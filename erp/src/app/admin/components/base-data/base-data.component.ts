/**
 * @file base-data.component.ts
 * @path src/app/admin/components/base-data/base-data.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Abstract base class providing standardized CRUD operations, pagination, and
 * caching logic for administrative data components.
 *
 * @dependencies
 * - DataHandler: Facilitates HTTP communication.
 * - GenericTableService: Used internally by PaginatedListStore.
 * - EntityCrudService, PaginatedListStore: Extrahovaná byznys logika.
 * - TableRefreshBusService: Globální "Aktualizovat vše" event bus (admin header).
 * - LoadingService, AlertDialogService, AuthService, PermissionService: Core infrastructure
 *   services for UI state and access control (skutečně cross-cutting, proto zůstávají zde).
 * - AdminLocalizationService: Statická (bundlovaná) lokalizace admin UI - viz refactor-note
 *   (2026-09) níže.
 *
 * @refactor-note (2026-09) BACKLOG "vícejazyčná administrace (statická, ne editovatelná)":
 * Přidán `AdminLocalizationService` jako společný vstupní bod i18n pro ~99 % admin
 * komponent, které dědí tuhle třídu (komponenty, co nededí - `PersonalInfoComponent`,
 * `EditWebsiteComponent`/`EditEshopComponent` - si službu injektují ručně, žádná změna
 * v nich není potřeba kvůli téhle úpravě).
 * - `translationSection` - potomek nastaví na název své sekce v JSON souboru (např.
 *   `'user-request'`). Prázdný default `''` znamená "žádná vlastní sekce, jen shared" -
 *   existující komponenty tak touhle změnou nic nerozbijí, dokud si vlastní sekci
 *   nenastaví samy při postupné migraci na i18n klíče.
 * - `strings` getter - pro šablony: `{{ strings.confirm }}` (shared klíč) nebo
 *   `{{ strings.save_failed }}` (vlastní sekce, přebíjí shared se stejným jménem).
 * - `t(path)` metoda - pro imperativní použití v `.ts` (texty v `alertDialogService.open()`
 *   apod.), vždy plná cesta včetně sekce: `this.t('shared.confirm')`,
 *   `this.t('user-request.save_failed')`.
 * - Konstruktor navíc odebírá `i18n.translations$` a při každé změně jazyka volá
 *   `cd.markForCheck()` - nutné pro komponenty s `ChangeDetectionStrategy.OnPush`
 *   (většina admin stránek), aby se `strings`/`t()` výstup po přepnutí jazyka na
 *   personal-info stránce reálně překreslil i v komponentách, které zrovna nejsou
 *   OnPush-triggerované jinou akcí. Bezpečné volat i pro non-OnPush komponenty
 *   (markForCheck je no-op navíc, ne chyba).
 *
 * @refactor-note (2026-10) BACKLOG "vícejazyčná administrace, žádné hardcoded texty":
 * Poslední natvrdo psané (anglické) texty PŘÍMO v této třídě nahrazeny i18n klíči
 * z vlastní sekce `base-data` - čteno přes `this.t('base-data.<klic>')`, tedy plnou
 * cestou včetně sekce (stejné pravidlo jako u `t()` výše). Záměrně NE přes `strings`
 * a NE přes `translationSection` potomka: jde o texty báze samotné, které mají být
 * stejné ve všech ~99 % zděděných komponent a potomek je nemá přebíjet.
 * Dotčené texty (jen texty, žádná změna logiky ani veřejného API):
 * - `loadData()`, `loadAllData()`, `hardDeleteAllTrashedDataFromApi()` -
 *   `base-data.api_endpoint_undefined` (dříve dvě drobně odlišné varianty téhož textu,
 *   sjednoceno na jeden klíč).
 * - `updatePassword()` - `base-data.password_change_error` (fallback, když chyba
 *   nenese vlastní `message`).
 * - `hardDeleteAllTrashedDataFromApi()` - `base-data.mass_delete_error` (stejný fallback).
 * Odpovídající JSON sekce `base-data` musí existovat v KAŽDÉM
 * `assets/i18n/admin/{lang}/{lang}.json` (cz, en).
 * @refactor-note (2026-10-21) Removed unused code (no reference in TS, templates or
 *   string literals): `currentTrashFilters`, `trashLastUpdatedAt$`, `restoreDataFromApi`, `updatePassword`, `hardDeleteAllTrashedDataFromApi`.
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

  /**
   * @description Řídí, jestli `initWithAuthCheck()` při mountu volá `this.list.loadInitial()`
   * (default, standardní tabulkové stránky) nebo přímo `this.refreshData()` (komponenty
   * s vlastním zdrojem dat mimo PaginatedListStore - viz refactor-note 2026-08-9 výše).
   */
  protected usesPaginatedList = true;

  /**
   * @description Perioda automatického refreshe na pozadí (viz `initWithAuthCheck()`).
   * Nízká priorita (viz backlog task) - jen pokud je karta prohlížeče aktivní
   * (`document.hidden` check), aby neaktivní karta negenerovala requesty donekonečna.
   */
  private static readonly BACKGROUND_REFRESH_INTERVAL_MS = 15 * 60 * 1000;

  public loadingService = inject(Core.LoadingService);
  public alertDialogService = inject(Core.AlertDialogService);
  public authService = inject(Core.AuthService);
  public permissionService = inject(Core.PermissionService);
  public tableRefreshBus = inject(TableRefreshBusService);
  public i18n = inject(AdminLocalizationService);

  /**
   * @description Název "vlastní" sekce v `assets/i18n/admin/{lang}/{lang}.json` pro
   * tuhle komponentu (např. `'user-request'`). Prázdný default = žádná vlastní sekce,
   * `strings` pak vrací jen `shared`. Nastavuje potomek při migraci na i18n klíče - viz
   * refactor-note v hlavičce souboru.
   */
  protected readonly translationSection: string = '';

  /**
   * @description Merged `shared` + vlastní sekce (`translationSection`) - pro binding
   * v šabloně: `{{ strings.confirm }}`. Viz refactor-note v hlavičce souboru.
   * @note Typ `any` záměrně - viz stejná poznámka u
   * `AdminLocalizationService.getMergedSection()`.
   */
  public get strings(): any {
    return this.i18n.getMergedSection(this.translationSection);
  }

  /**
   * @description Imperativní jednorázový lookup podle PLNÉ cesty (vč. sekce) - pro
   * použití v `.ts` kódu, kde je potřeba hotový `string` hned (např.
   * `this.alertDialogService.open(this.t('shared.error'), this.t('user-request.save_failed'), 'danger')`).
   * Viz refactor-note v hlavičce souboru.
   */
  public t(path: string): string {
    return this.i18n.getValue(path);
  }

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
    // Po přepnutí admin jazyka (personal-info dropdown) donutí i OnPush komponenty
    // přehodnotit `strings`/`t()` výstup - viz refactor-note v hlavičce souboru.
    this.i18n.translations$
      .pipe(Core.takeUntil(this.destroy$))
      .subscribe(() => this.cd.markForCheck());
  }

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

  /** Stream pro UI badge "Aktualizováno v HH:MM:SS" - aktivní tabulka. */
  get activeLastUpdatedAt$(): Core.Observable<Date | null> { return this.list.activeLastUpdatedAt.asObservable(); }

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
   * @note Mount-time load respektuje TTL cache (`list.loadInitial()`), ne tvrdý
   * refetch - viz refactor-note (2026-08-6) v hlavičce souboru. Komponenty s
   * `usesPaginatedList = false` (viz refactor-note 2026-08-9) místo toho zavolají
   * přímo `this.refreshData()`. Zároveň napojuje globální "Aktualizovat vše" tlačítko
   * a volitelný periodický background refresh.
   */
  protected initWithAuthCheck(router: Core.Router): void {
    this.authService.isLoggedIn$
      .pipe(Core.takeUntil(this.destroy$))
      .subscribe(loggedIn => {
        if (loggedIn) {
          if (this.usesPaginatedList) {
            this.list.loadInitial(this.defaultFilters);
          } else {
            this.refreshData();
          }
        } else {
          router.navigate(['/auth/login']);
        }
      });

    // Globální "Aktualizovat vše" tlačítko v admin headeru (TableRefreshBusService).
    this.tableRefreshBus.refreshAll$
      .pipe(Core.takeUntil(this.destroy$))
      .subscribe(() => this.forceFullRefresh(this.currentActiveFilters));

    // Volitelný periodický refresh na pozadí - jen pokud je karta prohlížeče aktivní.
    // Nízká priorita (viz backlog task) - lze snadno odstranit/vypnout bez dopadu
    // na zbytek mechanismu.
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

  // ── Shared table-page state and handlers ───────────────────────────────────
  // @refactor-note (2026-10-21) Moved here from the table pages, where each one had an
  // identical copy. A page with different behaviour keeps its own `override`.

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
  // @refactor-note (2026-10-21) Empty defaults and the toolbar dispatcher that most table
  // pages declared identically. Pages that fill them from a *.config.ts keep an `override`.

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
   * @bugfix-note (2026-10-22) `triggerImport` was missing - the "import data" toolbar button of
   *   pages that rely on this default (shop coupons, suppliers, shipping methods) did nothing.
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

  /**
   * @refactor-note (2026-10) Natvrdo psaný text nahrazen i18n klíčem
   * `base-data.api_endpoint_undefined` - viz hlavička souboru.
   */
  loadData(): void {
    if (!this.apiEndpoint) {
      this.errorMessage = this.t('base-data.api_endpoint_undefined');
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

  uploadData<U>(formData: FormData, targetUrl?: string): Core.Observable<U> {
    return this.crud.upload<U>(formData, targetUrl);
  }

  /**
   * @refactor-note (2026-10) Natvrdo psaný text nahrazen i18n klíčem
   * `base-data.api_endpoint_undefined` - viz hlavička souboru.
   */
  loadAllData(filters?: Core.FilterParams): Core.Observable<T[]> {
    if (!this.apiEndpoint) {
      return Core.throwError(() => new Error(this.t('base-data.api_endpoint_undefined')));
    }
    return this.crud.loadAll(filters);
  }
}