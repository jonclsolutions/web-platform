/**
 * @file data-handler.service.spec.ts
 * @path src/app/core/services/data-handler.service.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of DataHandler (admin HTTP wrapper): request shaping (headers, query
 *   params, `{data}` unwrapping, multipart PUT / PATCH via POST + `_method`) and the single error
 *   dialog of handleError (translated texts with placeholders, original error rethrown).
 * @dependencies
 * - HttpTestingController (no real request), AlertDialogService spy, AdminLocalizationService stub
 *   whose templates contain the placeholders the service fills in.
 */

import { TestBed } from '@angular/core/testing';
import { provideHttpClient, HttpErrorResponse } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { DataHandler } from './data-handler.service';
import { AlertDialogService } from './alert-dialog.service';
import { AdminLocalizationService } from './admin-localization.service';
import { environment } from '../../../environments/environment';

/** Translation templates of the `data-handler` section used by the stub. */
const TEMPLATES: Record<string, string> = {
  'data-handler.unknown_error': 'Unknown error',
  'data-handler.client_side_error': 'Client-side error: {message}',
  'data-handler.network_error': 'No connection',
  'data-handler.cannot_delete_own_account': 'Cannot delete own account',
  'data-handler.forbidden_fallback': 'Forbidden',
  'data-handler.validation_error': 'Validation ({status}): {errors}',
  'data-handler.client_error_with_message': 'Client ({status}): {message}',
  'data-handler.client_error': 'Client error {status} {statusText}',
  'data-handler.server_error': 'Server ({status}): {statusText}',
  'data-handler.server_error_default_text': 'Internal error',
  'data-handler.dialog_title': 'Error'
};

