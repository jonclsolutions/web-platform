/**
 * @file auth.service.spec.ts
 * @path src/app/core/auth/auth.service.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Thorough test suite of AuthService - the critical part of the authentication
 * of the whole application.
 *
 * @note Architectural pitfalls these tests must respect:
 *
 * 1) The constructor SYNCHRONOUSLY reads `sessionStorage.getItem('accessToken')` when
 *    defining `_isLoggedIn` and `_userEmailSubject` and - when a token exists - starts
 *    `startTokenRefreshTimer()` and `syncPermissions()` at once. Tests of the "logged out"
 *    behaviour MUST clear sessionStorage BEFORE `TestBed.inject(AuthService)`, and tests of the
 *    "existing token" behaviour must set sessionStorage before the injection as well. Hence
 *    the service is NOT created in a global `beforeEach`, but through the helper
 *    `createService()`, called inside every test AFTER sessionStorage is prepared.
 *
 * 2) `startTokenRefreshTimer()` creates an endlessly repeating `timer(...)` with a period of
 *    20 minutes. `fakeAsync` tests that start it (through the constructor, `login()` or
 *    directly) MUST stop it at the end - otherwise Angular reports "periodic timer(s) still in
 *    the queue". It is stopped by `service.clearAuthData()` (through `stopTokenRefreshTimer` ->
 *    `takeUntil`), plus `discardPeriodicTasks()` to be safe.
 */

