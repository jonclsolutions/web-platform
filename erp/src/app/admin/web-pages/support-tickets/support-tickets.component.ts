/**
 * @file support-tickets.component.ts
 * @path src/app/admin/web-pages/support-tickets/support-tickets.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Administrative dashboard component for managing customer support tickets, including status updates and multi-part data submission.
 * @dependencies
 * - BaseDataComponent: Inheritance for base CRUD and state management.
 * - TableBuilderComponent: Used for tabular data rendering and CSV export.
 * - SUPPORT_TICKET_* configs: Centralized definitions for UI elements and column configurations.
 */

import { Component, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { TableBuilderComponent } from '../../components/builders/table-builder/table-builder.component';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import * as Config from './support-tickets.config';

/**
 * @description Manages the lifecycle of support tickets within the web administration module.
 * @usage Provides an interface for tracking, creating, updating, and exporting support inquiries.
 * @note Extends BaseDataComponent with specific logic to handle FormData uploads (for attachments) versus standard JSON payloads.
 */
@Component({
  selector: 'app-support-tickets',
  standalone: true,
  imports: [SHARED_UI_BUILDERS],
  templateUrl: './support-tickets.component.html',
  styleUrl: '../default-style.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SupportTicketsComponent extends BaseDataComponent<any> implements Core.OnInit {
  @ViewChild('activeTable') activeTable!: TableBuilderComponent;

  override apiEndpoint: string = 'web/support_tickets';

  buttons = Config.SUPPORT_TICKET_BUTTONS;
  formFields = Config.SUPPORT_TICKET_FORM_FIELDS;
  columns = Config.SUPPORT_TICKET_COLUMNS;
  trashColumns = Config.SUPPORT_TICKET_TRASH_COLUMNS;
  filterColumns = Config.SUPPORT_TICKET_FILTER_COLUMNS;
  detailsColumns = Config.SUPPORT_TICKET_DETAILS_COLUMNS;

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
   * @description Dynamically constructs toolbar buttons based on user permissions and component state.
   * @returns Array of buttons configured for the current context (filters, export, or trash toggle).
   */
  get toolbarButtons(): Core.Button[] {
    return Config.SUPPORT_TICKET_TOOLBAR_BUTTONS.map(btn => {
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
          updatedBtn.label = this.showTrashTable ? 'Aktivní' : 'Smazané';
          break;
      }

      return updatedBtn;
    });
  }

  /**
   * @description Maps toolbar action strings to specific component methods.
   * @param action Identifier provided by the configuration.
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
   * @description Updates filtering parameters and refreshes the data set starting from page 1.
   * @param newFilters The criteria object to apply.
   */
  applyFilters(newFilters: Core.FilterParams): void {
    this.filters = { ...this.filters, ...newFilters };
    this.currentPage = 1;
    this.refreshData();
  }

  /**
   * @description Resets filtering criteria to system defaults.
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
   * @description Fetches detailed information for a specific ticket.
   * @param item The ticket record.
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
   * @description Handles submission of ticket data, detecting if the payload requires FormData (attachments) or standard JSON.
   * @param formData The data payload (either FormData object or standard object).
   */
  handleFormSubmitted(formData: any): void {
    const isFormData = formData instanceof FormData;
    const id = isFormData ? formData.get('id') : formData.id;

    let request;

    if (id) {
      if (isFormData) {
        // Handle multipart updates using a PUT override if necessary by API design
        formData.append('_method', 'PUT');
        request = this.dataHandler.post(`${this.apiEndpoint}/${id}`, formData);
      } else {
        request = this.updateData(id, formData);
      }
    } else {
      request = this.postData(formData);
    }

    request.pipe(
      Core.finalize(() => {
        this.showCreateForm = false;
        this.cd.markForCheck();
      })
    ).subscribe({
      next: () => this.refreshData(),
      error: (err: any) => this.alertDialogService.open('Chyba', err.error?.message || 'Akce selhala.', 'danger')
    });
  }

  onCancelForm(): void {
    this.showCreateForm = false;
    this.selectedItemForEdit = null;
    this.cd.markForCheck();
  }
}