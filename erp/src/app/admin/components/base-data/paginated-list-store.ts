/**
 * @file paginated-list-store.ts
 * @path src/app/admin/components/base-data/paginated-list-store.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Vlastní VŠECHNO, co se týká stránkovaného + cachovaného stavu
 * "aktivní vs. koš" tabulky: čítače stránek, cache per-stránka, aktivní filtry
 * a logiku fetch/refresh/změna stránky. Vyextrahováno z BaseDataComponent, aby
 * stránkování/cache bylo samostatně testovatelné a vyměnitelné, místo aby bylo
 * napevno zadrátované do KAŽDÉ admin stránkové komponenty (i těch, co ho vůbec
 * nepoužívají — viz TableBuilderComponent / PersonalInfoComponent).
 *
 * @note Stejně jako EntityCrudService, i tohle je plain třída — instancuje ji
 * BaseDataComponent (lazy getter `this.list`) pro konkrétní `apiEndpoint`.
 */

import { ChangeDetectorRef } from '@angular/core';
import { Observable, Subject, forkJoin, of } from 'rxjs';
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

  private activeCache = new Map<number, T[]>();
  private trashCache = new Map<number, T[]>();

  constructor(
    private genericTableService: GenericTableService,
    private endpointProvider: () => string,
    private destroy$: Subject<void>,
    private cd: ChangeDetectorRef,
    public defaultFilters: FilterParams = { sort_by: 'id', sort_direction: 'desc' }
  ) {}

  private get endpoint(): string {
    return this.endpointProvider();
  }

  /**
   * @description Načte stránku dat z API (nebo z cache, pokud tam už je) pro
   * aktivní nebo koš tabulku.
   */
  fetchPaginatedData(
    isTrash: boolean,
    page: number,
    perPage: number,
    filters: FilterParams
  ): Observable<PaginatedResponse<T>> {
    const cache = isTrash ? this.trashCache : this.activeCache;
    const currentStoredFilters = isTrash ? this.currentTrashFilters : this.currentActiveFilters;

    if (JSON.stringify(filters) !== JSON.stringify(currentStoredFilters)) {
      cache.clear();
      if (isTrash) {
        this.trashCurrentPage = 1;
        this.currentTrashFilters = { ...filters };
      } else {
        this.currentPage = 1;
        this.currentActiveFilters = { ...filters };
      }
    }

    if (cache.has(page)) {
      const cachedData = cache.get(page)!;
      if (isTrash) this.trashData = cachedData; else this.data = cachedData;
      this.cd.markForCheck();
      return of({
        data: cachedData,
        current_page: page,
        last_page: isTrash ? this.trashTotalPages : this.totalPages,
        total: isTrash ? this.trashTotalItems : this.totalItems
      } as PaginatedResponse<T>);
    }

    const params: FilterParams = { ...filters };
    if (isTrash) params['only_trashed'] = 'true';

    return this.genericTableService.getPaginatedData<T>(this.endpoint, page, perPage, params).pipe(
      takeUntil(this.destroy$),
      retry(1),
      tap(response => {
        if (isTrash) {
          this.trashData = response.data;
          this.trashTotalItems = response.total;
          this.trashTotalPages = response.last_page;
          this.trashCurrentPage = response.current_page;
        } else {
          this.data = response.data;
          this.totalItems = response.total;
          this.totalPages = response.last_page;
          this.currentPage = response.current_page;
        }
        cache.set(page, response.data);
        this.cd.markForCheck();
      })
    );
  }

  /**
   * @description Vyčistí obě cache a znovu načte aktuální stránku obou tabulek
   * (aktivní i koš) najednou.
   */
  forceFullRefresh(currentFilters: FilterParams = this.defaultFilters): void {
    this.activeCache.clear();
    this.trashCache.clear();
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
        this.fetchPaginatedData(true, page, this.trashItemsPerPage, filters).subscribe();
      }
    } else {
      if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
        this.currentPage = page;
        this.fetchPaginatedData(false, page, this.itemsPerPage, filters).subscribe();
      }
    }
  }

  onHandleItemsPerPageChange(value: number, filters: FilterParams = this.currentActiveFilters): void {
    if (this.showTrashTable) {
      this.trashItemsPerPage = value;
      this.trashCurrentPage = 1;
      this.trashCache.clear();
      this.fetchPaginatedData(true, 1, value, filters).subscribe();
    } else {
      this.itemsPerPage = value;
      this.currentPage = 1;
      this.activeCache.clear();
      this.fetchPaginatedData(false, 1, value, filters).subscribe();
    }
  }

  toggleTable(): void {
    this.showTrashTable = !this.showTrashTable;
    this.forceFullRefresh(this.showTrashTable ? this.currentTrashFilters : this.currentActiveFilters);
  }

  /** Odebere položku z lokálních polí (aktivní i koš), bez API volání. */
  removeLocal(id: number | undefined): void {
    if (!id) return;
    const activeIdx = this.data.findIndex(d => d.id === id);
    if (activeIdx > -1) this.data.splice(activeIdx, 1);
    const trashIdx = this.trashData.findIndex(d => d.id === id);
    if (trashIdx > -1) this.trashData.splice(trashIdx, 1);
    this.cd.markForCheck();
  }
}