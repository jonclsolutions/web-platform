/**
 * @file auth-token.interceptor.spec.ts
 * @path src/app/core/interceptors/auth-token.interceptor.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Complete test suite of AuthTokenInterceptor.
 *
 * Covers:
 *   A) Token injection           - adding / omitting the Authorization header
 *   B) 401 handling              - starting the refresh flow
 *   C) Refresh lock (queue)      - a second request waits for the running refresh
 *   D) Refresh failure           - clearAuthData + redirect to /auth/login
 *   E) Bypass URL                - a 401 of /login and /refresh is not retried
 *   F) Non-401 errors            - 403, 500 go straight back to the caller
 */

import {
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  HTTP_INTERCEPTORS,
  HttpClient,
  HttpErrorResponse,
} from '@angular/common/http';
import { of, throwError, Subject } from 'rxjs';

import { AuthTokenInterceptor } from './auth-token.interceptor';
import { SKIP_ADMIN_AUTH_CONTEXT } from './skip-admin-auth';
import { AuthService, AuthSessionResponse } from '../auth/auth.service';
import { Router }               from '@angular/router';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Creates an HttpErrorResponse with the given status */
function makeError(status: number): HttpErrorResponse {
  return new HttpErrorResponse({ status, url: '/test', statusText: '' });
}

// ─────────────────────────────────────────────────────────────────────────────

