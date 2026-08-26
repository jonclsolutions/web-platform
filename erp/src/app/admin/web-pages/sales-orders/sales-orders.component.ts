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
 * - SalesOrders Config: Domain-specific definitions for UI columns, form fields, and toolbar actions.
 */

import { Component, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { TableBuilderComponent } from '../../components/builders/table-builder/table-builder.component';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import * as Config from './sales-orders.config';
import { ActionMenuBuilderComponent } from '../../components/builders/action-menu-builder/action-menu-builder.component';
/**
 * @description Manages the lifecycle and administrative view of sales orders.
 * @usage Provides a data-driven interface to review order submissions, edit order details, and export reports via CSV.
 * @note Extends BaseDataComponent to maintain consistent API interactions and UI states across the web administration module.
 */
@Component({
  selector: 'app-sales-orders',
  standalone: true,
  imports: [SHARED_UI_BUILDERS, ActionMenuBuilderComponent],
  templateUrl: './sales-orders.component.html',
  styleUrl: '../default-style.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SalesOrdersComponent extends BaseDataComponent<any> implements Core.OnInit {
  @ViewChild('activeTable') activeTable!: TableBuilderComponent;

  override apiEndpoint: string = 'web/sales_orders';

  buttons = Config.SALES_ORDER_BUTTONS;
  formFields = Config.SALES_ORDER_FORM_FIELDS;
  columns = Config.SALES_ORDER_COLUMNS;
  trashColumns = Config.SALES_ORDER_TRASH_COLUMNS;
  filterColumns = Config.SALES_ORDER_FILTER_COLUMNS;
  detailsColumns = Config.SALES_ORDER_DETAILS_COLUMNS;

  selectedItemForEdit: any = null;
  selectedItemForDetails: any = null;

  filters: Core.FilterParams = {
    sort_by: 'id',
    sort_direction: 'desc'
  };

  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: Core.ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
    private router: Core.Router
  ) {
    super(dataHandler, cd, genericTableService);
  }

  /**
   * @description Generates the toolbar configuration dynamically based on active filters, trash visibility, and user permissions.
   * @returns Array of configured Core.Button items.
   */

  get toolbarButtons(): Core.Button[] {
      return Config.SALES_ORDER_TOOLBAR_BUTTONS.map(btn => {
        let updatedBtn = { ...btn };
  
        if (updatedBtn.permission && !this.permissionService.hasPermission(updatedBtn.permission)) {
          updatedBtn.showIf = false;
        }
  
        switch (btn.action) {
          case 'toggleFilters':
            updatedBtn.label = this.isFilterVisible ? 'Skrýt filtry' : 'Filtry';
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
            updatedBtn.label = this.showTrashTable ? 'Zobrazit aktivní' : 'Koš';
            updatedBtn.isActive = this.showTrashTable;
            break;
        }
  
        return updatedBtn;
      });
    }

  /**
   * @description Maps toolbar button actions to their corresponding class methods.
   * @param action Identifier string provided by configuration.
   */
  handleToolbarAction(action: string): void {
    const actions: { [key: string]: () => void } = {
      toggleFilters: () => this.toggleFilters(),
      exportActiveTable: () => this.exportActiveTable(),
      toggleTable: () => this.toggleTable()
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

  /**
   * @description Updates current view filters and resets pagination to the first page.
   * @param newFilters Filter parameters to apply.
   */
  applyFilters(newFilters: Core.FilterParams): void {
    this.filters = { ...this.filters, ...newFilters };
    this.currentPage = 1;
    this.refreshData();
  }

  /**
   * @description Reverts filters to system default sorting and refreshes the data set.
   */
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

  /**
   * @description Invokes CSV export mechanism on the primary data table component.
   */
  exportActiveTable(): void {
    if (this.activeTable) this.activeTable.exportToCSV();
  }

  /**
   * @description Prepares the selected item for the editing modal.
   * @param item The order record selected for modification.
   */
  handleEditFormOpened(item: any): void {
    this.selectedItemForEdit = { ...item };
    this.showCreateForm = true;
  }

  /**
   * @description Fetches detailed record data and displays it within a detail view modal.
   * @param item The order record for which to view details.
   */
  handleViewDetails(item: any): void {
    if (!item.id) return;
    this.getItemDetails(item.id).subscribe({
      next: (res) => {
        this.selectedItemForDetails = res;
        this.showDetails = true;
        this.cd.markForCheck();
      },
      error: (err: any) => this.alertDialogService.open('Chyba', err.error?.message || 'Nepodařilo se načíst detail.', 'danger')
    });
  }

  /**
   * @description Submits updated order information and refreshes the table upon success.
   * @param formData The object containing order data to be persisted.
   */
  handleFormSubmitted(formData: any): void {
    this.updateData(formData.id, formData).pipe(
      Core.finalize(() => {
        this.showCreateForm = false;
        this.cd.markForCheck();
      })
    ).subscribe({
      next: () => {
        this.alertDialogService.open('Úspěch', formData.id ? 'Požadavek byl upraven.' : 'Požadavek byl vytvořen.', 'success');
        this.refreshData();
      },
      error: (err: any) => this.alertDialogService.open('Chyba', err.error?.message || 'Akce selhala.', 'danger')
    });
  }

  onCancelForm(): void {
    this.showCreateForm = false;
    this.selectedItemForEdit = null;
    this.cd.markForCheck();
  }
}