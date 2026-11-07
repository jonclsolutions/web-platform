/**
 * @file auth.service.ts
 * @path src/app/core/auth/auth.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Core authentication service managing login, session restore, token lifecycle, and user authorization state.
 * @security Nothing secret is stored by JavaScript. The access token (60 min) and the user's
 * profile, role and permissions live only in the memory of this service. The refresh token
 * (7 days) exists only in an HttpOnly / Secure / SameSite=Strict cookie that the API sets and only
 * the browser sends (to POST /api/refresh) - an XSS can therefore not read it and keep the account.
 * After a page reload the session is restored by one refresh call. The role and permissions only
 * shape the UI; the API checks every request itself.
 * @note The only value kept in localStorage is SESSION_HINT_KEY = "a session may exist" (no
 * token, no user data). It spares visitors without a session the refresh call on every page load.
 * @dependencies
 * - HttpClient: Facilitates API communication for authentication endpoints.
 * - PermissionService: Synchronizes user permissions within the application.
 * - GenericTableService: Invalidates the table cache when the logged-in user changes - no
 *   circular dependency, GenericTableService does not depend on AuthService.
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, of, throwError, timer, Subject } from 'rxjs';
import { tap, catchError, switchMap, takeUntil, map, finalize, shareReplay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../../shared/interfaces/api-envelope';
import { PermissionService } from './services/permission.service';
import { GenericTableService } from '../services/generic-table.service';

/** Translation key (login.errors.*) of an auth error the backend sent no message for. */
export type AuthErrorKey = 'too_many_attempts' | 'login_failed' | 'verification_failed' | 'request_failed';

/** Auth error: `message` = backend message ('' when none), `messageKey` = fallback text key. */
export interface AuthError extends Error {
  messageKey?: AuthErrorKey;
}

/** Login error extended with whether a captcha is required from now on. */
export interface LoginError extends AuthError {
  captchaRequired?: boolean;
}

/** Error of the 2FA endpoints extended with the time (seconds) after which a resend is allowed again. */
export interface TwoFactorError extends AuthError {
  retryAfter?: number;
}

/**
 * @description Builds an AuthError from the backend message or the fallback key.
 * @param backendMessage `error.error.message` of the API (may be missing).
 * @param fallbackKey Key used when the backend sent no message.
 * @returns Error with `message` (backend text or '') and `messageKey` (only without backend text).
 */
function authError(backendMessage: unknown, fallbackKey: AuthErrorKey): AuthError {
  const message = typeof backendMessage === 'string' ? backendMessage : '';
  const err: AuthError = new Error(message);
  if (!message) {
    err.messageKey = fallbackKey;
  }
  return err;
}

/** Session answer of /login, /login/verify-2fa and /refresh (the refresh token is only in the cookie). */
export interface AuthSessionResponse {
  token: string;
  user: { id?: number | string; user_login_id?: number | string; user_email: string };
  user_roles?: string[];
  user_permissions?: string[];
}

/** In-memory state of the signed-in user. */
interface SessionState {
  accessToken: string;
  userId: string;
  email: string;
  role: string | null;
  permissions: string[];
}

/** localStorage key of the "a session may exist" hint - holds no token and no user data. */
export const SESSION_HINT_KEY = 'jsw_session_hint';

/** Name of the Web Lock that serializes refresh calls of all tabs (they share the refresh cookie). */
const REFRESH_LOCK_NAME = 'jsw-auth-refresh';

/** Minimal shape of the Web Locks API (navigator.locks) used here. */
export interface RefreshLockManager {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private baseUrl = environment.base_api_url;

  /** Session of the signed-in user - memory only (see the file header). */
  private session: SessionState | null = null;

  private _isLoggedIn = new BehaviorSubject<boolean>(false);
  public isLoggedIn$ = this._isLoggedIn.asObservable();

  private _userEmailSubject = new BehaviorSubject<string | null>(null);
  public userEmail$ = this._userEmailSubject.asObservable();

  private stopTokenRefresh$ = new Subject<void>();
  private readonly REFRESH_INTERVAL = 20 * 60 * 1000;

  /** Running refresh call - every caller (timer, interceptor, restore) shares one request. */
  private refreshInFlight$: Observable<AuthSessionResponse> | null = null;

  /**
   * Web Locks of the browser: the tabs share one refresh cookie and every refresh rotates it, so
   * two tabs must never refresh at the same moment (the second would send the already used
   * token). Null where the API does not exist (and in the unit tests).
   */
  public lockManager: RefreshLockManager | null =
    (typeof navigator !== 'undefined' && (navigator as any).locks) ? (navigator as any).locks : null;

  constructor(
    private http: HttpClient,
    private permissionService: PermissionService,
    private genericTableService: GenericTableService
  ) {
    // Leftovers of the former sessionStorage session (tokens, user data) - removed for good.
    this.removeLegacyStorage();
  }

