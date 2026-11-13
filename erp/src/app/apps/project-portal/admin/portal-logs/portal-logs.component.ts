/**
 * @file portal-logs.component.ts
 * @path src/app/apps/project-portal/admin/portal-logs/portal-logs.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Page "Portal logs" (/admin/project-portal/logs): display, filtering, reports and
 *   detail of the audit log of the project portal (project_portal_logs).
 * @dependencies
 * - BaseDataComponent: Provides the base logic for data fetching, pagination, and state management.
 * - TableBuilderComponent: Used for rendering the data grid and supporting CSV exports.
 * - SHARED_UI_BUILDERS: Centralized collection of UI components for the administrative dashboard.
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as Core from '../../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../../shared/imports/shared-ui-builders';
import { BaseDataComponent } from '../../../../admin/components/base-data/base-data.component';
import * as Config from './portal-logs.config';
import { GraphBuilderComponent } from '../../../../admin/components/builders/graph-builder/graph-builder.component';
import { GraphColumnOption } from '../../../../shared/interfaces/graph-format';
import { PageHelpComponent } from '../../../../admin/components/page-help/page-help.component';
/**
 * @description Component for viewing the log of the project portal.
 * @usage Provides administrators with a read-only interface to monitor system events with advanced filtering and export capabilities.
 * @note Implements standard pagination and filtering inherited from BaseDataComponent, with custom default sorting (ID descending).
 */
@Component({
  selector: 'app-portal-logs',
  standalone: true,
  imports: [SHARED_UI_BUILDERS,GraphBuilderComponent, PageHelpComponent],
  templateUrl: './portal-logs.component.html',
  styleUrls: ['../../../../admin/shared-styles/page.css', '../shared-styles/page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PortalLogsComponent extends BaseDataComponent<any> implements Core.OnInit {
  protected override translationSection: string = 'project-portal-logs';

  /**
   * @description Text of the page's translation section.
   * @param key Key inside `project-portal-logs`.
   * @returns Translated text.
   */
  public override t(key: string): string {
    return this.i18n.getValue(`project-portal-logs.${key}`);
  }

  tableCaption: string = '';

  override apiEndpoint: string = 'project-portal/logs';

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
      this.buttons = Config.createPortalLogButtons(this.i18n);
      this.tableColumns = Config.createPortalLogTableColumns(this.i18n);
      this.filterColumns = Config.createPortalLogFilterColumns(this.i18n);
      this.detailsColumns = Config.createPortalLogDetailsColumns(this.i18n);
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
    return Config.createPortalLogToolbarButtons(this.i18n).map(btn => {
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