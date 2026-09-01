/**
 * @file job-applications.component.ts
 * @path src/app/admin/web-pages/job-applications/job-applications.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Manages the administration of job applications, providing filtered views, details retrieval, and status updates.
 * @dependencies
 * - BaseDataComponent: Core logic for data fetching, pagination, and state management.
 * - TableBuilderComponent: Used for tabular data rendering and CSV export functionality.
 * - JOB_APPLICATION_* configs: Centralized definition for UI columns, form fields, and toolbar actions.
 * @bugfix-note (2026-08-31) Odstraněny duplicitní `alertDialogService.open('Chyba', ...)`
 * volání z `error:` callbacků (handleViewDetails, handleFormSubmitted) -
 * `DataHandler.handleError()` je jediné autoritativní místo pro chybový toast.
 */

import { Component, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { TableBuilderComponent } from '../../components/builders/table-builder/table-builder.component';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import * as Config from './job-applications.config';
import { ActionMenuBuilderComponent } from '../../components/builders/action-menu-builder/action-menu-builder.component';
import { GraphBuilderComponent } from '../../components/builders/graph-builder/graph-builder.component';
import { GraphColumnOption } from '../../../shared/interfaces/graph-format';
/**
 * @description Administrative component for viewing and editing incoming job applications.
 * @usage Provides a data-driven interface to manage candidate submissions via the administrative dashboard.
 * @note Extends BaseDataComponent to leverage standard CRUD patterns while customizing form submission and detail viewing specific to job applications.
 */
@Component({
  selector: 'app-job-applications',
  standalone: true,
  imports: [SHARED_UI_BUILDERS, ActionMenuBuilderComponent,GraphBuilderComponent],
  templateUrl: './job-applications.component.html',
  styleUrl: '../default-style.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class JobApplicationsComponent extends BaseDataComponent<any> implements Core.OnInit {
  @ViewChild('activeTable') activeTable!: TableBuilderComponent;
  tableCaption: string = 'Pracovní formulář';

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
showGraphBuilder = false;
  readonly graphColumns: GraphColumnOption[] = Config.JOB_APPLICATION_DETAILS_COLUMNS
     .filter(col => col.chartable === true)
     .map(col => ({
       key: col.key,
       label: col.displayName,
      aggregation: col.chartAggregation ?? 'count',
      possibleValues: col.chartPossibleValues
     }));
  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: Core.ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
    private router: Core.Router
  ) {
    super(dataHandler, cd, genericTableService);
  }

get toolbarButtons(): Core.Button[] {
      return Config.JOB_APPLICATION_TOOLBAR_BUTTONS.map(btn => {
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

  handleToolbarAction(action: string): void {
    const actions: { [key: string]: () => void } = {
      toggleFilters: () => this.toggleFilters(),
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
    this.selectedItemForEdit = null;
    this.showCreateForm = false;
    this.cd.detectChanges();

    setTimeout(() => {
      this.selectedItemForEdit = JSON.parse(JSON.stringify(item));
      this.showCreateForm = true;
      this.cd.markForCheck();
    }, 50);
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

  handleFormSubmitted(formData: any): void {
    this.updateData(formData.id, formData).pipe(
      Core.finalize(() => {
        this.showCreateForm = false;
        this.selectedItemForEdit = null;
        this.cd.markForCheck();
      })
    ).subscribe({
      next: () => {
        this.alertDialogService.open('Úspěch', formData.id ? 'Požadavek byl upraven.' : 'Požadavek byl vytvořen.', 'success');
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