describe('DataHandler', () => {
  let service: DataHandler;
  let http: HttpTestingController;
  let alert: jasmine.SpyObj<AlertDialogService>;
  let getValue: jasmine.Spy;
  const base = environment.base_api_url;

  beforeEach(() => {
    alert = jasmine.createSpyObj<AlertDialogService>('AlertDialogService', ['open']);
    getValue = jasmine.createSpy('getValue').and.callFake((key: string) => TEMPLATES[key] ?? key);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        { provide: AlertDialogService, useValue: alert },
        { provide: AdminLocalizationService, useValue: { getValue } }
      ]
    });
    service = TestBed.inject(DataHandler);
    http = TestBed.inject(HttpTestingController);
    spyOn(console, 'error');
  });

  afterEach(() => http.verify());

  /**
   * @description Fails a GET with the given error and returns what reached the subscriber.
   * @param error HttpErrorResponse init (status, statusText, error body).
   * @returns The error passed to the subscriber's error callback.
   */
  function failWith(error: { status: number; statusText?: string; error?: any }): any {
    let received: any;
    service.get('items').subscribe({ error: e => (received = e) });
    http.expectOne(`${base}/items`).flush(error.error ?? null, { status: error.status, statusText: error.statusText ?? '' });
    return received;
  }

  /**
   * @description Collections: JSON headers, params without null / undefined, `{data}` unwrapped
   *   when present, plain arrays returned as they are.
   * @input getCollection('items', {page: 2, search: null, sort: undefined}) answered {data: [A]};
   *        getCollection('items') answered [B].
   * @output GET with Accept + Content-Type JSON and only page=2; results [A] and [B].
   */
  it('getCollection unwraps data and skips empty params', () => {
    let first: any; let second: any;
    service.getCollection('items', { page: 2, search: null, sort: undefined }).subscribe(r => (first = r));
    const req = http.expectOne(r => r.url === `${base}/items`);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe('application/json');
    expect(req.request.headers.get('Content-Type')).toBe('application/json');
    expect(req.request.params.keys()).toEqual(['page']);
    expect(req.request.params.get('page')).toBe('2');
    req.flush({ data: [{ id: 1 }] });

    service.getCollection('items').subscribe(r => (second = r));
    http.expectOne(`${base}/items`).flush([{ id: 2 }]);

    expect(first).toEqual([{ id: 1 }]);
    expect(second).toEqual([{ id: 2 }]);
  });

  /**
   * @description get / getPaginatedCollection return the raw body; getOne unwraps `{data}` only
   *   when the backend wrapped it.
   * @input get → {a: 1}; getPaginatedCollection → {data: [], total: 0}; getOne → {data: {id: 1}}; getOne → {id: 2}.
   * @output {a: 1}; the full paginated object; {id: 1}; {id: 2}.
   */
  it('get, getPaginatedCollection and getOne', () => {
    const results: any[] = [];
    service.get('a').subscribe(r => results.push(r));
    http.expectOne(`${base}/a`).flush({ a: 1 });
    service.getPaginatedCollection('p').subscribe(r => results.push(r));
    http.expectOne(`${base}/p`).flush({ data: [], total: 0 });
    service.getOne('o').subscribe(r => results.push(r));
    http.expectOne(`${base}/o`).flush({ data: { id: 1 } });
    service.getOne('o').subscribe(r => results.push(r));
    http.expectOne(`${base}/o`).flush({ id: 2 });

    expect(results).toEqual([{ a: 1 }, { data: [], total: 0 }, { id: 1 }, { id: 2 }]);
  });

  /**
   * @description post / put / patch send JSON and unwrap `{data}`; delete sends DELETE.
   * @input post({n: 1}), put({n: 2}), patch({n: 3}) answered {data: {...}}; delete('items/1').
   * @output Methods POST / PUT / PATCH / DELETE with the bodies; unwrapped results.
   */
  it('post, put, patch and delete with JSON bodies', () => {
    const results: any[] = [];
    service.post('items', { n: 1 }).subscribe(r => results.push(r));
    service.put('items/1', { n: 2 }).subscribe(r => results.push(r));
    service.patch('items/1', { n: 3 }).subscribe(r => results.push(r));
    service.delete('items/1').subscribe(() => results.push('deleted'));

    const reqs = http.match(() => true);
    expect(reqs.map(r => [r.request.method, r.request.body])).toEqual([
      ['POST', { n: 1 }], ['PUT', { n: 2 }], ['PATCH', { n: 3 }], ['DELETE', null]
    ]);
    reqs[0].flush({ data: 'created' });
    reqs[1].flush({ data: 'replaced' });
    reqs[2].flush({ data: 'patched' });
    reqs[3].flush(null);

    expect(results).toEqual(['created', 'replaced', 'patched', 'deleted']);
  });

  /**
   * @description Bare (unwrapped) answers of create / update endpoints are returned as they are
   *   (bugfix 2026-10-23, finding #6 - they were `undefined` before); arrays are never unwrapped;
   *   postWithMeta keeps the meta fields next to the record and wraps a bare answer.
   * @input put / post / patch answered {id: 5, name: 'A'} (no wrapper), post answered [1, 2];
   *   postWithMeta answered {data: {id: 1}, activation_email_sent: false} and {id: 2}.
   * @output {id 5, name A} ×3; [1, 2]; {data {id 1}, activation_email_sent false}; {data {id 2}}.
   */
  it('accepts bare create / update answers and keeps meta fields', () => {
    const results: any[] = [];
    service.put('users/5', { name: 'A' }).subscribe(r => results.push(r));
    service.post('users', { name: 'A' }).subscribe(r => results.push(r));
    service.patch('users/5', { name: 'A' }).subscribe(r => results.push(r));
    service.post('list', {}).subscribe(r => results.push(r));
    service.postWithMeta('core/users', { a: 1 }).subscribe(r => results.push(r));
    service.postWithMeta('core/users', { a: 2 }).subscribe(r => results.push(r));
    const reqs = http.match(() => true);
    [0, 1, 2].forEach(i => reqs[i].flush({ id: 5, name: 'A' }));
    reqs[3].flush([1, 2]);
    reqs[4].flush({ data: { id: 1 }, activation_email_sent: false });
    reqs[5].flush({ id: 2 });
    expect(results).toEqual([
      { id: 5, name: 'A' }, { id: 5, name: 'A' }, { id: 5, name: 'A' }, [1, 2],
      { data: { id: 1 }, activation_email_sent: false }, { data: { id: 2 } }
    ]);
  });

  /**
   * @description Multipart bodies: PUT / PATCH with FormData go as POST with `_method` (PHP does
   *   not parse multipart PUT), without a JSON Content-Type (browser sets the boundary);
   *   upload / uploadPut POST the FormData and return the raw body.
   * @input put('items/1', FormData), patch('items/1', FormData), upload('files', FormData), uploadPut('files/1', FormData).
   * @output 4 × POST; `_method` PUT / PATCH; no Content-Type; results unwrapped / raw.
   */
  it('sends FormData as POST with a method override', () => {
    const results: any[] = [];
    const form = () => { const f = new FormData(); f.append('file', new Blob(['x']), 'a.txt'); return f; };
    service.put('items/1', form()).subscribe(r => results.push(r));
    service.patch('items/1', form()).subscribe(r => results.push(r));
    service.upload('files', form()).subscribe(r => results.push(r));
    service.uploadPut('files/1', form()).subscribe(r => results.push(r));

    const reqs = http.match(() => true);
    expect(reqs.map(r => r.request.method)).toEqual(['POST', 'POST', 'POST', 'POST']);
    expect((reqs[0].request.body as FormData).get('_method')).toBe('PUT');
    expect((reqs[1].request.body as FormData).get('_method')).toBe('PATCH');
    expect(reqs.every(r => r.request.headers.has('Content-Type'))).toBeFalse();
    reqs[0].flush({ data: 'put' });
    reqs[1].flush({ data: 'patch' });
    reqs[2].flush({ id: 9 });
    reqs[3].flush({ id: 10 });

    expect(results).toEqual(['put', 'patch', { id: 9 }, { id: 10 }]);
  });

  /**
   * @description Network / client-side failures: status 0 shows the connection text, an
   *   ErrorEvent its message; the ORIGINAL HttpErrorResponse reaches the caller.
   * @input Request failing with status 0; request failing with an ErrorEvent('reset').
   * @output Dialog ('Error', 'No connection', 'danger'); dialog 'Client-side error: reset'; the
   *   subscriber gets the HttpErrorResponse.
   */
  it('reports network and client-side errors', () => {
    const received = failWith({ status: 0 });
    expect(alert.open).toHaveBeenCalledWith('Error', 'No connection', 'danger');
    expect(received instanceof HttpErrorResponse).toBeTrue();
    expect(received.status).toBe(0);

    service.get('items').subscribe({ error: () => undefined });
    http.expectOne(`${base}/items`).error(new ErrorEvent('network', { message: 'reset' }));
    expect(alert.open).toHaveBeenCalledWith('Error', 'Client-side error: reset', 'danger');
  });

  /**
   * @description 403: own-account code, backend message, fallback text.
   * @input 403 {error_code: CANNOT_DELETE_OWN_ACCOUNT}; 403 {message: 'No access'}; 403 without body.
   * @output 'Cannot delete own account'; 'No access'; 'Forbidden'.
   */
  it('reports forbidden errors', () => {
    failWith({ status: 403, error: { error_code: 'CANNOT_DELETE_OWN_ACCOUNT' } });
    failWith({ status: 403, error: { message: 'No access' } });
    failWith({ status: 403 });

    expect(alert.open.calls.allArgs().map(a => a[1])).toEqual(['Cannot delete own account', 'No access', 'Forbidden']);
  });

  /**
   * @description 4xx: validation errors joined, backend message, errors without 422, status
   *   text only (trimmed when empty). Placeholder values from the backend are inserted literally.
   * @input 422 {errors: {name: [a], email: [b]}}; 409 {message: 'Locked $1 {status}'}; 400 {errors: {x: [c]}};
   *        404 'Not Found' without body; 404 with a blank status text (HTTP/2 sends none).
   * @output 'Validation (422): a; b'; 'Client (409): Locked $1 {status}'; 'Validation (400): c';
   *   'Client error 404 Not Found'; 'Client error 404'.
   */
  it('reports client errors', () => {
    failWith({ status: 422, error: { errors: { name: ['a'], email: ['b'] } } });
    failWith({ status: 409, error: { message: 'Locked $1 {status}' } });
    failWith({ status: 400, error: { errors: { x: ['c'] } } });
    failWith({ status: 404, statusText: 'Not Found' });
    failWith({ status: 404, statusText: ' ' });

    expect(alert.open.calls.allArgs().map(a => a[1])).toEqual([
      'Validation (422): a; b', 'Client (409): Locked $1 {status}', 'Validation (400): c', 'Client error 404 Not Found', 'Client error 404'
    ]);
  });

  /**
   * @description 5xx: status text or the default text; an unexpected status (3xx) keeps the
   *   unknown-error text; a template placeholder without value stays visible.
   * @input 500 'Internal Server Error'; 503 with blank status text; 302; server_error template
   *        changed to contain {unknown}.
   * @output 'Server (500): Internal Server Error'; 'Server (503): Internal error'; 'Unknown error';
   *   '{unknown} 500'.
   */
  it('reports server errors and keeps unknown placeholders', () => {
    failWith({ status: 500, statusText: 'Internal Server Error' });
    failWith({ status: 503, statusText: '  ' });
    failWith({ status: 302 });
    TEMPLATES['data-handler.server_error'] = '{unknown} {status}';
    failWith({ status: 500, statusText: 'X' });
    TEMPLATES['data-handler.server_error'] = 'Server ({status}): {statusText}';

    expect(alert.open.calls.allArgs().map(a => a[1])).toEqual([
      'Server (500): Internal Server Error', 'Server (503): Internal error', 'Unknown error', '{unknown} 500'
    ]);
  });

  /**
   * @description The localization service is resolved lazily on the first error and reused.
   * @input Two failing requests.
   * @output getValue called for both dialogs (same stub instance), dialog_title read per error.
   */
  it('resolves the localization lazily', () => {
    expect(getValue).not.toHaveBeenCalled();
    failWith({ status: 0 });
    failWith({ status: 0 });
    expect(getValue.calls.allArgs().filter(a => a[0] === 'data-handler.dialog_title').length).toBe(2);
  });
});
