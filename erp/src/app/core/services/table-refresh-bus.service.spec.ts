/**
 * @file table-refresh-bus.service.spec.ts
 * @path src/app/core/services/table-refresh-bus.service.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of TableRefreshBusService: a global refresh clears the table cache
 *   first and then notifies all subscribers.
 * @dependencies
 * - GenericTableService spy.
 */

import { TestBed } from '@angular/core/testing';

import { TableRefreshBusService } from './table-refresh-bus.service';
import { GenericTableService } from './generic-table.service';
import { createGenericTableSpy } from '../../../testing/admin-test-helpers';

describe('TableRefreshBusService', () => {
  /**
   * @description Cache invalidated before the event is emitted.
   * @input triggerGlobalRefresh() with one subscriber.
   * @output invalidateAll called, then the subscriber notified (order checked).
   */
  it('invalidates the table cache and notifies subscribers', () => {
    const table = createGenericTableSpy();
    TestBed.configureTestingModule({ providers: [{ provide: GenericTableService, useValue: table }] });
    const bus = TestBed.inject(TableRefreshBusService);
    const order: string[] = [];
    table.invalidateAll.and.callFake(() => { order.push('invalidate'); });
    bus.refreshAll$.subscribe(() => order.push('event'));

    bus.triggerGlobalRefresh();
    expect(order).toEqual(['invalidate', 'event']);
  });
});
