/**
 * @file resource-cache.service.spec.ts
 * @path src/app/core/services/resource-cache.service.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of ResourceCacheService: one shared load per key within the TTL
 *   (default 3 min or custom), invalidate(), and failed loads are not cached (bugfix 2026-10-23).
 * @dependencies
 * - jasmine.clock() with a mocked Date; loader spies returning cold observables.
 */

import { TestBed } from '@angular/core/testing';
import { Observable, defer, of, throwError } from 'rxjs';

import { ResourceCacheService } from './resource-cache.service';

describe('ResourceCacheService', () => {
  let service: ResourceCacheService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ResourceCacheService);
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 0, 1));
  });
  afterEach(() => jasmine.clock().uninstall());

  /**
   * @description Within the TTL the loader runs once (subscribers share the result); after the
   *   default TTL, a custom TTL or invalidate() it runs again; keys are independent.
   * @input get('a') ×2; tick 3 min; get('a'); get('b', ttl 1 s) + tick 1 s; invalidate('a').
   * @output Loader calls: a 1 → 2, b 2, a 3.
   */
  it('shares one load per key within the TTL', () => {
    let runs = 0;
    const loader = () => defer(() => of(++runs));
    const values: number[] = [];

    service.get('a', loader).subscribe(v => values.push(v));
    service.get('a', loader).subscribe(v => values.push(v));
    expect(values).toEqual([1, 1]);

    jasmine.clock().tick(3 * 60 * 1000);
    service.get('a', loader).subscribe(v => values.push(v));
    expect(values[2]).toBe(2);

    service.get('b', loader, 1000).subscribe();
    jasmine.clock().tick(1000);
    service.get('b', loader, 1000).subscribe();
    expect(runs).toBe(4);

    service.invalidate('a');
    service.get('a', loader).subscribe();
    expect(runs).toBe(5);
  });

  /**
   * @description A failing load is removed, the next get() retries; a late failure of an old
   *   load does not remove a newer entry.
   * @input Loader fails, then succeeds; then an old pending load fails after a new one is cached.
   * @output Error, then value; newer entry stays cached.
   */
  it('does not cache failed loads', () => {
    let error: any;
    let value: any;
    service.get('x', () => throwError(() => new Error('down'))).subscribe({ error: e => (error = e) });
    service.get('x', () => of('ok')).subscribe(v => (value = v));
    expect(error.message).toBe('down');
    expect(value).toBe('ok');

    let fail!: () => void;
    const loaders = jasmine.createSpy('loader').and.returnValues(
      new Observable<string>(sub => { fail = () => sub.error(new Error('late')); }),
      of('new')
    );
    service.get('y', loaders).subscribe({ error: () => undefined });
    jasmine.clock().tick(3 * 60 * 1000);
    service.get('y', loaders).subscribe();
    fail();
    service.get('y', loaders).subscribe();
    expect(loaders).toHaveBeenCalledTimes(2);
  });
});
