/**
 * @file paginated-list-store.spec.ts
 * @path src/app/admin/components/base-data/paginated-list-store.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of PaginatedListStore – pagination, trash table and refresh state shared
 *   by every admin table page (used through BaseDataComponent).
 * @dependencies
 * - src/testing/admin-test-helpers.ts (GenericTableService spy, paginated())
 */

import { ChangeDetectorRef } from '@angular/core';
import { Subject, of, throwError } from 'rxjs';

import { PaginatedListStore } from './paginated-list-store';
import { createGenericTableSpy, paginated } from '../../../../testing/admin-test-helpers';
import { GenericTableService } from '../../../core/services/generic-table.service';

interface Row { id?: number; deleted_at?: string | null; }

describe('PaginatedListStore', () => {
  let table: jasmine.SpyObj<GenericTableService>;
  let cd: jasmine.SpyObj<ChangeDetectorRef>;
  let destroy$: Subject<void>;
  let store: PaginatedListStore<Row>;

  beforeEach(() => {
    table = createGenericTableSpy();
    cd = jasmine.createSpyObj<ChangeDetectorRef>('ChangeDetectorRef', ['markForCheck']);
    destroy$ = new Subject<void>();
    store = new PaginatedListStore<Row>(table, () => 'core/items', destroy$, cd);
  });

  /**
   * @description Defaults: page 1, 15 rows per page for both tables, sorting id desc.
   * @input  new store
   * @output currentPage = trashCurrentPage = 1; itemsPerPage = trashItemsPerPage = 15; defaultFilters = { sort_by: 'id', sort_direction: 'desc' }
   */
  it('starts on page 1 with 15 rows per page', () => {
    expect(store.currentPage).toBe(1);
    expect(store.trashCurrentPage).toBe(1);
    expect(store.itemsPerPage).toBe(15);
    expect(store.trashItemsPerPage).toBe(15);
    expect(store.defaultFilters).toEqual({ sort_by: 'id', sort_direction: 'desc' });
  });

  /**
   * @description An active page response fills the active table state.
   * @input  API returns 2 rows, page 2 of 4; fetchPaginatedData(false, 2, 15, { q: 'a' })
   * @output data = 2 rows; totalItems = 2; totalPages = 4; currentPage = 2; currentActiveFilters = { q: 'a' }; activeLastUpdatedAt set
   */
  it('fetchPaginatedData() stores an active page', () => {
    table.getPaginatedData.and.returnValue(of(paginated<Row>([{ id: 1 }, { id: 2 }], 2, 4)));
    store.fetchPaginatedData(false, 2, 15, { q: 'a' }).subscribe();
    expect(table.getPaginatedData).toHaveBeenCalledWith('core/items', 2, 15, { q: 'a' });
    expect(store.data.length).toBe(2);
    expect(store.totalPages).toBe(4);
    expect(store.currentPage).toBe(2);
    expect(store.currentActiveFilters).toEqual({ q: 'a' });
    expect(store.activeLastUpdatedAt.getValue()).toEqual(jasmine.any(Date));
  });

  /**
   * @description The trash request adds only_trashed=true and fills the trash state only.
   * @input  fetchPaginatedData(true, 1, 15, { q: 'a' })
   * @output request params { q: 'a', only_trashed: 'true' }; trashData filled; data untouched; currentTrashFilters = { q: 'a' }
   */
  it('fetchPaginatedData() for the trash adds only_trashed', () => {
    table.getPaginatedData.and.returnValue(of(paginated<Row>([{ id: 3, deleted_at: '2026-01-01' }])));
    store.fetchPaginatedData(true, 1, 15, { q: 'a' }).subscribe();
    expect(table.getPaginatedData).toHaveBeenCalledWith('core/items', 1, 15, { q: 'a', only_trashed: 'true' });
    expect(store.trashData).toEqual([{ id: 3, deleted_at: '2026-01-01' }]);
    expect(store.data).toEqual([]);
    expect(store.currentTrashFilters).toEqual({ q: 'a' });
  });

  /**
   * @description A failed request is retried once before the error is passed on.
   * @input  API fails with Error('boom') on every call
   * @output getPaginatedData subscribed twice; subscriber receives 'boom'
   */
  it('fetchPaginatedData() retries once on error', () => {
    let calls = 0;
    table.getPaginatedData.and.returnValue(throwError(() => { calls++; return new Error('boom'); }));
    let message = '';
    store.fetchPaginatedData(false, 1, 15, {}).subscribe({ error: e => (message = e.message) });
    expect(calls).toBe(2);
    expect(message).toBe('boom');
  });

  /**
   * @description loadInitial loads both tables and preloads the neighbouring active pages.
   * @input  loadInitial({ sort_by: 'id' }) with 3 active pages
   * @output 2 getPaginatedData calls; preloadAdjacentPages('core/items', 1, 3, 15, 1, { sort_by: 'id' })
   */
  it('loadInitial() loads both tables and preloads neighbours', () => {
    table.getPaginatedData.and.returnValue(of(paginated<Row>([{ id: 1 }], 1, 3)));
    store.loadInitial({ sort_by: 'id' });
    expect(table.getPaginatedData).toHaveBeenCalledTimes(2);
    expect(table.preloadAdjacentPages).toHaveBeenCalledWith('core/items', 1, 3, 15, 1, { sort_by: 'id' });
  });

  /**
   * @description forceFullRefresh drops the endpoint cache and reloads both tables.
   * @input  forceFullRefresh({ q: 'x' })
   * @output invalidateEndpoint('core/items'); 2 getPaginatedData calls with { q: 'x' }
   */
  it('forceFullRefresh() invalidates the cache and reloads', () => {
    store.forceFullRefresh({ q: 'x' });
    expect(table.invalidateEndpoint).toHaveBeenCalledWith('core/items');
    expect(table.getPaginatedData).toHaveBeenCalledTimes(2);
    expect(table.getPaginatedData.calls.argsFor(0)[3]).toEqual({ q: 'x' });
  });

  /**
   * @description Page change outside the valid range or to the current page does nothing.
   * @input  totalPages = 3, currentPage = 1; onHandlePageChange(0), (4), (1)
   * @output getPaginatedData not called
   */
  it('onHandlePageChange() ignores invalid pages and the current page', () => {
    store.totalPages = 3;
    store.onHandlePageChange(0);
    store.onHandlePageChange(4);
    store.onHandlePageChange(1);
    expect(table.getPaginatedData).not.toHaveBeenCalled();
  });

  /**
   * @description A valid page change on the active table loads that page.
   * @input  totalPages = 3; onHandlePageChange(2, { q: 'a' })
   * @output currentPage = 2; getPaginatedData('core/items', 2, 15, { q: 'a' }); neighbours preloaded
   */
  it('onHandlePageChange() loads a valid active page', () => {
    store.totalPages = 3;
    table.getPaginatedData.and.returnValue(of(paginated<Row>([], 2, 3)));
    store.onHandlePageChange(2, { q: 'a' });
    expect(store.currentPage).toBe(2);
    expect(table.getPaginatedData).toHaveBeenCalledWith('core/items', 2, 15, { q: 'a' });
    expect(table.preloadAdjacentPages).toHaveBeenCalled();
  });

  /**
   * @description While the trash is shown, paging works on the trash table.
   * @input  showTrashTable = true, trashTotalPages = 2; onHandlePageChange(2, {})
   * @output trashCurrentPage = 2; request with only_trashed; active currentPage unchanged
   */
  it('onHandlePageChange() pages the trash when it is shown', () => {
    store.showTrashTable = true;
    store.trashTotalPages = 2;
    table.getPaginatedData.and.returnValue(of(paginated<Row>([], 2, 2)));
    store.onHandlePageChange(2, {});
    expect(store.trashCurrentPage).toBe(2);
    expect(table.getPaginatedData).toHaveBeenCalledWith('core/items', 2, 15, { only_trashed: 'true' });
    expect(store.currentPage).toBe(1);
  });

  /**
   * @description Changing the page size returns to page 1 of the visible table.
   * @input  currentPage = 3; onHandleItemsPerPageChange(30, {}); then trash shown, onHandleItemsPerPageChange(50, {})
   * @output itemsPerPage = 30, currentPage = 1; trashItemsPerPage = 50, trashCurrentPage = 1
   */
  it('onHandleItemsPerPageChange() resets to page 1 of the visible table', () => {
    store.currentPage = 3;
    store.onHandleItemsPerPageChange(30, {});
    expect(store.itemsPerPage).toBe(30);
    expect(store.currentPage).toBe(1);
    store.showTrashTable = true;
    store.onHandleItemsPerPageChange(50, {});
    expect(store.trashItemsPerPage).toBe(50);
    expect(store.trashCurrentPage).toBe(1);
  });

  /**
   * @description toggleTable switches the visible table and reloads with that table's filters.
   * @input  currentTrashFilters = { q: 't' }; toggleTable()
   * @output showTrashTable = true; reload with filters { q: 't' }
   */
  it('toggleTable() switches tables and reloads with the matching filters', () => {
    store.currentTrashFilters = { q: 't' };
    store.toggleTable();
    expect(store.showTrashTable).toBeTrue();
    expect(table.getPaginatedData.calls.argsFor(0)[3]).toEqual({ q: 't' });
  });

  /**
   * @description The endpoint is read lazily, so a page can set it after construction.
   * @input  endpoint provider returns 'late/endpoint' only after the store exists
   * @output request goes to 'late/endpoint'
   */
  it('reads the endpoint lazily', () => {
    let endpoint = '';
    const lazy = new PaginatedListStore<Row>(table, () => endpoint, destroy$, cd);
    endpoint = 'late/endpoint';
    lazy.fetchPaginatedData(false, 1, 15, {}).subscribe();
    expect(table.getPaginatedData.calls.mostRecent().args[0]).toBe('late/endpoint');
  });

  /**
   * @description Every loaded row (active and trash) goes through the row mapper; without one rows stay as they are.
   * @input  store with mapper row => ({ ...row, deleted_at: 'mapped' }); active and trash page [{ id: 1 }]; default store
   * @output data and trashData [{ id: 1, deleted_at: 'mapped' }]; default store data [{ id: 1 }]
   */
  it('maps loaded rows with the row mapper', () => {
    table.getPaginatedData.and.returnValue(of(paginated<Row>([{ id: 1 }])));
    const mapped = new PaginatedListStore<Row>(table, () => 'core/items', destroy$, cd, undefined, row => ({ ...row, deleted_at: 'mapped' }));
    mapped.fetchPaginatedData(false, 1, 15, {}).subscribe();
    mapped.fetchPaginatedData(true, 1, 15, {}).subscribe();
    expect(mapped.data).toEqual([{ id: 1, deleted_at: 'mapped' }]);
    expect(mapped.trashData).toEqual([{ id: 1, deleted_at: 'mapped' }]);
    store.fetchPaginatedData(false, 1, 15, {}).subscribe();
    expect(store.data).toEqual([{ id: 1 }]);
  });
});
