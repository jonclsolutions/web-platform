/**
 * @file shop-logs.component.ts
 * @path src/app/admin/shop-pages/shop-logs/shop-logs.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Manages the display, filtering, and detailed inspection of system logs related to shop activities.
 * @dependencies
 * - BaseDataComponent: Provides the base logic for data fetching, pagination, and state management.
 * - TableBuilderComponent: Used for rendering the data grid and supporting CSV exports.
 * - SHARED_UI_BUILDERS: Centralized collection of UI components for the administrative dashboard.
 */

import { Component, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { TableBuilderComponent } from '../../components/builders/table-builder/table-builder.component';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import * as Config from './shop-logs.config';
import { GraphBuilderComponent } from '../../components/builders/graph-builder/graph-builder.component';
import { GraphColumnOption } from '../../../shared/interfaces/graph-format';
/**
 * @description Component for viewing shop-related logs.
 * @usage Provides administrators with a read-only interface to monitor system events with advanced filtering and export capabilities.
 * @note Implements standard pagination and filtering inherited from BaseDataComponent, with custom default sorting (ID descending).
 */
@Component({
  selector: 'app-shop-logs',
  standalone: true,
  imports: [SHARED_UI_BUILDERS,GraphBuilderComponent],
  templateUrl: './shop-logs.component.html',
  styleUrl: '../default-style.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShopLogsComponent extends BaseDataComponent<any> implements Core.OnInit {
  @ViewChild('activeTable') activeTable!: TableBuilderComponent;
  tableCaption: string = 'E-Shop logy';

  override apiEndpoint: string = 'shop/logs';

  buttons = Config.BUTTONS.filter(b => b.action !== 'create' && b.action !== 'edit');
  tableColumns = Config.TABLE_COLUMNS;
  filterColumns = Config.FILTER_COLUMNS;
  detailsColumns = Config.DETAILS_COLUMNS;
  selectedItemForDetails: any | null = null;

  /**
   * @description Default filter settings ensuring the latest logs appear first.
   */
  filters: Core.FilterParams = {
    sort_by: 'id',
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
   * @description Generates toolbar buttons with dynamic state representation.
   * @returns List of buttons with active states applied based on filter visibility.
   */
get toolbarButtons(): Core.Button[] {
    return Config.TOOLBAR_BUTTONS.map(btn => {
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
   * @description Executes toolbar actions triggered by user interaction.
   * @param action The key of the action to be performed.
   */
  handleToolbarAction(action: string): void {
    const actions: { [key: string]: () => void } = {
      toggleFilters: () => this.toggleFilters(),
      exportActiveTable: () => this.exportActiveTable(),
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

  /**
   * @description Updates filter parameters and resets to the first page.
   * @param newFilters The set of filter values to merge.
   */
  applyFilters(newFilters: Core.FilterParams): void {
    this.filters = { ...this.filters, ...newFilters };
    this.currentPage = 1;
    this.refreshData();
  }

  /**
   * @description Resets active filters to default log sorting criteria.
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
   * @description Triggers the export functionality of the internal TableBuilder.
   */
  exportActiveTable(): void {
    if (this.activeTable) this.activeTable.exportToCSV();
  }

  /**
   * @description Fetches deep information for a single log entry.
   * @param item The log record selected for inspection.
   */
  handleViewDetails(item: any): void {
    const logId = item.id;
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
   * @description Closes the detail view and clears the current selection.
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