/**
 * @file logs.component.ts
 * @path src/app/admin/core-pages/logs/logs.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Provides a management interface for viewing and filtering system-wide
 * (Core) audit logs.
 * @dependencies
 * - BaseDataComponent: Provides the base logic for API interactions, pagination, and state management.
 * - TableBuilderComponent: Used for rendering the data grid and supporting CSV exports.
 * - Config.create* factory functions: i18n-aware definitions for UI columns and
 *   toolbar actions - see refactor-note (2026-09-08) below.
 * - SHARED_UI_BUILDERS: Centralized collection of UI components for the administrative dashboard.
 *
 * @bugfix-note (2026-09-08) `toolbarButtons` getter NIKDY nekontroloval `btn.permission`
 * - `openGraphBuilder` tlačítko s `permission: 'view-core'` se tak zobrazovalo i
 *   uživatelům bez tohoto práva. Doplněna stejná `permissionService.hasPermission()`
 *   kontrola jako všude jinde (stejná chyba jako u `business-logs.component.ts` web).
 *
 * @refactor-note (2026-09-08) BACKLOG "vícejazyčná administrace, žádné hardcoded texty":
 * `Config.*` konstanty nahrazeny `Config.create*()` factory funkcemi. `buttons.filter(b
 * => b.action !== 'create' && b.action !== 'edit')` ODSTRANĚN - byl to no-op (`BUTTONS`
 * nikdy `create`/`edit` tlačítko neobsahoval). `graphColumns` přestalo být `readonly`.
 */

import { Component, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { TableBuilderComponent } from '../../components/builders/table-builder/table-builder.component';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import * as Config from './logs.config';
import { GraphBuilderComponent } from '../../components/builders/graph-builder/graph-builder.component';
import { GraphColumnOption } from '../../../shared/interfaces/graph-format';

/**
 * @description Component for monitoring system-wide (Core) audit logs.
 * @usage Enables administrators to audit system events, apply filters, and export logs for external analysis.
 * @note Extends BaseDataComponent to leverage standard CRUD patterns while specifically handling log-specific identification fields.
 */
@Component({
  selector: 'app-core-system-logs',
  standalone: true,
  imports: [SHARED_UI_BUILDERS, GraphBuilderComponent],
  templateUrl: './logs.component.html',
  styleUrl: '../default-style.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CoreLogsComponent extends BaseDataComponent<any> implements Core.OnInit {
  @ViewChild('activeTable') activeTable!: TableBuilderComponent;

  protected override translationSection: string = 'core-logs';

  public override t(key: string): string {
    return this.i18n.getValue(`core-logs.${key}`);
  }

  tableCaption: string = '';

  override apiEndpoint: string = 'core/logs';

  buttons: Core.TableButtons[] = [];
  tableColumns: Core.ColumnDefinition[] = [];
  filterColumns: Core.FilterColumns[] = [];
  detailsColumns: Core.ItemDetailsColumns[] = [];
  selectedItemForDetails: any | null = null;

  /**
   * @description Initial sorting state for log entries, prioritizing the most recent events.
   */
  filters: Core.FilterParams = {
    sort_by: 'created_at',
    sort_direction: 'desc'
  };

  showGraphBuilder = false;

  /** @refactor-note (2026-09-08) Přestalo být `readonly` - viz hlavička souboru. */
  graphColumns: GraphColumnOption[] = [];

  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: Core.ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
    private router: Core.Router
  ) {
    super(dataHandler, cd, genericTableService);

    this.i18n.translations$.subscribe(() => {
      this.tableCaption = this.t('table_header');
      this.buttons = Config.createButtons(this.i18n);
      this.tableColumns = Config.createTableColumns(this.i18n);
      this.filterColumns = Config.createFilterColumns(this.i18n);
      this.detailsColumns = Config.createDetailsColumns(this.i18n);
      this.graphColumns = this.detailsColumns
        .filter(col => col.chartable === true)
        .map(col => ({
          key: col.key,
          label: col.displayName,
          aggregation: col.chartAggregation ?? 'count',
          possibleValues: col.chartPossibleValues,
        }));
      this.cd.markForCheck();
    });
  }

  /**
   * @description Constructs the toolbar configuration.
   * @returns List of buttons updated to reflect current filter visibility and permission state.
   * @bugfix-note (2026-09-08) Doplněna `permission` kontrola - viz hlavička souboru.
   */
  get toolbarButtons(): Core.Button[] {
    return Config.createToolbarButtons(this.i18n).map(btn => {
      let updatedBtn = { ...btn };

      if (updatedBtn.permission && !this.permissionService.hasPermission(updatedBtn.permission)) {
        updatedBtn.showIf = false;
      }

      switch (btn.action) {
        case 'toggleFilters':
          updatedBtn.label = this.isFilterVisible ? this.t('toolbar_hide_filters') : this.t('toolbar_filters');
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
      openGraphBuilder: () => this.openGraphBuilder(),
      exportActiveTable: () => this.exportActiveTable()
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