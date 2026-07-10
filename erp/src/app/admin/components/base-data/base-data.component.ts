/**
 * @file base-data.component.ts
 * @path src/app/admin/components/base-data/base-data.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Abstract base class providing standardized CRUD operations, pagination, and
 * caching logic for administrative data components.
 *
 * @refactor-note (2025) Tato třída už NEOBSAHUJE implementaci CRUD volání ani
 * stránkování/cache — to bylo vyextrahováno do dvou samostatných, jednoúčelových
 * tříd, na které tato komponenta pouze DELEGUJE přes lazy gettery:
 *   - `EntityCrudService<T>` (get/create/update/delete/restore/upload/updatePassword)
 *   - `PaginatedListStore<T>` (stránkování, cache, duplicita aktivní/koš tabulka)
 *
 * Veřejné API (`this.data`, `this.postData()`, `this.toggleTable()`, …) zůstává
 * BEZE ZMĚNY, takže existující stránkové komponenty (Orders, Products, EditLegal…)
 * nepotřebují žádnou úpravu. Komponenty, které z celého balíku potřebují jen
 * zlomek (např. PersonalInfoComponent, TableBuilderComponent), už z této třídy
 * vůbec nedědí — skládají si `EntityCrudService` přímo (viz jejich soubory).
 *
 * @dependencies
 * - DataHandler: Facilitates HTTP communication.
 * - GenericTableService: Used internally by PaginatedListStore.
 * - EntityCrudService, PaginatedListStore: Extrahovaná byznys logika.
 * - LoadingService, AlertDialogService, AuthService, PermissionService: Core infrastructure
 *   services for UI state and access control (skutečně cross-cutting, proto zůstávají zde).
 */

import { Directive, inject } from '@angular/core';
import * as Core from '../../../shared/imports/core-providers';
import { PaginatedListStore } from './paginated-list-store';
import { EntityCrudService } from '../../../core/services/entitiy-crud.service';
/**
 * @description Serves as a base controller for all resource management components in the admin panel.
 * @usage Extended by specific feature components (e.g., UserComponent, ProductComponent) to eliminate
 * boilerplate code for data fetching and manipulation. Pokud komponenta potřebuje jen jednotlivé
 * CRUD volání a NE stránkování/koš (typicky detail/profil stránky), zvaž raději přímé použití
 * `EntityCrudService` bez dědění z této třídy.
 */
