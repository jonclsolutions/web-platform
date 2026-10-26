/**
 * @file password-confirmation.interceptor.spec.ts
 * @path src/app/core/interceptors/password-confirmation.interceptor.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026-10-26
 * @description Unit tests of PasswordConfirmationInterceptor: a 403 PASSWORD_CONFIRMATION_REQUIRED
 *   asks for the password of its scope and repeats the request once; cancelled = the original 403;
 *   other errors and the confirmation request itself pass untouched; a second refusal of the
 *   repeat is not prompted again.
 * @dependencies
 * - HttpClientTestingModule; PasswordConfirmationService spy.
 */

import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { HTTP_INTERCEPTORS, HttpClient, HttpErrorResponse, HttpRequest } from '@angular/common/http';
import { firstValueFrom, throwError } from 'rxjs';

import { PasswordConfirmationInterceptor } from './password-confirmation.interceptor';
import { PasswordConfirmationService } from '../services/password-confirmation.service';

describe('PasswordConfirmationInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let confirmation: jasmine.SpyObj<PasswordConfirmationService>;
  const required = { message: 'Confirm this operation with your password.', error_code: 'PASSWORD_CONFIRMATION_REQUIRED', scope: 'user:7' };
  const flushAsync = () => new Promise(resolve => setTimeout(resolve));

  beforeEach(() => {
    confirmation = jasmine.createSpyObj('PasswordConfirmationService', ['confirm']);
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: HTTP_INTERCEPTORS, useClass: PasswordConfirmationInterceptor, multi: true },
        { provide: PasswordConfirmationService, useValue: confirmation },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });
  afterEach(() => httpMock.verify());

  /**
   * @description Confirmed → the same request is sent again and its answer reaches the caller.
   * @input DELETE /api/users/7 → 403 required (scope user:7); confirm resolves true; repeat → 204-like null.
   * @output confirm('user:7') 1×; the caller gets the answer of the repeat.
   */
  it('repeats the request once the password is confirmed', async () => {
    confirmation.confirm.and.resolveTo(true);
    const result = firstValueFrom(http.delete('/api/users/7'));
    httpMock.expectOne('/api/users/7').flush(required, { status: 403, statusText: 'Forbidden' });
    await flushAsync();
    const repeat = httpMock.expectOne('/api/users/7');
    expect(repeat.request.method).toBe('DELETE');
    repeat.flush({ data: { ok: true } });

    expect(await result).toEqual({ data: { ok: true } });
    expect(confirmation.confirm).toHaveBeenCalledOnceWith('user:7');
  });

  /**
   * @description Cancelled → the original 403 reaches the caller; nothing is sent again.
   * @input PUT /api/users/7 → 403 required; confirm resolves false.
   * @output HttpErrorResponse 403 with error_code PASSWORD_CONFIRMATION_REQUIRED; no repeat.
   */
  it('passes the refusal on when cancelled', async () => {
    confirmation.confirm.and.resolveTo(false);
    const result = firstValueFrom(http.put('/api/users/7', {}));
    httpMock.expectOne('/api/users/7').flush(required, { status: 403, statusText: 'Forbidden' });

    const error = await result.catch(e => e) as HttpErrorResponse;
    expect(error.status).toBe(403);
    expect(error.error.error_code).toBe('PASSWORD_CONFIRMATION_REQUIRED');
    httpMock.expectNone('/api/users/7');
  });

  /**
   * @description A repeat refused again is not prompted a second time (no loop).
   * @input 403 required; confirm true; repeat → 403 required again.
   * @output confirm 1×; the caller gets the second 403.
   */
  it('does not prompt again for the repeat', async () => {
    confirmation.confirm.and.resolveTo(true);
    const result = firstValueFrom(http.delete('/api/users/7'));
    httpMock.expectOne('/api/users/7').flush(required, { status: 403, statusText: 'Forbidden' });
    await flushAsync();
    httpMock.expectOne('/api/users/7').flush(required, { status: 403, statusText: 'Forbidden' });

    const error = await result.catch(e => e) as HttpErrorResponse;
    expect(error.status).toBe(403);
    expect(confirmation.confirm).toHaveBeenCalledTimes(1);
  });

  /**
   * @description Other errors pass untouched: another 403 code, a 403 without scope / with an
   *   empty scope, a non-HTTP error body, a 422; the confirmation request itself is not intercepted.
   * @input 403 CANNOT_DELETE_OWN_ACCOUNT; 403 required without scope; 403 scope ''; 403 null body;
   *   422 required; POST /api/confirm-password → 403 required.
   * @output Each request errors with its own status; confirm never called.
   */
  it('ignores other errors and the confirmation request', async () => {
    const cases: Array<[string, any, number]> = [
      ['/a', { error_code: 'CANNOT_DELETE_OWN_ACCOUNT' }, 403],
      ['/b', { error_code: 'PASSWORD_CONFIRMATION_REQUIRED' }, 403],
      ['/c', { error_code: 'PASSWORD_CONFIRMATION_REQUIRED', scope: '' }, 403],
      ['/d', null, 403],
      ['/e', required, 422],
      ['/api/confirm-password', required, 403],
    ];
    for (const [url, body, status] of cases) {
      const result = firstValueFrom(http.post(url, {}));
      httpMock.expectOne(url).flush(body, { status, statusText: 'Error' });
      const error = await result.catch(e => e) as HttpErrorResponse;
      expect(error.status).withContext(url).toBe(status);
    }
    expect(confirmation.confirm).not.toHaveBeenCalled();
  });

  /**
   * @description A network error (not an HttpErrorResponse with a body) passes untouched.
   * @input GET /x → ProgressEvent error.
   * @output status 0; confirm never called.
   */
  it('passes network errors', async () => {
    const result = firstValueFrom(http.get('/x'));
    httpMock.expectOne('/x').error(new ProgressEvent('error'));
    const error = await result.catch(e => e) as HttpErrorResponse;
    expect(error.status).toBe(0);
    expect(confirmation.confirm).not.toHaveBeenCalled();
  });

  /**
   * @description An error that is not an HttpErrorResponse (thrown by an inner handler) passes untouched.
   * @input intercept() with a handler throwing Error('boom').
   * @output the same Error; confirm never called.
   */
  it('passes non-HTTP errors', async () => {
    const interceptor = new PasswordConfirmationInterceptor(confirmation);
    const boom = new Error('boom');
    const handler = { handle: () => throwError(() => boom) };
    const error = await firstValueFrom(interceptor.intercept(new HttpRequest('GET', '/y'), handler)).catch(e => e);
    expect(error).toBe(boom);
    expect(confirmation.confirm).not.toHaveBeenCalled();
  });
});
