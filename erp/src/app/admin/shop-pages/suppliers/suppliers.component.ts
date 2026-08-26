/**
 * @file suppliers.component.ts
 * @path src/app/admin/shop-pages/suppliers/suppliers.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Manages the administration of store suppliers, including CRUD operations, archive management, and data filtering.
 * @dependencies
 * - BaseDataComponent: Provides the base logic for API interactions, pagination, and entity state management.
 * - TableBuilderComponent: Used for displaying supplier data and handling CSV exports.
 * - SHARED_UI_BUILDERS: Collection of reusable UI components for the dashboard.
 */

import { Component, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { TableBuilderComponent } from '../../components/builders/table-builder/table-builder.component';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import * as Config from './suppliers.config';
import { ActionMenuBuilderComponent } from '../../components/builders/action-menu-builder/action-menu-builder.component';
/**
 * @description Component for managing business relationships with suppliers.
 * @usage Provides a comprehensive interface for administrators to list, create, edit, and archive supplier records.
 * @note Extends BaseDataComponent to utilize standardized service patterns for fetching and mutating data.
 */
@Component({
  selector: 'app-suppliers',
  standalone: true,
  imports: [SHARED_UI_BUILDERS, ActionMenuBuilderComponent],
  templateUrl: './suppliers.component.html',
  styleUrl: '../default-style.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SuppliersComponent extends BaseDataComponent<any> implements Core.OnInit {
  @ViewChild('activeTable') activeTable!: TableBuilderComponent;

  override apiEndpoint: string = 'shop/suppliers';

  buttons = Config.SUPPLIER_BUTTONS;
  formFields = Config.SUPPLIER_FORM_FIELDS;
  supplierColumns = Config.SUPPLIER_COLUMNS;
  trashSupplierColumns = Config.SUPPLIER_TRASH_COLUMNS;
  filterColumns = Config.SUPPLIER_FILTER_COLUMNS;
  detailsColumns = Config.SUPPLIER_DETAILS_COLUMNS;

  selectedItemForEdit: any | null = null;
  selectedItemForDetails: any | null = null;

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
   * @description Computes the toolbar configuration.
   * @returns List of buttons updated based on user permissions, current view state (active/trash), and UI filter state.
   */
  get toolbarButtons(): Core.Button[] {
    return Config.SUPPLIER_TOOLBAR_BUTTONS.map(btn => {
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
          // Disable context-specific actions when viewing the trash table
          if (updatedBtn.showIf !== false) {
            updatedBtn.showIf = !this.showTrashTable;
          }
          break;
        case 'toggleTable':
          updatedBtn.label = this.showTrashTable ? 'Aktivní' : 'Koš';
          break;
      }

      return updatedBtn;
    });
  }

  /**
   * @description Dispatches actions triggered by the UI toolbar.
   * @param action Identifier of the clicked toolbar action.
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

  override refreshData(): void {
    this.forceFullRefresh(this.filters);
  }

  /**
   * @description Applies updated filters to the data source and refreshes the current view from the first page.
   * @param newFilters The collection of filter parameters.
   */
  applyFilters(newFilters: Core.FilterParams): void {
    this.filters = { ...this.filters, ...newFilters };
    this.currentPage = 1;
    this.refreshData();
  }

  /**
   * @description Resets filter configuration to initial sorting criteria.
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
   * @description Initiates the CSV file export process for the currently active table.
   */
  exportActiveTable(): void {
    if (this.activeTable) {
      this.activeTable.exportToCSV();
    }
  }

  /**
   * @description Resets the editing state and opens the form to create a new supplier.
   */
  handleCreateFormOpened(): void {
    this.selectedItemForEdit = null;
    this.showCreateForm = true;
  }

  /**
   * @description Loads existing record data into the editor and opens the form.
   * @param item The supplier record to be edited.
   */
  handleEditFormOpened(item: any): void {
    this.selectedItemForEdit = { ...item };
    this.showCreateForm = true;
  }

  /**
   * @description Submits form data; determines whether to execute a create or update request based on the ID presence.
   * @param formData The object submitted from the form.
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
        this.alertDialogService.open('Úspěch', formData.id ? 'Požadavek byl upraven.' : 'Požadavek byl vytvořen.', 'success');
        this.refreshData();
      },
      error: (err: any) => this.alertDialogService.open('Chyba', err.error?.message || 'Akce selhala.', 'danger')
    });
  }

  /**
   * @description Fetches detailed information for a specific supplier for display in a view modal.
   * @param item The selected supplier record.
   */
  handleViewDetails(item: any): void {
    if (!item.id) return;
    this.getItemDetails(item.id).subscribe({
      next: (details) => {
        this.selectedItemForDetails = details;
        this.showDetails = true;
        this.cd.markForCheck();
      },
      error: (err: any) => this.alertDialogService.open('Chyba', err.error?.message || 'Nepodařilo se načíst detail.', 'danger')
    });
  }

  /**
   * @description Closes the detailed information view and clears the current selection.
   */
  handleCloseDetails(): void {
    this.selectedItemForDetails = null;
    this.showDetails = false;
  }

  /**
   * @description Cancels form editing, resets state, and triggers a change detection cycle.
   */
  onCancelForm(): void {
    this.showCreateForm = false;
    this.selectedItemForEdit = null;
    this.cd.markForCheck();
  }

  handleItemRestored(): void { this.refreshData(); }
  handleItemDeleted(): void { this.refreshData(); }
}