/**
 * @file data-handler.service.spec.ts
 * @path src/app/core/services/data-handler.service.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests for {@link DataHandler}.
 *
 * `DataHandler` is a thin, centralized wrapper around `HttpClient` used
 * throughout the admin module. It has two responsibilities worth testing in
 * isolation:
 *
 *   1. **Request shaping** — building the right headers (JSON vs. multipart
 *      `FormData`), appending query params while skipping `null`/`undefined`
 *      values, and unwrapping the Laravel-style `{ data: T }` / `{ data: T[] }`
 *      envelope where the API uses one.
 *   2. **Error normalization** (`handleError`) — translating raw
 *      `HttpErrorResponse` objects (by status code, or a client-side
 *      `ErrorEvent`) into a single human-readable string, surfacing that
 *      string via `AlertDialogService.open(...)`, and re-throwing a plain
 *      `Error` so callers can still `catchError`/`subscribe({ error })`.
 *
 * We use `HttpClientTestingModule` / `HttpTestingController` to intercept
 * every outgoing request without touching the network, and a Jasmine spy for
 * `AlertDialogService` so we can assert exactly what gets shown to the user.
 *
 * @dependencies
 * - HttpClientTestingModule / HttpTestingController: Intercepts and flushes
 *   HTTP requests synchronously inside each test.
 * - AlertDialogService: Stubbed out; only `open(...)` is asserted on.
 *
 * @note `DataHandler` has no dependency on `ActivatedRoute`, so the
 * `PROVIDE_ACTIVATED_ROUTE` / `getRouterProviders()` helpers supplied
 * alongside this task are not required here and are intentionally not wired
 * into `TestBed.configureTestingModule`. They're kept available for sibling
 * spec files (e.g. route-parameter-driven components) that do need them.
 */

import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController
} from '@angular/common/http/testing';