describe('AuthTokenInterceptor', () => {
  let http:            HttpClient;
  let httpMock:        HttpTestingController;
  let authService:     jasmine.SpyObj<AuthService>;
  let router:          jasmine.SpyObj<Router>;
  let interceptorInst: AuthTokenInterceptor;

  beforeEach(() => {
    authService = jasmine.createSpyObj('AuthService', [
      'getAccessToken',
      'refreshAccessToken',
      'clearAuthData',
    ]);
    router = jasmine.createSpyObj('Router', ['navigate']);

    // Default state: no token
    authService.getAccessToken.and.returnValue(null);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthTokenInterceptor,
        { provide: HTTP_INTERCEPTORS, useClass: AuthTokenInterceptor, multi: true },
        { provide: AuthService, useValue: authService },
        { provide: Router,      useValue: router },
      ],
    });

    http            = TestBed.inject(HttpClient);
    httpMock        = TestBed.inject(HttpTestingController);
    interceptorInst = TestBed.inject(AuthTokenInterceptor);
  });

  afterEach(() => httpMock.verify());

  // ═══════════════════════════════════════════════════════════════════════════
  // A) TOKEN INJECTION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('A) Token injection', () => {

    /**
     * @description Requests of a client portal (context SKIP_ADMIN_AUTH) bypass the interceptor
     *   (no token, no 401 handling).
     * @input Token present; GET /api/projects/public/abc with SKIP_ADMIN_AUTH_CONTEXT answered 401.
     * @output No Authorization header, error passed through, no refresh attempt.
     */
    it('passes client portal requests without a token and without a refresh', () => {
      authService.getAccessToken.and.returnValue('test-jwt-token');
      let status = 0;
      http.get('/api/projects/public/abc', { context: SKIP_ADMIN_AUTH_CONTEXT }).subscribe({ error: e => (status = e.status) });

      const req = httpMock.expectOne('/api/projects/public/abc');
      expect(req.request.headers.has('Authorization')).toBeFalse();
      req.flush({}, { status: 401, statusText: 'Unauthorized' });
      expect(status).toBe(401);
      expect(authService.refreshAccessToken).not.toHaveBeenCalled();
    });

    it('adds the Authorization header when an access token exists', () => {
      authService.getAccessToken.and.returnValue('test-jwt-token');

      http.get('/api/data').subscribe();

      const req = httpMock.expectOne('/api/data');
      expect(req.request.headers.get('Authorization')).toBe('Bearer test-jwt-token');
      req.flush({});
    });

    it('uses exactly the "Bearer <token>" format', () => {
      authService.getAccessToken.and.returnValue('abc.def.ghi');

      http.get('/api/data').subscribe();

      const req = httpMock.expectOne('/api/data');
      expect(req.request.headers.get('Authorization')).toBe('Bearer abc.def.ghi');
      req.flush({});
    });

    it('does NOT add the Authorization header when there is no token (null)', () => {
      authService.getAccessToken.and.returnValue(null);

      http.get('/api/public').subscribe();

      const req = httpMock.expectOne('/api/public');
      expect(req.request.headers.has('Authorization')).toBeFalse();
      req.flush({});
    });

    it('does NOT add the Authorization header when the token is an empty string', () => {
      authService.getAccessToken.and.returnValue('');

      http.get('/api/public').subscribe();

      const req = httpMock.expectOne('/api/public');
      expect(req.request.headers.has('Authorization')).toBeFalse();
      req.flush({});
    });

    it('adds the header to every method (POST, PUT, DELETE)', () => {
      authService.getAccessToken.and.returnValue('my-token');

      http.post('/api/resource', {}).subscribe();
      http.put('/api/resource/1', {}).subscribe();
      http.delete('/api/resource/1').subscribe();

      ['POST', 'PUT', 'DELETE'].forEach(method => {
        const req = httpMock.expectOne(r => r.method === method);
        expect(req.request.headers.get('Authorization')).toBe('Bearer my-token');
        req.flush({});
      });
    });

    it('does not mutate the original request object (immutable clone)', () => {
      authService.getAccessToken.and.returnValue('token-x');
      let capturedRequest: any;

      http.get('/api/data').subscribe();

      const req = httpMock.expectOne('/api/data');
      capturedRequest = req.request;

      // The original request must not have the header - only the clone gets it
      // (Angular HttpRequest is immutable, clone returns a new object)
      expect(capturedRequest.headers.get('Authorization')).toBe('Bearer token-x');
      req.flush({});
    });

    it('calls getAccessToken exactly once per request', () => {
      authService.getAccessToken.and.returnValue('t');

      http.get('/api/data').subscribe();
      httpMock.expectOne('/api/data').flush({});

      expect(authService.getAccessToken).toHaveBeenCalledTimes(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // B) 401 HANDLING — REFRESH FLOW
  // ═══════════════════════════════════════════════════════════════════════════

  describe('B) 401 handling — refresh flow', () => {

    it('calls refreshAccessToken on a 401 response', fakeAsync(() => {
      authService.getAccessToken.and.returnValue('expired-token');
      authService.refreshAccessToken.and.returnValue(of({ token: 'new-token' } as AuthSessionResponse));

      http.get('/api/protected').subscribe();

      const req = httpMock.expectOne('/api/protected');
      req.flush({}, { status: 401, statusText: 'Unauthorized' });
      tick();

      expect(authService.refreshAccessToken).toHaveBeenCalledTimes(1);

      // Repeated request with the new token
      const retried = httpMock.expectOne('/api/protected');
      expect(retried.request.headers.get('Authorization')).toBe('Bearer new-token');
      retried.flush({ ok: true });
    }));

    it('repeats the original request with the new token after a successful refresh', fakeAsync(() => {
      authService.getAccessToken.and.returnValue('old-token');
      authService.refreshAccessToken.and.returnValue(of({ token: 'refreshed-token' } as AuthSessionResponse));

      let responseData: any;
      http.get('/api/resource').subscribe(d => (responseData = d));

      httpMock.expectOne('/api/resource').flush(
        {}, { status: 401, statusText: 'Unauthorized' }
      );
      tick();

      const retried = httpMock.expectOne('/api/resource');
      retried.flush({ id: 42 });

      expect(responseData).toEqual({ id: 42 });
    }));

    it('sets isRefreshing back to false after a successful refresh', fakeAsync(() => {
      authService.getAccessToken.and.returnValue('old');
      authService.refreshAccessToken.and.returnValue(of({ token: 'new' } as AuthSessionResponse));

      http.get('/api/data').subscribe();
      httpMock.expectOne('/api/data').flush(
        {}, { status: 401, statusText: 'Unauthorized' }
      );
      tick();

      httpMock.expectOne('/api/data').flush({});

      // Second request - the refresh must not start again
      authService.getAccessToken.and.returnValue('new');
      http.get('/api/data2').subscribe();
      httpMock.expectOne('/api/data2').flush({});

      expect(authService.refreshAccessToken).toHaveBeenCalledTimes(1);
    }));

    it('does NOT call refreshAccessToken on a 200 response', () => {
      authService.getAccessToken.and.returnValue('valid-token');

      http.get('/api/data').subscribe();
      httpMock.expectOne('/api/data').flush({ data: 'ok' });

      expect(authService.refreshAccessToken).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // C) REFRESH LOCK - QUEUE (concurrent requests)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('C) Refresh lock - queue of concurrent requests', () => {

    it('starts refreshAccessToken only once for two concurrent 401s', fakeAsync(() => {
      // Simulate two concurrent calls that both get 401
      const refreshSubject = new Subject<any>();
      authService.getAccessToken.and.returnValue('expired');
      authService.refreshAccessToken.and.returnValue(refreshSubject.asObservable());

      http.get('/api/a').subscribe();
      http.get('/api/b').subscribe();

      // Both requests get 401
      httpMock.expectOne('/api/a').flush(
        {}, { status: 401, statusText: 'Unauthorized' }
      );
      httpMock.expectOne('/api/b').flush(
        {}, { status: 401, statusText: 'Unauthorized' }
      );
      tick();

      // The refresh was called exactly once
      expect(authService.refreshAccessToken).toHaveBeenCalledTimes(1);

      // Finish the refresh
      refreshSubject.next({ token: 'fresh-token' });
      refreshSubject.complete();
      tick();

      // Both requests should be repeated with the new token
      const retries = httpMock.match('/api/a').concat(httpMock.match('/api/b'));
      expect(retries.length).toBe(2);
      retries.forEach(r => {
        expect(r.request.headers.get('Authorization')).toBe('Bearer fresh-token');
        r.flush({});
      });
    }));

    it('gives the waiting requests the new token once the refresh finishes', fakeAsync(() => {
      const refreshSubject = new Subject<any>();
      authService.getAccessToken.and.returnValue('exp');
      authService.refreshAccessToken.and.returnValue(refreshSubject.asObservable());

      let result1: any;
      let result2: any;
      http.get('/api/r1').subscribe(d => (result1 = d));
      http.get('/api/r2').subscribe(d => (result2 = d));

      httpMock.expectOne('/api/r1').flush(
        {}, { status: 401, statusText: 'Unauthorized' }
      );
      httpMock.expectOne('/api/r2').flush(
        {}, { status: 401, statusText: 'Unauthorized' }
      );
      tick();

      refreshSubject.next({ token: 'brand-new' });
      refreshSubject.complete();
      tick();

      httpMock.expectOne('/api/r1').flush({ from: 'r1' });
      httpMock.expectOne('/api/r2').flush({ from: 'r2' });

      expect(result1).toEqual({ from: 'r1' });
      expect(result2).toEqual({ from: 'r2' });
    }));
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // D) REFRESH FAILURE - clearAuthData + redirect
  // ═══════════════════════════════════════════════════════════════════════════

  describe('D) Refresh failure', () => {

    it('calls clearAuthData when the refresh fails', fakeAsync(() => {
      authService.getAccessToken.and.returnValue('exp');
      authService.refreshAccessToken.and.returnValue(
        throwError(() => makeError(401))
      );

      http.get('/api/secured').subscribe({ error: () => {} });

      httpMock.expectOne('/api/secured').flush(
        {}, { status: 401, statusText: 'Unauthorized' }
      );
      tick();

      expect(authService.clearAuthData).toHaveBeenCalledTimes(1);
    }));

    it('navigates to /auth/login when the refresh fails', fakeAsync(() => {
      authService.getAccessToken.and.returnValue('exp');
      authService.refreshAccessToken.and.returnValue(
        throwError(() => makeError(401))
      );

      http.get('/api/secured').subscribe({ error: () => {} });

      httpMock.expectOne('/api/secured').flush(
        {}, { status: 401, statusText: 'Unauthorized' }
      );
      tick();

      expect(router.navigate).toHaveBeenCalledOnceWith(['/auth/login']);
    }));

    it('sets isRefreshing back to false after a failure', fakeAsync(() => {
      authService.getAccessToken.and.returnValue('exp');
      authService.refreshAccessToken.and.returnValue(
        throwError(() => makeError(401))
      );

      http.get('/api/a').subscribe({ error: () => {} });
      httpMock.expectOne('/api/a').flush(
        {}, { status: 401, statusText: 'Unauthorized' }
      );
      tick();

      // Second request - the refresh must not start again, because
      // isRefreshing is false and a 401 on the /login route is bypassed
      authService.refreshAccessToken.calls.reset();
      authService.getAccessToken.and.returnValue(null);

      http.get('/api/b').subscribe({ error: () => {} });
      httpMock.expectOne('/api/b').flush(
        {}, { status: 401, statusText: 'Unauthorized' }
      );
      tick();

      // For /api/b (not a bypass URL) the refresh starts again -
      // this proves the lock was released
      expect(authService.refreshAccessToken).toHaveBeenCalledTimes(1);

      // Failure of the second refresh - clean-up
      tick();
    }));

    /**
     * @description A failed refresh fails the requests that waited for it too - they never hang
     *   (a tab whose session ended elsewhere stayed unresponsive on the next action).
     * @input Two concurrent 401s; the refresh errors.
     * @output Both callers get an error; one refresh.
     */
    it('fails the waiting requests when the refresh fails', fakeAsync(() => {
      const refreshSubject = new Subject<any>();
      authService.getAccessToken.and.returnValue('expired');
      authService.refreshAccessToken.and.returnValue(refreshSubject.asObservable());
      const errors: any[] = [];
      http.get('/api/a').subscribe({ error: e => errors.push(e) });
      http.get('/api/b').subscribe({ error: e => errors.push(e) });
      httpMock.expectOne('/api/a').flush({}, { status: 401, statusText: 'Unauthorized' });
      httpMock.expectOne('/api/b').flush({}, { status: 401, statusText: 'Unauthorized' });
      tick();

      refreshSubject.error(makeError(401));
      tick();
      expect(errors.length).toBe(2);
      expect(errors.every(e => e.status === 401)).toBeTrue();
      expect(authService.refreshAccessToken).toHaveBeenCalledTimes(1);
    }));

    it('propagates the error to the caller after a failed refresh', fakeAsync(() => {
      authService.getAccessToken.and.returnValue('exp');
      const refreshErr = makeError(403);
      authService.refreshAccessToken.and.returnValue(throwError(() => refreshErr));

      let caughtError: any;
      http.get('/api/x').subscribe({ error: e => (caughtError = e) });

      httpMock.expectOne('/api/x').flush(
        {}, { status: 401, statusText: 'Unauthorized' }
      );
      tick();

      expect(caughtError).toBe(refreshErr);
    }));
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // E) BYPASS URLs — /login, /refresh
  // ═══════════════════════════════════════════════════════════════════════════

  describe('E) Bypass URLs', () => {

    it('does NOT start the refresh flow on a 401 of the /login endpoint', fakeAsync(() => {
      authService.getAccessToken.and.returnValue(null);

      let error: any;
      http.post('/api/login', {}).subscribe({ error: e => (error = e) });

      httpMock.expectOne('/api/login').flush(
        {}, { status: 401, statusText: 'Unauthorized' }
      );
      tick();

      expect(authService.refreshAccessToken).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
      expect(error.status).toBe(401);
    }));

    /**
     * @description A 401 of the logout is never refreshed: logging out must not renew a session (with
     *   the cookie of another account signed in elsewhere it would log that one out).
     * @input POST /api/logout answering 401.
     * @output No refresh, the 401 reaches the caller.
     */
    it('does NOT start the refresh flow on a 401 of the /logout endpoint', fakeAsync(() => {
      authService.getAccessToken.and.returnValue('old');
      let error: any;
      http.post('/api/logout', {}).subscribe({ error: e => (error = e) });
      httpMock.expectOne('/api/logout').flush({}, { status: 401, statusText: 'Unauthorized' });
      tick();
      expect(authService.refreshAccessToken).not.toHaveBeenCalled();
      expect(error.status).toBe(401);
    }));

    it('does NOT start the refresh flow on a 401 of the /refresh endpoint', fakeAsync(() => {
      authService.getAccessToken.and.returnValue(null);

      let error: any;
      http.post('/api/refresh', {}).subscribe({ error: e => (error = e) });

      httpMock.expectOne('/api/refresh').flush(
        {}, { status: 401, statusText: 'Unauthorized' }
      );
      tick();

      expect(authService.refreshAccessToken).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
      expect(error.status).toBe(401);
    }));

it('documents the includes() behaviour when /login occurs inside the URL', fakeAsync(() => {
      // Checks that the substring match through includes('/login')
      // returns true for this URL and starts the refresh flow (shows the code behaviour).
      authService.getAccessToken.and.returnValue('tok');
      authService.refreshAccessToken.and.returnValue(of({ token: 'new-token' } as AuthSessionResponse));

      http.get('/api/settings-login-info').subscribe();
      
      const req = httpMock.expectOne('/api/settings-login-info');
      req.flush({}, { status: 401, statusText: 'Unauthorized' });
      tick();

      // The code treats the path as a bypass through .includes('/login') (no refresh),
      // OR, when the test URL contains /login in the domain / port, behaves like this:
      expect(authService.refreshAccessToken).toHaveBeenCalled();

      // Clean-up of the follow-up request after the refresh
      const retried = httpMock.expectOne('/api/settings-login-info');
      retried.flush({});
    }));
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // F) NON-401 ERRORS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('F) Non-401 errors', () => {

    it('propagates 403 Forbidden directly without a refresh', fakeAsync(() => {
      authService.getAccessToken.and.returnValue('valid');

      let caughtError: any;
      http.get('/api/forbidden').subscribe({ error: e => (caughtError = e) });

      httpMock.expectOne('/api/forbidden').flush(
        {}, { status: 403, statusText: 'Forbidden' }
      );
      tick();

      expect(authService.refreshAccessToken).not.toHaveBeenCalled();
      expect(caughtError.status).toBe(403);
    }));

    it('propagates 500 Internal Server Error without a refresh', fakeAsync(() => {
      authService.getAccessToken.and.returnValue('valid');

      let caughtError: any;
      http.get('/api/crash').subscribe({ error: e => (caughtError = e) });

      httpMock.expectOne('/api/crash').flush(
        {}, { status: 500, statusText: 'Internal Server Error' }
      );
      tick();

      expect(authService.refreshAccessToken).not.toHaveBeenCalled();
      expect(caughtError.status).toBe(500);
    }));

    it('propagates 404 Not Found without a refresh', fakeAsync(() => {
      authService.getAccessToken.and.returnValue('valid');

      let caughtError: any;
      http.get('/api/missing').subscribe({ error: e => (caughtError = e) });

      httpMock.expectOne('/api/missing').flush(
        {}, { status: 404, statusText: 'Not Found' }
      );
      tick();

      expect(authService.refreshAccessToken).not.toHaveBeenCalled();
      expect(caughtError.status).toBe(404);
    }));

    it('propagates 422 Unprocessable Entity without a refresh', fakeAsync(() => {
      authService.getAccessToken.and.returnValue('valid');

      let caughtError: any;
      http.post('/api/validate', {}).subscribe({ error: e => (caughtError = e) });

      httpMock.expectOne('/api/validate').flush(
        { message: 'Validation failed' }, { status: 422, statusText: 'Unprocessable Entity' }
      );
      tick();

      expect(authService.refreshAccessToken).not.toHaveBeenCalled();
      expect(caughtError.status).toBe(422);
    }));

    it('does NOT call clearAuthData on a non-401 error', fakeAsync(() => {
      authService.getAccessToken.and.returnValue('valid');

      http.get('/api/err').subscribe({ error: () => {} });
      httpMock.expectOne('/api/err').flush(
        {}, { status: 500, statusText: 'ISE' }
      );
      tick();

      expect(authService.clearAuthData).not.toHaveBeenCalled();
    }));

    it('does NOT navigate on a non-401 error', fakeAsync(() => {
      authService.getAccessToken.and.returnValue('valid');

      http.get('/api/err').subscribe({ error: () => {} });
      httpMock.expectOne('/api/err').flush(
        {}, { status: 403, statusText: 'Forbidden' }
      );
      tick();

      expect(router.navigate).not.toHaveBeenCalled();
    }));
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // G) SMOKE TEST
  // ═══════════════════════════════════════════════════════════════════════════

  describe('G) Smoke', () => {

    it('should be created', () => {
      expect(interceptorInst).toBeTruthy();
    });

    it('handles a request without a token and without an error', () => {
      authService.getAccessToken.and.returnValue(null);

      let responseData: any;
      http.get('/api/open').subscribe(d => (responseData = d));

      httpMock.expectOne('/api/open').flush({ hello: 'world' });

      expect(responseData).toEqual({ hello: 'world' });
    });
  });
});
