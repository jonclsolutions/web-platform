/**
 * @file auth.service.ts
 * @path src/app/core/auth/auth.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Core authentication service managing login, session persistence, token lifecycle, and user authorization state.
 * @dependencies
 * - HttpClient: Facilitates API communication for authentication endpoints.
 * - PermissionService: Synchronizes user permissions within the application.
 * - GenericTableService: Invalidates the table cache when the logged-in user changes - no
 *   circular dependency, GenericTableService does not depend on AuthService.
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, of, throwError, timer, Subject } from 'rxjs';
import { tap, catchError, switchMap, takeUntil, map } from 'rxjs/operators';
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

@Injectable({ providedIn: 'root' })
export class AuthService {
  private baseUrl = environment.base_api_url;

  private _isLoggedIn = new BehaviorSubject<boolean>(!!sessionStorage.getItem('accessToken'));
  public isLoggedIn$ = this._isLoggedIn.asObservable();

  private _userEmailSubject = new BehaviorSubject<string | null>(sessionStorage.getItem('userEmail'));
  public userEmail$ = this._userEmailSubject.asObservable();

  private stopTokenRefresh$ = new Subject<void>();
  private readonly REFRESH_INTERVAL = 20 * 60 * 1000;

  constructor(
    private http: HttpClient,
    private permissionService: PermissionService,
    private genericTableService: GenericTableService
  ) {
    if (this.getAccessToken()) {
      this.startTokenRefreshTimer();
      this.syncPermissions();
    }
  }

  /**
   * @description Step 1 of the login: verifies the password (+ captcha when the backend asked for it).
   * @param credentials E-mail, password and optional captcha_token.
   * @returns {Observable<any>} Either the full session (token / refreshToken / user), or a
   * `LoginTwoFactorChallenge` ({ requires_2fa: true, login_token, ... }) - in THAT case NOTHING
   * is stored in sessionStorage, the session is created only after verifyTwoFactor().
   */
  login(credentials: { email: string; password: string; captcha_token?: string }): Observable<any> {
    return this.http.post<ApiEnvelope<any>>(`${this.baseUrl}/login`, credentials).pipe(
      map(res => res.data),
      tap((response: any) => {
        if (response?.requires_2fa) {
          // Pending 2FA state - deliberately NOT persisted anywhere.
          return;
        }
        this.persistSession(response);
      }),
      catchError(this.handleLoginError)
    );
  }

  /**
   * @description Step 2 of the login (only when login() returned requires_2fa): verifies the OTP
   * code and only on success creates the real session.
   * @param loginToken Opaque token from step 1 - kept ONLY in the memory of the calling
   * component, never in sessionStorage (see login.component.ts).
   * @param code 6-digit numeric code from the e-mail.
   */
  verifyTwoFactor(loginToken: string, code: string): Observable<any> {
    return this.http.post<ApiEnvelope<any>>(`${this.baseUrl}/login/verify-2fa`, { login_token: loginToken, code }).pipe(
      map(res => res.data),
      tap((response: any) => this.persistSession(response)),
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

  checkAuth(): Observable<boolean> {
    const token = this.getAccessToken();
    if (!token) {
      this._isLoggedIn.next(false);
      return of(false);
    }
    this._isLoggedIn.next(true);
    return of(true);
  }

  refreshAccessToken(): Observable<any> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      this.clearAuthData();
      return throwError(() => new Error('Refresh token missing'));
    }

    return this.http.post<ApiEnvelope<{ token: string; refreshToken: string }>>(`${this.baseUrl}/refresh`, { refreshToken }).pipe(
      map(res => res.data),
      tap(res => {
        sessionStorage.setItem('accessToken', res.token);
        sessionStorage.setItem('refreshToken', res.refreshToken);
        this._isLoggedIn.next(true);
      }),
      catchError(err => {
        this.clearAuthData();
        return throwError(() => err);
      })
    );
  }

  public clearAuthData(): void {
    sessionStorage.clear();
    this.permissionService.clearPermissions();
    this.genericTableService.invalidateAll();
    this._isLoggedIn.next(false);
    this._userEmailSubject.next(null);
    this.stopTokenRefreshTimer();
  }

  public getUserId(): string | null { return sessionStorage.getItem('userId'); }
  public getUserEmail(): string | null { return sessionStorage.getItem('userEmail'); }
  public getUserRole(): string | null { return sessionStorage.getItem('userRole'); }
  public getAccessToken(): string | null { return sessionStorage.getItem('accessToken'); }
  public getRefreshToken(): string | null { return sessionStorage.getItem('refreshToken'); }

  public getUserPermissions(): string[] {
    const perms = sessionStorage.getItem('userPermissions');
    return perms ? JSON.parse(perms) : [];
  }

  logout(): Observable<any> {
    const body = { refreshToken: this.getRefreshToken() };
    return this.http.post<any>(`${this.baseUrl}/logout`, body).pipe(
      tap(() => this.clearAuthData()),
      catchError(() => {
        this.clearAuthData();
        return of(null);
      })
    );
  }

  /**
   * @description Stores the full session (access / refresh token, user, role, permissions) in
   * sessionStorage. Shared by the direct login (no 2FA) and the completion of
   * verifyTwoFactor() - same logic, only a different entry endpoint.
   */
  private persistSession(response: any): void {
    const userId = (response.user.id || response.user.user_login_id).toString();

    sessionStorage.setItem('accessToken', response.token);
    sessionStorage.setItem('refreshToken', response.refreshToken);
    sessionStorage.setItem('userEmail', response.user.user_email);
    sessionStorage.setItem('userId', userId);

    if (response.user_roles?.length > 0) {
      sessionStorage.setItem('userRole', response.user_roles[0]);
    }

    if (response.user_permissions) {
      sessionStorage.setItem('userPermissions', JSON.stringify(response.user_permissions));
      this.permissionService.setPermissions(response.user_permissions);
    }

    this.genericTableService.invalidateAll();

    this._userEmailSubject.next(response.user.user_email);
    this._isLoggedIn.next(true);
    this.startTokenRefreshTimer();
  }

  private startTokenRefreshTimer(): void {
    this.stopTokenRefreshTimer();
    timer(this.REFRESH_INTERVAL, this.REFRESH_INTERVAL).pipe(
      switchMap(() => this.refreshAccessToken()),
      takeUntil(this.stopTokenRefresh$)
    ).subscribe();
  }

  private stopTokenRefreshTimer(): void {
    this.stopTokenRefresh$.next();
  }

  private syncPermissions(): void {
    const perms = this.getUserPermissions();
    this.permissionService.setPermissions(perms);
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