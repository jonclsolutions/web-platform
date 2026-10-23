/**
 * @file role-options.service.spec.ts
 * @path src/app/core/services/role-options.service.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of RoleOptionsService: role list loaded once for 5 minutes,
 *   invalidate() and no caching of a failed load (bugfix 2026-10-23).
 * @dependencies
 * - DataHandler spy; jasmine.clock() with a mocked Date.
 */

import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';

import { RoleOptionsService } from './role-options.service';
import { DataHandler } from './data-handler.service';
import { createDataHandlerSpy } from '../../../testing/admin-test-helpers';

describe('RoleOptionsService', () => {
  let service: RoleOptionsService;
  let dataHandler: jasmine.SpyObj<DataHandler>;
  const roles = [{ id: 1, role_name: 'admin' }];

  beforeEach(() => {
    dataHandler = createDataHandlerSpy();
    dataHandler.getCollection.and.returnValue(of(roles) as any);
    TestBed.configureTestingModule({ providers: [{ provide: DataHandler, useValue: dataHandler }] });
    service = TestBed.inject(RoleOptionsService);
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 0, 1));
  });
  afterEach(() => jasmine.clock().uninstall());

  /**
   * @description One request within 5 minutes, a new one after the TTL and after invalidate().
   * @input getRoles() ×2; tick 5 min; getRoles(); invalidate(); getRoles().
   * @output 'core/roles?no_pagination=true' requested 3×; roles returned.
   */
  it('caches the roles for five minutes', () => {
    let result: any;
    service.getRoles().subscribe(r => (result = r));
    service.getRoles().subscribe();
    expect(result).toEqual(roles);
    expect(dataHandler.getCollection).toHaveBeenCalledOnceWith('core/roles?no_pagination=true');

    jasmine.clock().tick(5 * 60 * 1000);
    service.getRoles().subscribe();
    service.invalidate();
    service.getRoles().subscribe();
    expect(dataHandler.getCollection).toHaveBeenCalledTimes(3);
  });

  /**
   * @description A failed load is retried on the next call; a late failure of an expired load
   *   keeps the newer cache.
   * @input Error then success; then pending load that fails after a new one is cached.
   * @output Error, then roles; newer cache kept (no extra request).
   */
  it('does not cache a failed load', () => {
    let error: any;
    dataHandler.getCollection.and.returnValues(throwError(() => new Error('x')) as any, of(roles) as any);
    service.getRoles().subscribe({ error: e => (error = e) });
    let result: any;
    service.getRoles().subscribe(r => (result = r));
    expect(error.message).toBe('x');
    expect(result).toEqual(roles);

    let fail!: () => void;
    dataHandler.getCollection.and.returnValues(new Observable<any>(sub => { fail = () => sub.error(new Error('late')); }) as any, of(roles) as any);
    jasmine.clock().tick(5 * 60 * 1000);
    service.getRoles().subscribe({ error: () => undefined });
    jasmine.clock().tick(5 * 60 * 1000);
    service.getRoles().subscribe();
    fail();
    service.getRoles().subscribe();
    expect(dataHandler.getCollection).toHaveBeenCalledTimes(4);
  });
});