@Directive()
export abstract class BaseDataComponent<T extends { id?: number; deleted_at?: string | null }>
  implements Core.OnInit, Core.OnDestroy, Core.OnChanges {

  abstract apiEndpoint: string;

  errorMessage: string | null = null;
  protected destroy$ = new Core.Subject<void>();

  // Čistě UI-stavové přepínače (nemají nic společného s daty/pagingem)
  isTableFullWidth = true;
  isFilterVisible = false;
  showCreateForm = false;
  showDetails = false;

  protected defaultFilters: Core.FilterParams = {
    sort_by: 'id',
    sort_direction: 'desc'
  };

  public loadingService = inject(Core.LoadingService);
  public alertDialogService = inject(Core.AlertDialogService);
  public authService = inject(Core.AuthService);
  public permissionService = inject(Core.PermissionService);

  private _crud?: EntityCrudService<T>;
  private _list?: PaginatedListStore<T>;

  /** Jednotlivé CRUD operace pro `apiEndpoint` (lazy — apiEndpoint bývá nastaven
   *  až property initializerem potomka, proto se nesmí sestavovat v konstruktoru). */
  protected get crud(): EntityCrudService<T> {
    if (!this._crud) {
      this._crud = new EntityCrudService<T>(
        this.dataHandler,
        () => this.apiEndpoint,
        this.destroy$,
        () => this.cd.markForCheck()
      );
    }
    return this._crud;
  }

  /** Stránkování + cache + duplicita aktivní/koš tabulka pro `apiEndpoint` (lazy). */
  protected get list(): PaginatedListStore<T> {
    if (!this._list) {
      this._list = new PaginatedListStore<T>(
        this.genericTableService,
        () => this.apiEndpoint,
        this.destroy$,
        this.cd,
        this.defaultFilters
      );
    }
    return this._list;
  }

  constructor(
    protected dataHandler: Core.DataHandler,
    protected cd: Core.ChangeDetectorRef,
    protected genericTableService: Core.GenericTableService
  ) {}

  // ── Pass-through stav — zachovává původní veřejné API beze změny ────────────

  get data(): T[] { return this.list.data; }
  set data(value: T[]) { this.list.data = value; }

  get trashData(): T[] { return this.list.trashData; }
  set trashData(value: T[]) { this.list.trashData = value; }

  get showTrashTable(): boolean { return this.list.showTrashTable; }
  set showTrashTable(value: boolean) { this.list.showTrashTable = value; }

  get currentPage(): number { return this.list.currentPage; }
  set currentPage(value: number) { this.list.currentPage = value; }

  get itemsPerPage(): number { return this.list.itemsPerPage; }
  set itemsPerPage(value: number) { this.list.itemsPerPage = value; }

  get totalItems(): number { return this.list.totalItems; }
  set totalItems(value: number) { this.list.totalItems = value; }

  get totalPages(): number { return this.list.totalPages; }
  set totalPages(value: number) { this.list.totalPages = value; }

  get trashCurrentPage(): number { return this.list.trashCurrentPage; }
  set trashCurrentPage(value: number) { this.list.trashCurrentPage = value; }

  get trashItemsPerPage(): number { return this.list.trashItemsPerPage; }
  set trashItemsPerPage(value: number) { this.list.trashItemsPerPage = value; }

  get trashTotalItems(): number { return this.list.trashTotalItems; }
  set trashTotalItems(value: number) { this.list.trashTotalItems = value; }

  get trashTotalPages(): number { return this.list.trashTotalPages; }
  set trashTotalPages(value: number) { this.list.trashTotalPages = value; }

  protected get currentActiveFilters(): Core.FilterParams { return this.list.currentActiveFilters; }
  protected get currentTrashFilters(): Core.FilterParams { return this.list.currentTrashFilters; }

  public refreshData(): void {}

  ngOnInit(): void {}
  ngOnChanges(changes: Core.SimpleChanges): void {}

  /**
   * @description Cleans up resources by completing the destroy subject to unsubscribe from all
   * active streams (sdílený i s `crud`/`list`, protože jim byl předán stejný `destroy$`).
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * @description Initializes component state with authentication guard logic.
   */
  protected initWithAuthCheck(router: Core.Router): void {
    this.authService.isLoggedIn$
      .pipe(Core.takeUntil(this.destroy$))
      .subscribe(loggedIn => {
        if (loggedIn) this.refreshData();
        else router.navigate(['/auth/login']);
      });
  }

  // ── Stránkování / koš — deleguje na PaginatedListStore ──────────────────────

  public forceFullRefresh(currentFilters: Core.FilterParams = this.defaultFilters): void {
    this.list.forceFullRefresh(currentFilters);
  }

  onHandlePageChange(page: number, filters: Core.FilterParams = this.currentActiveFilters): void {
    this.list.onHandlePageChange(page, filters);
  }

  onHandleItemsPerPageChange(value: number, filters: Core.FilterParams = this.currentActiveFilters): void {
    this.list.onHandleItemsPerPageChange(value, filters);
  }

  toggleTable(): void {
    this.list.toggleTable();
  }

  toggleFilters(): void {
    this.isFilterVisible = !this.isFilterVisible;
  }

  loadData(): void {
    if (!this.apiEndpoint) {
      this.errorMessage = 'Error: API endpoint undefined.';
      return;
    }
    this.crud.getCollection().subscribe(responseData => { this.data = responseData; });
  }

  // ── Jednotlivé CRUD operace — deleguje na EntityCrudService ─────────────────

  getItemDetails(id: number | undefined): Core.Observable<T> {
    return this.crud.getOne(id);
  }

  postData(data: T): Core.Observable<T> {
    return this.crud.create(data);
  }

  updateData(id: number | undefined, data: T): Core.Observable<T> {
    return this.crud.update(id, data);
  }

  deleteData(id: number | undefined, forceDelete?: boolean | undefined, params?: any): Core.Observable<void> {
    return this.crud.remove(id, { forceDelete, params });
  }

  restoreDataFromApi(id: number): Core.Observable<T> {
    return this.crud.restore(id);
  }

  uploadData<U>(formData: FormData, targetUrl?: string): Core.Observable<U> {
    return this.crud.upload<U>(formData, targetUrl);
  }

  public updatePassword(id: number, data: any): Core.Observable<any> {
    this.errorMessage = null;
    return this.crud.updatePassword(id, data).pipe(
      Core.catchError((err: Core.HttpErrorResponse) => {
        this.errorMessage = err.message || 'Error changing password.';
        this.cd.markForCheck();
        return Core.throwError(() => err);
      })
    );
  }

  loadAllData(filters?: Core.FilterParams): Core.Observable<T[]> {
    if (!this.apiEndpoint) {
      return Core.throwError(() => new Error('API endpoint undefined.'));
    }
    return this.crud.loadAll(filters);
  }

  public hardDeleteAllTrashedDataFromApi(): Core.Observable<void> {
    if (!this.apiEndpoint) {
      return Core.throwError(() => new Error('API endpoint undefined.'));
    }
    this.errorMessage = null;

    return this.crud.hardDeleteAllTrashed().pipe(
      Core.catchError((err: Core.HttpErrorResponse) => {
        this.errorMessage = err.message || 'Mass delete error.';
        this.cd.markForCheck();
        return Core.throwError(() => err);
      })
    );
  }
}