  /**
   * @description Step 1 of the login: verifies the password (+ captcha when the backend asked for it).
   * @param credentials E-mail, password and optional captcha_token.
   * @returns {Observable<any>} Either the session (token / user, the refresh token arrives as an
   * HttpOnly cookie), or a `LoginTwoFactorChallenge` ({ requires_2fa: true, login_token, ... }) -
   * in THAT case no session starts, it is created only after verifyTwoFactor().
   */
  login(credentials: { email: string; password: string; captcha_token?: string }): Observable<any> {
    return this.http.post<ApiEnvelope<any>>(`${this.baseUrl}/login`, credentials, { withCredentials: true }).pipe(
      map(res => res.data),
      tap((response: any) => {
        if (response?.requires_2fa) {
          // Pending 2FA state - deliberately NOT kept anywhere.
          return;
        }
        this.startSession(response);
      }),
      catchError(this.handleLoginError)
    );
  }

  /**
   * @description Step 2 of the login (only when login() returned requires_2fa): verifies the OTP
   * code and only on success creates the real session.
   * @param loginToken Opaque token from step 1 - kept ONLY in the memory of the calling
   * component (see login.component.ts).
   * @param code 6-digit numeric code from the e-mail.
   */
  verifyTwoFactor(loginToken: string, code: string): Observable<any> {
    return this.http.post<ApiEnvelope<any>>(`${this.baseUrl}/login/verify-2fa`, { login_token: loginToken, code }, { withCredentials: true }).pipe(
      map(res => res.data),
      tap((response: any) => this.startSession(response)),
      catchError(this.handleTwoFactorError)
    );
  }

  /**
   * @description Requests a new OTP code for the running pending 2FA session. The backend has its
   * own cooldown (60 s) and a resend cap - a 429 answer contains `retry_after`.
   */
  resendTwoFactor(loginToken: string): Observable<{ expires_in: number }> {
    return this.http.post<ApiEnvelope<{ expires_in: number }>>(`${this.baseUrl}/login/resend-2fa`, { login_token: loginToken }).pipe(
      map(res => res.data),
      catchError(this.handleTwoFactorError)
    );
  }