import { DataHandler } from './data-handler.service';
import { AlertDialogService } from './alert-dialog.service';
import { environment } from '../../../environments/environment';
import { HttpErrorResponse } from '@angular/common/http';
describe('DataHandler', () => {
  let service: DataHandler;
  let httpMock: HttpTestingController;
  let alertDialogServiceSpy: jasmine.SpyObj<AlertDialogService>;

  const baseUrl = environment.base_api_url;

  /** Shape used for entity-typed responses across the suite. */
  interface TestEntity {
    id?: number;
    name?: string;
  }

  beforeEach(() => {
    alertDialogServiceSpy = jasmine.createSpyObj<AlertDialogService>('AlertDialogService', ['open']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        DataHandler,
        { provide: AlertDialogService, useValue: alertDialogServiceSpy }
      ]
    });

    service = TestBed.inject(DataHandler);
    httpMock = TestBed.inject(HttpTestingController);
  });

  /**
   * @description Ensures no unmatched/unflushed requests leak between tests,
   * which would otherwise silently mask assertions in later specs.
   */
  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // getCollection()
  // ═══════════════════════════════════════════════════════════════════════
  describe('getCollection()', () => {
    it('should GET the resource and return the array as-is when the response has no "data" wrapper', () => {
      const rows: TestEntity[] = [{ id: 1, name: 'Alpha' }, { id: 2, name: 'Beta' }];
      let result: TestEntity[] | undefined;

      service.getCollection<TestEntity>('items').subscribe(res => (result = res));

      const req = httpMock.expectOne(`${baseUrl}/items`);
      expect(req.request.method).toBe('GET');
      expect(req.request.headers.get('Accept')).toBe('application/json');
      expect(req.request.headers.get('Content-Type')).toBe('application/json');
      req.flush(rows);

      expect(result).toEqual(rows);
    });

    it('should unwrap the "data" key when the response is wrapped', () => {
      const rows: TestEntity[] = [{ id: 3, name: 'Gamma' }];
      let result: TestEntity[] | undefined;

      service.getCollection<TestEntity>('items').subscribe(res => (result = res));

      const req = httpMock.expectOne(`${baseUrl}/items`);
      req.flush({ data: rows });

      expect(result).toEqual(rows);
    });

    it('should append provided query params to the request URL', () => {
      service.getCollection<TestEntity>('items', { page: 2, per_page: 10 }).subscribe();

      const req = httpMock.expectOne(
        r => r.url === `${baseUrl}/items` &&
             r.params.get('page') === '2' &&
             r.params.get('per_page') === '10'
      );
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('should skip params whose value is null or undefined', () => {
      service.getCollection<TestEntity>('items', { page: 1, search: null, sort: undefined }).subscribe();

      // Parametr page=1 je přítomen, takže URL obsahuje query string
      const req = httpMock.expectOne(`${baseUrl}/items?page=1`);
      expect(req.request.params.has('page')).toBeTrue();
      expect(req.request.params.has('search')).toBeFalse();
      expect(req.request.params.has('sort')).toBeFalse();
      req.flush([]);
    });

    it('should not attach any params when none are provided', () => {
      service.getCollection<TestEntity>('items').subscribe();

      const req = httpMock.expectOne(`${baseUrl}/items`);
      expect(req.request.params.keys().length).toBe(0);
      req.flush([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // getPaginatedCollection()
  // ═══════════════════════════════════════════════════════════════════════
  describe('getPaginatedCollection()', () => {
    it('should GET the resource and return the raw (unwrapped) response', () => {
      const payload = { data: [{ id: 1 }], meta: { total: 1, per_page: 10 } };
      let result: any;

      service.getPaginatedCollection('items').subscribe(res => (result = res));

      const req = httpMock.expectOne(`${baseUrl}/items`);
      expect(req.request.method).toBe('GET');
      req.flush(payload);

      expect(result).toEqual(payload);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // get()
  // ═══════════════════════════════════════════════════════════════════════
  describe('get()', () => {
    it('should GET the resource and return the raw response untouched', () => {
      const payload = { foo: 'bar' };
      let result: any;

      service.get('config').subscribe(res => (result = res));

      const req = httpMock.expectOne(`${baseUrl}/config`);
      expect(req.request.method).toBe('GET');
      req.flush(payload);

      expect(result).toEqual(payload);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // getOne()
  // ═══════════════════════════════════════════════════════════════════════
  describe('getOne()', () => {
    it('should GET the resource and unwrap the "data" property', () => {
      const entity: TestEntity = { id: 5, name: 'Delta' };
      let result: TestEntity | undefined;

      service.getOne<TestEntity>('items/5').subscribe(res => (result = res));

      const req = httpMock.expectOne(`${baseUrl}/items/5`);
      expect(req.request.method).toBe('GET');
      req.flush({ data: entity });

      expect(result).toEqual(entity);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // post()
  // ═══════════════════════════════════════════════════════════════════════
  describe('post()', () => {
    it('should POST a JSON body with a JSON Content-Type header and unwrap "data"', () => {
      const payload = { name: 'New item' };
      const created: TestEntity = { id: 10, name: 'New item' };
      let result: TestEntity | undefined;

      service.post<TestEntity>('items', payload).subscribe(res => (result = res));

      const req = httpMock.expectOne(`${baseUrl}/items`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(payload);
      expect(req.request.headers.get('Content-Type')).toBe('application/json');
      expect(req.request.headers.get('Accept')).toBe('application/json');
      req.flush({ data: created });

      expect(result).toEqual(created);
    });

    it('should omit the Content-Type header when the payload is FormData', () => {
      const formData = new FormData();
      formData.append('name', 'New item');

      service.post<TestEntity>('items', formData).subscribe();

      const req = httpMock.expectOne(`${baseUrl}/items`);
      expect(req.request.body).toBe(formData);
      expect(req.request.headers.has('Content-Type')).toBeFalse();
      expect(req.request.headers.get('Accept')).toBe('application/json');
      req.flush({ data: {} });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // put()
  // ═══════════════════════════════════════════════════════════════════════
  describe('put()', () => {
    it('should PUT a JSON body and unwrap "data"', () => {
      const payload: TestEntity = { id: 11, name: 'Updated' };
      let result: TestEntity | undefined;

      service.put<TestEntity>('items/11', payload).subscribe(res => (result = res));

      const req = httpMock.expectOne(`${baseUrl}/items/11`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(payload);
      expect(req.request.headers.get('Content-Type')).toBe('application/json');
      req.flush({ data: payload });

      expect(result).toEqual(payload);
    });

    it('should omit the Content-Type header when the payload is FormData', () => {
      const formData = new FormData();
      formData.append('name', 'Updated');

      service.put<TestEntity>('items/11', formData).subscribe();

      const req = httpMock.expectOne(`${baseUrl}/items/11`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.headers.has('Content-Type')).toBeFalse();
      req.flush({ data: {} });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // patch()
  // ═══════════════════════════════════════════════════════════════════════
  describe('patch()', () => {
    it('should PATCH a JSON body and unwrap "data"', () => {
      const payload: Partial<TestEntity> = { name: 'Patched' };
      const patched: TestEntity = { id: 12, name: 'Patched' };
      let result: TestEntity | undefined;

      service.patch<TestEntity>('items/12', payload).subscribe(res => (result = res));

      const req = httpMock.expectOne(`${baseUrl}/items/12`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(payload);
      expect(req.request.headers.get('Content-Type')).toBe('application/json');
      req.flush({ data: patched });

      expect(result).toEqual(patched);
    });

    it('should omit the Content-Type header when the payload is FormData', () => {
      const formData = new FormData();
      formData.append('name', 'Patched');

      service.patch<TestEntity>('items/12', formData).subscribe();

      const req = httpMock.expectOne(`${baseUrl}/items/12`);
      expect(req.request.headers.has('Content-Type')).toBeFalse();
      req.flush({ data: {} });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // delete()
  // ═══════════════════════════════════════════════════════════════════════
  describe('delete()', () => {
   it('should send a DELETE request to the resource and complete with void', () => {
      let completed = false;

      service.delete('items/9').subscribe(res => {
        expect(res).toBeNull(); // Změněno z toBeUndefined() na toBeNull() dle req.flush(null)
        completed = true;
      });

      const req = httpMock.expectOne(`${baseUrl}/items/9`);
      expect(req.request.method).toBe('DELETE');
      expect(req.request.headers.get('Content-Type')).toBe('application/json');
      req.flush(null);

      expect(completed).toBeTrue();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // upload()
  // ═══════════════════════════════════════════════════════════════════════
  describe('upload()', () => {
    it('should POST the FormData payload without a Content-Type header and return the raw response', () => {
      const formData = new FormData();
      formData.append('file', new Blob(['content']), 'file.png');
      const response = { url: 'https://example.com/file.png' };
      let result: any;

      service.upload<{ url: string }>('items/9/upload', formData).subscribe(res => (result = res));

      const req = httpMock.expectOne(`${baseUrl}/items/9/upload`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toBe(formData);
      expect(req.request.headers.has('Content-Type')).toBeFalse();
      expect(req.request.headers.get('Accept')).toBe('application/json');
      req.flush(response);

      expect(result).toEqual(response);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // handleError() — exercised indirectly through every public method's
  // catchError(this.handleError) pipe. get() is used as the vehicle for
  // most cases since the error path is identical regardless of verb.
  // ═══════════════════════════════════════════════════════════════════════
  describe('error normalization (handleError)', () => {
    /**
     * @description Fires a GET request through the service, flushes it as an
     * error with the given status/body/statusText, and returns the message
     * the resulting Observable errors with.
     */
    function triggerHttpError(
      httpMockRef: HttpTestingController,
      errorBody: any,
      status: number,
      statusText: string = ''
    ): Promise<string> {
      return new Promise(resolve => {
        service.get('items').subscribe({
          error: (err: Error) => resolve(err.message)
        });

        const req = httpMockRef.expectOne(`${baseUrl}/items`);
        req.flush(errorBody, { status, statusText });
      });
    }

    it('should report a client-side error (ErrorEvent) with its message', (done) => {
      service.get('items').subscribe({
        error: (err: Error) => {
          expect(err.message).toBe('Client-side error: connection reset');
          expect(alertDialogServiceSpy.open).toHaveBeenCalledWith(
            'API Error',
            'Client-side error: connection reset',
            'danger'
          );
          done();
        }
      });

      const req = httpMock.expectOne(`${baseUrl}/items`);
      req.error(new ErrorEvent('Network error', { message: 'connection reset' }));
    });

    it('should report a connection-level failure for status 0', async () => {
      const message = await triggerHttpError(httpMock, {}, 0);
      expect(message).toBe('Unable to connect to the server. Please check your network connection or if the API is running.');
      expect(alertDialogServiceSpy.open).toHaveBeenCalledWith('API Error', message, 'danger');
    });

    it('should report the dedicated message for a 403 CANNOT_DELETE_OWN_ACCOUNT error_code', async () => {
      const message = await triggerHttpError(
        httpMock,
        { error_code: 'CANNOT_DELETE_OWN_ACCOUNT' },
        403
      );
      expect(message).toBe('Cannot delete the user you are currently logged in as.');
    });

    it('should surface the backend "message" for a generic 403 with an explicit message', async () => {
      const message = await triggerHttpError(httpMock, { message: 'Forbidden resource' }, 403);
      expect(message).toBe('Forbidden resource');
    });

    it('should fall back to a generic delete-error message for a 403 with no message/error_code', async () => {
      const message = await triggerHttpError(httpMock, {}, 403);
      expect(message).toBe('An error occurred while deleting the item.');
    });

    it('should join validation errors for a 422 response', async () => {
      const message = await triggerHttpError(
        httpMock,
        { errors: { name: ['Name is required'], email: ['Email is invalid'] } },
        422
      );
      expect(message).toBe('Validation error (422): Name is required; Email is invalid');
    });

    it('should surface the backend "message" for a generic 4xx (non-403/422) error', async () => {
      const message = await triggerHttpError(httpMock, { message: 'Item is locked' }, 409);
      expect(message).toBe('Client error (409): Item is locked');
    });

    it('should join validation errors for a generic 4xx error that has "errors" but no "message"', async () => {
      const message = await triggerHttpError(
        httpMock,
        { errors: { quantity: ['Must be positive'] } },
        400
      );
      expect(message).toBe('Validation error (400): Must be positive');
    });

    it('should fall back to status/statusText for a 4xx error with neither "message" nor "errors"', async () => {
      const message = await triggerHttpError(httpMock, {}, 404, 'Not Found');
      expect(message).toBe('Client error: 404 Not Found');
    });

    it('should report a generic server error for a 5xx response', async () => {
      const message = await triggerHttpError(httpMock, {}, 500, 'Internal Server Error');
      expect(message).toBe('Server error (500): Internal Server Error');
    });

    it('should always display the normalized message via AlertDialogService.open(...)', async () => {
      const message = await triggerHttpError(httpMock, { message: 'Boom' }, 400);
      expect(alertDialogServiceSpy.open).toHaveBeenCalledWith('API Error', message, 'danger');
      expect(alertDialogServiceSpy.open).toHaveBeenCalledTimes(1);
    });

    it('should propagate the normalized error to every calling method\'s pipe, not just get()', (done) => {
      service.post('items', { name: 'x' }).subscribe({
        error: (err: Error) => {
          expect(err.message).toBe('Client error (422): Bad payload');
          done();
        }
      });

      const req = httpMock.expectOne(`${baseUrl}/items`);
      req.flush({ message: 'Bad payload' }, { status: 422, statusText: 'Unprocessable Entity' });
    });
  });
});