import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from './auth.service';
import { PermissionService } from './services/permission.service';
import { environment } from '../../../environments/environment';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let permissionServiceMock: {
    setPermissions: jasmine.Spy;
    clearPermissions: jasmine.Spy;
  };
  const baseUrl = environment.base_api_url;

  /** Creates the instance only NOW - called inside a test, after sessionStorage is prepared. */
  function createService(): void {
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  }

  beforeEach(() => {
    sessionStorage.clear();
    permissionServiceMock = {
      setPermissions: jasmine.createSpy('setPermissions'),
      clearPermissions: jasmine.createSpy('clearPermissions'),
    };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [{ provide: PermissionService, useValue: permissionServiceMock }],
    });
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('should be created', () => {
    createService();
    expect(service).toBeTruthy();
  });

  // ---------------------------------------------------------------------
  // Constructor - state initialization from sessionStorage
  // ---------------------------------------------------------------------
  describe('konstruktor — inicializace stavu', () => {
    it('isLoggedIn$ by mělo být false, pokud v sessionStorage není accessToken', () => {
      createService();
      let loggedIn: boolean | undefined;
      service.isLoggedIn$.subscribe(v => (loggedIn = v));
      expect(loggedIn).toBeFalse();
    });

    it('isLoggedIn$ by mělo být true, pokud accessToken v sessionStorage existuje', () => {
      sessionStorage.setItem('accessToken', 'existing-token');
      createService();
      let loggedIn: boolean | undefined;
      service.isLoggedIn$.subscribe(v => (loggedIn = v));
      expect(loggedIn).toBeTrue();

      service.clearAuthData(); // clean up the started refresh timer
    });

    it('userEmail$ by mělo být inicializováno hodnotou z sessionStorage', () => {
      sessionStorage.setItem('userEmail', 'stored@rpsw.cz');
      createService();
      let email: string | null | undefined;
      service.userEmail$.subscribe(v => (email = v));
      expect(email).toBe('stored@rpsw.cz');
    });

    it('userEmail$ by mělo být null, pokud v sessionStorage nic není', () => {
      createService();
      let email: string | null | undefined = 'placeholder';
      service.userEmail$.subscribe(v => (email = v));
      expect(email).toBeNull();
    });

    it('by mělo zavolat permissionService.setPermissions s uloženými oprávněními, pokud accessToken existuje', () => {
      sessionStorage.setItem('accessToken', 'tok');
      sessionStorage.setItem('userPermissions', JSON.stringify(['perm-a', 'perm-b']));

      createService();

      expect(permissionServiceMock.setPermissions).toHaveBeenCalledWith(['perm-a', 'perm-b']);
      service.clearAuthData();
    });

    it('by mělo zavolat permissionService.setPermissions s prázdným polem, pokud accessToken existuje, ale userPermissions ne', () => {
      sessionStorage.setItem('accessToken', 'tok');

      createService();

      expect(permissionServiceMock.setPermissions).toHaveBeenCalledWith([]);
      service.clearAuthData();
    });

    it('NEMĚLO by volat permissionService.setPermissions, pokud accessToken v sessionStorage neexistuje', () => {
      createService();
      expect(permissionServiceMock.setPermissions).not.toHaveBeenCalled();
    });

    it('by mělo spustit refresh timer, pokud accessToken existuje při konstrukci (ověřeno HTTP voláním po 20 minutách)', fakeAsync(() => {
      sessionStorage.setItem('accessToken', 'tok');
      sessionStorage.setItem('refreshToken', 'reftok');

      createService();

      tick(20 * 60 * 1000);
      const req = httpMock.expectOne(`${baseUrl}/refresh`);
      expect(req.request.method).toBe('POST');
      req.flush({ data: { token: 'newtok', refreshToken: 'newreftok' } });

      service.clearAuthData();
      discardPeriodicTasks();
    }));

    it('NEMĚLO by spustit refresh timer, pokud accessToken při konstrukci neexistuje (žádné HTTP volání po 20 minutách)', fakeAsync(() => {
      createService();

      tick(20 * 60 * 1000);
      httpMock.expectNone(`${baseUrl}/refresh`);

      discardPeriodicTasks();
    }));
  });

  // ---------------------------------------------------------------------
  // login
  // ---------------------------------------------------------------------
  describe('login', () => {
    beforeEach(() => createService());
    afterEach(() => httpMock.verify());

    it('by mělo poslat POST na {baseUrl}/login se zadanými přihlašovacími údaji', () => {
      const credentials = { email: 'a@b.cz', password: 'pass' };
      service.login(credentials).subscribe();

      const req = httpMock.expectOne(`${baseUrl}/login`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(credentials);
      req.flush({ data: { token: 't', refreshToken: 'r', user: { id: 1, user_email: 'a@b.cz' } } });
    });

    it('by mělo po úspěchu uložit accessToken, refreshToken, userEmail a userId do sessionStorage', () => {
      service.login({ email: 'a@b.cz', password: 'p' }).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/login`);
      req.flush({ data: {
        token: 'tok123',
        refreshToken: 'reftok123',
        user: { id: 42, user_email: 'a@b.cz' },
      } });

      expect(sessionStorage.getItem('accessToken')).toBe('tok123');
      expect(sessionStorage.getItem('refreshToken')).toBe('reftok123');
      expect(sessionStorage.getItem('userEmail')).toBe('a@b.cz');
      expect(sessionStorage.getItem('userId')).toBe('42');
    });

    it('by mělo použít user.user_login_id jako fallback, pokud user.id chybí', () => {
      service.login({ email: 'a@b.cz', password: 'p' }).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/login`);
      req.flush({ data: {
        token: 't',
        refreshToken: 'r',
        user: { user_login_id: 99, user_email: 'a@b.cz' },
      } });

      expect(sessionStorage.getItem('userId')).toBe('99');
    });

    it('by mělo uložit userRole z prvního prvku user_roles, pokud je pole neprázdné', () => {
      service.login({ email: 'a@b.cz', password: 'p' }).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/login`);
      req.flush({ data: {
        token: 't',
        refreshToken: 'r',
        user: { id: 1, user_email: 'a@b.cz' },
        user_roles: ['admin', 'editor'],
      } });

      expect(sessionStorage.getItem('userRole')).toBe('admin');
    });

    it('NEMĚLO by uložit userRole, pokud je user_roles prázdné pole', () => {
      service.login({ email: 'a@b.cz', password: 'p' }).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/login`);
      req.flush({ data: {
        token: 't',
        refreshToken: 'r',
        user: { id: 1, user_email: 'a@b.cz' },
        user_roles: [],
      } });

      expect(sessionStorage.getItem('userRole')).toBeNull();
    });

    it('NEMĚLO by uložit userRole, pokud user_roles v odpovědi vůbec chybí', () => {
      service.login({ email: 'a@b.cz', password: 'p' }).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/login`);
      req.flush({ data: { token: 't', refreshToken: 'r', user: { id: 1, user_email: 'a@b.cz' } } });

      expect(sessionStorage.getItem('userRole')).toBeNull();
    });

    it('by mělo uložit userPermissions a zavolat permissionService.setPermissions, pokud jsou v odpovědi', () => {
      const perms = ['view-web', 'view-eshop'];
      service.login({ email: 'a@b.cz', password: 'p' }).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/login`);
      req.flush({ data: {
        token: 't',
        refreshToken: 'r',
        user: { id: 1, user_email: 'a@b.cz' },
        user_permissions: perms,
      } });

      expect(sessionStorage.getItem('userPermissions')).toBe(JSON.stringify(perms));
      expect(permissionServiceMock.setPermissions).toHaveBeenCalledWith(perms);
    });

    it('NEMĚLO by volat permissionService.setPermissions během loginu, pokud user_permissions chybí', () => {
      service.login({ email: 'a@b.cz', password: 'p' }).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/login`);
      req.flush({ data: { token: 't', refreshToken: 'r', user: { id: 1, user_email: 'a@b.cz' } } });

      expect(permissionServiceMock.setPermissions).not.toHaveBeenCalled();
    });

    it('by mělo aktualizovat userEmail$ a isLoggedIn$ po úspěšném přihlášení', () => {
      let email: string | null = null;
      let loggedIn = false;
      service.userEmail$.subscribe(v => (email = v));
      service.isLoggedIn$.subscribe(v => (loggedIn = v));

      service.login({ email: 'a@b.cz', password: 'p' }).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/login`);
      req.flush({ data: { token: 't', refreshToken: 'r', user: { id: 1, user_email: 'new@rpsw.cz' } } });

      expect(email!).toBe('new@rpsw.cz');
      expect(loggedIn).toBeTrue();
    });

    it('by mělo spustit refresh timer po úspěšném přihlášení (ověřeno následným HTTP voláním)', fakeAsync(() => {
      service.login({ email: 'a@b.cz', password: 'p' }).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/login`);
      req.flush({ data: { token: 't', refreshToken: 'r', user: { id: 1, user_email: 'a@b.cz' } } });

      tick(20 * 60 * 1000);
      const refreshReq = httpMock.expectOne(`${baseUrl}/refresh`);
      expect(refreshReq.request.method).toBe('POST');
      refreshReq.flush({ data: { token: 't2', refreshToken: 'r2' } });

      service.clearAuthData();
      discardPeriodicTasks();
    }));

    it('NEMĚLO by při neúspěšném loginu měnit sessionStorage ani isLoggedIn$', () => {
      let loggedIn = false;
      service.isLoggedIn$.subscribe(v => (loggedIn = v));

      service.login({ email: 'a@b.cz', password: 'wrong' }).subscribe({ error: () => {} });
      const req = httpMock.expectOne(`${baseUrl}/login`);
      req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

      expect(loggedIn).toBeFalse();
      expect(sessionStorage.getItem('accessToken')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------
  // checkAuth
  // ---------------------------------------------------------------------
  describe('checkAuth', () => {
    it('by mělo vrátit false a nastavit isLoggedIn$ na false, pokud accessToken neexistuje', () => {
      createService();

      let result: boolean | undefined;
      service.checkAuth().subscribe(v => (result = v));
      expect(result).toBeFalse();

      let loggedIn: boolean | undefined;
      service.isLoggedIn$.subscribe(v => (loggedIn = v));
      expect(loggedIn).toBeFalse();
    });

    it('by mělo vrátit true a nastavit isLoggedIn$ na true, pokud accessToken existuje', () => {
      sessionStorage.setItem('accessToken', 'tok');
      createService();

      let result: boolean | undefined;
      service.checkAuth().subscribe(v => (result = v));
      expect(result).toBeTrue();

      service.clearAuthData(); // clean up the timer started by the constructor
    });

    it('by mělo přepnout isLoggedIn$ z true na false, pokud accessToken mezitím zmizí', () => {
      sessionStorage.setItem('accessToken', 'tok');
      createService();

      let loggedIn: boolean | undefined;
      service.isLoggedIn$.subscribe(v => (loggedIn = v));
      expect(loggedIn).toBeTrue();

      sessionStorage.removeItem('accessToken');
      service.checkAuth().subscribe();

      expect(loggedIn).toBeFalse();
      service.clearAuthData();
    });
  });

  // ---------------------------------------------------------------------
  // refreshAccessToken
  // ---------------------------------------------------------------------
  describe('refreshAccessToken', () => {
    beforeEach(() => createService());
    afterEach(() => httpMock.verify());

    it('by mělo okamžitě vyčistit auth data a vrátit chybu "Refresh token missing", pokud refreshToken neexistuje', () => {
      let error: Error | undefined;
      service.refreshAccessToken().subscribe({ error: e => (error = e) });

      expect(error?.message).toBe('Refresh token missing');
      expect(permissionServiceMock.clearPermissions).toHaveBeenCalled();
    });

    it('by mělo poslat POST na {baseUrl}/refresh s uloženým refreshToken', () => {
      sessionStorage.setItem('refreshToken', 'existing-refresh');
      service.refreshAccessToken().subscribe();

      const req = httpMock.expectOne(`${baseUrl}/refresh`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ refreshToken: 'existing-refresh' });
      req.flush({ data: { token: 'newtok', refreshToken: 'newreftok' } });
    });

    it('by mělo po úspěchu aktualizovat tokeny v sessionStorage a isLoggedIn$', () => {
      sessionStorage.setItem('refreshToken', 'existing-refresh');
      let loggedIn = false;
      service.isLoggedIn$.subscribe(v => (loggedIn = v));

      service.refreshAccessToken().subscribe();
      const req = httpMock.expectOne(`${baseUrl}/refresh`);
      req.flush({ data: { token: 'newtok', refreshToken: 'newreftok' } });

      expect(sessionStorage.getItem('accessToken')).toBe('newtok');
      expect(sessionStorage.getItem('refreshToken')).toBe('newreftok');
      expect(loggedIn).toBeTrue();
    });

    it('by mělo zavolat clearAuthData a přeposlat chybu dál, pokud HTTP požadavek selže', () => {
      sessionStorage.setItem('refreshToken', 'existing-refresh');
      sessionStorage.setItem('accessToken', 'old-token');

      let error: any;
      service.refreshAccessToken().subscribe({ error: e => (error = e) });
      const req = httpMock.expectOne(`${baseUrl}/refresh`);
      req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

      expect(error).toBeTruthy();
      expect(sessionStorage.getItem('accessToken')).toBeNull();
      expect(permissionServiceMock.clearPermissions).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------
  // clearAuthData
  // ---------------------------------------------------------------------
  describe('clearAuthData', () => {
    beforeEach(() => createService());

    it('by mělo vymazat celý sessionStorage', () => {
      sessionStorage.setItem('accessToken', 'a');
      sessionStorage.setItem('refreshToken', 'b');
      sessionStorage.setItem('userEmail', 'c');
      sessionStorage.setItem('userId', 'd');

      service.clearAuthData();

      expect(sessionStorage.length).toBe(0);
    });

    it('by mělo zavolat permissionService.clearPermissions', () => {
      service.clearAuthData();
      expect(permissionServiceMock.clearPermissions).toHaveBeenCalled();
    });

    it('by mělo nastavit isLoggedIn$ na false a userEmail$ na null', () => {
      let loggedIn = true;
      let email: string | null = 'x';
      service.isLoggedIn$.subscribe(v => (loggedIn = v));
      service.userEmail$.subscribe(v => (email = v));

      service.clearAuthData();

      expect(loggedIn).toBeFalse();
      expect(email).toBeNull();
    });

  });

  describe('clearAuthData — zastavení refresh timeru (samostatná instance, bez sdíleného beforeEach)', () => {
    // NOTE: this test deliberately does NOT use the nested `beforeEach(() => createService())` above,
    // because inside one test `TestBed.inject(AuthService)` ALWAYS returns the same (already
    // created) instance - a second call would not run the constructor again.
    // So the instance is created exactly once, AFTER the token is in sessionStorage.
    it('by mělo zastavit refresh timer spuštěný konstruktorem (žádné další HTTP volání po uplynutí intervalu)', fakeAsync(() => {
      sessionStorage.setItem('accessToken', 'tok');
      sessionStorage.setItem('refreshToken', 'reftok');
      createService(); // the constructor now starts the refresh timer

      service.clearAuthData();
      tick(20 * 60 * 1000);

      httpMock.expectNone(`${baseUrl}/refresh`);
      discardPeriodicTasks();
    }));
  });

  // ---------------------------------------------------------------------
  // Getters and setters
  // ---------------------------------------------------------------------
  describe('gettery a settery', () => {
    beforeEach(() => createService());

    it('getUserId by mělo přečíst "userId" ze sessionStorage', () => {
      sessionStorage.setItem('userId', '123');
      expect(service.getUserId()).toBe('123');
    });

    it('getUserId by mělo vrátit null, pokud není nastaveno', () => {
      expect(service.getUserId()).toBeNull();
    });

    it('getUserEmail by mělo přečíst "userEmail" ze sessionStorage', () => {
      sessionStorage.setItem('userEmail', 'x@y.cz');
      expect(service.getUserEmail()).toBe('x@y.cz');
    });

    it('getUserRole by mělo přečíst "userRole" ze sessionStorage', () => {
      sessionStorage.setItem('userRole', 'admin');
      expect(service.getUserRole()).toBe('admin');
    });

    it('getUserRole by mělo vrátit null, pokud role není nastavena', () => {
      expect(service.getUserRole()).toBeNull();
    });

    it('getAccessToken / getRefreshToken by měly přečíst příslušné klíče', () => {
      sessionStorage.setItem('accessToken', 'tok-a');
      sessionStorage.setItem('refreshToken', 'tok-r');
      expect(service.getAccessToken()).toBe('tok-a');
      expect(service.getRefreshToken()).toBe('tok-r');
    });

    it('getUserPermissions by mělo vrátit prázdné pole, pokud nic není uloženo', () => {
      expect(service.getUserPermissions()).toEqual([]);
    });

    it('getUserPermissions by mělo naparsovat a vrátit uložené JSON pole', () => {
      sessionStorage.setItem('userPermissions', JSON.stringify(['a', 'b', 'c']));
      expect(service.getUserPermissions()).toEqual(['a', 'b', 'c']);
    });
  });

  // ---------------------------------------------------------------------
  // logout
  // ---------------------------------------------------------------------
  describe('logout', () => {
    beforeEach(() => createService());
    afterEach(() => httpMock.verify());

    it('by mělo poslat POST na {baseUrl}/logout s aktuálním refreshToken', () => {
      sessionStorage.setItem('refreshToken', 'ref-123');
      service.logout().subscribe();

      const req = httpMock.expectOne(`${baseUrl}/logout`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ refreshToken: 'ref-123' });
      req.flush({ message: 'Logout successful!' });
    });

    it('by mělo poslat POST s refreshToken: null, pokud v sessionStorage žádný není', () => {
      service.logout().subscribe();

      const req = httpMock.expectOne(`${baseUrl}/logout`);
      expect(req.request.body).toEqual({ refreshToken: null });
      req.flush({ message: 'Logout successful!' });
    });

    it('by mělo po úspěchu zavolat clearAuthData (vymazat sessionStorage a oprávnění)', () => {
      sessionStorage.setItem('refreshToken', 'ref-123');
      sessionStorage.setItem('accessToken', 'acc-123');

      service.logout().subscribe();
      const req = httpMock.expectOne(`${baseUrl}/logout`);
      req.flush({ message: 'Logout successful!' });

      expect(sessionStorage.getItem('accessToken')).toBeNull();
      expect(permissionServiceMock.clearPermissions).toHaveBeenCalled();
    });

    it('by mělo při chybě POTLAČIT chybu, přesto zavolat clearAuthData a vrátit null (ne error)', () => {
      sessionStorage.setItem('refreshToken', 'ref-123');
      sessionStorage.setItem('accessToken', 'acc-123');

      let result: any = 'not-set';
      let errored = false;
      service.logout().subscribe({
        next: v => (result = v),
        error: () => (errored = true),
      });

      const req = httpMock.expectOne(`${baseUrl}/logout`);
      req.flush('Server down', { status: 500, statusText: 'Internal Server Error' });

      expect(errored).toBeFalse();
      expect(result).toBeNull();
      expect(sessionStorage.getItem('accessToken')).toBeNull();
      expect(permissionServiceMock.clearPermissions).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------
  // Error mapping + 2FA / password reset
  // ---------------------------------------------------------------------
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
      expect([backend.message, backend.messageKey, backend.captchaRequired]).toEqual(['Bad password', undefined, true]);
      const failed = errorOf(() => service.login({ email: 'a@b.cz', password: 'x' }), 'login', 500);
      expect([failed.message, failed.messageKey, failed.captchaRequired]).toEqual(['', 'login_failed', false]);
      expect(errorOf(() => service.login({ email: 'a@b.cz', password: 'x' }), 'login', 429).messageKey).toBe('too_many_attempts');
    });

    /**
     * @description A 2FA challenge stores nothing; verifyTwoFactor stores the session; errors map
     *   to verification_failed with retry_after from a 429.
     * @input login → {requires_2fa, login_token}; verify-2fa → session; verify 400 {}; resend 429 {retry_after: 30};
     *        resend 200.
     * @output No token after step 1; token + email after step 2; key verification_failed;
     *   retryAfter 30; resend response passed through.
     */
    it('handles the two-factor flow', () => {
      createService();
      let challenge: any;
      service.login({ email: 'a@b.cz', password: 'x' }).subscribe(r => (challenge = r));
      httpMock.expectOne(`${baseUrl}/login`).flush({ data: { requires_2fa: true, login_token: 'lt' } });
      expect(challenge.login_token).toBe('lt');
      expect(sessionStorage.getItem('accessToken')).toBeNull();

      service.verifyTwoFactor('lt', '123456').subscribe();
      const verify = httpMock.expectOne(`${baseUrl}/login/verify-2fa`);
      expect(verify.request.body).toEqual({ login_token: 'lt', code: '123456' });
      verify.flush({ data: { token: 't', refreshToken: 'r', user: { user_login_id: 5, user_email: 'a@b.cz' } } });
      expect(sessionStorage.getItem('accessToken')).toBe('t');
      expect(sessionStorage.getItem('userId')).toBe('5');
      service.clearAuthData();

      const wrong = errorOf(() => service.verifyTwoFactor('lt', '000000'), 'login/verify-2fa', 400, {});
      expect([wrong.message, wrong.messageKey, wrong.retryAfter]).toEqual(['', 'verification_failed', undefined]);
      const throttled = errorOf(() => service.resendTwoFactor('lt'), 'login/resend-2fa', 429, { message: 'Wait', retry_after: '30' });
      expect([throttled.message, throttled.retryAfter]).toEqual(['Wait', 30]);
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
      expect([sent.message, reset.email]).toEqual(['ok', 'a@b.cz']);

      const throttled = errorOf(() => service.requestPasswordReset('a@b.cz'), 'forgot-password', 429, { message: 'Too Many Attempts.' });
      expect([throttled.message, throttled.messageKey]).toEqual(['', 'too_many_attempts']);
      expect(errorOf(() => service.resetPassword('t', 'p', 'p'), 'reset-password', 422, { message: 'Token expired' }).message).toBe('Token expired');
      expect(errorOf(() => service.resetPassword('t', 'p', 'p'), 'reset-password', 500).messageKey).toBe('request_failed');
    });
  });
});
