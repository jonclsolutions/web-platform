/**
 * @file paginated-list-store.ts
 * @path src/app/admin/components/base-data/paginated-list-store.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Own state of the "active vs. trash" table pair: page counters, active filters and
 * the fetch / refresh / page change logic.
 * @note Two methods for two situations:
 * - `loadInitial()` - "soft" load on entering the page (mount). Invalidates nothing - when the
 *   `GenericTableService` cache of the page / filters is still fresh (< TTL), no network
 *   request is made.
 * - `forceFullRefresh()` - "hard" refresh. Calls `genericTableService.invalidateEndpoint()`
 *   first (drops ALL cached pages of the resource), then refetches. Used by the refresh button
 *   of the table, after create / update / delete / restore (through the `refreshData()`
 *   override of every page component) and by the global refresh in the header
 *   (TableRefreshBusService).
 * @note `activeLastUpdatedAt` / `trashLastUpdatedAt` (BehaviorSubject<Date | null>) are set on
 * EVERY successful `fetchPaginatedData()` (network or cache), so the UI can show
 * "Updated at HH:MM:SS" (TableBuilderComponent). A page change also calls
 * `genericTableService.preloadAdjacentPages()`.
 */

import { ChangeDetectorRef } from '@angular/core';
import { BehaviorSubject, Observable, Subject, forkJoin } from 'rxjs';
import { takeUntil, retry, tap, finalize } from 'rxjs/operators';
import { GenericTableService, FilterParams, PaginatedResponse } from '../../../core/services/generic-table.service';

export class PaginatedListStore<T extends { id?: number; deleted_at?: string | null }> {
  data: T[] = [];
  trashData: T[] = [];

  showTrashTable = false;

  currentPage = 1;
  itemsPerPage = 15;
  totalItems = 0;
  totalPages = 0;

  trashCurrentPage = 1;
  trashItemsPerPage = 15;
  trashTotalItems = 0;
  trashTotalPages = 0;

  currentActiveFilters: FilterParams = {};
  currentTrashFilters: FilterParams = {};

  /** Time of the last successful load of the active / trash table - for the UI badge "Updated at...". */
  public activeLastUpdatedAt = new BehaviorSubject<Date | null>(null);
  public trashLastUpdatedAt = new BehaviorSubject<Date | null>(null);

  constructor(
    private genericTableService: GenericTableService,
    private endpointProvider: () => string,
    private destroy$: Subject<void>,
    private cd: ChangeDetectorRef,
    public defaultFilters: FilterParams = { sort_by: 'id', sort_direction: 'desc' },
    private rowMapper: (row: T) => T = row => row
  ) {}

  private get endpoint(): string {
    return this.endpointProvider();
  }

  /**
   * @description Loads a page of data from `GenericTableService` (which decides network vs.
   * TTL cache itself) for the active or the trash table.
   */
  fetchPaginatedData(
    isTrash: boolean,
    page: number,
    perPage: number,
    filters: FilterParams
  ): Observable<PaginatedResponse<T>> {
    if (isTrash) {
      this.currentTrashFilters = { ...filters };
    } else {
      this.currentActiveFilters = { ...filters };
    }

    const params: FilterParams = { ...filters };
    if (isTrash) params['only_trashed'] = 'true';

    return this.genericTableService.getPaginatedData<T>(this.endpoint, page, perPage, params).pipe(
      takeUntil(this.destroy$),
      retry(1),
      tap(response => {
        if (isTrash) {
          this.trashData = response.data.map(row => this.rowMapper(row));
          this.trashTotalItems = response.meta.total;
          this.trashTotalPages = response.meta.last_page;
          this.trashCurrentPage = response.meta.current_page;
          this.trashLastUpdatedAt.next(new Date());
        } else {
          this.data = response.data.map(row => this.rowMapper(row));
          this.totalItems = response.meta.total;
          this.totalPages = response.meta.last_page;
          this.currentPage = response.meta.current_page;
          this.activeLastUpdatedAt.next(new Date());
        }
        this.cd.markForCheck();
      })
    );
  }

