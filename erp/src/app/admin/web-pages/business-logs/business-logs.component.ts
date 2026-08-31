/**
 * @file business-logs.component.ts
 * @path src/app/admin/web-pages/business-logs/business-logs.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Provides a management interface for viewing and filtering business-related system logs.
 * @dependencies
 * - BaseDataComponent: Provides the base logic for API interactions, pagination, and state management.
 * - TableBuilderComponent: Used for rendering the data grid and supporting CSV exports.
 * - SHARED_UI_BUILDERS: Centralized collection of UI components for the administrative dashboard.
 */

import { Component, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { TableBuilderComponent } from '../../components/builders/table-builder/table-builder.component';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import * as Config from './business-logs.config';
import { GraphBuilderComponent } from '../../components/builders/graph-builder/graph-builder.component';
import { GraphColumnOption } from '../../../shared/interfaces/graph-format';

/**
 * @description Component for monitoring business logs.
 * @usage Enables administrators to audit system events, apply filters, and export logs for external analysis.
 * @note Extends BaseDataComponent to leverage standard CRUD patterns while specifically handling log-specific identification fields.
 */
@Component({
  selector: 'app-business-logs',
  standalone: true,
  imports: [SHARED_UI_BUILDERS,GraphBuilderComponent],
  templateUrl: './business-logs.component.html',
  styleUrl: '../default-style.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BusinessLogsComponent extends BaseDataComponent<any> implements Core.OnInit {
  @ViewChild('activeTable') activeTable!: TableBuilderComponent;
  tableCaption: string = 'Webové logy';

  override apiEndpoint: string = 'web/logs';

  buttons = Config.BUTTONS.filter(b => b.action !== 'create' && b.action !== 'edit');
  tableColumns = Config.TABLE_COLUMNS;
  filterColumns = Config.FILTER_COLUMNS;
  detailsColumns = Config.DETAILS_COLUMNS;
  selectedItemForDetails: any | null = null;

  /**
   * @description Initial sorting state for log entries, prioritizing the most recent events.
   */
  filters: Core.FilterParams = {
    sort_by: 'created_at',
    sort_direction: 'desc'
  };
showGraphBuilder = false;
  readonly graphColumns: GraphColumnOption[] = Config.DETAILS_COLUMNS
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

  /**
   * @description Constructs the toolbar configuration.
   * @returns List of buttons updated to reflect current filter visibility states.
   */
  get toolbarButtons(): Core.Button[] {
    return Config.TOOLBAR_BUTTONS.map(btn => {
      let updatedBtn = { ...btn };
      switch (btn.action) {
        case 'toggleFilters':
          updatedBtn.label = this.isFilterVisible ? 'Skrýt' : 'Filtry';
          updatedBtn.isActive = this.isFilterVisible;
          break;
      }
      return updatedBtn;
    });
  }

  /**
   * @description Executes toolbar actions based on user selection.
   * @param action The unique identifier of the action to execute.
   */
  handleToolbarAction(action: string): void {
    const actions: { [key: string]: () => void } = {
      toggleFilters: () => this.toggleFilters(),
      exportActiveTable: () => this.exportActiveTable(),
      openGraphBuilder: () => this.openGraphBuilder()
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
   * @description Updates applied filters and resets the view to the initial page.
   * @param newFilters The collection of filter parameters.
   */
  applyFilters(newFilters: Core.FilterParams): void {
    this.filters = { ...this.filters, ...newFilters };
    this.currentPage = 1;
    this.refreshData();
  }

  /**
   * @description Resets filter settings to default sorting criteria.
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
   * @description Triggers the TableBuilder CSV export.
   */
  exportActiveTable(): void {
    if (this.activeTable) this.activeTable.exportToCSV();
  }

  /**
   * @description Retrieves detailed log information using the item's primary key.
   * @param item The log entry selected for inspection.
   * @note Handles fallback from 'business_log_id' to standard 'id' field for compatibility.
   */
  handleViewDetails(item: any): void {
    const logId = item.business_log_id || item.id;
    if (!logId) return;
    this.getItemDetails(logId).subscribe({
      next: (details) => {
        this.selectedItemForDetails = details;
        this.showDetails = true;
        this.cd.markForCheck();
      },
      complete: () => {
        this.cd.markForCheck();
      }
    });
  }

  /**
   * @description Closes the details view and clears current state.
   */
  handleCloseDetails(): void {
    this.selectedItemForDetails = null;
    this.showDetails = false;
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