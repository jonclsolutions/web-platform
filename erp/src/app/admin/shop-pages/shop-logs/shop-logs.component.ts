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
 * @refactor-note (2026-10-23) Localized (open finding #16): texts from the admin translation
 *   section `shop-logs` (`Config.create*()` factories rebuilt on every language change,
 *   `takeUntilDestroyed()`). The no-op `buttons.filter(create / edit)` was removed (the log only
 *   has the details button).
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
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
  styleUrls: ['../../shared-styles/page.css', '../shared-styles/page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShopLogsComponent extends BaseDataComponent<any> implements Core.OnInit {
  protected override translationSection: string = 'shop-logs';

  /**
   * @description Text of the page's translation section.
   * @param key Key inside `shop-logs`.
   * @returns Translated text.
   */
  public override t(key: string): string {
    return this.i18n.getValue(`shop-logs.${key}`);
  }

  tableCaption: string = '';

  override apiEndpoint: string = 'shop/logs';

  tableColumns: Core.ColumnDefinition[] = [];
  graphColumns: GraphColumnOption[] = [];

  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: Core.ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
    private router: Core.Router
  ) {
    super(dataHandler, cd, genericTableService);

    this.i18n.translations$.pipe(takeUntilDestroyed()).subscribe(() => {
      this.tableCaption = this.t('table_header');
      this.buttons = Config.createShopLogButtons(this.i18n);
      this.tableColumns = Config.createShopLogTableColumns(this.i18n);
      this.filterColumns = Config.createShopLogFilterColumns(this.i18n);
      this.detailsColumns = Config.createShopLogDetailsColumns(this.i18n);
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
   * @description Generates toolbar buttons with dynamic state representation.
   * @returns List of buttons with active states applied based on filter visibility.
   */
  get toolbarButtons(): Core.Button[] {
    return Config.createShopLogToolbarButtons(this.i18n).map(btn => {
      let updatedBtn = { ...btn };

      if (updatedBtn.permission && !this.permissionService.hasPermission(updatedBtn.permission)) {
        updatedBtn.showIf = false;
      }

      switch (btn.action) {
        case 'toggleFilters':
          updatedBtn.label = this.isFilterVisible ? this.t('toolbar_hide_filters') : this.t('toolbar_filters');
          updatedBtn.isActive = this.isFilterVisible;
          break;
        // @refactor-note (2026-10-22) The log is read-only without a trash view (toolbar: filters,
        // reports, export) – the unreachable create / import / trash cases were removed.
      }

      return updatedBtn;
    });
  }

  /**
   * @description Executes toolbar actions triggered by user interaction.
   * @param action The key of the action to be performed.
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
   * @description Fetches deep information for a single log entry.
   * @param item The log record selected for inspection.
   */
  override handleViewDetails(item: any): void {
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
  override handleCloseDetails(): void {
    this.selectedItemForDetails = null;
    this.showDetails = false;
    this.cd.markForCheck();
  }

}