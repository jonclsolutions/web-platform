/**
 * @file shipping-methods.component.ts
 * @path src/app/admin/shop-pages/shipping-methods/shipping-methods.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Manages the lifecycle of shipping methods, including configuration, filtering, and soft-delete/restore operations.
 * @dependencies
 * - BaseDataComponent: Provides foundational CRUD operations and state management.
 * - TableBuilderComponent: Used for rendering the shipping method registry.
 * - Config.create* factory functions: i18n-aware definitions - viz refactor-note
 *   (2026-09-09) níže.
 *
 * (Earlier bugfix-note 2026-08-31 for duplicate error toasts is unchanged.)
 *
 * @refactor-note (2026-09-09) BACKLOG "vícejazyčná administrace, žádné hardcoded texty":
 * `Config.SHIPPING_*` konstanty nahrazeny `Config.create*()` factory funkcemi.
 * `graphColumns` přestalo být `readonly`. `'Úspěch'`/`'Požadavek byl upraven.'`/
 * `'Požadavek byl vytvořen.'` (dřív natvrdo česky) nahrazeny `t()` voláním.
 */

import { Component, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { TableBuilderComponent } from '../../components/builders/table-builder/table-builder.component';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import * as Config from './shipping-methods.config';
import { ActionMenuBuilderComponent } from '../../components/builders/action-menu-builder/action-menu-builder.component';
import { GraphBuilderComponent } from '../../components/builders/graph-builder/graph-builder.component';
import { GraphColumnOption } from '../../../shared/interfaces/graph-format';

@Component({
  selector: 'app-shipping-methods',
  standalone: true,
  imports: [SHARED_UI_BUILDERS, ActionMenuBuilderComponent, GraphBuilderComponent],
  templateUrl: './shipping-methods.component.html',
  styleUrl: '../default-style.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShippingMethodsComponent extends BaseDataComponent<any> implements Core.OnInit {
  @ViewChild('activeTable') activeTable!: TableBuilderComponent;

  protected override translationSection: string = 'shop-shipping-methods';

  public override t(key: string): string {
    return this.i18n.getValue(`shop-shipping-methods.${key}`);
  }

  tableCaption: string = '';

  override apiEndpoint: string = 'shop/shipping_methods';

  buttons: Core.TableButtons[] = [];
  formFields: Core.InputDefinition[] = [];
  shippingColumns: Core.ColumnDefinition[] = [];
  trashShippingColumns: Core.ColumnDefinition[] = [];
  filterColumns: Core.FilterColumns[] = [];
  detailsColumns: Core.ItemDetailsColumns[] = [];

  selectedItemForEdit: any | null = null;
  selectedItemForDetails: any | null = null;

  filters: Core.FilterParams = {
    sort_by: 'sort_order',
    sort_direction: 'asc'
  };
  showGraphBuilder = false;

  /** @refactor-note (2026-09-09) Přestalo být `readonly` - viz hlavička souboru. */
  graphColumns: GraphColumnOption[] = [];

  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: Core.ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
    private router: Core.Router
  ) {
    super(dataHandler, cd, genericTableService);

    this.i18n.translations$.subscribe(() => {
      this.tableCaption = this.t('table_header');
      this.buttons = Config.createShippingButtons(this.i18n);
      this.formFields = Config.createShippingFormFields(this.i18n);
      this.shippingColumns = Config.createShippingColumns(this.i18n);
      this.trashShippingColumns = Config.createShippingTrashColumns(this.i18n);
      this.filterColumns = Config.createShippingFilterColumns(this.i18n);
      this.detailsColumns = Config.createShippingDetailsColumns(this.i18n);
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
    return Config.createShippingToolbarButtons(this.i18n).map(btn => {
      let updatedBtn = { ...btn };

      if (updatedBtn.permission && !this.permissionService.hasPermission(updatedBtn.permission)) {
        updatedBtn.showIf = false;
      }

      switch (btn.action) {
        case 'toggleFilters':
          updatedBtn.label = this.isFilterVisible ? this.t('toolbar_hide_filters') : this.t('toolbar_filters');
          updatedBtn.isActive = this.isFilterVisible;
          break;
        case 'handleCreateFormOpened':
        case 'exportActiveTable':
        case 'triggerImport':
          if (updatedBtn.showIf !== false) {
            updatedBtn.showIf = !this.showTrashTable;
          }
          break;
        case 'toggleTable':
          updatedBtn.label = this.showTrashTable ? this.t('toolbar_show_active') : this.t('toolbar_show_trash');
          updatedBtn.isActive = this.showTrashTable;
          break;
      }

      return updatedBtn;
    });
  }

  handleToolbarAction(action: string): void {
    const actions: { [key: string]: () => void } = {
      toggleFilters: () => this.toggleFilters(),
      handleCreateFormOpened: () => this.handleCreateFormOpened(),
      exportActiveTable: () => this.exportActiveTable(),
      openGraphBuilder: () => this.openGraphBuilder(),
      toggleTable: () => this.toggleTable()
    };
    if (actions[action]) actions[action]();
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.initWithAuthCheck(this.router);
  }

  override refreshData(): void { this.forceFullRefresh(this.filters); }

  applyFilters(newFilters: Core.FilterParams): void {
    this.filters = { ...this.filters, ...newFilters };
    this.currentPage = 1;
    this.refreshData();
  }

  clearFilters(): void {
    this.filters = { sort_by: 'sort_order', sort_direction: 'asc' };
    this.currentPage = 1;
    this.refreshData();
  }

  handlePageChange(page: number): void { this.onHandlePageChange(page, this.filters); }
  handleItemsPerPageChange(value: number): void { this.onHandleItemsPerPageChange(value, this.filters); }

  exportActiveTable(): void {
    if (this.activeTable) this.activeTable.exportToCSV();
  }

  handleCreateFormOpened(): void {
    this.selectedItemForEdit = null;
    this.showCreateForm = true;
  }

  handleEditFormOpened(item: any): void {
    this.selectedItemForEdit = { ...item };
    this.showCreateForm = true;
  }

  /**
   * @refactor-note (2026-09-09) Natvrdo česká 'Úspěch'/'Požadavek byl upraven.'/
   * 'Požadavek byl vytvořen.' nahrazeny `t()` voláním.
   */
  handleFormSubmitted(formData: any): void {
    const request$ = formData.id ? this.updateData(formData.id, formData) : this.postData(formData);
    request$.pipe(Core.finalize(() => { this.showCreateForm = false; this.cd.markForCheck(); })).subscribe({
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

  handleViewDetails(item: any): void {
    if (!item.id) return;
    this.getItemDetails(item.id).subscribe({
      next: (details) => { this.selectedItemForDetails = details; this.showDetails = true; this.cd.markForCheck(); }
    });
  }

  handleCloseDetails(): void { this.selectedItemForDetails = null; this.showDetails = false; }
  onCancelForm(): void { this.showCreateForm = false; this.selectedItemForEdit = null; this.cd.markForCheck(); }
  handleItemRestored(): void { this.refreshData(); }
  handleItemDeleted(): void { this.refreshData(); }

  openGraphBuilder(): void {
    this.showGraphBuilder = true;
    this.cd.markForCheck();
  }

  closeGraphBuilder(): void {
    this.showGraphBuilder = false;
    this.cd.markForCheck();
  }
}