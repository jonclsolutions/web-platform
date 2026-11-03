/**
 * @file base-data.component.ts
 * @path src/app/admin/components/base-data/base-data.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Abstract base class providing standardized CRUD operations, pagination, and
 * caching logic for administrative data components.
 *
 * @dependencies
 * - DataHandler: Facilitates HTTP communication.
 * - GenericTableService: Used internally by PaginatedListStore.
 * - EntityCrudService, PaginatedListStore: Extracted business logic.
 * - TableRefreshBusService: Global "Refresh all" event bus (admin header).
 * - LoadingService, AlertDialogService, AuthService, PermissionService: Core infrastructure
 *   services for UI state and access control (truly cross-cutting, so they stay here).
 * - AdminLocalizationService: Static (bundled) localization of the admin UI.
 */

import { Directive, ViewChild, inject } from '@angular/core';
import { timer } from 'rxjs';
import { filter as rxFilter } from 'rxjs/operators';
import * as Core from '../../../shared/imports/core-providers';
import { PaginatedListStore } from './paginated-list-store';
import { EntityCrudService } from '../../../core/services/entitiy-crud.service';
import { TableRefreshBusService } from '../../../core/services/table-refresh-bus.service';
import type { TableBuilderComponent } from '../builders/table-builder/table-builder.component';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';

/**
 * @description Serves as a base controller for all resource management components in the admin panel.
 * @usage Extended by specific feature components (e.g., UserComponent, ProductComponent) to eliminate
 * boilerplate code for data fetching and manipulation. When a component needs only single CRUD
 * calls and NO pagination / trash (typically detail / profile pages), prefer using
 * `EntityCrudService` directly instead of extending this class.
 */
