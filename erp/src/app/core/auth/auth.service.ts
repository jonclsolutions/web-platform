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
 * @note Several accounts per browser: every account has its own refresh cookie (jsw_refresh_{slot},
 * the slot is derived from the account by the API). A tab works with ONE account - the slot of that
 * account is kept in the tab's sessionStorage (SESSION_SLOT_KEY, survives its reload) and sent with
 * every refresh (header SESSION_SLOT_HEADER); the API refuses a slot of another account. Other tabs
 * may be signed in as other accounts at the same time - a login, a switch or a logout in one tab
 * never changes the account of another tab.
 * @note The login page is never skipped: it offers the account of the tab and the accounts
 * remembered with "Remember me" ("Continue as ...", one click, no password) next to the form for
 * another account. Only an ADMIN address opened in a tab without its own account (a new tab, a
 * pasted link) opens with a remembered account - the last used one (LAST_ACCOUNT_KEY), or the only
 * one; otherwise the login page is shown.
 * @note Values kept in the browser (no token, no user data):
 * - SESSION_SLOT_KEY (sessionStorage): the account of this tab - restored after its reload.
 * - SESSION_HINT_KEY (localStorage): "accounts remembered with 'Remember me' may exist". Only then
 *   the API is asked for them (POST /refresh/accounts) - visitors without it make no request.
 * - LAST_ACCOUNT_KEY (localStorage): slot of the remembered account used last (no user data). A login without "Remember me" is never offered - it belongs to its tab only. The same
 *   key in sessionStorage is the hint of the former single-cookie version (its cookie is migrated
 *   on the first refresh).
 * @note A logout ends the account in every tab signed in as it (BroadcastChannel SESSION_CHANNEL_NAME,
 * those tabs reload to the login page); tabs of other accounts keep working.
 * @dependencies
 * - HttpClient: Facilitates API communication for authentication endpoints.
 * - PermissionService: Synchronizes user permissions within the application.
 * - GenericTableService: Invalidates the table cache when the logged-in user changes - no
 *   circular dependency, GenericTableService does not depend on AuthService.
 */

import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, NEVER, of, throwError, timer, Subject, distinctUntilChanged } from 'rxjs';
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
  /** Slot of the account's refresh cookie - this tab sends it with every refresh. */
  session_slot?: string;
  token: string;
  user: { id?: number | string; user_login_id?: number | string; user_email: string; avatar_url?: string | null };
  user_roles?: string[];
  user_permissions?: string[];
  /** "Remember me" of the login (also on every refresh) - where the session hint is kept. */
  remember?: boolean;
}

/** In-memory state of the signed-in user. */
interface SessionState {
  accessToken: string;
  userId: string;
  email: string;
  role: string | null;
  permissions: string[];
}

/** Account remembered in this browser (POST /refresh/accounts) - offered on the login page. */
export interface RememberedAccount {
  /** Slot of its refresh cookie (null = the single cookie of the former version). */
  slot: string | null;
  user_email: string;
  full_name?: string | null;
  avatar_url?: string | null;
}

/**
 * Key of the "remembered accounts may exist" hint in localStorage (see the file header) - holds no
 * token and no user data.
 */
export const SESSION_HINT_KEY = 'jsw_session_hint';

/** localStorage key of the slot of the remembered account used last - see the file header. */
export const LAST_ACCOUNT_KEY = 'jsw_last_account';

/** sessionStorage key of the account (refresh cookie slot) of this tab - see the file header. */
export const SESSION_SLOT_KEY = 'jsw_session_slot';

/** Request header that names the refresh cookie (account) a refresh is for. */
export const SESSION_SLOT_HEADER = 'X-Session-Slot';

/**
 * Prefix of the Web Lock that serializes the refresh calls of one account: its tabs share one
 * refresh cookie, which every refresh rotates.
 */
const REFRESH_LOCK_NAME = 'jsw-auth-refresh';

/** Name of the BroadcastChannel that tells the other tabs about a logout in this browser. */
export const SESSION_CHANNEL_NAME = 'jsw-auth-session';

/** Message of the session channel: the account that logged out. */
export type SessionMessage = { type: 'logout'; userId: string };

/** Minimal shape of the BroadcastChannel used here (replaceable in the unit tests). */
export interface SessionChannel {
  postMessage(message: SessionMessage): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  close(): void;
}

/** Minimal shape of the Web Locks API (navigator.locks) used here. */
export interface RefreshLockManager {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
}

