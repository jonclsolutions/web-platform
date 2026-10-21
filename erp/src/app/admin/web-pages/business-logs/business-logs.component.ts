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
 * - Config.create* factory functions: i18n-aware definitions for UI columns and toolbar
 *   actions - see refactor-note (2026-09-08) below.
 *
 * @bugfix-note (2026-09-08) `toolbarButtons` getter NIKDY nekontroloval `btn.permission`
 * (na rozdíl od VŠECH ostatních web-pages stránek) - `openGraphBuilder` tlačítko s
 * `permission: 'web-view-web-logs'` se tak zobrazovalo i uživatelům bez tohoto práva.
 * Doplněna stejná `permissionService.hasPermission()` kontrola jako všude jinde.
 *
 * @refactor-note (2026-09-08) BACKLOG "vícejazyčná administrace, žádné hardcoded texty":
 * `Config.*` konstanty nahrazeny `Config.create*()` factory funkcemi. `buttons.filter(b
 * => b.action !== 'create' && b.action !== 'edit')` ODSTRANĚN - byl to no-op (`BUTTONS`
 * nikdy `create`/`edit` tlačítko neobsahoval, jen `details`), zbytečně matoucí mrtvý
 * kód stejně jako u `EditNewsComponent`. `graphColumns` přestalo být `readonly`.
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
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
  imports: [SHARED_UI_BUILDERS, GraphBuilderComponent],
  templateUrl: './business-logs.component.html',
  styleUrls: ['../../shared-styles/page.css', '../shared-styles/page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BusinessLogsComponent extends BaseDataComponent<any> implements Core.OnInit {

  protected override translationSection: string = 'business-logs';

  public override t(key: string): string {
    return this.i18n.getValue(`business-logs.${key}`);
  }

  tableCaption: string = '';

  override apiEndpoint: string = 'web/logs';

  tableColumns: Core.ColumnDefinition[] = [];

  /**
   * @description Initial sorting state for log entries, prioritizing the most recent events.
   */
  override filters: Core.FilterParams = {
    sort_by: 'created_at',
    sort_direction: 'desc'
  };

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
      this.buttons = Config.createBusinessLogButtons(this.i18n);
      this.tableColumns = Config.createBusinessLogTableColumns(this.i18n);
      this.filterColumns = Config.createBusinessLogFilterColumns(this.i18n);
      this.detailsColumns = Config.createBusinessLogDetailsColumns(this.i18n);
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
    return Config.createBusinessLogToolbarButtons(this.i18n).map(btn => {
      let updatedBtn = { ...btn };

      if (updatedBtn.permission && !this.permissionService.hasPermission(updatedBtn.permission)) {
        updatedBtn.showIf = false;
      }

      switch (btn.action) {
        case 'toggleFilters':
          updatedBtn.label = this.isFilterVisible
            ? this.t('toolbar_hide_filters')
            : this.t('toolbar_filters');
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
  override handleToolbarAction(action: string): void {
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
   * @description Retrieves detailed log information using the item's primary key.
   * @param item The log entry selected for inspection.
   * @note Handles fallback from 'business_log_id' to standard 'id' field for compatibility.
   */
  override handleViewDetails(item: any): void {
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
  override handleCloseDetails(): void {
    this.selectedItemForDetails = null;
    this.showDetails = false;
    this.cd.markForCheck();
  }

}