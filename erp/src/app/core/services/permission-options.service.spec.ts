/**
 * @file permission-options.service.spec.ts
 * @path src/app/core/services/permission-options.service.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of PermissionOptionsService: permission list cached for 5 minutes
 *   after a successful load; a failed load answers [] and is retried next time.
 * @dependencies
 * - DataHandler spy; jasmine.clock() with a mocked Date.
 */

import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { PermissionOptionsService } from './permission-options.service';
import { DataHandler } from './data-handler.service';
import { createDataHandlerSpy } from '../../../testing/admin-test-helpers';

describe('PermissionOptionsService', () => {
  let service: PermissionOptionsService;
  let dataHandler: jasmine.SpyObj<DataHandler>;
  const list = [{ id: 1, permission_key: 'core-users-view', description: null, module: 'core' }];

  beforeEach(() => {
    dataHandler = createDataHandlerSpy();
    TestBed.configureTestingModule({ providers: [{ provide: DataHandler, useValue: dataHandler }] });
    service = TestBed.inject(PermissionOptionsService);
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 0, 1));
  });
  afterEach(() => jasmine.clock().uninstall());

  /**
   * @description Success is cached for 5 min; error → [] and not cached.
   * @input Error; success ×2; tick 5 min; success.
   * @output [], list, list; requests 'core/permissions' 3× in total.
   */
  it('caches successful loads only', () => {
    dataHandler.get.and.returnValues(throwError(() => new Error('x')) as any, of(list) as any, of(list) as any);
    const results: any[] = [];
    service.getPermissions().subscribe(r => results.push(r));
    service.getPermissions().subscribe(r => results.push(r));
    service.getPermissions().subscribe(r => results.push(r));
    expect(results).toEqual([[], list, list]);
    expect(dataHandler.get).toHaveBeenCalledTimes(2);
    expect(dataHandler.get).toHaveBeenCalledWith('core/permissions');

    jasmine.clock().tick(5 * 60 * 1000);
    service.getPermissions().subscribe();
    expect(dataHandler.get).toHaveBeenCalledTimes(3);
  });
});