@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
  private baseUrl = environment.base_api_url;

  /** Session of the signed-in user - memory only (see the file header). */
  private session: SessionState | null = null;

  private _isLoggedIn = new BehaviorSubject<boolean>(false);
  public isLoggedIn$ = this._isLoggedIn.asObservable();

  private _userEmailSubject = new BehaviorSubject<string | null>(null);
  public userEmail$ = this._userEmailSubject.asObservable();

  /** Signed URL of the own profile photo (null = the default image) - shown in the admin header. */
  private _avatarUrlSubject = new BehaviorSubject<string | null>(null);
  public avatarUrl$ = this._avatarUrlSubject.pipe(distinctUntilChanged());

  private stopTokenRefresh$ = new Subject<void>();
  private readonly REFRESH_INTERVAL = 20 * 60 * 1000;

  /** Running refresh calls per slot - every caller (timer, interceptor, restore) shares one request. */
  private refreshInFlight = new Map<string, Observable<AuthSessionResponse>>();

  /**
   * Web Locks of the browser: the tabs of one account share its refresh cookie and every refresh
   * rotates it, so two of them must never refresh at the same moment (the second would send the
   * already used token). Null where the API does not exist (and in the unit tests).
   */
  public lockManager: RefreshLockManager | null =
    (typeof navigator !== 'undefined' && (navigator as any).locks) ? (navigator as any).locks : null;

  /**
   * Channel to the other tabs of this browser (see the file header). Null where BroadcastChannel
   * does not exist - the tabs then rely on the refresh check only.
   */
  public sessionChannel: SessionChannel | null =
    typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(SESSION_CHANNEL_NAME) : null;

  /** Reloads the page - a property so that the unit tests can replace it. */
  public reloadPage: () => void = () => window.location.reload();

  constructor(
    private http: HttpClient,
    private permissionService: PermissionService,
    private genericTableService: GenericTableService
  ) {
    // Leftovers of the former sessionStorage session (tokens, user data) - removed for good.
    this.removeLegacyStorage();
    this.sessionChannel?.addEventListener('message', event => this.onSessionMessage(event.data));
  }

  ngOnDestroy(): void {
    this.sessionChannel?.close();
  }

  /**
   * @description Reacts to a logout in another tab: a tab signed in as THAT account reloads (its
   *   session no longer exists - it shows the login page). Tabs of other accounts and tabs without
   *   a session are left alone.
   * @param message Message of the session channel.
   */
  private onSessionMessage(message: SessionMessage | null): void {
    if (!this.session || message?.type !== 'logout') return;
    if (message.userId === this.session.userId) {
      this.reloadPage();
    }
  }

  /** @description Tells the other tabs about a logout (no-op without the channel). */
  private announce(message: SessionMessage): void {
    try {
      this.sessionChannel?.postMessage(message);
    } catch {
      // A closed channel (page being left) - nothing to tell.
    }
  }

  /**
   * @description Step 1 of the login: verifies the password (+ captcha when the backend asked for it).
   * @param credentials E-mail, password and optional captcha_token.
   * @returns {Observable<any>} Either the session (token / user, the refresh token arrives as an
   * HttpOnly cookie), or a `LoginTwoFactorChallenge` ({ requires_2fa: true, login_token, ... }) -
   * in THAT case no session starts, it is created only after verifyTwoFactor().
   */
  login(credentials: { email: string; password: string; captcha_token?: string; remember?: boolean }): Observable<any> {
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
   * @param remember "Remember me" of the login form (sent again with the code).
   */
  verifyTwoFactor(loginToken: string, code: string, remember = false): Observable<any> {
    return this.http.post<ApiEnvelope<any>>(`${this.baseUrl}/login/verify-2fa`, { login_token: loginToken, code, remember }, { withCredentials: true }).pipe(
      map(res => res.data),
      tap((response: any) => {
        this.startSession(response);
      }),
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
   * @description Whether a user is signed in. After a page reload the memory is empty: the tab's
   * own account is restored with one refresh call (its slot). A tab without one - a new tab, or
   * after a logout / expiry - is not signed in, unless `resumeRemembered` is set (an admin address
   * was opened): then the last used remembered account is signed in, or the only one; with several
   * and none used last the answer is false (the login page offers them).
   * @param resumeRemembered Sign a tab without its own account in with a remembered one (AuthGuard).
   * @returns {Observable<boolean>}
   */
  checkAuth(resumeRemembered = false): Observable<boolean> {
    if (this.session) {
      this._isLoggedIn.next(true);
      return of(true);
    }
    const slot = this.tabSlot();
    if (slot !== null || this.hasLegacyTabHint()) {
      return this.restore(slot);
    }
    if (resumeRemembered && this.hasRememberedHint()) {
      return this.rememberedAccounts().pipe(
        switchMap(accounts => {
          const last = this.readLocal(LAST_ACCOUNT_KEY);
          const chosen = accounts.find(a => a.slot !== null && a.slot === last) ?? (accounts.length === 1 ? accounts[0] : null);
          if (chosen) {
            return this.restore(chosen.slot);
          }
          this._isLoggedIn.next(false);
          return of(false);
        })
      );
    }
    this._isLoggedIn.next(false);
    return of(false);
  }

  /**
   * @description Accounts remembered in this browser ("Remember me", not logged out) - for the
   * account chooser of the login page. No request without the hint; an empty answer removes it.
   * @returns {Observable<RememberedAccount[]>} The accounts ([] also when the call fails).
   */
  rememberedAccounts(): Observable<RememberedAccount[]> {
    if (!this.hasRememberedHint()) {
      return of([]);
    }
    return this.http.post<ApiEnvelope<RememberedAccount[]>>(`${this.baseUrl}/refresh/accounts`, {}, { withCredentials: true }).pipe(
      map(res => Array.isArray(res.data) ? res.data : []),
      tap(accounts => {
        if (!accounts.length) this.setRememberedHint(false);
      }),
      catchError(() => of([]))
    );
  }

  /**
   * @description Signs this tab in as a remembered account (the chooser of the login page) - the
   * tab's previous account, if any, stays signed in for its other tabs.
   * @param slot Slot of the account (RememberedAccount.slot).
   * @returns {Observable<AuthSessionResponse>} The new session (error = the account is no longer remembered).
   */
  resumeAccount(slot: string | null): Observable<AuthSessionResponse> {
    return this.refreshAccessToken(slot);
  }

  /**
   * @description Rotates the account's refresh cookie and gets a new access token together with
   * the user's profile, role and permissions (POST /refresh with credentials and the slot header).
   * Concurrent callers of one account share one request; its tabs take turns through a Web Lock.
   * @param slot Account to refresh - this tab's one by default (null = the cookie of the former version).
   * @returns {Observable<AuthSessionResponse>} The new session; on failure this tab's session is cleared.
   */
  refreshAccessToken(slot: string | null = this.tabSlot()): Observable<AuthSessionResponse> {
    const key = slot ?? '';
    let inFlight = this.refreshInFlight.get(key);
    if (!inFlight) {
      const headers: Record<string, string> = slot ? { [SESSION_SLOT_HEADER]: slot } : {};
      inFlight = this.exclusive(`${REFRESH_LOCK_NAME}:${slot ?? 'legacy'}`, () =>
        this.http.post<ApiEnvelope<AuthSessionResponse>>(`${this.baseUrl}/refresh`, {}, { withCredentials: true, headers }).pipe(map(res => res.data))
      ).pipe(
        // The former single cookie (no slot) answered for another account than this tab has:
        // never continue as that account here - reload and show the real state.
        switchMap(res => {
          if (!slot && this.session && String(res.user.id ?? res.user.user_login_id) !== this.session.userId) {
            this.reloadPage();
            return NEVER;
          }
          return of(res);
        }),
        tap(res => this.startSession(res)),
        catchError(err => {
          // A failed switch to another account leaves this tab's own session alone.
          if (!this.session || slot === this.tabSlot()) {
            this.clearAuthData();
          }
          return throwError(() => err);
        }),
        finalize(() => this.refreshInFlight.delete(key)),
        shareReplay({ bufferSize: 1, refCount: false })
      );
      this.refreshInFlight.set(key, inFlight);
    }
    return inFlight;
  }

  /**
   * @description Ends the session of THIS tab (memory and its slot). Remembered accounts and other
   * tabs are not touched.
   */
  public clearAuthData(): void {
    this.session = null;
    this.setTabSlot(null);
    this.permissionService.clearPermissions();
    this.genericTableService.setCurrentUser(null);
    this.genericTableService.invalidateAll();
    this._isLoggedIn.next(false);
    this._userEmailSubject.next(null);
    this._avatarUrlSubject.next(null);
    this.stopTokenRefreshTimer();
  }

  public getUserId(): string | null { return this.session?.userId ?? null; }
  public getUserEmail(): string | null { return this.session?.email ?? null; }
  public getUserRole(): string | null { return this.session?.role ?? null; }
  public getAccessToken(): string | null { return this.session?.accessToken ?? null; }
  /** Signed URL of the own profile photo (null = the default image). */
  public getAvatarUrl(): string | null { return this.session ? this._avatarUrlSubject.value : null; }

  /**
   * @description Shows a changed own profile photo at once (the next refresh brings the same URL).
   * @param url New signed URL, null after the removal.
   */
  public setAvatarUrl(url: string | null): void {
    this._avatarUrlSubject.next(url);
  }

  public getUserPermissions(): string[] {
    return this.session ? [...this.session.permissions] : [];
  }

  /**
   * @description Ends the account of this tab on the server (its tokens, its refresh cookie
   * deleted) and locally - also when the server cannot be reached. After a successful logout the
   * other tabs of the same account are told (they reload to the login page); other accounts of
   * this browser stay signed in.
   */
  logout(): Observable<any> {
    const userId = this.session?.userId;
    const slot = this.tabSlot();
    if (slot && this.readLocal(LAST_ACCOUNT_KEY) === slot) {
      this.writeLocal(LAST_ACCOUNT_KEY, null);
    }
    return this.http.post<any>(`${this.baseUrl}/logout`, {}, { withCredentials: true }).pipe(
      tap(() => {
        this.clearAuthData();
        if (userId) this.announce({ type: 'logout', userId });
      }),
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
    this.setTabSlot(response.session_slot ?? null);
    if (response.remember ?? true) {
      this.setRememberedHint(true);
      if (response.session_slot) this.writeLocal(LAST_ACCOUNT_KEY, response.session_slot);
    }
    this.permissionService.setPermissions(permissions);

    if (changedUser) {
      this.genericTableService.invalidateAll();
    }
    this.genericTableService.setCurrentUser(userId);

    this._userEmailSubject.next(this.session.email);
    this._avatarUrlSubject.next(response.user.avatar_url ?? null);
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
   * @description Runs the request under a Web Lock when the browser has one.
   * @param lockName Name of the lock (one per account).
   * @param work Request to run (subscribed only once the lock is held).
   * @returns {Observable<T>} Result of the request.
   */
  private exclusive<T>(lockName: string, work: () => Observable<T>): Observable<T> {
    const locks = this.lockManager;
    if (!locks) {
      return work();
    }
    return new Observable<T>(subscriber => {
      locks.request(lockName, () => new Promise<void>(release => {
        work().subscribe({
          next: value => subscriber.next(value),
          error: err => { release(); subscriber.error(err); },
          complete: () => { release(); subscriber.complete(); },
        });
      })).catch(err => subscriber.error(err));
    });
  }

  /** @description Slot of this tab's account (null = none). */
  private tabSlot(): string | null {
    try {
      return sessionStorage.getItem(SESSION_SLOT_KEY) || null;
    } catch {
      return null;
    }
  }

  /**
   * @description Stores the account of this tab (storage blocked = harmless, only the restore
   * after a reload is lost). Also removes the hint of the former single-cookie version.
   * @param slot Slot of the account; null = none (removed).
   */
  private setTabSlot(slot: string | null): void {
    try {
      sessionStorage.removeItem(SESSION_HINT_KEY);
      if (slot === null) {
        sessionStorage.removeItem(SESSION_SLOT_KEY);
      } else {
        sessionStorage.setItem(SESSION_SLOT_KEY, slot);
      }
    } catch {
      // Storage unavailable (private mode).
    }
  }

  /** @description Whether this tab has the session hint of the former single-cookie version. */
  private hasLegacyTabHint(): boolean {
    try {
      return sessionStorage.getItem(SESSION_HINT_KEY) === '1';
    } catch {
      return false;
    }
  }

  /** @description Whether accounts remembered in this browser may exist. */
  private hasRememberedHint(): boolean {
    try {
      return localStorage.getItem(SESSION_HINT_KEY) === '1';
    } catch {
      return false;
    }
  }

  /**
   * @description Sets / removes the "remembered accounts may exist" hint (storage blocked = no hint).
   * @param on A remembered login happened (true) or none is left (false).
   */
  private setRememberedHint(on: boolean): void {
    this.writeLocal(SESSION_HINT_KEY, on ? '1' : null);
    if (!on) this.writeLocal(LAST_ACCOUNT_KEY, null);
  }

  /**
   * @description Reads a localStorage value (storage blocked = null).
   * @param key Key to read.
   * @returns {string | null} The value.
   */
  private readLocal(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  /**
   * @description Writes / removes a localStorage value (storage blocked = harmless: only the
   *   chooser of the login page and the remembered sign-in of admin addresses are lost).
   * @param key Key to write.
   * @param value Value; null removes the key.
   */
  private writeLocal(key: string, value: string | null): void {
    try {
      if (value === null) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, value);
      }
    } catch {
      // Storage unavailable (private mode).
    }
  }

  /**
   * @description Restores a session with one refresh call.
   * @param slot Account to restore (null = the cookie of the former version).
   * @returns {Observable<boolean>} Whether the tab is now signed in.
   */
  private restore(slot: string | null): Observable<boolean> {
    return this.refreshAccessToken(slot).pipe(
      map(() => true),
      catchError(() => of(false))
    );
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