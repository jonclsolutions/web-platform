/**
 * @file auth.service.spec.ts
 * @path src/app/core/auth/auth.service.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of AuthService - the session of the admin lives only in memory, the
 *   refresh token only in the HttpOnly cookie of the API: login / 2FA start the session, nothing
 *   secret reaches sessionStorage / localStorage (only the "session may exist" hint), the session
 *   is restored after a reload by one refresh call, concurrent refreshes share one request and run
 *   under the Web Lock of the tabs, logout ends it; error mapping of login / 2FA / password reset.
 * @note `startTokenRefreshTimer()` creates an endless 20-minute `timer(...)`: fakeAsync tests that
 *   start it stop it with `clearAuthData()` and `discardPeriodicTasks()`.
 * @note `lockManager` is set to null (no Web Lock) so the requests start synchronously; one test
 *   checks the lock with a fake lock manager.
 * @dependencies
 * - HttpTestingController; PermissionService spy; the real GenericTableService (spied).
 */

import { TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService, AuthSessionResponse, RefreshLockManager, SESSION_HINT_KEY } from './auth.service';
import { PermissionService } from './services/permission.service';
import { GenericTableService } from '../services/generic-table.service';
import { environment } from '../../../environments/environment';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let tables: GenericTableService;
  let permissionServiceMock: { setPermissions: jasmine.Spy; clearPermissions: jasmine.Spy };
  const baseUrl = environment.base_api_url;

  /** Session answer of the API (the refresh token is only in the cookie, never here). */
  const session = (overrides: Partial<AuthSessionResponse> = {}): AuthSessionResponse => ({
    token: 'access-1',
    user: { id: 42, user_email: 'a@b.cz' },
    user_roles: ['admin', 'editor'],
    user_permissions: ['view-web', 'view-eshop'],
    ...overrides,
  });

  /** Creates the service (after the storage of the test is prepared) without Web Lock. */
  function createService(): void {
    service = TestBed.inject(AuthService);
    service.lockManager = null;
    httpMock = TestBed.inject(HttpTestingController);
    tables = TestBed.inject(GenericTableService);
  }

  /** Logs in directly (no 2FA) with the given answer. */
  function logIn(response: AuthSessionResponse = session()): void {
    service.login({ email: 'a@b.cz', password: 'p' }).subscribe();
    httpMock.expectOne(`${baseUrl}/login`).flush({ data: response });
  }

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.removeItem(SESSION_HINT_KEY);
    permissionServiceMock = {
      setPermissions: jasmine.createSpy('setPermissions'),
      clearPermissions: jasmine.createSpy('clearPermissions'),
    };
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: PermissionService, useValue: permissionServiceMock }],
    });
  });

  afterEach(() => {
    httpMock?.verify();
    sessionStorage.clear();
    localStorage.removeItem(SESSION_HINT_KEY);
  });

  describe('start', () => {
    /**
     * @description A new instance is logged out and reads no session from any storage; the
     *   tokens / user data former versions kept in sessionStorage are deleted.
     * @input sessionStorage with accessToken, refreshToken, userId, userEmail, userRole,
     *   userPermissions and an unrelated key.
     * @output isLoggedIn$ false, userEmail$ null, no token; the six keys removed, the unrelated
     *   key kept; no permissions set; no refresh after 20 minutes.
     */
    it('starts logged out and removes the former sessionStorage session', fakeAsync(() => {
      ['accessToken', 'refreshToken', 'userId', 'userEmail', 'userRole', 'userPermissions'].forEach(k => sessionStorage.setItem(k, 'x'));
      sessionStorage.setItem('other', 'keep');
      createService();

      let loggedIn: boolean | undefined;
      let email: string | null | undefined;
      service.isLoggedIn$.subscribe(v => (loggedIn = v));
      service.userEmail$.subscribe(v => (email = v));
      expect<unknown[]>([loggedIn, email, service.getAccessToken(), service.getUserId()]).toEqual([false, null, null, null]);
      expect(sessionStorage.length).toBe(1);
      expect(sessionStorage.getItem('other')).toBe('keep');
      expect(permissionServiceMock.setPermissions).not.toHaveBeenCalled();

      tick(20 * 60 * 1000);
      httpMock.expectNone(`${baseUrl}/refresh`);
      discardPeriodicTasks();
    }));
  });

  describe('login', () => {
    beforeEach(() => createService());

    /**
     * @description Login posts the credentials with credentials (the API sets the refresh
     *   cookie); the session is kept in memory only - nothing in sessionStorage, only the hint.
     * @input login({email, password}) answered with the session (role admin, two permissions).
     * @output POST /login, withCredentials; token / id / email / role / permissions from memory;
     *   sessionStorage empty; localStorage hint '1'; permissions set; table cache bound to user 42.
     */
    it('starts the session in memory only', () => {
      const setUser = spyOn(tables, 'setCurrentUser').and.callThrough();
      const credentials = { email: 'a@b.cz', password: 'pass' };
      service.login(credentials).subscribe();

      const req = httpMock.expectOne(`${baseUrl}/login`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(credentials);
      expect(req.request.withCredentials).toBeTrue();
      req.flush({ data: session() });

      expect(service.getAccessToken()).toBe('access-1');
      expect(service.getUserId()).toBe('42');
      expect(service.getUserEmail()).toBe('a@b.cz');
      expect(service.getUserRole()).toBe('admin');
      expect(service.getUserPermissions()).toEqual(['view-web', 'view-eshop']);
      expect(sessionStorage.length).toBe(0);
      expect(localStorage.getItem(SESSION_HINT_KEY)).toBe('1');
      expect(permissionServiceMock.setPermissions).toHaveBeenCalledWith(['view-web', 'view-eshop']);
      expect(setUser).toHaveBeenCalledWith('42');
    });

    /**
     * @description Fallbacks: user_login_id when id is missing, no role for an empty / missing
     *   list, an empty permission list when missing; getUserPermissions returns a copy.
     * @input user {user_login_id: 99}, user_roles [] and no user_permissions.
     * @output id '99', role null, permissions [] (also set to PermissionService); mutating the
     *   returned array changes nothing.
     */
    it('uses the fallbacks of the answer', () => {
      logIn(session({ user: { user_login_id: 99, user_email: 'a@b.cz' }, user_roles: [], user_permissions: undefined }));
      expect<unknown[]>([service.getUserId(), service.getUserRole()]).toEqual(['99', null]);
      expect(service.getUserPermissions()).toEqual([]);
      expect(permissionServiceMock.setPermissions).toHaveBeenCalledWith([]);

      service.clearAuthData();
      logIn(session({ user_roles: undefined }));
      expect(service.getUserRole()).toBeNull();
      service.getUserPermissions().push('hack');
      expect(service.getUserPermissions()).toEqual(['view-web', 'view-eshop']);
      service.clearAuthData();
    });

    /**
     * @description The subjects follow the session; a failed login changes nothing.
     * @input Failed login (401); then a successful one.
     * @output isLoggedIn$ false and no hint after the failure; email 'a@b.cz' / true after success.
     */
    it('updates the subjects and ignores a failed login', () => {
      let email: string | null = null;
      let loggedIn = false;
      service.userEmail$.subscribe(v => (email = v));
      service.isLoggedIn$.subscribe(v => (loggedIn = v));

      service.login({ email: 'a@b.cz', password: 'wrong' }).subscribe({ error: () => {} });
      httpMock.expectOne(`${baseUrl}/login`).flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
      expect(loggedIn).toBeFalse();
      expect(localStorage.getItem(SESSION_HINT_KEY)).toBeNull();

      logIn();
      expect<unknown[]>([email, loggedIn]).toEqual(['a@b.cz', true]);
      service.clearAuthData();
    });

    /**
     * @description The refresh timer starts with the session and renews it every 20 minutes;
     *   a failed timed refresh ends the session without an unhandled error.
     * @input Login; tick 20 min → refresh answered with a new token; tick 20 min → refresh 401.
     * @output POST /refresh {} with the new token in memory; after the 401 logged out.
     */
    it('refreshes the session every 20 minutes', fakeAsync(() => {
      logIn();

      tick(20 * 60 * 1000);
      const refresh = httpMock.expectOne(`${baseUrl}/refresh`);
      expect(refresh.request.body).toEqual({});
      expect(refresh.request.withCredentials).toBeTrue();
      refresh.flush({ data: session({ token: 'access-2' }) });
      expect(service.getAccessToken()).toBe('access-2');

      tick(20 * 60 * 1000);
      httpMock.expectOne(`${baseUrl}/refresh`).flush({}, { status: 401, statusText: 'Unauthorized' });
      expect(service.getAccessToken()).toBeNull();
      discardPeriodicTasks();
    }));
  });

  describe('checkAuth (session restore after a reload)', () => {
    beforeEach(() => createService());

    /**
     * @description Without a session and without the hint nobody is logged in - no request is made
     *   (a public visitor causes no refresh call on every page).
     * @input No session, no hint.
     * @output false, isLoggedIn$ false, no request.
     */
    it('answers false without a hint and without a request', () => {
      let result: boolean | undefined;
      service.checkAuth().subscribe(v => (result = v));
      expect(result).toBeFalse();
      httpMock.expectNone(`${baseUrl}/refresh`);
    });

    /**
     * @description With a session in memory it answers true at once.
     * @input Logged in.
     * @output true, no refresh request.
     */
    it('answers true for a session in memory', () => {
      logIn();
      let result: boolean | undefined;
      service.checkAuth().subscribe(v => (result = v));
      expect(result).toBeTrue();
      httpMock.expectNone(`${baseUrl}/refresh`);
      service.clearAuthData();
    });

    /**
     * @description After a reload (hint set, memory empty) the session is restored with ONE
     *   refresh call (the cookie), also when several callers ask at once.
     * @input Hint '1'; checkAuth() twice before the answer.
     * @output One POST /refresh; both answer true; token, email and permissions restored.
     */
    it('restores the session with one refresh call', () => {
      localStorage.setItem(SESSION_HINT_KEY, '1');
      const results: boolean[] = [];
      service.checkAuth().subscribe(v => results.push(v));
      service.checkAuth().subscribe(v => results.push(v));

      httpMock.expectOne(`${baseUrl}/refresh`).flush({ data: session() });
      expect(results).toEqual([true, true]);
      expect<unknown[]>([service.getAccessToken(), service.getUserEmail()]).toEqual(['access-1', 'a@b.cz']);
      expect(permissionServiceMock.setPermissions).toHaveBeenCalledWith(['view-web', 'view-eshop']);
      service.clearAuthData();
    });

    /**
     * @description A hint without a valid cookie (expired, logged out in another tab) ends quietly.
     * @input Hint '1'; refresh answers 401.
     * @output false (no error), hint removed, permissions cleared.
     */
    it('answers false when the restore fails and removes the hint', () => {
      localStorage.setItem(SESSION_HINT_KEY, '1');
      let result: boolean | undefined;
      let failed = false;
      service.checkAuth().subscribe({ next: v => (result = v), error: () => (failed = true) });

      httpMock.expectOne(`${baseUrl}/refresh`).flush({}, { status: 401, statusText: 'Unauthorized' });
      expect<unknown[]>([result, failed]).toEqual([false, false]);
      expect(localStorage.getItem(SESSION_HINT_KEY)).toBeNull();
      expect(permissionServiceMock.clearPermissions).toHaveBeenCalled();
    });
  });

  describe('refreshAccessToken', () => {
    beforeEach(() => createService());

    /**
     * @description Concurrent refreshes (timer, interceptor) share one request; a finished one
     *   lets the next caller start a new request.
     * @input Two subscriptions, one answer; then a third refresh.
     * @output One request with both answers; then a second request.
     */
    it('shares one request between concurrent callers', () => {
      const tokens: string[] = [];
      service.refreshAccessToken().subscribe(r => tokens.push(r.token));
      service.refreshAccessToken().subscribe(r => tokens.push(r.token));
      httpMock.expectOne(`${baseUrl}/refresh`).flush({ data: session({ token: 'shared' }) });
      expect(tokens).toEqual(['shared', 'shared']);

      service.refreshAccessToken().subscribe();
      httpMock.expectOne(`${baseUrl}/refresh`).flush({ data: session({ token: 'next' }) });
      expect(service.getAccessToken()).toBe('next');
      service.clearAuthData();
    });

    /**
     * @description A refresh of the same user keeps the table cache; another user (different
     *   account in another tab) invalidates it.
     * @input Login as 42; refresh as 42; refresh as 7.
     * @output invalidateAll once for the login, not for the same user, once more for user 7.
     */
    it('invalidates the table cache only when the user changes', () => {
      const invalidate = spyOn(tables, 'invalidateAll').and.callThrough();
      logIn();
      expect(invalidate).toHaveBeenCalledTimes(1);

      service.refreshAccessToken().subscribe();
      httpMock.expectOne(`${baseUrl}/refresh`).flush({ data: session({ token: 'a2' }) });
      expect(invalidate).toHaveBeenCalledTimes(1);

      service.refreshAccessToken().subscribe();
      httpMock.expectOne(`${baseUrl}/refresh`).flush({ data: session({ token: 'b1', user: { id: 7, user_email: 'b@b.cz' } }) });
      expect(invalidate).toHaveBeenCalledTimes(2);
      expect(service.getUserId()).toBe('7');
      service.clearAuthData();
    });

    /**
     * @description A failed refresh ends the session and passes the error on.
     * @input Logged in; refresh answers 401.
     * @output Error to the subscriber; no token; permissions cleared; hint removed.
     */
    it('ends the session when the refresh fails', () => {
      logIn();
      let error: any;
      service.refreshAccessToken().subscribe({ error: e => (error = e) });
      httpMock.expectOne(`${baseUrl}/refresh`).flush({}, { status: 401, statusText: 'Unauthorized' });

      expect(error.status).toBe(401);
      expect(service.getAccessToken()).toBeNull();
      expect(permissionServiceMock.clearPermissions).toHaveBeenCalled();
      expect(localStorage.getItem(SESSION_HINT_KEY)).toBeNull();
    });

    /**
     * @description With the Web Locks API the request runs only while the tab holds the refresh
     *   lock and the lock is released when it finishes (also after an error); a failing lock
     *   request is passed on as an error.
     * @input Fake lock manager; refresh answered 200; refresh answered 500; lock manager rejecting.
     * @output Lock 'jsw-auth-refresh' requested twice, each released; the 500 and the lock
     *   error reach the subscriber.
     */
    it('runs the refresh under the Web Lock of the tabs', async () => {
      const released: string[] = [];
      const fakeLocks: RefreshLockManager = {
        request: <T>(name: string, callback: () => Promise<T>) => callback().then(v => { released.push(name); return v; }),
      };
      service.lockManager = fakeLocks;

      const ok = new Promise<string>(resolve => service.refreshAccessToken().subscribe(r => resolve(r.token)));
      httpMock.expectOne(`${baseUrl}/refresh`).flush({ data: session({ token: 'locked' }) });
      expect(await ok).toBe('locked');

      const failed = new Promise<number>(resolve => service.refreshAccessToken().subscribe({ error: e => resolve(e.status) }));
      httpMock.expectOne(`${baseUrl}/refresh`).flush({}, { status: 500, statusText: 'Error' });
      expect(await failed).toBe(500);
      await Promise.resolve();
      expect(released).toEqual(['jsw-auth-refresh', 'jsw-auth-refresh']);

      service.lockManager = { request: () => Promise.reject(new Error('lock refused')) };
      const lockError = await new Promise<string>(resolve => service.refreshAccessToken().subscribe({ error: e => resolve(e.message) }));
      expect(lockError).toBe('lock refused');
    });
  });

  describe('clearAuthData and logout', () => {
    beforeEach(() => createService());

    /**
     * @description clearAuthData ends the session: memory, hint, permissions, table cache owner,
     *   subjects, timer.
     * @input Logged in; clearAuthData(); tick 20 min.
     * @output No token / user; no hint; clearPermissions; setCurrentUser(null); false / null; no refresh.
     */
    it('clears the whole session and stops the timer', fakeAsync(() => {
      logIn();
      const setUser = spyOn(tables, 'setCurrentUser').and.callThrough();
      let loggedIn = true;
      let email: string | null = 'x';
      service.isLoggedIn$.subscribe(v => (loggedIn = v));
      service.userEmail$.subscribe(v => (email = v));

      service.clearAuthData();
      expect<unknown[]>([service.getAccessToken(), service.getUserId(), service.getUserEmail(), service.getUserRole()]).toEqual([null, null, null, null]);
      expect(service.getUserPermissions()).toEqual([]);
      expect(localStorage.getItem(SESSION_HINT_KEY)).toBeNull();
      expect(permissionServiceMock.clearPermissions).toHaveBeenCalled();
      expect(setUser).toHaveBeenCalledWith(null);
      expect<unknown[]>([loggedIn, email]).toEqual([false, null]);

      tick(20 * 60 * 1000);
      httpMock.expectNone(`${baseUrl}/refresh`);
      discardPeriodicTasks();
    }));

    /**
     * @description Logout posts an empty body with credentials (the API revokes the tokens and
     *   deletes the cookie) and clears the session; a failed request still logs out locally.
     * @input Logged in; logout → 200; logged in; logout → 500.
     * @output POST /logout {} withCredentials; no token; second: null result, no error, no token.
     */
    it('logs out on the server and locally', () => {
      logIn();
      service.logout().subscribe();
      const req = httpMock.expectOne(`${baseUrl}/logout`);
      expect(req.request.body).toEqual({});
      expect(req.request.withCredentials).toBeTrue();
      req.flush({ message: 'Logout successful!' });
      expect(service.getAccessToken()).toBeNull();

      logIn();
      let result: any = 'not-set';
      let errored = false;
      service.logout().subscribe({ next: v => (result = v), error: () => (errored = true) });
      httpMock.expectOne(`${baseUrl}/logout`).flush('Server down', { status: 500, statusText: 'Internal Server Error' });
      expect<unknown[]>([result, errored, service.getAccessToken()]).toEqual([null, false, null]);
    });

    /**
     * @description Blocked browser storage (private mode) does not break the session - only the
     *   restore after a reload is lost.
     * @input localStorage.getItem / setItem / removeItem and sessionStorage.removeItem throwing; new service; login; checkAuth after clear.
     * @output No error; session in memory; checkAuth false without request.
     */
    it('works with blocked storage', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [provideHttpClient(), provideHttpClientTesting(), { provide: PermissionService, useValue: permissionServiceMock }],
      });
      const boom = () => { throw new Error('blocked'); };
      const spies = [
        spyOn(Storage.prototype, 'getItem').and.callFake(boom),
        spyOn(Storage.prototype, 'setItem').and.callFake(boom),
        spyOn(Storage.prototype, 'removeItem').and.callFake(boom),
      ];
      createService();

      logIn();
      expect(service.getAccessToken()).toBe('access-1');
      service.clearAuthData();
      let result: boolean | undefined;
      service.checkAuth().subscribe(v => (result = v));
      expect(result).toBeFalse();
      httpMock.expectNone(`${baseUrl}/refresh`);
      spies.forEach(spy => spy.and.callThrough());
    });
  });

  describe('error mapping and 2FA / password reset', () => {
    /**
     * @description Collects the error of a request answered with the given status / body.
     * @param call Request to start.
     * @param url Expected endpoint.
     * @param status HTTP status.
     * @param body Response body.
     * @returns The AuthError received by the subscriber.
     */
    function errorOf(call: () => any, url: string, status: number, body: any = null): any {
      let error: any;
      call().subscribe({ error: (e: any) => (error = e) });
      httpMock.expectOne(`${baseUrl}/${url}`).flush(body, { status, statusText: 'x' });
      return error;
    }

    /**
     * @description Login errors keep the backend message, else a translation key; 429 has its own
     *   key; captcha_required is passed on.
     * @input 401 {message: 'Bad password', captcha_required: true}; 500 without body; 429 without body.
     * @output 'Bad password' without key + captchaRequired; '' + login_failed; '' + too_many_attempts.
     */
    it('maps login errors', () => {
      createService();
      const backend = errorOf(() => service.login({ email: 'a@b.cz', password: 'x' }), 'login', 401, { message: 'Bad password', captcha_required: true });
      expect<unknown[]>([backend.message, backend.messageKey, backend.captchaRequired]).toEqual(['Bad password', undefined, true]);
      const failed = errorOf(() => service.login({ email: 'a@b.cz', password: 'x' }), 'login', 500);
      expect<unknown[]>([failed.message, failed.messageKey, failed.captchaRequired]).toEqual(['', 'login_failed', false]);
      expect(errorOf(() => service.login({ email: 'a@b.cz', password: 'x' }), 'login', 429).messageKey).toBe('too_many_attempts');
    });

    /**
     * @description A 2FA challenge starts no session; verifyTwoFactor (with credentials - the API
     *   sets the refresh cookie) starts it; errors map to verification_failed with retry_after.
     * @input login → {requires_2fa, login_token}; verify-2fa → session; verify 400 {}; resend 429 {retry_after: 30};
     *        resend 200.
     * @output No token / hint after step 1; token + user 5 after step 2; key verification_failed;
     *   retryAfter 30; resend response passed through.
     */
    it('handles the two-factor flow', () => {
      createService();
      let challenge: any;
      service.login({ email: 'a@b.cz', password: 'x' }).subscribe(r => (challenge = r));
      httpMock.expectOne(`${baseUrl}/login`).flush({ data: { requires_2fa: true, login_token: 'lt' } });
      expect(challenge.login_token).toBe('lt');
      expect(service.getAccessToken()).toBeNull();
      expect(localStorage.getItem(SESSION_HINT_KEY)).toBeNull();

      service.verifyTwoFactor('lt', '123456').subscribe();
      const verify = httpMock.expectOne(`${baseUrl}/login/verify-2fa`);
      expect(verify.request.body).toEqual({ login_token: 'lt', code: '123456' });
      expect(verify.request.withCredentials).toBeTrue();
      verify.flush({ data: session({ token: 't', user: { user_login_id: 5, user_email: 'a@b.cz' } }) });
      expect<unknown[]>([service.getAccessToken(), service.getUserId()]).toEqual(['t', '5']);
      service.clearAuthData();

      const wrong = errorOf(() => service.verifyTwoFactor('lt', '000000'), 'login/verify-2fa', 400, {});
      expect<unknown[]>([wrong.message, wrong.messageKey, wrong.retryAfter]).toEqual(['', 'verification_failed', undefined]);
      const throttled = errorOf(() => service.resendTwoFactor('lt'), 'login/resend-2fa', 429, { message: 'Wait', retry_after: '30' });
      expect<unknown[]>([throttled.message, throttled.retryAfter]).toEqual(['Wait', 30]);
      const noRetry = errorOf(() => service.resendTwoFactor('lt'), 'login/resend-2fa', 429, {});
      expect(noRetry.retryAfter).toBeUndefined();

      let resent: any;
      service.resendTwoFactor('lt').subscribe(r => (resent = r));
      httpMock.expectOne(`${baseUrl}/login/resend-2fa`).flush({ data: { expires_in: 300 }, message: 'A new code has been sent.' });
      expect(resent).toEqual({ expires_in: 300 });
    });

    /**
     * @description Password reset: request and reset send the bodies; 429 always uses the own key
     *   (even with a backend message), other errors the backend message or request_failed.
     * @input forgot-password ok; reset-password ok; 429 {message}; 422 {message: 'Token expired'}; 500.
     * @output Bodies; too_many_attempts; 'Token expired'; request_failed.
     */
    it('handles the password reset requests', () => {
      createService();
      let sent: any; let reset: any;
      service.requestPasswordReset('a@b.cz').subscribe(r => (sent = r));
      const forgot = httpMock.expectOne(`${baseUrl}/forgot-password`);
      expect(forgot.request.body).toEqual({ email: 'a@b.cz' });
      forgot.flush({ message: 'ok' });
      service.resetPassword('tok', 'Pw1!', 'Pw1!').subscribe(r => (reset = r));
      const resetReq = httpMock.expectOne(`${baseUrl}/reset-password`);
      expect(resetReq.request.body).toEqual({ token: 'tok', password: 'Pw1!', password_confirmation: 'Pw1!' });
      resetReq.flush({ data: { email: 'a@b.cz' }, message: 'done' });
      expect<unknown[]>([sent.message, reset.email]).toEqual(['ok', 'a@b.cz']);

      const throttled = errorOf(() => service.requestPasswordReset('a@b.cz'), 'forgot-password', 429, { message: 'Too Many Attempts.' });
      expect<unknown[]>([throttled.message, throttled.messageKey]).toEqual(['', 'too_many_attempts']);
      expect(errorOf(() => service.resetPassword('t', 'p', 'p'), 'reset-password', 422, { message: 'Token expired' }).message).toBe('Token expired');
      expect(errorOf(() => service.resetPassword('t', 'p', 'p'), 'reset-password', 500).messageKey).toBe('request_failed');
    });
  });
});
