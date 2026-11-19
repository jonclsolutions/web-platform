/**
 * @file table-refresh-bus.service.spec.ts
 * @path src/app/core/services/table-refresh-bus.service.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of TableRefreshBusService: a global refresh clears the table cache
 *   first and then notifies all subscribers.
 * @dependencies
 * - GenericTableService spy, ResourceCacheService spy.
 */

import { TestBed } from '@angular/core/testing';

import { TableRefreshBusService } from './table-refresh-bus.service';
import { GenericTableService } from './generic-table.service';
import { ResourceCacheService } from './resource-cache.service';
import { createGenericTableSpy } from '../../../testing/admin-test-helpers';

describe('TableRefreshBusService', () => {
  /**
   * @description Both caches (tables, other cached GETs) are dropped before the event is emitted.
   * @input triggerGlobalRefresh() with one subscriber.
   * @output invalidateAll, clear, then the subscriber notified (order checked).
   */
  it('invalidates the table cache and notifies subscribers', () => {
    const table = createGenericTableSpy();
    const resources = jasmine.createSpyObj<ResourceCacheService>('ResourceCacheService', ['clear']);
    TestBed.configureTestingModule({ providers: [{ provide: GenericTableService, useValue: table }, { provide: ResourceCacheService, useValue: resources }] });
    const bus = TestBed.inject(TableRefreshBusService);
    const order: string[] = [];
    table.invalidateAll.and.callFake(() => { order.push('invalidate'); });
    resources.clear.and.callFake(() => { order.push('clear'); });
    bus.refreshAll$.subscribe(() => order.push('event'));

    bus.triggerGlobalRefresh();
    expect(order).toEqual(['invalidate', 'clear', 'event']);
  });
});
