/**
 * @file job-applications.component.ts
 * @path src/app/admin/pages/web/job-applications/job-applications.component.ts
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Manages the administration of job applications, providing filtered views, details retrieval, and status updates.
 * @dependencies
 * - BaseDataComponent: Core logic for data fetching, pagination, and state management.
 * - TableBuilderComponent: Used for tabular data rendering and CSV export functionality.
 * - JOB_APPLICATION_* configs: Centralized definition for UI columns, form fields, and toolbar actions.
 */

import { Component, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { TableBuilderComponent } from '../../components/builders/table-builder/table-builder.component';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import * as Config from './job-applications.config';

/**
 * @description Administrative component for viewing and editing incoming job applications.
 * @usage Provides a data-driven interface to manage candidate submissions via the administrative dashboard.
 * @note Extends BaseDataComponent to leverage standard CRUD patterns while customizing form submission and detail viewing specific to job applications.
 */
@Component({
  selector: 'app-job-applications',
  standalone: true,
  imports: [SHARED_UI_BUILDERS],
  templateUrl: './job-applications.component.html',
  styleUrl: '../default-style.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class JobApplicationsComponent extends BaseDataComponent<any> implements Core.OnInit {
  @ViewChild('activeTable') activeTable!: TableBuilderComponent;

  override apiEndpoint: string = 'web/job_applications';

  buttons = Config.JOB_APPLICATION_BUTTONS.filter(b => b.action !== 'create');
  formFields = Config.JOB_APPLICATION_FORM_FIELDS;
  columns = Config.JOB_APPLICATION_COLUMNS;
  trashColumns = Config.JOB_APPLICATION_TRASH_COLUMNS;
  filterColumns = Config.JOB_APPLICATION_FILTER_COLUMNS;
  detailsColumns = Config.JOB_APPLICATION_DETAILS_COLUMNS;

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
   * @description Dynamically constructs the toolbar buttons based on user permissions and current component state.
   * @returns Array of configured buttons for the toolbar.
   */
  get toolbarButtons(): Core.Button[] {
    return Config.JOB_APPLICATION_TOOLBAR_BUTTONS.map(btn => {
      let updatedBtn = { ...btn };

      if (updatedBtn.permission && !this.permissionService.hasPermission(updatedBtn.permission)) {
        updatedBtn.showIf = false;
      }

      switch (btn.action) {
        case 'toggleFilters':
          updatedBtn.label = this.isFilterVisible ? 'Skrýt' : 'Filtry';
          updatedBtn.isActive = this.isFilterVisible;
          break;
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
   * @description Orchestrates toolbar button click events by mapping actions to class methods.
   * @param action Identifier string provided by the button configuration.
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
   * @description Updates current filters and refreshes table data.
   * @param newFilters The filter object containing sorting and filtering criteria.
   */
  applyFilters(newFilters: Core.FilterParams): void {
    this.filters = { ...this.filters, ...newFilters };
    this.currentPage = 1;
    this.refreshData();
  }

  /**
   * @description Resets the filter object to default sort parameters and refreshes data.
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
   * @description Triggers the CSV export functionality on the referenced active table component.
   */
  exportActiveTable(): void {
    if (this.activeTable) this.activeTable.exportToCSV();
  }

  /**
   * @description Prepares the edit modal by deep-copying the selected item and toggling visibility.
   * @param item The job application record selected for editing.
   */
  handleEditFormOpened(item: any): void {
    this.selectedItemForEdit = null;
    this.showCreateForm = false;
    this.cd.detectChanges();

    setTimeout(() => {
      this.selectedItemForEdit = JSON.parse(JSON.stringify(item));
      this.showCreateForm = true;
      this.cd.markForCheck();
    }, 50);
  }

  /**
   * @description Fetches full details for a specific record to display in a detail view.
   * @param item The job application to view.
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
   * @description Performs a PUT/PATCH request to update existing job application data.
   * @param formData The data object retrieved from the form.
   */
  handleFormSubmitted(formData: any): void {
    this.updateData(formData.id, formData).pipe(
      Core.finalize(() => {
        this.showCreateForm = false;
        this.selectedItemForEdit = null;
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