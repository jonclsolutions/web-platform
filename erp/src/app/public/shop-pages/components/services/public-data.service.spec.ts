/**
 * @file entity-crud.service.spec.ts
 * @path src/app/core/services/entity-crud.service.spec.ts
 * @description Důkladné jednotkové testy pro EntityCrudService.
 *
 * Třída NENÍ @Injectable (viz komentář v entity-crud.service.ts) — instance se
 * vytváří ručně, proto ji zde NEPOUŽÍVÁME přes `TestBed.inject`, ale přímo přes
 * `new EntityCrudService(...)` s mockovaným DataHandlerem. Původní vygenerovaný
 * spec (`TestBed.inject(EntitiyCrudService)`) byl jak typograficky, tak koncepčně
 * chybný — testoval neexistující třídu a spoléhal na DI kontejner, který tuto
 * třídu vůbec neregistruje.
 *
 * Pokrytí:
 *  - všechny CRUD metody (happy path + error path)
 *  - lazy vyhodnocování `endpointProvider` (volá se při KAŽDÉM requestu)
 *  - `!id` edge-case (id = 0 je považováno za neplatné — dokumentujeme aktuální
 *    chování, protože jde o kritickou část aplikace a případná budoucí změna by
 *    zde měla shodit test a vynutit vědomé rozhodnutí)
 *  - `remove()` — všechny kombinace `forceDelete` / `params.force_delete`
 *  - `loadAll()` — sestavení query stringu, filtrování prázdných/null/undefined hodnot
 *  - `onSettled` hook (volitelný, volá se přes `finalize` i při chybě)
 *  - `takeUntil(destroy$)` — request se odhlásí po zániku komponenty
 */

import { Subject, of, throwError, Observable } from 'rxjs';
import { EntityCrudService, DeleteOptions  } from '../../../../core/services/entitiy-crud.service';
import { DataHandler } from '../../../../core/services/data-handler.service';

