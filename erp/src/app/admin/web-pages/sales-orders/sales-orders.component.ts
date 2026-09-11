/**
 * @file sales-orders.component.ts
 * @path src/app/admin/web-pages/sales-orders/sales-orders.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Administrative component for managing sales orders, providing capabilities for status tracking, detail viewing, and data export.
 * @dependencies
 * - BaseDataComponent: Standardized CRUD and state management.
 * - TableBuilderComponent: Handling tabular views and CSV exports.
 * - Config.create* factory functions: Domain-specific, i18n-aware definitions for UI
 *   columns, form fields, and toolbar actions - see refactor-note (2026-09-08) below.
 * @note `createProject(item)` je čistě navigační přesměrování na ProjectsComponent
 * s `order_id`/`open_project` query parametrem - žádné vlastní API volání zde.
 * @bugfix-note (2026-08-31) Odstraněny duplicitní `alertDialogService.open('Chyba', ...)`
 * volání z `error:` callbacků (handleViewDetails, handleFormSubmitted) -
 * `DataHandler.handleError()` je jediné autoritativní místo pro chybový toast.
 *
 * @refactor-note (2026-09-08) BACKLOG "vícejazyčná administrace, žádné hardcoded texty":
 * `Config.SALES_ORDER_*` konstanty nahrazeny `Config.create*()` factory funkcemi -
 * stejný vzor jako `SupportTicketsComponent`/`UserRequestComponent`, viz jejich hlavička
 * pro plné odůvodnění (NG0956 riziko getterů, `translations$` je `BehaviorSubject`).
 * `buttons`/`formFields`/`columns`/`trashColumns`/`filterColumns`/`detailsColumns`
 * přesunuty z field initializerů do konstruktoru, plněné výhradně přes
 * `this.i18n.translations$.subscribe()`. `graphColumns` přestalo být `readonly` -
 * počítá se ze `detailsColumns`, které teď vznikají až uvnitř téhož subscribu.
 * `'Úspěch'`/`'Požadavek byl upraven.'`/`'Požadavek byl vytvořen.'` (dřív natvrdo
 * česky) nahrazeny `t()` voláním.
 */

