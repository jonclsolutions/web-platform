/**
 * @file generic-table.service.spec.ts
 * @path src/app/core/services/generic-table.service.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of GenericTableService: query building (page, per_page, non-empty
 *   filters), the per-user page cache with its 3 minute TTL, removal of failed requests from the
 *   cache (bugfix 2026-10-23), preloading of adjacent pages and invalidation.
 * @dependencies
 * - DataHandler spy; jasmine.clock() with a mocked Date for the TTL; sessionStorage 'userId'.
 */

import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';

import { GenericTableService } from './generic-table.service';
import { DataHandler } from './data-handler.service';
import { createDataHandlerSpy, paginated } from '../../../testing/admin-test-helpers';

describe('GenericTableService', () => {
  let service: GenericTableService;
  let dataHandler: jasmine.SpyObj<DataHandler>;
  const urls = () => dataHandler.getPaginatedCollection.calls.allArgs().map(a => a[0]);

  beforeEach(() => {
    sessionStorage.removeItem('userId');
    dataHandler = createDataHandlerSpy();
    dataHandler.getPaginatedCollection.and.returnValue(of(paginated([{ id: 1 }])) as any);
    TestBed.configureTestingModule({ providers: [{ provide: DataHandler, useValue: dataHandler }] });
    service = TestBed.inject(GenericTableService);
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 0, 1));
  });
  afterEach(() => {
    jasmine.clock().uninstall();
    sessionStorage.removeItem('userId');
  });

  /**
   * @description Query string with page / per_page and only non-empty filters; the same request
   *   (filters in another order) is served from the cache until the TTL passes.
   * @input getPaginatedData('core/users', 2, 10, {q: 'x', a: '', b: null, c: undefined, active: false}) ×2
   *        (second with reversed key order); after 3 min.
   * @output 'core/users?page=2&per_page=10&q=x&active=false' requested once, then again.
   */
  it('builds the query and caches pages for the TTL', () => {
    let data: any;
    service.getPaginatedData('core/users', 2, 10, { q: 'x', a: '', b: null, c: undefined, active: false }).subscribe(r => (data = r));
    service.getPaginatedData('core/users', 2, 10, { active: false, c: undefined, q: 'x' }).subscribe();
    expect(data.data).toEqual([{ id: 1 }]);
    expect(urls()).toEqual(['core/users?page=2&per_page=10&q=x&active=false']);

    jasmine.clock().tick(service.CACHE_TTL_MS);
    service.getPaginatedData('core/users', 2, 10, { q: 'x' }).subscribe();
    expect(urls().length).toBe(2);

    service.getPaginatedData('core/users').subscribe();
    expect(urls()[2]).toBe('core/users?page=1&per_page=15');
  });

  /**
   * @description The cache key contains the user id: another user never gets a cached page.
   * @input Same request anonymous, as userId 5.
   * @output Two requests.
   */
  it('separates the cache per logged-in user', () => {
    service.getPaginatedData('core/users').subscribe();
    sessionStorage.setItem('userId', '5');
    service.getPaginatedData('core/users').subscribe();
    service.getPaginatedData('core/users').subscribe();
    expect(urls().length).toBe(2);
  });

  /**
   * @description A failed request is not served from the cache - the next call asks again.
   * @input First call errors (500), second succeeds.
   * @output Error delivered, second call makes a new request and returns data.
   */
  it('does not cache failed requests', () => {
    dataHandler.getPaginatedCollection.and.returnValues(throwError(() => new Error('500')) as any, of(paginated([{ id: 2 }])) as any);
    let error: any;
    let data: any;
    service.getPaginatedData('core/users').subscribe({ error: e => (error = e) });
    service.getPaginatedData('core/users').subscribe(r => (data = r));
    expect(error.message).toBe('500');
    expect(data.data).toEqual([{ id: 2 }]);
    expect(urls().length).toBe(2);
  });

  /**
   * @description An old failing entry does not remove a newer entry of the same key.
   * @input First request (never completes until triggered) expires, second request is cached,
   *        then the first one fails.
   * @output Third call is served from the cache (2 requests in total).
   */
  it('keeps a newer cache entry when an older request fails', () => {
    let failFirst!: (e: any) => void;
    const pending = new Observable<any>(sub => { failFirst = e => sub.error(e); });
    dataHandler.getPaginatedCollection.and.returnValues(pending, of(paginated([])) as any);

    service.getPaginatedData('core/users').subscribe({ error: () => undefined });
    jasmine.clock().tick(service.CACHE_TTL_MS);
    service.getPaginatedData('core/users').subscribe();
    failFirst(new Error('late'));
    service.getPaginatedData('core/users').subscribe();
    expect(urls().length).toBe(2);
  });

  /**
   * @description Preload: ±range pages inside 1..total, fresh pages skipped, errors only logged.
   * @input Page 3 of 4 cached; preloadAdjacentPages(endpoint, 3, 4, 15, 2) where page 4 fails.
   * @output Requests for 2, 4, 1 (5 out of range, 3 not requested again); console.error for 4.
   */
  it('preloads adjacent pages that are not cached', () => {
    spyOn(console, 'error');
    service.getPaginatedData('core/users', 3).subscribe();
    dataHandler.getPaginatedCollection.and.callFake(((url: string) =>
      url.includes('page=4') ? throwError(() => new Error('x')) : of(paginated([]))) as any);

    service.preloadAdjacentPages('core/users', 3, 4, 15, 2);
    expect(urls()).toEqual([
      'core/users?page=3&per_page=15', 'core/users?page=2&per_page=15',
      'core/users?page=4&per_page=15', 'core/users?page=1&per_page=15'
    ]);
    expect(console.error).toHaveBeenCalledTimes(1);

    service.preloadAdjacentPages('core/users', 1, 1, 15);
    expect(urls().length).toBe(4);
  });

  /**
   * @description invalidateEndpoint drops only that endpoint, invalidateAll everything.
   * @input Cached 'a' and 'ab'; invalidateEndpoint('a'); then invalidateAll().
   * @output 'a' reloaded, 'ab' still cached; after invalidateAll 'ab' reloaded.
   */
  it('invalidates one endpoint or all', () => {
    service.getPaginatedData('a').subscribe();
    service.getPaginatedData('ab').subscribe();
    service.invalidateEndpoint('a');
    service.getPaginatedData('a').subscribe();
    service.getPaginatedData('ab').subscribe();
    expect(urls().length).toBe(3);

    service.invalidateAll();
    service.getPaginatedData('ab').subscribe();
    expect(urls().length).toBe(4);
  });
});
