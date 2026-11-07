/**
 * @file entity-crud.service.spec.ts
 * @path src/app/core/services/entity-crud.service.spec.ts
 * @description Thorough unit tests of EntityCrudService.
 *
 * The class is NOT @Injectable (see the comment in entity-crud.service.ts) - the instance is
 * created manually, so the tests do NOT use `TestBed.inject` but
 * `new EntityCrudService(...)` with a mocked DataHandler.
 *
 * Coverage:
 *  - all CRUD methods (happy path + error path)
 *  - lazy evaluation of `endpointProvider` (called on EVERY request)
 *  - the `!id` edge case (id = 0 is treated as invalid - documents the current behaviour; this
 *    is a critical part of the application and a future change should break the test and
 *    force a conscious decision)
 *  - `remove()` - all combinations of `forceDelete` / `params.force_delete`
 *  - `loadAll()` - building the query string, filtering empty / null / undefined values
 *  - the `onSettled` hook (optional, called through `finalize` also on error)
 *  - `takeUntil(destroy$)` - the request unsubscribes when the component is destroyed
 */

import { Subject, of, throwError, Observable } from 'rxjs';
import { EntityCrudService, DeleteOptions } from './entity-crud.service';
import { DataHandler } from './data-handler.service';

describe('EntityCrudService', () => {
  let service: EntityCrudService<any>;
  let dataHandlerSpy: jasmine.SpyObj<DataHandler>;
  let destroy$: Subject<void>;
  let onSettledSpy: jasmine.Spy;
  const endpoint = 'test-entity';

  beforeEach(() => {
    dataHandlerSpy = jasmine.createSpyObj<DataHandler>('DataHandler', [
      'getOne',
      'getCollection',
      'post',
      'put',
      'delete',
      'upload',
    ]);
    destroy$ = new Subject<void>();
    onSettledSpy = jasmine.createSpy('onSettled');
    service = new EntityCrudService(dataHandlerSpy, () => endpoint, destroy$, onSettledSpy);
  });

  afterEach(() => {
    destroy$.next();
    destroy$.complete();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ---------------------------------------------------------------------
  // Lazy endpointProvider
  // ---------------------------------------------------------------------
  describe('endpointProvider (lazy evaluation)', () => {
    it('calls endpointProvider on EVERY request, not only once at construction', () => {
      let currentEndpoint = 'first-endpoint';
      const providerSpy = jasmine.createSpy('endpointProvider').and.callFake(() => currentEndpoint);
      const svc = new EntityCrudService(dataHandlerSpy, providerSpy, destroy$);
      dataHandlerSpy.getOne.and.returnValue(of({ id: 1 }));

      svc.getOne(1).subscribe();
      expect(dataHandlerSpy.getOne).toHaveBeenCalledWith('first-endpoint/1');

      currentEndpoint = 'second-endpoint';
      svc.getOne(2).subscribe();
      expect(dataHandlerSpy.getOne).toHaveBeenCalledWith('second-endpoint/2');

      expect(providerSpy).toHaveBeenCalledTimes(2);
    });

    it('does not fail when endpointProvider returns an empty string (documented behaviour)', () => {
      const svc = new EntityCrudService(dataHandlerSpy, () => '', destroy$);
      dataHandlerSpy.getOne.and.returnValue(of({}));
      svc.getOne(1).subscribe();
      expect(dataHandlerSpy.getOne).toHaveBeenCalledWith('/1');
    });
  });

  // ---------------------------------------------------------------------
  // getOne
  // ---------------------------------------------------------------------
  describe('getOne', () => {
    it('calls dataHandler.getOne with the right URL and returns the data', () => {
      const mockEntity = { id: 5, name: 'foo' };
      dataHandlerSpy.getOne.and.returnValue(of(mockEntity));

      let result: any;
      service.getOne(5).subscribe(r => (result = r));

      expect(dataHandlerSpy.getOne).toHaveBeenCalledWith(`${endpoint}/5`);
      expect(result).toEqual(mockEntity);
    });

    it('does not call dataHandler.getOne and emits an error when id is undefined', () => {
      let error: Error | undefined;
      service.getOne(undefined).subscribe({
        error: e => (error = e),
      });

      expect(dataHandlerSpy.getOne).not.toHaveBeenCalled();
      expect(error?.message).toBe('ID undefined.');
    });

    it('emits an error for id = 0 too (edge case: `!id` treats 0 as invalid)', () => {
      let error: Error | undefined;
      service.getOne(0).subscribe({
        error: e => (error = e),
      });

      expect(dataHandlerSpy.getOne).not.toHaveBeenCalled();
      expect(error?.message).toBe('ID undefined.');
    });

    it('calls onSettled after a successful completion', () => {
      dataHandlerSpy.getOne.and.returnValue(of({ id: 1 }));
      service.getOne(1).subscribe();
      expect(onSettledSpy).toHaveBeenCalledTimes(1);
    });

    it('calls onSettled after an HTTP error too (finalize runs on the error path)', () => {
      dataHandlerSpy.getOne.and.returnValue(throwError(() => new Error('network error')));
      service.getOne(1).subscribe({ error: () => {} });
      expect(onSettledSpy).toHaveBeenCalledTimes(1);
    });

    it('does not fail when onSettled is not provided', () => {
      const svc = new EntityCrudService(dataHandlerSpy, () => endpoint, destroy$);
      dataHandlerSpy.getOne.and.returnValue(of({ id: 1 }));
      expect(() => svc.getOne(1).subscribe()).not.toThrow();
    });

    it('unsubscribes from the request when destroy$ emits (takeUntil)', () => {
      const source$ = new Subject<any>();
      dataHandlerSpy.getOne.and.returnValue(source$.asObservable());

      let completed = false;
      let emittedValue: any;
      service.getOne(1).subscribe({
        next: v => (emittedValue = v),
        complete: () => (completed = true),
      });

      destroy$.next();
      source$.next({ id: 1 }); // after destroy no value should pass any more

      expect(emittedValue).toBeUndefined();
      expect(completed).toBeTrue();
    });
  });

  // ---------------------------------------------------------------------
  // getCollection
  // ---------------------------------------------------------------------
  describe('getCollection', () => {
    it('calls dataHandler.getCollection with the endpoint and params', () => {
      const mockList = [{ id: 1 }, { id: 2 }];
      dataHandlerSpy.getCollection.and.returnValue(of(mockList));
      const params = { active: true };

      let result: any;
      service.getCollection(params).subscribe(r => (result = r));

      expect(dataHandlerSpy.getCollection).toHaveBeenCalledWith(endpoint, params);
      expect(result).toEqual(mockList);
    });

    it('works without params (undefined)', () => {
      dataHandlerSpy.getCollection.and.returnValue(of([]));
      service.getCollection().subscribe();
      expect(dataHandlerSpy.getCollection).toHaveBeenCalledWith(endpoint, undefined);
    });

    it('calls onSettled after completion', () => {
      dataHandlerSpy.getCollection.and.returnValue(of([]));
      service.getCollection().subscribe();
      expect(onSettledSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------
  describe('create', () => {
    it('calls dataHandler.post with the right URL and data', () => {
      const payload = { name: 'new entity' };
      const created = { id: 10, ...payload };
      dataHandlerSpy.post.and.returnValue(of(created));

      let result: any;
      service.create(payload).subscribe(r => (result = r));

      expect(dataHandlerSpy.post).toHaveBeenCalledWith(endpoint, payload);
      expect(result).toEqual(created);
    });

    it('calls onSettled on a server error too (e.g. 422 validation)', () => {
      dataHandlerSpy.post.and.returnValue(throwError(() => new Error('validation error')));
      let error: any;
      service.create({}).subscribe({ error: e => (error = e) });

      expect(error.message).toBe('validation error');
      expect(onSettledSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------
  describe('update', () => {
    it('calls dataHandler.put with the right URL and data', () => {
      const payload = { name: 'updated' };
      dataHandlerSpy.put.and.returnValue(of({ id: 3, ...payload }));

      service.update(3, payload).subscribe();

      expect(dataHandlerSpy.put).toHaveBeenCalledWith(`${endpoint}/3`, payload);
    });

    it('returns an error and does not call dataHandler.put when id is missing', () => {
      let error: Error | undefined;
      service.update(undefined, { name: 'x' }).subscribe({ error: e => (error = e) });

      expect(dataHandlerSpy.put).not.toHaveBeenCalled();
      expect(error?.message).toBe('ID undefined.');
    });

    it('returns an error for id = 0', () => {
      let error: Error | undefined;
      service.update(0, {}).subscribe({ error: e => (error = e) });
      expect(dataHandlerSpy.put).not.toHaveBeenCalled();
      expect(error?.message).toBe('ID undefined.');
    });
  });

  // ---------------------------------------------------------------------
  // remove - the riskiest method (force_delete logic), tested thoroughly
  // ---------------------------------------------------------------------
  describe('remove', () => {
    beforeEach(() => {
      dataHandlerSpy.delete.and.returnValue(of(undefined));
    });

    it('returns an error and does not call dataHandler.delete when id is missing', () => {
      let error: Error | undefined;
      service.remove(undefined).subscribe({ error: e => (error = e) });

      expect(dataHandlerSpy.delete).not.toHaveBeenCalled();
      expect(error?.message).toBe('ID undefined.');
    });

    it('returns an error for id = 0', () => {
      let error: Error | undefined;
      service.remove(0).subscribe({ error: e => (error = e) });
      expect(dataHandlerSpy.delete).not.toHaveBeenCalled();
      expect(error?.message).toBe('ID undefined.');
    });

    it('calls DELETE without a query parameter when no options are given', () => {
      service.remove(7).subscribe();
      expect(dataHandlerSpy.delete).toHaveBeenCalledWith(`${endpoint}/7`);
    });

    it('calls DELETE without force_delete when options.forceDelete === false', () => {
      service.remove(7, { forceDelete: false }).subscribe();
      expect(dataHandlerSpy.delete).toHaveBeenCalledWith(`${endpoint}/7`);
    });

    it('adds ?force_delete=true when options.forceDelete === true', () => {
      service.remove(7, { forceDelete: true }).subscribe();
      expect(dataHandlerSpy.delete).toHaveBeenCalledWith(`${endpoint}/7?force_delete=true`);
    });

    it('adds ?force_delete=true when options.params.force_delete === true (boolean)', () => {
      const options: DeleteOptions = { params: { force_delete: true } };
      service.remove(7, options).subscribe();
      expect(dataHandlerSpy.delete).toHaveBeenCalledWith(`${endpoint}/7?force_delete=true`);
    });

    it('adds ?force_delete=true when options.params.force_delete === "true" (string)', () => {
      const options: DeleteOptions = { params: { force_delete: 'true' } };
      service.remove(7, options).subscribe();
      expect(dataHandlerSpy.delete).toHaveBeenCalledWith(`${endpoint}/7?force_delete=true`);
    });

    it('does NOT add force_delete when options.params.force_delete === "false" (string other than "true")', () => {
      const options: DeleteOptions = { params: { force_delete: 'false' } };
      service.remove(7, options).subscribe();
      expect(dataHandlerSpy.delete).toHaveBeenCalledWith(`${endpoint}/7`);
    });

    it('does NOT add force_delete when options.params.force_delete === false (boolean)', () => {
      const options: DeleteOptions = { params: { force_delete: false } };
      service.remove(7, options).subscribe();
      expect(dataHandlerSpy.delete).toHaveBeenCalledWith(`${endpoint}/7`);
    });

    it('adds force_delete when AT LEAST ONE of the conditions holds (OR logic)', () => {
      // params.force_delete is 'false' but the forceDelete flag is true -> it should be forced
      const options: DeleteOptions = { forceDelete: true, params: { force_delete: 'false' } };
      service.remove(7, options).subscribe();
      expect(dataHandlerSpy.delete).toHaveBeenCalledWith(`${endpoint}/7?force_delete=true`);
    });

    it('ignores the other params keys (only force_delete is checked, the others are not added to the URL)', () => {
      const options: DeleteOptions = { params: { some_other_flag: 'x' } };
      service.remove(7, options).subscribe();
      expect(dataHandlerSpy.delete).toHaveBeenCalledWith(`${endpoint}/7`);
    });

    it('calls onSettled after a successful delete', () => {
      service.remove(7).subscribe();
      expect(onSettledSpy).toHaveBeenCalledTimes(1);
    });

    it('calls onSettled on a delete error too (e.g. the entity is still referenced elsewhere)', () => {
      dataHandlerSpy.delete.and.returnValue(throwError(() => new Error('conflict')));
      service.remove(7).subscribe({ error: () => {} });
      expect(onSettledSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------
  // restore
  // ---------------------------------------------------------------------
  describe('restore', () => {
    it('calls POST /{endpoint}/{id}/restore with an empty body', () => {
      const restored = { id: 4, name: 'restored' };
      dataHandlerSpy.post.and.returnValue(of(restored));

      let result: any;
      service.restore(4).subscribe(r => (result = r));

      expect(dataHandlerSpy.post).toHaveBeenCalledWith(`${endpoint}/4/restore`, {});
      expect(result).toEqual(restored);
    });

    it('calls onSettled after completion', () => {
      dataHandlerSpy.post.and.returnValue(of({}));
      service.restore(4).subscribe();
      expect(onSettledSpy).toHaveBeenCalledTimes(1);
    });

    // Note: unlike getOne / update / remove this method has NO guard against a missing id
    // (the type signature requires `number`, there is no runtime check). The test documents
    // the current behaviour - when a caller sends 0 / undefined through `any`, the request
    // is still sent.
    it('has no runtime guard against id = 0 - the request is sent anyway (documents the current behaviour)', () => {
      dataHandlerSpy.post.and.returnValue(of({}));
      service.restore(0).subscribe();
      expect(dataHandlerSpy.post).toHaveBeenCalledWith(`${endpoint}/0/restore`, {});
    });
  });

  // ---------------------------------------------------------------------
  // upload
  // ---------------------------------------------------------------------
  describe('upload', () => {
    it('uses the endpoint as the target URL when targetUrl is not given', () => {
      const formData = new FormData();
      dataHandlerSpy.upload.and.returnValue(of({ ok: true }));

      service.upload(formData).subscribe();

      expect(dataHandlerSpy.upload).toHaveBeenCalledWith(endpoint, formData);
    });

    it('uses targetUrl instead of the endpoint when given', () => {
      const formData = new FormData();
      const targetUrl = 'custom/upload/path';
      dataHandlerSpy.upload.and.returnValue(of({ ok: true }));

      service.upload(formData, targetUrl).subscribe();

      expect(dataHandlerSpy.upload).toHaveBeenCalledWith(targetUrl, formData);
    });

    it('calls onSettled after the upload finishes', () => {
      dataHandlerSpy.upload.and.returnValue(of({}));
      service.upload(new FormData()).subscribe();
      expect(onSettledSpy).toHaveBeenCalledTimes(1);
    });

    it('calls onSettled on an upload error too (e.g. a too large file)', () => {
      dataHandlerSpy.upload.and.returnValue(throwError(() => new Error('payload too large')));
      service.upload(new FormData()).subscribe({ error: () => {} });
      expect(onSettledSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------
  // updatePassword
  // ---------------------------------------------------------------------
  describe('updatePassword', () => {
    it('calls PUT /{endpoint}/{id}/change-password with the right data', () => {
      const payload = { password: 'newSecret123', password_confirmation: 'newSecret123' };
      dataHandlerSpy.put.and.returnValue(of({ success: true }));

      service.updatePassword(9, payload).subscribe();

      expect(dataHandlerSpy.put).toHaveBeenCalledWith(`${endpoint}/9/change-password`, payload);
    });

    it('returns the error "User ID undefined." and does not call PUT when id is missing', () => {
      let error: Error | undefined;
      service.updatePassword(undefined as any, {}).subscribe({ error: e => (error = e) });

      expect(dataHandlerSpy.put).not.toHaveBeenCalled();
      expect(error?.message).toBe('User ID undefined.');
    });

    it('returns an error for id = 0', () => {
      let error: Error | undefined;
      service.updatePassword(0, {}).subscribe({ error: e => (error = e) });
      expect(dataHandlerSpy.put).not.toHaveBeenCalled();
      expect(error?.message).toBe('User ID undefined.');
    });

    it('calls onSettled after completion', () => {
      dataHandlerSpy.put.and.returnValue(of({}));
      service.updatePassword(9, {}).subscribe();
      expect(onSettledSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------
  // loadAll - building the query string
  // ---------------------------------------------------------------------
  describe('loadAll', () => {
    it('always sets no_pagination=true, also without filters', () => {
      dataHandlerSpy.getCollection.and.returnValue(of([]));
      service.loadAll().subscribe();

      expect(dataHandlerSpy.getCollection).toHaveBeenCalledWith(`${endpoint}?no_pagination=true`);
    });

    it('appends the given filters to the query string', () => {
      dataHandlerSpy.getCollection.and.returnValue(of([]));
      service.loadAll({ status: 'active', page_size: 50 }).subscribe();

      const calledUrl = dataHandlerSpy.getCollection.calls.mostRecent().args[0] as string;
      const [, queryString] = calledUrl.split('?');
      const params = new URLSearchParams(queryString);

      expect(params.get('no_pagination')).toBe('true');
      expect(params.get('status')).toBe('active');
      expect(params.get('page_size')).toBe('50');
    });

    it('skips filters whose value is an empty string, null or undefined', () => {
      dataHandlerSpy.getCollection.and.returnValue(of([]));
      service
        .loadAll({
          empty: '',
          nullValue: null,
          undefinedValue: undefined,
          valid: 'keep-me',
        })
        .subscribe();

      const calledUrl = dataHandlerSpy.getCollection.calls.mostRecent().args[0] as string;
      const [, queryString] = calledUrl.split('?');
      const params = new URLSearchParams(queryString);

      expect(params.has('empty')).toBeFalse();
      expect(params.has('nullValue')).toBeFalse();
      expect(params.has('undefinedValue')).toBeFalse();
      expect(params.get('valid')).toBe('keep-me');
    });

    it('keeps filters with the value 0 or false (unlike the id guards, no `!id` logic here)', () => {
      dataHandlerSpy.getCollection.and.returnValue(of([]));
      service.loadAll({ page: 0, active: false }).subscribe();

      const calledUrl = dataHandlerSpy.getCollection.calls.mostRecent().args[0] as string;
      const [, queryString] = calledUrl.split('?');
      const params = new URLSearchParams(queryString);

      expect(params.get('page')).toBe('0');
      expect(params.get('active')).toBe('false');
    });

    it('has NO finalize/onSettled hook (unlike the other methods) - documents the API asymmetry', () => {
      dataHandlerSpy.getCollection.and.returnValue(of([]));
      service.loadAll().subscribe();
      expect(onSettledSpy).not.toHaveBeenCalled();
    });

    it('unsubscribes from the request when destroy$ emits (takeUntil)', () => {
      const source$ = new Subject<any[]>();
      dataHandlerSpy.getCollection.and.returnValue(source$.asObservable());

      let completed = false;
      service.loadAll().subscribe({ complete: () => (completed = true) });

      destroy$.next();
      expect(completed).toBeTrue();
    });
  });

  // ---------------------------------------------------------------------
  // hardDeleteAllTrashed
  // ---------------------------------------------------------------------
  describe('hardDeleteAllTrashed', () => {
    it('calls DELETE /{endpoint}/force-delete-all', () => {
      dataHandlerSpy.delete.and.returnValue(of(undefined));
      service.hardDeleteAllTrashed().subscribe();
      expect(dataHandlerSpy.delete).toHaveBeenCalledWith(`${endpoint}/force-delete-all`);
    });

    it('calls onSettled after a successful completion', () => {
      dataHandlerSpy.delete.and.returnValue(of(undefined));
      service.hardDeleteAllTrashed().subscribe();
      expect(onSettledSpy).toHaveBeenCalledTimes(1);
    });

    it('calls onSettled on an error too (e.g. foreign keys prevent the delete)', () => {
      dataHandlerSpy.delete.and.returnValue(throwError(() => new Error('FK constraint')));
      service.hardDeleteAllTrashed().subscribe({ error: () => {} });
      expect(onSettledSpy).toHaveBeenCalledTimes(1);
    });
  });
});