describe('EntityCrudService', () => {
  let service: EntityCrudService<any>;
  let dataHandlerSpy: jasmine.SpyObj<DataHandler>;
  let destroy$: Subject<void>;
  let onSettledSpy: jasmine.Spy;
  const endpoint = 'test-entity';

  beforeEach(() => {
    dataHandlerSpy = jasmine.createSpyObj<DataHandler>('DataHandler', [
      'get',
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
  describe('endpointProvider (lazy vyhodnocení)', () => {
    it('by mělo endpointProvider zavolat při KAŽDÉM požadavku, ne jen jednou při konstrukci', () => {
      let currentEndpoint = 'first-endpoint';
      const providerSpy = jasmine.createSpy('endpointProvider').and.callFake(() => currentEndpoint);
      const svc = new EntityCrudService(dataHandlerSpy, providerSpy, destroy$);
      dataHandlerSpy.get.and.returnValue(of({ id: 1 }));

      svc.getOne(1).subscribe();
      expect(dataHandlerSpy.get).toHaveBeenCalledWith('first-endpoint/1');

      currentEndpoint = 'second-endpoint';
      svc.getOne(2).subscribe();
      expect(dataHandlerSpy.get).toHaveBeenCalledWith('second-endpoint/2');

      expect(providerSpy).toHaveBeenCalledTimes(2);
    });

    it('nemělo by selhat, pokud endpointProvider vrátí prázdný string (jen zdokumentované chování)', () => {
      const svc = new EntityCrudService(dataHandlerSpy, () => '', destroy$);
      dataHandlerSpy.get.and.returnValue(of({}));
      svc.getOne(1).subscribe();
      expect(dataHandlerSpy.get).toHaveBeenCalledWith('/1');
    });
  });

  // ---------------------------------------------------------------------
  // getOne
  // ---------------------------------------------------------------------
  describe('getOne', () => {
    it('by mělo zavolat dataHandler.get se správnou URL a vrátit data', () => {
      const mockEntity = { id: 5, name: 'foo' };
      dataHandlerSpy.get.and.returnValue(of(mockEntity));

      let result: any;
      service.getOne(5).subscribe(r => (result = r));

      expect(dataHandlerSpy.get).toHaveBeenCalledWith(`${endpoint}/5`);
      expect(result).toEqual(mockEntity);
    });

    it('by nemělo zavolat dataHandler.get a mělo by emitovat chybu, pokud id je undefined', () => {
      let error: Error | undefined;
      service.getOne(undefined).subscribe({
        error: e => (error = e),
      });

      expect(dataHandlerSpy.get).not.toHaveBeenCalled();
      expect(error?.message).toBe('ID undefined.');
    });

    it('by mělo emitovat chybu i pro id = 0 (edge case: `!id` bere 0 jako neplatné)', () => {
      let error: Error | undefined;
      service.getOne(0).subscribe({
        error: e => (error = e),
      });

      expect(dataHandlerSpy.get).not.toHaveBeenCalled();
      expect(error?.message).toBe('ID undefined.');
    });

    it('by mělo zavolat onSettled po úspěšném dokončení', () => {
      dataHandlerSpy.get.and.returnValue(of({ id: 1 }));
      service.getOne(1).subscribe();
      expect(onSettledSpy).toHaveBeenCalledTimes(1);
    });

    it('by mělo zavolat onSettled i po chybě z HTTP vrstvy (finalize běží i na error cestě)', () => {
      dataHandlerSpy.get.and.returnValue(throwError(() => new Error('network error')));
      service.getOne(1).subscribe({ error: () => {} });
      expect(onSettledSpy).toHaveBeenCalledTimes(1);
    });

    it('by nemělo spadnout, pokud onSettled není poskytnut', () => {
      const svc = new EntityCrudService(dataHandlerSpy, () => endpoint, destroy$);
      dataHandlerSpy.get.and.returnValue(of({ id: 1 }));
      expect(() => svc.getOne(1).subscribe()).not.toThrow();
    });

    it('by se mělo odhlásit z requestu při emitu na destroy$ (takeUntil)', () => {
      const source$ = new Subject<any>();
      dataHandlerSpy.get.and.returnValue(source$.asObservable());

      let completed = false;
      let emittedValue: any;
      service.getOne(1).subscribe({
        next: v => (emittedValue = v),
        complete: () => (completed = true),
      });

      destroy$.next();
      source$.next({ id: 1 }); // po zničení už by neměla projít žádná hodnota

      expect(emittedValue).toBeUndefined();
      expect(completed).toBeTrue();
    });
  });

  // ---------------------------------------------------------------------
  // getCollection
  // ---------------------------------------------------------------------
  describe('getCollection', () => {
    it('by mělo zavolat dataHandler.getCollection s endpointem a params', () => {
      const mockList = [{ id: 1 }, { id: 2 }];
      dataHandlerSpy.getCollection.and.returnValue(of(mockList));
      const params = { active: true };

      let result: any;
      service.getCollection(params).subscribe(r => (result = r));

      expect(dataHandlerSpy.getCollection).toHaveBeenCalledWith(endpoint, params);
      expect(result).toEqual(mockList);
    });

    it('by mělo fungovat i bez params (undefined)', () => {
      dataHandlerSpy.getCollection.and.returnValue(of([]));
      service.getCollection().subscribe();
      expect(dataHandlerSpy.getCollection).toHaveBeenCalledWith(endpoint, undefined);
    });

    it('by mělo zavolat onSettled po dokončení', () => {
      dataHandlerSpy.getCollection.and.returnValue(of([]));
      service.getCollection().subscribe();
      expect(onSettledSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------
  describe('create', () => {
    it('by mělo zavolat dataHandler.post se správnou URL a daty', () => {
      const payload = { name: 'new entity' };
      const created = { id: 10, ...payload };
      dataHandlerSpy.post.and.returnValue(of(created));

      let result: any;
      service.create(payload).subscribe(r => (result = r));

      expect(dataHandlerSpy.post).toHaveBeenCalledWith(endpoint, payload);
      expect(result).toEqual(created);
    });

    it('by mělo zavolat onSettled i při chybě serveru (např. 422 validace)', () => {
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
    it('by mělo zavolat dataHandler.put se správnou URL a daty', () => {
      const payload = { name: 'updated' };
      dataHandlerSpy.put.and.returnValue(of({ id: 3, ...payload }));

      service.update(3, payload).subscribe();

      expect(dataHandlerSpy.put).toHaveBeenCalledWith(`${endpoint}/3`, payload);
    });

    it('by mělo vrátit chybu a nezavolat dataHandler.put, pokud id chybí', () => {
      let error: Error | undefined;
      service.update(undefined, { name: 'x' }).subscribe({ error: e => (error = e) });

      expect(dataHandlerSpy.put).not.toHaveBeenCalled();
      expect(error?.message).toBe('ID undefined.');
    });

    it('by mělo vrátit chybu pro id = 0', () => {
      let error: Error | undefined;
      service.update(0, {}).subscribe({ error: e => (error = e) });
      expect(dataHandlerSpy.put).not.toHaveBeenCalled();
      expect(error?.message).toBe('ID undefined.');
    });
  });

  // ---------------------------------------------------------------------
  // remove — nejrizikovější metoda (force_delete logika), testujeme důkladně
  // ---------------------------------------------------------------------
  describe('remove', () => {
    beforeEach(() => {
      dataHandlerSpy.delete.and.returnValue(of(undefined));
    });

    it('by mělo vrátit chybu a nezavolat dataHandler.delete, pokud id chybí', () => {
      let error: Error | undefined;
      service.remove(undefined).subscribe({ error: e => (error = e) });

      expect(dataHandlerSpy.delete).not.toHaveBeenCalled();
      expect(error?.message).toBe('ID undefined.');
    });

    it('by mělo vrátit chybu pro id = 0', () => {
      let error: Error | undefined;
      service.remove(0).subscribe({ error: e => (error = e) });
      expect(dataHandlerSpy.delete).not.toHaveBeenCalled();
      expect(error?.message).toBe('ID undefined.');
    });

    it('by mělo zavolat DELETE bez query parametru, pokud nejsou zadány žádné options', () => {
      service.remove(7).subscribe();
      expect(dataHandlerSpy.delete).toHaveBeenCalledWith(`${endpoint}/7`);
    });

    it('by mělo zavolat DELETE bez force_delete, pokud options.forceDelete === false', () => {
      service.remove(7, { forceDelete: false }).subscribe();
      expect(dataHandlerSpy.delete).toHaveBeenCalledWith(`${endpoint}/7`);
    });

    it('by mělo přidat ?force_delete=true, pokud options.forceDelete === true', () => {
      service.remove(7, { forceDelete: true }).subscribe();
      expect(dataHandlerSpy.delete).toHaveBeenCalledWith(`${endpoint}/7?force_delete=true`);
    });

    it('by mělo přidat ?force_delete=true, pokud options.params.force_delete === true (boolean)', () => {
      const options: DeleteOptions = { params: { force_delete: true } };
      service.remove(7, options).subscribe();
      expect(dataHandlerSpy.delete).toHaveBeenCalledWith(`${endpoint}/7?force_delete=true`);
    });

    it('by mělo přidat ?force_delete=true, pokud options.params.force_delete === "true" (string)', () => {
      const options: DeleteOptions = { params: { force_delete: 'true' } };
      service.remove(7, options).subscribe();
      expect(dataHandlerSpy.delete).toHaveBeenCalledWith(`${endpoint}/7?force_delete=true`);
    });

    it('by NEMĚLO přidat force_delete, pokud options.params.force_delete === "false" (string, jiná hodnota než "true")', () => {
      const options: DeleteOptions = { params: { force_delete: 'false' } };
      service.remove(7, options).subscribe();
      expect(dataHandlerSpy.delete).toHaveBeenCalledWith(`${endpoint}/7`);
    });

    it('by NEMĚLO přidat force_delete, pokud options.params.force_delete === false (boolean)', () => {
      const options: DeleteOptions = { params: { force_delete: false } };
      service.remove(7, options).subscribe();
      expect(dataHandlerSpy.delete).toHaveBeenCalledWith(`${endpoint}/7`);
    });

    it('by mělo přidat force_delete, pokud je splněna ALESPOŇ JEDNA z podmínek (OR logika)', () => {
      // params.force_delete je 'false', ale forceDelete flag je true -> mělo by se to vynutit
      const options: DeleteOptions = { forceDelete: true, params: { force_delete: 'false' } };
      service.remove(7, options).subscribe();
      expect(dataHandlerSpy.delete).toHaveBeenCalledWith(`${endpoint}/7?force_delete=true`);
    });

    it('by mělo ignorovat ostatní klíče v params (force_delete se testuje samostatně, ostatní se do URL nepromítají)', () => {
      const options: DeleteOptions = { params: { some_other_flag: 'x' } };
      service.remove(7, options).subscribe();
      expect(dataHandlerSpy.delete).toHaveBeenCalledWith(`${endpoint}/7`);
    });

    it('by mělo zavolat onSettled po úspěšném smazání', () => {
      service.remove(7).subscribe();
      expect(onSettledSpy).toHaveBeenCalledTimes(1);
    });

    it('by mělo zavolat onSettled i při chybě mazání (např. entita je stále v poresu jinde)', () => {
      dataHandlerSpy.delete.and.returnValue(throwError(() => new Error('conflict')));
      service.remove(7).subscribe({ error: () => {} });
      expect(onSettledSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------
  // restore
  // ---------------------------------------------------------------------
  describe('restore', () => {
    it('by mělo zavolat POST na /{endpoint}/{id}/restore s prázdným tělem', () => {
      const restored = { id: 4, name: 'restored' };
      dataHandlerSpy.post.and.returnValue(of(restored));

      let result: any;
      service.restore(4).subscribe(r => (result = r));

      expect(dataHandlerSpy.post).toHaveBeenCalledWith(`${endpoint}/4/restore`, {});
      expect(result).toEqual(restored);
    });

    it('by mělo zavolat onSettled po dokončení', () => {
      dataHandlerSpy.post.and.returnValue(of({}));
      service.restore(4).subscribe();
      expect(onSettledSpy).toHaveBeenCalledTimes(1);
    });

    // Pozor: na rozdíl od getOne/update/remove tato metoda NEMÁ guard na chybějící id
    // (typový podpis vyžaduje `number`, runtime kontrola chybí). Test dokumentuje
    // současné chování — pokud by volající poslal 0/undefined přes `any`, požadavek
    // se přesto odešle.
    it('nemá runtime guard proti id = 0 — request se přesto odešle (dokumentace současného chování)', () => {
      dataHandlerSpy.post.and.returnValue(of({}));
      service.restore(0).subscribe();
      expect(dataHandlerSpy.post).toHaveBeenCalledWith(`${endpoint}/0/restore`, {});
    });
  });

  // ---------------------------------------------------------------------
  // upload
  // ---------------------------------------------------------------------
  describe('upload', () => {
    it('by mělo použít endpoint jako cílovou URL, pokud targetUrl není zadán', () => {
      const formData = new FormData();
      dataHandlerSpy.upload.and.returnValue(of({ ok: true }));

      service.upload(formData).subscribe();

      expect(dataHandlerSpy.upload).toHaveBeenCalledWith(endpoint, formData);
    });

    it('by mělo použít targetUrl místo endpointu, pokud je zadán', () => {
      const formData = new FormData();
      const targetUrl = 'custom/upload/path';
      dataHandlerSpy.upload.and.returnValue(of({ ok: true }));

      service.upload(formData, targetUrl).subscribe();

      expect(dataHandlerSpy.upload).toHaveBeenCalledWith(targetUrl, formData);
    });

    it('by mělo zavolat onSettled po dokončení uploadu', () => {
      dataHandlerSpy.upload.and.returnValue(of({}));
      service.upload(new FormData()).subscribe();
      expect(onSettledSpy).toHaveBeenCalledTimes(1);
    });

    it('by mělo zavolat onSettled i při chybě uploadu (např. příliš velký soubor)', () => {
      dataHandlerSpy.upload.and.returnValue(throwError(() => new Error('payload too large')));
      service.upload(new FormData()).subscribe({ error: () => {} });
      expect(onSettledSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------
  // updatePassword
  // ---------------------------------------------------------------------
  describe('updatePassword', () => {
    it('by mělo zavolat PUT na /{endpoint}/{id}/change-password se správnými daty', () => {
      const payload = { password: 'newSecret123', password_confirmation: 'newSecret123' };
      dataHandlerSpy.put.and.returnValue(of({ success: true }));

      service.updatePassword(9, payload).subscribe();

      expect(dataHandlerSpy.put).toHaveBeenCalledWith(`${endpoint}/9/change-password`, payload);
    });

    it('by mělo vrátit chybu "User ID undefined." a nezavolat PUT, pokud id chybí', () => {
      let error: Error | undefined;
      service.updatePassword(undefined as any, {}).subscribe({ error: e => (error = e) });

      expect(dataHandlerSpy.put).not.toHaveBeenCalled();
      expect(error?.message).toBe('User ID undefined.');
    });

    it('by mělo vrátit chybu pro id = 0', () => {
      let error: Error | undefined;
      service.updatePassword(0, {}).subscribe({ error: e => (error = e) });
      expect(dataHandlerSpy.put).not.toHaveBeenCalled();
      expect(error?.message).toBe('User ID undefined.');
    });

    it('by mělo zavolat onSettled po dokončení', () => {
      dataHandlerSpy.put.and.returnValue(of({}));
      service.updatePassword(9, {}).subscribe();
      expect(onSettledSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------
  // loadAll — sestavení query stringu
  // ---------------------------------------------------------------------
  describe('loadAll', () => {
    it('by mělo vždy nastavit no_pagination=true, i bez filtrů', () => {
      dataHandlerSpy.getCollection.and.returnValue(of([]));
      service.loadAll().subscribe();

      expect(dataHandlerSpy.getCollection).toHaveBeenCalledWith(`${endpoint}?no_pagination=true`);
    });

    it('by mělo připojit zadané filtry do query stringu', () => {
      dataHandlerSpy.getCollection.and.returnValue(of([]));
      service.loadAll({ status: 'active', page_size: 50 }).subscribe();

      const calledUrl = dataHandlerSpy.getCollection.calls.mostRecent().args[0] as string;
      const [, queryString] = calledUrl.split('?');
      const params = new URLSearchParams(queryString);

      expect(params.get('no_pagination')).toBe('true');
      expect(params.get('status')).toBe('active');
      expect(params.get('page_size')).toBe('50');
    });

    it('by mělo vynechat filtry s hodnotou prázdný string, null nebo undefined', () => {
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

    it('by mělo zachovat filtr s hodnotou 0 nebo false (na rozdíl od id-guardů zde `!id` logika není použita)', () => {
      dataHandlerSpy.getCollection.and.returnValue(of([]));
      service.loadAll({ page: 0, active: false }).subscribe();

      const calledUrl = dataHandlerSpy.getCollection.calls.mostRecent().args[0] as string;
      const [, queryString] = calledUrl.split('?');
      const params = new URLSearchParams(queryString);

      expect(params.get('page')).toBe('0');
      expect(params.get('active')).toBe('false');
    });

    it('NEMÁ finalize/onSettled hook (na rozdíl od ostatních metod) — dokumentujeme asymetrii v API', () => {
      dataHandlerSpy.getCollection.and.returnValue(of([]));
      service.loadAll().subscribe();
      expect(onSettledSpy).not.toHaveBeenCalled();
    });

    it('by se mělo odhlásit z requestu při emitu na destroy$ (takeUntil)', () => {
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
    it('by mělo zavolat DELETE na /{endpoint}/force-delete-all', () => {
      dataHandlerSpy.delete.and.returnValue(of(undefined));
      service.hardDeleteAllTrashed().subscribe();
      expect(dataHandlerSpy.delete).toHaveBeenCalledWith(`${endpoint}/force-delete-all`);
    });

    it('by mělo zavolat onSettled po úspěšném dokončení', () => {
      dataHandlerSpy.delete.and.returnValue(of(undefined));
      service.hardDeleteAllTrashed().subscribe();
      expect(onSettledSpy).toHaveBeenCalledTimes(1);
    });

    it('by mělo zavolat onSettled i při chybě (např. cizí klíče brání smazání)', () => {
      dataHandlerSpy.delete.and.returnValue(throwError(() => new Error('FK constraint')));
      service.hardDeleteAllTrashed().subscribe({ error: () => {} });
      expect(onSettledSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------
  // Obecné chování napříč metodami — destroy$ jako sdílený "teardown" kanál
  // ---------------------------------------------------------------------
  describe('destroy$ (sdílený teardown mezi voláními)', () => {
    it('po completed destroy$ by nové requesty NEMĚLY vůbec emitovat hodnotu', () => {
      destroy$.next();
      destroy$.complete();

      const source$ = new Subject<any>();
      dataHandlerSpy.get.and.returnValue(source$.asObservable());

      let emitted = false;
      service.getOne(1).subscribe({ next: () => (emitted = true) });
      source$.next({ id: 1 });

      // takeUntil na už dokončeném/emitnutém subjectu se ihned completuje,
      // takže se do next() nikdy nedostaneme
      expect(emitted).toBeFalse();
    });
  });
});