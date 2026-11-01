/**
 * @file table-refresh-bus.service.ts
 * @path src/app/core/services/table-refresh-bus.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Light event bus of the global "Refresh all" button in the admin header.
 * AdminLayoutComponent has no direct reference to the currently rendered page component (it
 * goes through <router-outlet>), so it needs a way to "call" a refresh without a direct
 * dependency - hence the bus.
 * @dependencies
 * - GenericTableService: The real cache invalidation across all endpoints.
 */

import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { GenericTableService } from './generic-table.service';

@Injectable({ providedIn: 'root' })
export class TableRefreshBusService {
  private _refreshAll$ = new Subject<void>();

  /** Table pages (through BaseDataComponent.initWithAuthCheck()) subscribe to this. */
  public refreshAll$ = this._refreshAll$.asObservable();

  constructor(private genericTableService: GenericTableService) {}

  /**
   * @description Called by the global refresh button of the admin header. First invalidates the
   * WHOLE cache (no network request by itself), then emits the signal the currently mounted page
   * reacts to with a real refetch of what it shows. Pages not open now refetch by themselves on
   * the next visit, because their cache is empty.
   */
  triggerGlobalRefresh(): void {
    this.genericTableService.invalidateAll();
    this._refreshAll$.next();
  }
}