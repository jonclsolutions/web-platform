/**
 * @file sales-leads.component.ts
 * @path src/app/admin/pages/web/sales-leads/sales-leads.component.ts
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Administrative dashboard component for managing sales leads, including link generation, logging, and CRUD operations.
 * @dependencies
 * - BaseDataComponent: Inheritance for base table/data handling.
 * - TableBuilderComponent: For UI rendering of lead collections.
 * - SalesLeads Config: Domain-specific definitions for forms, columns, and toolbar buttons.
 */

import { Component, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { TableBuilderComponent } from '../../components/builders/table-builder/table-builder.component';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import * as Config from './sales-leads.config';

/**
 * @description Manages the Sales Leads module.
 * @usage Provides administrative oversight for lead generation, editing, and tracking through centralized configuration.
 * @note Implements custom logging for sensitive lead-related actions (e.g., link generation).
 */
@Component({
  selector: 'app-sales-leads',
  standalone: true,
  imports: [SHARED_UI_BUILDERS],
  templateUrl: './sales-leads.component.html',
  styleUrl: '../default-style.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SalesLeadsComponent extends BaseDataComponent<any> implements Core.OnInit {
  @ViewChild('activeTable') activeTable!: TableBuilderComponent;

  override apiEndpoint: string = 'web/sales_leads';
  /** Endpoint for activity logging system */
  private logEndpoint: string = 'web/logs';

  buttons = Config.SALES_LEAD_BUTTONS;
  formFields = Config.SALES_LEAD_FORM_FIELDS;
  salesLeadColumns = Config.SALES_LEAD_COLUMNS;
  trashSalesLeadColumns = Config.SALES_LEAD_TRASH_COLUMNS;
  filterColumns = Config.SALES_LEAD_FILTER_COLUMNS;
  detailsColumns = Config.SALES_LEAD_DETAILS_COLUMNS;

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
   * @description Constructs the toolbar buttons based on current component state and user permissions.
   * @returns List of buttons with conditional rendering (e.g., hiding export when trash is active).
   */
  get toolbarButtons(): Core.Button[] {
    return Config.SALES_LEAD_TOOLBAR_BUTTONS.map(btn => {
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
   * @description Maps toolbar action strings to specific component methods for execution.
   * @param action The action identifier from configuration.
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

  /**
   * @description Constructs a unique order form URL for the lead and copies it to the clipboard.
   * @param item The specific sales lead entity.
   */
  handleGenerateFormLink(item: any): void {
    const url = `${window.location.origin}/order_form/lead_id=${item.id}`;
    navigator.clipboard.writeText(url).then(() => {
      this.alertDialogService.open('Odkaz zkopírován', `Odkaz pro lead ID: ${item.id} je ve schránce.`, 'success');
      this.logAction(item);
    }).catch(() => {
      this.alertDialogService.open('Chyba', 'Nepodařilo se zkopírovat odkaz.', 'danger');
    });
  }

  /**
   * @description Sends an audit log entry to the server regarding specific user actions on a lead.
   * @param item The lead record associated with the action.
   */
  private logAction(item: any): void {
    const logData = {
      event_type: 'LINK_GENERATED',
      module: 'SalesLead',
      description: `Generován odkaz pro lead ID: ${item.id} (Email: ${item.contact_email || 'N/A'})`,
      affected_entity_type: 'sales_lead',
      affected_entity_id: item.id,
      user_id_plain: this.authService.getUserId()?.toString(),
      user_plain: this.authService.getUserEmail(),
      context_data: JSON.stringify({ component: 'SalesLeads' }) 
    };

    this.dataHandler.post(this.logEndpoint, logData)
      .pipe(Core.takeUntil(this.destroy$))
      .subscribe();
  }

  override refreshData(): void {
    this.forceFullRefresh(this.filters);
  }

  /**
   * @description Updates current filtering parameters and resets pagination to page 1.
   * @param f The new filter criteria.
   */
  applyFilters(f: Core.FilterParams): void {
    this.filters = { ...this.filters, ...f };
    this.currentPage = 1;
    this.refreshData();
  }

  /**
   * @description Resets active filters to system defaults.
   */
  clearFilters(): void {
    this.filters = { ...this.defaultFilters };
    this.refreshData();
  }

  handlePageChange(p: number): void {
    this.onHandlePageChange(p, this.filters);
  }

  handleItemsPerPageChange(v: number): void {
    this.onHandleItemsPerPageChange(v, this.filters);
  }

  exportActiveTable(): void {
    this.activeTable?.exportToCSV();
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
   * @description Handles form submission, deciding whether to perform an update or creation based on presence of entity ID.
   * @param formData The object submitted via the edit/create form.
   */
  handleFormSubmitted(formData: any): void {
    const req = formData.id ? this.updateData(formData.id, formData) : this.postData(formData);
    req.pipe(
      Core.finalize(() => {
        this.showCreateForm = false;
        this.cd.markForCheck();
      })
    ).subscribe(() => this.refreshData());
  }

  handleViewDetails(item: any): void {
    this.getItemDetails(item.id).subscribe(d => {
      this.selectedItemForDetails = d;
      this.showDetails = true;
      this.cd.markForCheck();
    });
  }

  onCancelForm(): void {
    this.showCreateForm = false;
    this.selectedItemForEdit = null;
    this.cd.markForCheck();
  }

  handleCloseDetails(): void {
    this.showDetails = false;
    this.selectedItemForDetails = null;
    this.cd.markForCheck();
  }
}