@Directive()
export abstract class BaseDataComponent<T extends { id?: number; deleted_at?: string | null }>
  implements Core.OnInit, Core.OnDestroy, Core.OnChanges {

  abstract apiEndpoint: string;

  errorMessage: string | null = null;
  protected destroy$ = new Core.Subject<void>();

  // Pure UI state toggles (unrelated to data / paging)
  isTableFullWidth = true;
  isFilterVisible = false;
  showCreateForm = false;
  showDetails = false;

  protected defaultFilters: Core.FilterParams = {
    sort_by: 'id',
    sort_direction: 'desc'
  };

  /**
   * @description Controls whether `initWithAuthCheck()` calls `this.list.loadInitial()` on mount
   * (default, standard table pages) or `this.refreshData()` directly (components with their own
   * data source outside PaginatedListStore).
   */
  protected usesPaginatedList = true;

  /**
   * @description Period of the automatic background refresh (see `initWithAuthCheck()`). Runs
   * only while the browser tab is active (`document.hidden` check), so an inactive tab does not
   * generate requests forever.
   */
  private static readonly BACKGROUND_REFRESH_INTERVAL_MS = 15 * 60 * 1000;

  public loadingService = inject(Core.LoadingService);
  public alertDialogService = inject(Core.AlertDialogService);
  public authService = inject(Core.AuthService);
  public permissionService = inject(Core.PermissionService);
  public tableRefreshBus = inject(TableRefreshBusService);
  public i18n = inject(AdminLocalizationService);

  /**
   * @description Name of the component's own section in `assets/i18n/admin/{lang}/{lang}.json`
   * (e.g. `'user-request'`). Empty default = no own section, `strings` then returns only
   * `shared`. Set by the subclass.
   */
  protected readonly translationSection: string = '';

  /**
   * @description Merged `shared` + own section (`translationSection`) - for template binding:
   * `{{ strings.confirm }}`.
   * @note Type `any` on purpose - see the same note on
   * `AdminLocalizationService.getMergedSection()`.
   */
  public get strings(): any {
    return this.i18n.getMergedSection(this.translationSection);
  }

  /**
   * @description Imperative one-off lookup by the FULL path (incl. the section) - for `.ts` code
   * that needs a ready `string` at once (e.g.
   * `this.alertDialogService.open(this.t('shared.error'), this.t('user-request.save_failed'), 'danger')`).
   */
  public t(path: string): string {
    return this.i18n.getValue(path);
  }

  private _crud?: EntityCrudService<T>;
  private _list?: PaginatedListStore<T>;

  /** Single CRUD operations for `apiEndpoint` (lazy - apiEndpoint is often set only by a
   *  property initializer of the subclass, so it must not be built in the constructor). */
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

  /** Pagination + cache + the active / trash table pair for `apiEndpoint` (lazy). */
  protected get list(): PaginatedListStore<T> {
    if (!this._list) {
      this._list = new PaginatedListStore<T>(
        this.genericTableService,
        () => this.apiEndpoint,
        this.destroy$,
        this.cd,
        this.defaultFilters,
        row => this.mapListRow(row)
      );
    }
    return this._list;
  }

  /**
   * @description Maps one loaded table row before it is shown (active and trash table).
   *   Identity by default; pages override it to derive display columns from nested API data.
   * @param row Row as returned by the API.
   * @returns The row to display.
   */
  protected mapListRow(row: T): T {
    return row;
  }

  constructor(
    protected dataHandler: Core.DataHandler,
    protected cd: Core.ChangeDetectorRef,
    protected genericTableService: Core.GenericTableService
  ) {
    // After switching the admin language (personal-info dropdown), forces OnPush components to
    // re-evaluate the `strings` / `t()` output.
    this.i18n.translations$
      .pipe(Core.takeUntil(this.destroy$))
      .subscribe(() => this.cd.markForCheck());
  }

  // ── Pass-through state - keeps the original public API unchanged ────────────

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

  /** Stream for the UI badge "Updated at HH:MM:SS" - active table. */
  get activeLastUpdatedAt$(): Core.Observable<Date | null> { return this.list.activeLastUpdatedAt.asObservable(); }

  public refreshData(): void {}

  ngOnInit(): void {}
  ngOnChanges(changes: Core.SimpleChanges): void {}

  /**
   * @description Cleans up resources by completing the destroy subject to unsubscribe from all
   * active streams (shared with `crud` / `list`, which got the same `destroy$`).
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * @description Initializes component state with authentication guard logic.
   * @note The mount-time load respects the TTL cache (`list.loadInitial()`), not a hard
   * refetch. Components with `usesPaginatedList = false` call `this.refreshData()` directly
   * instead. Also wires the global "Refresh all" button and the optional periodic background
   * refresh.
   */
  protected initWithAuthCheck(router: Core.Router): void {
    this.authService.isLoggedIn$
      .pipe(Core.takeUntil(this.destroy$))
      .subscribe(loggedIn => {
        if (loggedIn) {
          if (this.usesPaginatedList) {
            this.list.loadInitial(this.filters);
          } else {
            this.refreshData();
          }
        } else {
          router.navigate(['/auth/login']);
        }
      });

    // Global "Refresh all" button in the admin header (TableRefreshBusService).
    this.tableRefreshBus.refreshAll$
      .pipe(Core.takeUntil(this.destroy$))
      .subscribe(() => this.forceFullRefresh(this.currentActiveFilters));

    // Optional periodic background refresh - only while the browser tab is active.
    // Low priority - can be removed / switched off without impact on the rest of the mechanism.
    timer(BaseDataComponent.BACKGROUND_REFRESH_INTERVAL_MS, BaseDataComponent.BACKGROUND_REFRESH_INTERVAL_MS)
      .pipe(
        Core.takeUntil(this.destroy$),
        rxFilter(() => !document.hidden)
      )
      .subscribe(() => this.forceFullRefresh(this.currentActiveFilters));
  }

  /**
   * @description Checks whether the current user holds any of the given permission key(s).
   * Supports OR syntax ('klic1|klic2'), same as the *appHasPermission directive and the
   * backend CheckPermission middleware. Intended for templates that render their own
   * inline action buttons instead of going through TableBuilderComponent's `buttons`
   * Input (which has its own `isButtonVisible()`) - e.g. EditLegalComponent's inline
   * edit/delete/add controls, or WebSettingsComponent's single-form Save button.
   * @param permission One permission key, or several separated by '|'.
   */
  public hasAnyPermission(permission: string): boolean {
    return permission.split('|').some(p => this.permissionService.hasPermission(p));
  }

  // ── Pagination / trash - delegates to PaginatedListStore ──────────────────────

  /**
   * @description "Hard" reload of the page data - the global "Refresh all" button, the background
   * refresh and the mutations of the table pages call it.
   * @param currentFilters Filters of the reload (paginated pages only).
   * @note Pages with their own data source (`usesPaginatedList = false`) reload through their
   * `refreshData()` - their endpoint is no paginated list and must never be read as one.
   */
  public forceFullRefresh(currentFilters: Core.FilterParams = this.defaultFilters): void {
    if (!this.usesPaginatedList) {
      this.refreshData();
      return;
    }
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

  // ── Shared table-page state and handlers ───────────────────────────────────

  /**
   * @description Whether the graph builder overlay of a table page is open.
   */
  showGraphBuilder = false;

  /**
   * @description Record loaded into the create/edit form; `null` = create a new record.
   */
  selectedItemForEdit: any | null = null;

  /**
   * @description Record shown in the details panel; `null` while the panel is closed.
   */
  selectedItemForDetails: any | null = null;

  /**
   * @description Active filter and sort parameters of a table page.
   * @note Pages with a different default sort override this field.
   */
  filters: Core.FilterParams = {
    sort_by: 'id',
    sort_direction: 'desc'
  };

  /**
   * @description The page's main table (`#activeTable` in the template), used by `exportActiveTable()`.
   * @note Angular inherits view queries from a `@Directive()` base class and resolves them against the
   *   template of the concrete page; pages without a `#activeTable` simply keep `undefined`.
   */
  @ViewChild('activeTable') activeTable!: TableBuilderComponent;

  /**
   * @description Opens the graph builder overlay (toolbar "graph" action).
   */
  openGraphBuilder(): void {
    this.showGraphBuilder = true;
    this.cd.markForCheck();
  }

  /**
   * @description Closes the graph builder overlay.
   */
  closeGraphBuilder(): void {
    this.showGraphBuilder = false;
    this.cd.markForCheck();
  }

  /**
   * @description Pagination handler of the table: loads the requested page with the page's current filters.
   * @param page 1-based page number
   */
  handlePageChange(page: number): void {
    this.onHandlePageChange(page, this.filters);
  }

  /**
   * @description Page-size handler of the table: reloads with the new page size and the current filters.
   * @param value number of rows per page
   */
  handleItemsPerPageChange(value: number): void {
    this.onHandleItemsPerPageChange(value, this.filters);
  }

  /**
   * @description Merges the submitted filter form into the current filters and reloads from page 1.
   * @param newFilters values from the filter form builder
   * @note `refreshData()` is the page's own override, so the reload uses the page's endpoint and filters.
   */
  applyFilters(newFilters: Core.FilterParams): void {
    this.filters = { ...this.filters, ...newFilters };
    this.currentPage = 1;
    this.refreshData();
  }

  /**
   * @description Resets the filters to the default sort (id, newest first) and reloads from page 1.
   * @note Pages with a different default sort override this method.
   */
  clearFilters(): void {
    this.filters = { sort_by: 'id', sort_direction: 'desc' };
    this.currentPage = 1;
    this.refreshData();
  }

  /**
   * @description Opens the form for a new record.
   */
  handleCreateFormOpened(): void {
    this.selectedItemForEdit = null;
    this.showCreateForm = true;
  }

  /**
   * @description Opens the form with a shallow copy of the row, so editing does not change the table row before saving.
   * @param item table row to edit
   */
  handleEditFormOpened(item: any): void {
    this.selectedItemForEdit = { ...item };
    this.showCreateForm = true;
  }

  /**
   * @description Closes the create/edit form without saving.
   */
  onCancelForm(): void {
    this.showCreateForm = false;
    this.selectedItemForEdit = null;
    this.cd.markForCheck();
  }

  /**
   * @description Saves the form: PUT when the record has an id, POST otherwise; closes the form either way and reloads on success.
   * @param formData values emitted by the form builder
   * @note Errors are reported by the data handler; pages with extra steps (files, mapping, prefill) override this method.
   */
  handleFormSubmitted(formData: any): void {
    const request$ = formData.id
      ? this.updateData(formData.id, formData)
      : this.postData(formData);

    request$.pipe(
      Core.finalize(() => {
        this.showCreateForm = false;
        this.cd.markForCheck();
      })
    ).subscribe({
      next: () => {
        this.alertDialogService.open(
          this.i18n.getValue('shared.success'),
          formData.id ? this.t('crud_updated_message') : this.t('crud_created_message'),
          'success'
        );
        this.refreshData();
      }
    });
  }

  /**
   * @description Loads the full record from the API and opens the details panel.
   * @param item table row; rows without id are ignored
   */
  handleViewDetails(item: any): void {
    if (!item.id) return;
    this.getItemDetails(item.id).subscribe({
      next: (details) => {
        this.selectedItemForDetails = details;
        this.showDetails = true;
        this.cd.markForCheck();
      }
    });
  }

  /**
   * @description Closes the details panel.
   */
  handleCloseDetails(): void {
    this.selectedItemForDetails = null;
    this.showDetails = false;
  }

  /**
   * @description Reloads the table after a row was moved to the trash.
   */
  handleItemDeleted(): void { this.refreshData(); }

  /**
   * @description Reloads the table after a row was restored from the trash.
   */
  handleItemRestored(): void { this.refreshData(); }

  /**
   * @description Exports the main table to CSV (toolbar "export" action); does nothing before the table is rendered.
   */
  exportActiveTable(): void {
    if (this.activeTable) this.activeTable.exportToCSV();
  }

  // ── Shared table configuration defaults ────────────────────────────────────

  /**
   * @description Row action buttons of the main table. Empty by default; set by the page.
   */
  buttons: Core.TableButtons[] = [];

  /**
   * @description Columns offered in the filter panel. Empty by default; set by the page.
   */
  filterColumns: Core.FilterColumns[] = [];

  /**
   * @description Columns shown in the details popup. Empty by default; set by the page.
   */
  detailsColumns: Core.ItemDetailsColumns[] = [];

  /**
   * @description Field definitions of the create/edit form. Empty by default; set by the page.
   */
  formFields: Core.InputDefinition[] = [];

  /**
   * @description Dispatches a toolbar button action name to the matching handler; unknown names are ignored.
   * @param action Action name emitted by the toolbar.
   */
  handleToolbarAction(action: string): void {
    const actions: { [key: string]: () => void } = {
      toggleFilters: () => this.toggleFilters(),
      handleCreateFormOpened: () => this.handleCreateFormOpened(),
      exportActiveTable: () => this.exportActiveTable(),
      triggerImport: () => this.activeTable?.importData(),
      openGraphBuilder: () => this.openGraphBuilder(),
      toggleTable: () => this.toggleTable()
    };
    if (actions[action]) actions[action]();
  }

  loadData(): void {
    if (!this.apiEndpoint) {
      this.errorMessage = this.t('base-data.api_endpoint_undefined');
      return;
    }
    this.crud.getCollection().subscribe(responseData => { this.data = responseData; });
  }

  // ── Single CRUD operations - delegates to EntityCrudService ─────────────────

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

  uploadData<U>(formData: FormData, targetUrl?: string): Core.Observable<U> {
    return this.crud.upload<U>(formData, targetUrl);
  }

  loadAllData(filters?: Core.FilterParams): Core.Observable<T[]> {
    if (!this.apiEndpoint) {
      return Core.throwError(() => new Error(this.t('base-data.api_endpoint_undefined')));
    }
    return this.crud.loadAll(filters);
  }
}