  /**
   * @description "Soft" initial load on entering the page (mount). Invalidates no cache - when
   * the `GenericTableService` cache is still fresh, no network request is made.
   */
  loadInitial(filters: FilterParams = this.defaultFilters): void {
    forkJoin([
      this.fetchPaginatedData(false, this.currentPage, this.itemsPerPage, filters),
      this.fetchPaginatedData(true, this.trashCurrentPage, this.trashItemsPerPage, filters)
    ]).pipe(
      finalize(() => this.cd.markForCheck())
    ).subscribe(() => {
      // The neighbours of the table on screen (the trash too, when it is the one shown).
      this.preloadAround(this.showTrashTable, filters);
    });
  }

  /**
   * @description "Hard" refresh - invalidates ALL cached pages of this endpoint and loads them
   * again. Use after a data mutation (create / update / delete / restore) and for the manual /
   * global refresh button.
   */
  forceFullRefresh(currentFilters: FilterParams = this.defaultFilters): void {
    this.genericTableService.invalidateEndpoint(this.endpoint);
    this.cd.markForCheck();

    forkJoin([
      this.fetchPaginatedData(false, this.currentPage, this.itemsPerPage, currentFilters),
      this.fetchPaginatedData(true, this.trashCurrentPage, this.trashItemsPerPage, currentFilters)
    ]).pipe(
      finalize(() => this.cd.markForCheck())
    ).subscribe();
  }

  onHandlePageChange(page: number, filters: FilterParams = this.currentActiveFilters): void {
    if (this.showTrashTable) {
      if (page >= 1 && page <= this.trashTotalPages && page !== this.trashCurrentPage) {
        this.trashCurrentPage = page;
        this.fetchPaginatedData(true, page, this.trashItemsPerPage, filters).subscribe(() => this.preloadAround(true, filters));
      }
    } else {
      if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
        this.currentPage = page;
        this.fetchPaginatedData(false, page, this.itemsPerPage, filters).subscribe(() => this.preloadAround(false, filters));
      }
    }
  }

  onHandleItemsPerPageChange(value: number, filters: FilterParams = this.currentActiveFilters): void {
    if (this.showTrashTable) {
      this.trashItemsPerPage = value;
      this.trashCurrentPage = 1;
      // A new page size = new pages: preload the next one, like after a page change.
      this.fetchPaginatedData(true, 1, value, filters).subscribe(() => this.preloadAround(true, filters));
    } else {
      this.itemsPerPage = value;
      this.currentPage = 1;
      this.fetchPaginatedData(false, 1, value, filters).subscribe(() => this.preloadAround(false, filters));
    }
  }

  /**
   * @description Preloads the neighbour pages (±1) of the current page of the active or the
   *   trash table in the background, with the same parameters as `fetchPaginatedData()` (the
   *   trash adds `only_trashed`) - so the cache key matches and the next click is instant.
   *   Pages already fresh in the cache are not downloaded again (GenericTableService).
   * @param isTrash The trash table (true) or the active one.
   * @param filters Filters of the table.
   */
  private preloadAround(isTrash: boolean, filters: FilterParams): void {
    const params: FilterParams = isTrash ? { ...filters, only_trashed: 'true' } : filters;
    this.genericTableService.preloadAdjacentPages(
      this.endpoint,
      isTrash ? this.trashCurrentPage : this.currentPage,
      isTrash ? this.trashTotalPages : this.totalPages,
      isTrash ? this.trashItemsPerPage : this.itemsPerPage,
      1,
      params
    );
  }

  toggleTable(): void {
    this.showTrashTable = !this.showTrashTable;
    this.loadInitial(this.showTrashTable ? this.currentTrashFilters : this.currentActiveFilters);
  }
}