/**
 * @file paginated-list-store.ts
 * @path src/app/admin/components/base-data/paginated-list-store.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Vlastní stav "aktivní vs. koš" tabulky: čítače stránek, aktivní filtry
 * a logiku fetch/refresh/změna stránky.
 *
 * @refactor-note (2026-08) ODSTRANĚNA vlastní lokální `Map` cache (`activeCache`/
 * `trashCache`) - byla to druhá, nezávislá cache vrstva NAD `GenericTableService`
 * (root singleton), navíc bez TTL a bez povědomí o mutacích dat. Protože je tahle
 * třída (stejně jako celý BaseDataComponent) při KAŽDÉ navigaci zničena a znovu
 * vytvořena, lokální cache navigaci mezi stránkami stejně nikdy nepřežila - jediná
 * cache, která ji reálně přežije, je `GenericTableService.pageCache` (root singleton).
 * Sjednoceno na jeden zdroj pravdy: `fetchPaginatedData()` teď vždy volá
 * `genericTableService.getPaginatedData()`, který sám rozhodne network vs. cache podle
 * TTL - transparentně, bez ohledu na to, jestli je tohle nový nebo starý mount.
 *
 * Přidány dvě odlišné metody pro dvě odlišné situace (klíčová oprava backlog tasku):
 * - `loadInitial()` - "jemné" načtení při vstupu na stránku (mount). NEinvaliduje nic -
 *   pokud je `GenericTableService` cache pro danou stránku/filtry ještě čerstvá (< TTL),
 *   proběhne bez síťového dotazu.
 * - `forceFullRefresh()` - "tvrdý" refresh. Napřed zavolá
 *   `genericTableService.invalidateEndpoint()` (zahodí VŠECHNY cachované stránky
 *   tohoto zdroje), pak refetchne. Použito: ruční refresh tlačítko na tabulce, refresh
 *   po create/update/delete/restore (přes stávající `refreshData()` override v každé
 *   stránkové komponentě), a globální refresh v headeru (přes TableRefreshBusService).
 *
 * Přidáno `activeLastUpdatedAt` / `trashLastUpdatedAt` (BehaviorSubject<Date | null>) -
 * nastavuje se při KAŽDÉM úspěšném `fetchPaginatedData()` (ať data přišla ze sítě nebo
 * z cache) - UI tak může zobrazit "Aktualizováno v HH:MM:SS", viz TableBuilderComponent.
 *
 * Přidáno volání `genericTableService.preloadAdjacentPages()` při změně stránky - dřív
 * existující, ale nikde nevolaná metoda.
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

  /** Kdy naposledy proběhlo úspěšné načtení aktivní/koš tabulky - pro UI badge "Aktualizováno v...". */
  public activeLastUpdatedAt = new BehaviorSubject<Date | null>(null);
  public trashLastUpdatedAt = new BehaviorSubject<Date | null>(null);

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
   * @description Načte stránku dat z `GenericTableService` (ten sám rozhodne
   * network vs. TTL cache) pro aktivní nebo koš tabulku.
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
          this.trashData = response.data;
          this.trashTotalItems = response.total;
          this.trashTotalPages = response.last_page;
          this.trashCurrentPage = response.current_page;
          this.trashLastUpdatedAt.next(new Date());
        } else {
          this.data = response.data;
          this.totalItems = response.total;
          this.totalPages = response.last_page;
          this.currentPage = response.current_page;
          this.activeLastUpdatedAt.next(new Date());
        }
        this.cd.markForCheck();
      })
    );
  }

  /**
   * @description "Jemné" počáteční načtení při vstupu na stránku (mount). Neinvaliduje
   * žádnou cache - pokud je `GenericTableService` cache ještě čerstvá, proběhne bez
   * síťového dotazu (viz refactor-note výše).
   */
  loadInitial(filters: FilterParams = this.defaultFilters): void {
    forkJoin([
      this.fetchPaginatedData(false, this.currentPage, this.itemsPerPage, filters),
      this.fetchPaginatedData(true, this.trashCurrentPage, this.trashItemsPerPage, filters)
    ]).pipe(
      finalize(() => this.cd.markForCheck())
    ).subscribe(() => {
      this.genericTableService.preloadAdjacentPages(
        this.endpoint, this.currentPage, this.totalPages, this.itemsPerPage, 1, filters
      );
    });
  }

  /**
   * @description "Tvrdý" refresh - zneplatní VŠECHNY cachované stránky tohoto endpointu
   * a znovu je natáhne. Použít po mutaci dat (create/update/delete/restore) a u
   * ručního/globálního refresh tlačítka.
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
        this.fetchPaginatedData(true, page, this.trashItemsPerPage, filters).subscribe(() => {
          this.genericTableService.preloadAdjacentPages(
            this.endpoint, page, this.trashTotalPages, this.trashItemsPerPage, 1,
            { ...filters, only_trashed: 'true' }
          );
        });
      }
    } else {
      if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
        this.currentPage = page;
        this.fetchPaginatedData(false, page, this.itemsPerPage, filters).subscribe(() => {
          this.genericTableService.preloadAdjacentPages(
            this.endpoint, page, this.totalPages, this.itemsPerPage, 1, filters
          );
        });
      }
    }
  }

  onHandleItemsPerPageChange(value: number, filters: FilterParams = this.currentActiveFilters): void {
    if (this.showTrashTable) {
      this.trashItemsPerPage = value;
      this.trashCurrentPage = 1;
      this.fetchPaginatedData(true, 1, value, filters).subscribe();
    } else {
      this.itemsPerPage = value;
      this.currentPage = 1;
      this.fetchPaginatedData(false, 1, value, filters).subscribe();
    }
  }

  toggleTable(): void {
    this.showTrashTable = !this.showTrashTable;
    this.loadInitial(this.showTrashTable ? this.currentTrashFilters : this.currentActiveFilters);
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