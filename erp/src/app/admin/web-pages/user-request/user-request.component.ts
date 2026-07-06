/**
 * @file user-request.component.ts
 * @path src/app/admin/pages/web/user-request/user-request.component.ts
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Administrative component for managing user-submitted requests (raw commissions), handling data lifecycle, filtering, and detail views.
 * @dependencies
 * - BaseDataComponent: Core logic for API interaction and state management.
 * - TableBuilderComponent: UI component for rendering the request data tables and handling CSV exports.
 * - USER_REQUEST Config: Domain-specific definitions for form fields, table columns, and button configurations.
 */

import { Component, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { TableBuilderComponent } from '../../components/builders/table-builder/table-builder.component';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import * as Config from './user-request.config';

/**
 * @description Manages the administration of user request commissions.
 * @usage Enables staff to monitor, edit, and audit incoming raw requests from the frontend.
 * @note Implements standard CRUD operations while utilizing custom configurations for display and interaction logic.
 */
@Component({
  selector: 'app-user-request',
  standalone: true,
  imports: [SHARED_UI_BUILDERS],
  templateUrl: './user-request.component.html',
  styleUrl: '../default-style.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserRequestComponent extends BaseDataComponent<any> implements Core.OnInit {
  @ViewChild('activeTable') activeTable!: TableBuilderComponent;

  override apiEndpoint: string = 'web/raw_request_commissions';

  buttons = Config.USER_REQUEST_BUTTONS;
  formFields = Config.USER_REQUEST_FORM_FIELDS;
  userRequestColumns = Config.USER_REQUEST_COLUMNS;
  trashUserRequestColumns = Config.USER_REQUEST_TRASH_COLUMNS;
  filterColumns = Config.USER_REQUEST_FILTER_COLUMNS;
  detailsColumns = Config.USER_REQUEST_DETAILS_COLUMNS;

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
   * @description Dynamically generates toolbar button definitions based on user permissions and component state (e.g., active vs. trash table view).
   * @returns Array of button objects with applied logic for visibility and state labeling.
   */
  get toolbarButtons(): Core.Button[] {
    return Config.USER_REQUEST_TOOLBAR_BUTTONS.map(btn => {
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
   * @description Maps incoming action strings from the toolbar to their corresponding component methods.
   * @param action The unique action key from the button configuration.
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
   * @description Merges new filter criteria with existing ones and resets the table view to the first page.
   * @param newFilters The filter object containing sorting and filtering criteria.
   */
  applyFilters(newFilters: Core.FilterParams): void {
    this.filters = { ...this.filters, ...newFilters };
    this.currentPage = 1;
    this.refreshData();
  }

  /**
   * @description Resets the filter state to default parameters and triggers a data refresh.
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
   * @description Initiates the CSV file generation for the currently displayed table.
   */
  exportActiveTable(): void {
    if (this.activeTable) {
      this.activeTable.exportToCSV();
    }
  }

  handleCreateFormOpened(): void {
    this.selectedItemForEdit = null;
    this.showCreateForm = true;
  }

  /**
   * @description Prepares an existing item for modification by copying it into the editing buffer.
   * @param item The record data to be edited.
   */
  handleEditFormOpened(item: any): void {
    this.selectedItemForEdit = { ...item };
    this.showCreateForm = true;
  }

  /**
   * @description Processes form submission, routing to either create or update API endpoints based on entity ID presence.
   * @param formData The data object derived from the form interaction.
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
      next: () => this.refreshData(),
      error: (err: any) => this.alertDialogService.open('Chyba', err.error?.message || 'Akce selhala.', 'danger')
    });
  }

  /**
   * @description Retrieves detailed information for a specific request record.
   * @param item The request item to be inspected.
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

  handleCloseDetails(): void {
    this.selectedItemForDetails = null;
    this.showDetails = false;
  }

  onCancelForm(): void {
    this.showCreateForm = false;
    this.selectedItemForEdit = null;
    this.cd.markForCheck();
  }

  handleItemRestored(): void { this.refreshData(); }
  handleItemDeleted(): void { this.refreshData(); }
}