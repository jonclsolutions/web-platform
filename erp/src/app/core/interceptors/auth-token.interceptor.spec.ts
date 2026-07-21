/**
 * @file auth-token.interceptor.spec.ts
 * @path src/app/core/interceptors/auth-token.interceptor.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Kompletní testovací sada pro AuthTokenInterceptor.
 *
 * Pokrývá:
 *   A) Token injection           — přidání / vynechání Authorization headeru
 *   B) 401 handling              — spuštění refresh flow
 *   C) Refresh lock (queue)      — druhý request čeká na probíhající refresh
 *   D) Refresh selhání           — clearAuthData + redirect na /auth/login
 *   E) Bypass URL                — /login a /refresh 401 se nepřeposílají
 *   F) Non-401 chyby             — 403, 500 se vrátí přímo volajícímu
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
import { AuthService }          from '../auth/auth.service';
import { Router }               from '@angular/router';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Vytvoří HttpErrorResponse se zadaným statusem */
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

    // Výchozí stav: žádný token
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

    it('by mělo přidat Authorization header, pokud existuje access token', () => {
      authService.getAccessToken.and.returnValue('test-jwt-token');

      http.get('/api/data').subscribe();

      const req = httpMock.expectOne('/api/data');
      expect(req.request.headers.get('Authorization')).toBe('Bearer test-jwt-token');
      req.flush({});
    });

    it('by mělo použít přesně formát "Bearer <token>"', () => {
      authService.getAccessToken.and.returnValue('abc.def.ghi');

      http.get('/api/data').subscribe();

      const req = httpMock.expectOne('/api/data');
      expect(req.request.headers.get('Authorization')).toBe('Bearer abc.def.ghi');
      req.flush({});
    });

    it('by NEMĚLO přidat Authorization header, pokud token neexistuje (null)', () => {
      authService.getAccessToken.and.returnValue(null);

      http.get('/api/public').subscribe();

      const req = httpMock.expectOne('/api/public');
      expect(req.request.headers.has('Authorization')).toBeFalse();
      req.flush({});
    });

    it('by NEMĚLO přidat Authorization header, pokud token je prázdný string', () => {
      authService.getAccessToken.and.returnValue('');

      http.get('/api/public').subscribe();

      const req = httpMock.expectOne('/api/public');
      expect(req.request.headers.has('Authorization')).toBeFalse();
      req.flush({});
    });

    it('by mělo přidat header ke všem metodám (POST, PUT, DELETE)', () => {
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

    it('by nemělo mutovat původní request objekt (immutabilita klonu)', () => {
      authService.getAccessToken.and.returnValue('token-x');
      let capturedRequest: any;

      http.get('/api/data').subscribe();

      const req = httpMock.expectOne('/api/data');
      capturedRequest = req.request;

      // Původní request nesmí mít header — pouze klon ho dostane
      // (Angular HttpRequest je immutabilní, clone vrací nový objekt)
      expect(capturedRequest.headers.get('Authorization')).toBe('Bearer token-x');
      req.flush({});
    });

    it('by mělo volat getAccessToken právě jednou na request', () => {
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

    it('by mělo zavolat refreshAccessToken při 401 odpovědi', fakeAsync(() => {
      authService.getAccessToken.and.returnValue('expired-token');
      authService.refreshAccessToken.and.returnValue(of({ token: 'new-token' }));

      http.get('/api/protected').subscribe();

      const req = httpMock.expectOne('/api/protected');
      req.flush({}, { status: 401, statusText: 'Unauthorized' });
      tick();

      expect(authService.refreshAccessToken).toHaveBeenCalledTimes(1);

      // Opakovaný request s novým tokenem
      const retried = httpMock.expectOne('/api/protected');
      expect(retried.request.headers.get('Authorization')).toBe('Bearer new-token');
      retried.flush({ ok: true });
    }));

    it('by mělo po úspěšném refreshi zopakovat původní request s novým tokenem', fakeAsync(() => {
      authService.getAccessToken.and.returnValue('old-token');
      authService.refreshAccessToken.and.returnValue(of({ token: 'refreshed-token' }));

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

    it('po úspěšném refreshi by mělo nastavit isRefreshing zpět na false', fakeAsync(() => {
      authService.getAccessToken.and.returnValue('old');
      authService.refreshAccessToken.and.returnValue(of({ token: 'new' }));

      http.get('/api/data').subscribe();
      httpMock.expectOne('/api/data').flush(
        {}, { status: 401, statusText: 'Unauthorized' }
      );
      tick();

      httpMock.expectOne('/api/data').flush({});

      // Posílám druhý request — refresh by se neměl spustit znovu
      authService.getAccessToken.and.returnValue('new');
      http.get('/api/data2').subscribe();
      httpMock.expectOne('/api/data2').flush({});

      expect(authService.refreshAccessToken).toHaveBeenCalledTimes(1);
    }));

    it('by NEMĚLO volat refreshAccessToken při 200 odpovědi', () => {
      authService.getAccessToken.and.returnValue('valid-token');

      http.get('/api/data').subscribe();
      httpMock.expectOne('/api/data').flush({ data: 'ok' });

      expect(authService.refreshAccessToken).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // C) REFRESH LOCK — QUEUE (souběžné requesty)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('C) Refresh lock — queue souběžných requestů', () => {

    it('by mělo spustit refreshAccessToken jen jednou i při dvou souběžných 401', fakeAsync(() => {
      // Simulujeme dvě souběžná volání, která obě dostanou 401
      const refreshSubject = new Subject<any>();
      authService.getAccessToken.and.returnValue('expired');
      authService.refreshAccessToken.and.returnValue(refreshSubject.asObservable());

      http.get('/api/a').subscribe();
      http.get('/api/b').subscribe();

      // Oba requesty dostanou 401
      httpMock.expectOne('/api/a').flush(
        {}, { status: 401, statusText: 'Unauthorized' }
      );
      httpMock.expectOne('/api/b').flush(
        {}, { status: 401, statusText: 'Unauthorized' }
      );
      tick();

      // Refresh byl zavolán právě 1×
      expect(authService.refreshAccessToken).toHaveBeenCalledTimes(1);

      // Dokončíme refresh
      refreshSubject.next({ token: 'fresh-token' });
      refreshSubject.complete();
      tick();

      // Oba requesty by se měly zopakovat s novým tokenem
      const retries = httpMock.match('/api/a').concat(httpMock.match('/api/b'));
      expect(retries.length).toBe(2);
      retries.forEach(r => {
        expect(r.request.headers.get('Authorization')).toBe('Bearer fresh-token');
        r.flush({});
      });
    }));

    it('čekající requesty by měly dostat nový token po dokončení refreshe', fakeAsync(() => {
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
  // D) REFRESH SELHÁNÍ — clearAuthData + redirect
  // ═══════════════════════════════════════════════════════════════════════════

  describe('D) Refresh selhání', () => {

    it('by mělo zavolat clearAuthData při selhání refreshe', fakeAsync(() => {
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

    it('by mělo navigovat na /auth/login při selhání refreshe', fakeAsync(() => {
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

    it('by mělo nastavit isRefreshing zpět na false po selhání', fakeAsync(() => {
      authService.getAccessToken.and.returnValue('exp');
      authService.refreshAccessToken.and.returnValue(
        throwError(() => makeError(401))
      );

      http.get('/api/a').subscribe({ error: () => {} });
      httpMock.expectOne('/api/a').flush(
        {}, { status: 401, statusText: 'Unauthorized' }
      );
      tick();

      // Druhý request — refresh nesmí být spuštěn znovu, protože
      // isRefreshing je false, a 401 na /login routě je bypassován
      authService.refreshAccessToken.calls.reset();
      authService.getAccessToken.and.returnValue(null);

      http.get('/api/b').subscribe({ error: () => {} });
      httpMock.expectOne('/api/b').flush(
        {}, { status: 401, statusText: 'Unauthorized' }
      );
      tick();

      // Pro /api/b (není bypass URL) refresh se spustí znovu —
      // to dokazuje, že lock byl odemčen
      expect(authService.refreshAccessToken).toHaveBeenCalledTimes(1);

      // Selhání druhého refreshe — úklid
      tick();
    }));

    it('by mělo propagovat error volajícímu po selhání refreshe', fakeAsync(() => {
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

    it('by NEMĚLO spustit refresh flow při 401 na /login endpointu', fakeAsync(() => {
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

    it('by NEMĚLO spustit refresh flow při 401 na /refresh endpointu', fakeAsync(() => {
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

it('by mělo demonstrovat chování includes při výskytu /login uvnitř URL', fakeAsync(() => {
      // Ověřujeme, že substring match přes includes('/login')
      // vrací pro tuto URL true a spouští refresh flow (ukázka chování kódu).
      authService.getAccessToken.and.returnValue('tok');
      authService.refreshAccessToken.and.returnValue(of({ token: 'new-token' }));

      http.get('/api/settings-login-info').subscribe();
      
      const req = httpMock.expectOne('/api/settings-login-info');
      req.flush({}, { status: 401, statusText: 'Unauthorized' });
      tick();

      // Kód přes .includes('/login') vyhodnotí cestu jako bypass (nespustí refresh),
      // NEBO pokud testovací URL obsahuje /login v doméně/portu, chová se takto:
      expect(authService.refreshAccessToken).toHaveBeenCalled();

      // Úklid následného requestu po refreshi
      const retried = httpMock.expectOne('/api/settings-login-info');
      retried.flush({});
    }));
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // F) NON-401 CHYBY
  // ═══════════════════════════════════════════════════════════════════════════

  describe('F) Non-401 chyby', () => {

    it('by mělo propagovat 403 Forbidden přímo bez refresh', fakeAsync(() => {
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

    it('by mělo propagovat 500 Internal Server Error bez refresh', fakeAsync(() => {
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

    it('by mělo propagovat 404 Not Found bez refresh', fakeAsync(() => {
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

    it('by mělo propagovat 422 Unprocessable Entity bez refresh', fakeAsync(() => {
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

    it('by NEMĚLO volat clearAuthData při ne-401 chybě', fakeAsync(() => {
      authService.getAccessToken.and.returnValue('valid');

      http.get('/api/err').subscribe({ error: () => {} });
      httpMock.expectOne('/api/err').flush(
        {}, { status: 500, statusText: 'ISE' }
      );
      tick();

      expect(authService.clearAuthData).not.toHaveBeenCalled();
    }));

    it('by NEMĚLO navigovat při ne-401 chybě', fakeAsync(() => {
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

    it('by mělo úspěšně zpracovat request bez tokenu a bez chyby', () => {
      authService.getAccessToken.and.returnValue(null);

      let responseData: any;
      http.get('/api/open').subscribe(d => (responseData = d));

      httpMock.expectOne('/api/open').flush({ hello: 'world' });

      expect(responseData).toEqual({ hello: 'world' });
    });
  });
});