import { Component, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { TableBuilderComponent } from '../../components/builders/table-builder/table-builder.component';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import * as Config from './sales-orders.config';
import { ActionMenuBuilderComponent } from '../../components/builders/action-menu-builder/action-menu-builder.component';
import { GraphBuilderComponent } from '../../components/builders/graph-builder/graph-builder.component';
import { GraphColumnOption } from '../../../shared/interfaces/graph-format';

/**
 * @description Manages the lifecycle and administrative view of sales orders.
 * @usage Provides a data-driven interface to review order submissions, edit order details, and export reports via CSV.
 * @note Extends BaseDataComponent to maintain consistent API interactions and UI states across the web administration module.
 */
@Component({
  selector: 'app-sales-orders',
  standalone: true,
  imports: [SHARED_UI_BUILDERS, ActionMenuBuilderComponent, GraphBuilderComponent],
  templateUrl: './sales-orders.component.html',
  styleUrl: '../default-style.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SalesOrdersComponent extends BaseDataComponent<any> implements Core.OnInit {
  @ViewChild('activeTable') activeTable!: TableBuilderComponent;

  protected override translationSection: string = 'sales-orders';

  public override t(key: string): string {
    return this.i18n.getValue(`sales-orders.${key}`);
  }

  tableCaption: string = '';

  override apiEndpoint: string = 'web/sales_orders';

  buttons: Core.TableButtons[] = [];
  formFields: Core.InputDefinition[] = [];
  columns: Core.ColumnDefinition[] = [];
  trashColumns: Core.ColumnDefinition[] = [];
  filterColumns: Core.FilterColumns[] = [];
  detailsColumns: Core.ItemDetailsColumns[] = [];

  /** @refactor-note (2026-09-08) Přestalo být `readonly` - viz hlavička souboru. */
  graphColumns: GraphColumnOption[] = [];

  selectedItemForEdit: any = null;
  selectedItemForDetails: any = null;

  filters: Core.FilterParams = {
    sort_by: 'id',
    sort_direction: 'desc'
  };
  showGraphBuilder = false;

  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: Core.ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
    private router: Core.Router
  ) {
    super(dataHandler, cd, genericTableService);

    this.i18n.translations$.subscribe(() => {
      this.tableCaption = this.t('table_header');
      this.buttons = Config.createSalesOrderButtons(this.i18n);
      this.formFields = Config.createSalesOrderFormFields(this.i18n);
      this.columns = Config.createSalesOrderColumns(this.i18n);
      this.trashColumns = Config.createSalesOrderTrashColumns(this.i18n);
      this.filterColumns = Config.createSalesOrderFilterColumns(this.i18n);
      this.detailsColumns = Config.createSalesOrderDetailsColumns(this.i18n);
      this.graphColumns = this.detailsColumns
        .filter(col => col.chartable === true)
        .map(col => ({
          key: col.key,
          label: col.displayName,
          aggregation: col.chartAggregation ?? 'count',
          possibleValues: col.chartPossibleValues,
        }));
      this.cd.markForCheck();
    });
  }

  get toolbarButtons(): Core.Button[] {
    return Config.createSalesOrderToolbarButtons(this.i18n).map(btn => {
      let updatedBtn = { ...btn };

      if (updatedBtn.permission && !this.permissionService.hasPermission(updatedBtn.permission)) {
        updatedBtn.showIf = false;
      }

      switch (btn.action) {
        case 'toggleFilters':
          updatedBtn.label = this.isFilterVisible
            ? this.t('toolbar_hide_filters')
            : this.t('toolbar_filters');
          updatedBtn.isActive = this.isFilterVisible;
          break;
        case 'exportActiveTable':
          if (updatedBtn.showIf !== false) {
            updatedBtn.showIf = !this.showTrashTable;
          }
          break;
        case 'toggleTable':
          updatedBtn.label = this.showTrashTable
            ? this.t('toolbar_show_active')
            : this.t('toolbar_show_trash');
          updatedBtn.isActive = this.showTrashTable;
          break;
      }

      return updatedBtn;
    });
  }

  handleToolbarAction(action: string): void {
    const actions: { [key: string]: () => void } = {
      toggleFilters: () => this.toggleFilters(),
      exportActiveTable: () => this.exportActiveTable(),
      openGraphBuilder: () => this.openGraphBuilder(),
      toggleTable: () => this.toggleTable(),
    };
    if (actions[action]) actions[action]();
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.initWithAuthCheck(this.router);
  }

  override refreshData(): void {
    this.forceFullRefresh(this.filters);
  }

  applyFilters(newFilters: Core.FilterParams): void {
    this.filters = { ...this.filters, ...newFilters };
    this.currentPage = 1;
    this.refreshData();
  }

  clearFilters(): void {
    this.filters = { sort_by: 'id', sort_direction: 'desc' };
    this.currentPage = 1;
    this.refreshData();
  }

  handlePageChange(page: number): void {
    this.onHandlePageChange(page, this.filters);
  }

  handleItemsPerPageChange(value: number): void {
    this.onHandleItemsPerPageChange(value, this.filters);
  }

  exportActiveTable(): void {
    if (this.activeTable) this.activeTable.exportToCSV();
  }

  handleEditFormOpened(item: any): void {
    this.selectedItemForEdit = { ...item };
    this.showCreateForm = true;
  }

  handleViewDetails(item: any): void {
    if (!item.id) return;
    this.getItemDetails(item.id).subscribe({
      next: (res) => {
        this.selectedItemForDetails = res;
        this.showDetails = true;
        this.cd.markForCheck();
      }
    });
  }

  createProject(item: any): void {
    if (!item?.id) return;
    if (item.project_id) {
      this.router.navigate(['/admin/web/projects'], { queryParams: { open_project: item.project_id } });
    } else {
      this.router.navigate(['/admin/web/projects'], { queryParams: { order_id: item.id } });
    }
  }

  /**
   * @refactor-note (2026-09-08) Natvrdo česká 'Úspěch'/'Požadavek byl upraven.'/
   * 'Požadavek byl vytvořen.' nahrazeny `t()` voláním. Metoda VŽDY volá `updateData()`
   * (beze změny oproti originálu) - tenhle resource nemá "vytvořit" cestu z UI (realizace
   * vznikají automaticky ze Sales Leadů, viz info-banner v šabloně), takže "byl vytvořen"
   * větev je fakticky nedosažitelná, ale ponechána pro konzistenci s ostatními stránkami.
   */
  handleFormSubmitted(formData: any): void {
    this.updateData(formData.id, formData).pipe(
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

  onCancelForm(): void {
    this.showCreateForm = false;
    this.selectedItemForEdit = null;
    this.cd.markForCheck();
  }

  openGraphBuilder(): void {
    this.showGraphBuilder = true;
    this.cd.markForCheck();
  }

  closeGraphBuilder(): void {
    this.showGraphBuilder = false;
    this.cd.markForCheck();
  }
}