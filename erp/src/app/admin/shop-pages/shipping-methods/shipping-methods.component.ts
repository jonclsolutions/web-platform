/**
 * @file shipping-methods.component.ts
 * @path src/app/admin/pages/shop/shipping-methods/shipping-methods.component.ts
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Manages the lifecycle of shipping methods, including configuration, filtering, and soft-delete/restore operations.
 * @dependencies
 * - BaseDataComponent: Provides foundational CRUD operations and state management.
 * - TableBuilderComponent: Used for rendering the shipping method registry.
 * - SHARED_UI_BUILDERS: Provides UI building blocks for forms and toolbars.
 */

import { Component, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { TableBuilderComponent } from '../../components/builders/table-builder/table-builder.component';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import * as Config from './shipping-methods.config';

/**
 * @description Component responsible for the CRUD operations of store shipping methods.
 * @usage Enables administrators to create, update, and manage the visibility of shipping options, including archival via trash functionality.
 * @note Leverages BaseDataComponent for standardized data handling and integrates specific logic for toggling between active and archived views.
 */
@Component({
  selector: 'app-shipping-methods',
  standalone: true,
  imports: [SHARED_UI_BUILDERS],
  templateUrl: './shipping-methods.component.html',
  styleUrl: '../default-style.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShippingMethodsComponent extends BaseDataComponent<any> implements Core.OnInit {
  @ViewChild('activeTable') activeTable!: TableBuilderComponent;

  override apiEndpoint: string = 'shop/shipping_methods';

  buttons = Config.SHIPPING_BUTTONS;
  formFields = Config.SHIPPING_FORM_FIELDS;
  shippingColumns = Config.SHIPPING_COLUMNS;
  trashShippingColumns = Config.SHIPPING_TRASH_COLUMNS;
  filterColumns = Config.SHIPPING_FILTER_COLUMNS;
  detailsColumns = Config.SHIPPING_DETAILS_COLUMNS;

  selectedItemForEdit: any | null = null;
  selectedItemForDetails: any | null = null;

  filters: Core.FilterParams = {
    sort_by: 'sort_order',
    sort_direction: 'asc'
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
   * @description Constructs the toolbar configuration.
   * @returns List of toolbar buttons adjusted for permissions and current UI context (archive/active state).
   */
  get toolbarButtons(): Core.Button[] {
    return Config.SHIPPING_TOOLBAR_BUTTONS.map(btn => {
      let updatedBtn = { ...btn };
      if (updatedBtn.permission && !this.permissionService.hasPermission(updatedBtn.permission)) {
        updatedBtn.showIf = false;
      }
      switch (btn.action) {
        case 'toggleFilters':
          updatedBtn.label = this.isFilterVisible ? 'Skrýt' : 'Filtry';
          updatedBtn.isActive = this.isFilterVisible;
          break;
        case 'handleCreateFormOpened':
        case 'exportActiveTable':
          // Hide context-dependent actions when viewing the trash table
          if (updatedBtn.showIf !== false) updatedBtn.showIf = !this.showTrashTable;
          break;
        case 'toggleTable':
          // Toggle label based on current data view
          updatedBtn.label = this.showTrashTable ? 'Aktivní' : 'Koš';
          break;
      }
      return updatedBtn;
    });
  }

  /**
   * @description Maps toolbar action strings to their respective handler methods.
   * @param action Identifier for the action to execute.
   */
  handleToolbarAction(action: string): void {
    const actions: { [key: string]: () => void } = {
      toggleFilters: () => this.toggleFilters(),
      handleCreateFormOpened: () => this.handleCreateFormOpened(),
      exportActiveTable: () => this.exportActiveTable(),
      toggleTable: () => this.toggleTable()
    };
    if (actions[action]) actions[action]();
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.initWithAuthCheck(this.router);
  }

  override refreshData(): void { this.forceFullRefresh(this.filters); }

  /**
   * @description Merges new filter criteria and triggers a data refresh from page one.
   * @param newFilters The incoming filter parameters.
   */
  applyFilters(newFilters: Core.FilterParams): void {
    this.filters = { ...this.filters, ...newFilters };
    this.currentPage = 1;
    this.refreshData();
  }

  /**
   * @description Resets filter set to default sort criteria.
   */
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
   * @description Handles form submission by either updating an existing record or creating a new one.
   * @param formData Data captured from the form component.
   */
  handleFormSubmitted(formData: any): void {
    const request$ = formData.id ? this.updateData(formData.id, formData) : this.postData(formData);
    request$.pipe(Core.finalize(() => { this.showCreateForm = false; this.cd.markForCheck(); })).subscribe({
      next: () => this.refreshData(),
      error: (err: any) => this.alertDialogService.open('Chyba', err.error?.message || 'Akce selhala.', 'danger')
    });
  }

  /**
   * @description Fetches and opens detail view for a specific shipping method.
   * @param item Target record to view.
   */
  handleViewDetails(item: any): void {
    if (!item.id) return;
    this.getItemDetails(item.id).subscribe({
      next: (details) => { this.selectedItemForDetails = details; this.showDetails = true; this.cd.markForCheck(); },
      error: (err: any) => this.alertDialogService.open('Chyba', err.error?.message || 'Nepodařilo se načíst detail.', 'danger')
    });
  }

  handleCloseDetails(): void { this.selectedItemForDetails = null; this.showDetails = false; }
  onCancelForm(): void { this.showCreateForm = false; this.selectedItemForEdit = null; this.cd.markForCheck(); }
  handleItemRestored(): void { this.refreshData(); }
  handleItemDeleted(): void { this.refreshData(); }
}