  /**
   * @description Requests a password reset link for the given email (step 1 of the recovery flow).
   */
  requestPasswordReset(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/forgot-password`, { email }).pipe(
      catchError(this.handlePasswordResetError)
    );
  }

  resetPassword(
    token: string,
    password: string,
    passwordConfirmation: string
  ): Observable<{ email?: string }> {
    return this.http.post<ApiEnvelope<{ email?: string }>>(`${this.baseUrl}/reset-password`, {
      token,
      password,
      password_confirmation: passwordConfirmation
    }).pipe(
      map(res => res.data),
      catchError(this.handlePasswordResetError)
    );
  }

  /**
   * @description Whether a user is signed in. After a page reload the memory is empty: when the
   * session hint says a session may exist, the session is restored with one refresh call (the
   * refresh cookie); without the hint nobody is signed in and no request is made.
   * @returns {Observable<boolean>}
   */
  checkAuth(): Observable<boolean> {
    if (this.session) {
      this._isLoggedIn.next(true);
      return of(true);
    }
    if (!this.hasSessionHint()) {
      this._isLoggedIn.next(false);
      return of(false);
    }
    return this.refreshAccessToken().pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  /**
   * @description Rotates the refresh cookie and gets a new access token together with the user's
   * profile, role and permissions (POST /refresh with credentials). Concurrent callers share one
   * request; the tabs of the browser take turns through a Web Lock.
   * @returns {Observable<AuthSessionResponse>} The new session; on failure the session is cleared.
   */
  refreshAccessToken(): Observable<AuthSessionResponse> {
    if (!this.refreshInFlight$) {
      this.refreshInFlight$ = this.exclusive(() =>
        this.http.post<ApiEnvelope<AuthSessionResponse>>(`${this.baseUrl}/refresh`, {}, { withCredentials: true }).pipe(map(res => res.data))
      ).pipe(
        tap(res => this.startSession(res)),
        catchError(err => {
          this.clearAuthData();
          return throwError(() => err);
        }),
        finalize(() => { this.refreshInFlight$ = null; }),
        shareReplay({ bufferSize: 1, refCount: false })
      );
    }
    return this.refreshInFlight$;
  }

  public clearAuthData(): void {
    this.session = null;
    this.setSessionHint(false);
    this.permissionService.clearPermissions();
    this.genericTableService.setCurrentUser(null);
    this.genericTableService.invalidateAll();
    this._isLoggedIn.next(false);
    this._userEmailSubject.next(null);
    this.stopTokenRefreshTimer();
  }

  public getUserId(): string | null { return this.session?.userId ?? null; }
  public getUserEmail(): string | null { return this.session?.email ?? null; }
  public getUserRole(): string | null { return this.session?.role ?? null; }
  public getAccessToken(): string | null { return this.session?.accessToken ?? null; }

  public getUserPermissions(): string[] {
    return this.session ? [...this.session.permissions] : [];
  }

  /**
   * @description Ends the session on the server (all tokens of the user, refresh cookie deleted)
   * and locally - also when the server cannot be reached.
   */
  logout(): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/logout`, {}, { withCredentials: true }).pipe(
      tap(() => this.clearAuthData()),
      catchError(() => {
        this.clearAuthData();
        return of(null);
      })
    );
  }

  /**
   * @description Starts (or renews) the in-memory session from a login / 2FA / refresh answer.
   * Shared by the direct login, the finished 2FA verification and every refresh.
   */
  private startSession(response: AuthSessionResponse): void {
    const userId = String(response.user.id ?? response.user.user_login_id);
    const changedUser = this.session?.userId !== userId;
    const permissions = response.user_permissions ?? [];

    this.session = {
      accessToken: response.token,
      userId,
      email: response.user.user_email,
      role: response.user_roles?.length ? response.user_roles[0] : null,
      permissions,
    };
    this.setSessionHint(true);
    this.permissionService.setPermissions(permissions);

    if (changedUser) {
      this.genericTableService.invalidateAll();
    }
    this.genericTableService.setCurrentUser(userId);

    this._userEmailSubject.next(this.session.email);
    this._isLoggedIn.next(true);
    this.startTokenRefreshTimer();
  }

  private startTokenRefreshTimer(): void {
    this.stopTokenRefreshTimer();
    // A failed refresh ends the session (clearAuthData), which also stops this timer.
    timer(this.REFRESH_INTERVAL, this.REFRESH_INTERVAL).pipe(
      switchMap(() => this.refreshAccessToken()),
      takeUntil(this.stopTokenRefresh$)
    ).subscribe();
  }

  private stopTokenRefreshTimer(): void {
    this.stopTokenRefresh$.next();
  }

  /**
   * @description Runs the request under the refresh Web Lock when the browser has one.
   * @param work Request to run (subscribed only once the lock is held).
   * @returns {Observable<T>} Result of the request.
   */
  private exclusive<T>(work: () => Observable<T>): Observable<T> {
    const locks = this.lockManager;
    if (!locks) {
      return work();
    }
    return new Observable<T>(subscriber => {
      locks.request(REFRESH_LOCK_NAME, () => new Promise<void>(release => {
        work().subscribe({
          next: value => subscriber.next(value),
          error: err => { release(); subscriber.error(err); },
          complete: () => { release(); subscriber.complete(); },
        });
      })).catch(err => subscriber.error(err));
    });
  }

  /** @description Whether a session may exist (set at its start, removed when it ends). */
  private hasSessionHint(): boolean {
    try {
      return localStorage.getItem(SESSION_HINT_KEY) === '1';
    } catch {
      return false;
    }
  }

  /** @description Sets / removes the session hint (storage blocked = no hint, harmless). */
  private setSessionHint(on: boolean): void {
    try {
      if (on) {
        localStorage.setItem(SESSION_HINT_KEY, '1');
      } else {
        localStorage.removeItem(SESSION_HINT_KEY);
      }
    } catch {
      // Storage unavailable (private mode) - only the restore after a reload is lost.
    }
  }

  /** @description Deletes the session keys the former versions kept in sessionStorage and the former session hint. */
  private removeLegacyStorage(): void {
    try {
      ['accessToken', 'refreshToken', 'userId', 'userEmail', 'userRole', 'userPermissions']
        .forEach(key => sessionStorage.removeItem(key));
      // Session hint under the former brand-specific key (its refresh cookie was renamed too).
      localStorage.removeItem('rpsw_session_hint');
    } catch {
      // Storage unavailable - nothing to remove.
    }
  }

  /**
   * @description Maps /login errors to a user message and passes on the `captcha_required` flag
   * of the backend, so the component knows when to show the widget.
   */
  private handleLoginError = (error: HttpErrorResponse) => {
    const err: LoginError = authError(error.error?.message, error.status === 429 ? 'too_many_attempts' : 'login_failed');
    err.captchaRequired = !!error.error?.captcha_required;
    return throwError(() => err);
  };

  /**
   * @description Maps the /login/verify-2fa and /login/resend-2fa errors, passes on `retry_after`
   * (seconds) of a 429 answer for the countdown of the resend button.
   */
  private handleTwoFactorError = (error: HttpErrorResponse) => {
    const err: TwoFactorError = authError(error.error?.message, 'verification_failed');
    if (error.status === 429 && error.error?.retry_after) {
      err.retryAfter = Number(error.error.retry_after);
    }
    return throwError(() => err);
  };

  private handlePasswordResetError(error: HttpErrorResponse) {
    // 429 always uses the own text (the throttle message of the API is generic).
    return throwError(() => error.status === 429
      ? authError(undefined, 'too_many_attempts')
      : authError(error.error?.message, 'request_failed'));
  }
}