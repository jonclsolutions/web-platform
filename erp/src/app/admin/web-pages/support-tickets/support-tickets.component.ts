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
 * @bugfix-note (2026-08-31) Odstraněny duplicitní `alertDialogService.open('Chyba', ...)`
 * volání z `error:` callbacků (handleViewDetails, handleFormSubmitted) -
 * `DataHandler.handleError()` je jediné autoritativní místo pro chybový toast.
 */

import { Component, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { TableBuilderComponent } from '../../components/builders/table-builder/table-builder.component';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import * as Config from './support-tickets.config';
import { ActionMenuBuilderComponent } from '../../components/builders/action-menu-builder/action-menu-builder.component';
import { GraphBuilderComponent } from '../../components/builders/graph-builder/graph-builder.component';
import { GraphColumnOption } from '../../../shared/interfaces/graph-format';
/**
 * @description Manages the lifecycle of support tickets within the web administration module.
 * @usage Provides an interface for tracking, creating, updating, and exporting support inquiries.
 * @note Extends BaseDataComponent with specific logic to handle FormData uploads (for attachments) versus standard JSON payloads.
 */
@Component({
  selector: 'app-support-tickets',
  standalone: true,
  imports: [SHARED_UI_BUILDERS, ActionMenuBuilderComponent,GraphBuilderComponent],
  templateUrl: './support-tickets.component.html',
  styleUrl: '../default-style.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SupportTicketsComponent extends BaseDataComponent<any> implements Core.OnInit {
  @ViewChild('activeTable') activeTable!: TableBuilderComponent;
  tableCaption: string = 'Helpdesk tickety';

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
  showGraphBuilder = false;
    readonly graphColumns: GraphColumnOption[] = Config.SUPPORT_TICKET_DETAILS_COLUMNS
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
      return Config.SUPPORT_TICKET_TOOLBAR_BUTTONS.map(btn => {
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
      handleCreateFormOpened: () => this.handleCreateFormOpened(),
      exportActiveTable: () => this.exportActiveTable(),
      toggleTable: () => this.toggleTable(),
      openGraphBuilder: () => this.openGraphBuilder(),
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

  handleCreateFormOpened(): void {
    this.selectedItemForEdit = null;
    this.showCreateForm = true;
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

  handleFormSubmitted(formData: any): void {
    const isFormData = formData instanceof FormData;
    const id = isFormData ? formData.get('id') : formData.id;

    let request;

    if (id) {
      if (isFormData) {
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