/**
 * @file audit-log-page.component.ts
 * @path src/app/admin/components/audit-log-page/audit-log-page.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Read-only page of an audit log - one component for the log of the core and of
 *   every application. The route gives the configuration (`data.auditLog`, AuditLogPageConfig):
 *   endpoint, translation section, report permission, event types and modules. The page lists
 *   the rows with filters, opens the detail of a row, charts event types / modules and exports
 *   the table.
 * @dependencies
 * - BaseDataComponent: loading, pagination, filters, export, graph builder state.
 * - audit-log-page.config: buttons and columns.
 * - SHARED_UI_BUILDERS, GraphBuilderComponent, PageHelpComponent.
 */

import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { BaseDataComponent } from '../base-data/base-data.component';
import { GraphBuilderComponent } from '../builders/graph-builder/graph-builder.component';
import { GraphColumnOption } from '../../../shared/interfaces/graph-format';
import { PageHelpComponent } from '../page-help/page-help.component';
import {
  AUDIT_LOG_ROUTE_DATA, AUDIT_LOG_SECTION, AuditLogPageConfig, createAuditLogButtons, createAuditLogDetailsColumns,
  createAuditLogFilterColumns, createAuditLogTableColumns, createAuditLogToolbarButtons,
} from './audit-log-page.config';

/**
 * @description Audit log page configured by its route.
 * @usage Route data `{ auditLog: <AuditLogPageConfig> }` (see audit-log-page.config.ts).
 */
@Component({
  selector: 'app-audit-log-page',
  standalone: true,
  imports: [SHARED_UI_BUILDERS, GraphBuilderComponent, PageHelpComponent],
  templateUrl: './audit-log-page.component.html',
  styleUrls: ['../../shared-styles/page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditLogPageComponent extends BaseDataComponent<Record<string, unknown>> implements Core.OnInit {
  /** Configuration of the log (route data). */
  readonly config: AuditLogPageConfig = inject(ActivatedRoute).snapshot.data[AUDIT_LOG_ROUTE_DATA];

  override apiEndpoint: string = this.config.endpoint;
  protected override translationSection: string = this.config.section;

  /** Newest rows first. */
  override filters: Core.FilterParams = { sort_by: 'created_at', sort_direction: 'desc' };

  tableCaption: string = '';
  tableColumns: Core.ColumnDefinition[] = [];
  graphColumns: GraphColumnOption[] = [];

  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: Core.ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
    private router: Core.Router,
  ) {
    super(dataHandler, cd, genericTableService);

    this.i18n.translations$.pipe(takeUntilDestroyed()).subscribe(() => {
      this.tableCaption = this.pageText('table_header');
      this.buttons = createAuditLogButtons(this.i18n);
      this.tableColumns = createAuditLogTableColumns(this.i18n);
      this.filterColumns = createAuditLogFilterColumns(this.config, this.i18n);
      this.detailsColumns = createAuditLogDetailsColumns(this.config, this.i18n);
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
   * @description Text shared by every log page.
   * @param key Key inside `audit-log`.
   */
  text(key: string): string {
    return this.i18n.getValue(`${AUDIT_LOG_SECTION}.${key}`);
  }

  /**
   * @description Text of this log page.
   * @param key Key inside the section of the page.
   */
  pageText(key: string): string {
    return this.i18n.getValue(`${this.config.section}.${key}`);
  }

  /**
   * @description Toolbar with the filter state and without the report action for a user
   *   without the report permission.
   */
  get toolbarButtons(): Core.Button[] {
    return createAuditLogToolbarButtons(this.config, this.i18n).map(btn => {
      const button = { ...btn };
      if (button.permission && !this.permissionService.hasPermission(button.permission)) {
        button.showIf = false;
      }
      if (button.action === 'toggleFilters') {
        button.label = this.isFilterVisible ? this.text('toolbar_hide_filters') : this.text('toolbar_filters');
        button.isActive = this.isFilterVisible;
      }
      return button;
    });
  }

  /**
   * @description Runs a toolbar action (filters, reports, export - the log has no other).
   * @param action Action of the button.
   */
  override handleToolbarAction(action: string): void {
    const actions: Record<string, () => void> = {
      toggleFilters: () => this.toggleFilters(),
      openGraphBuilder: () => this.openGraphBuilder(),
      exportActiveTable: () => this.exportActiveTable(),
    };
    actions[action]?.();
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.initWithAuthCheck(this.router);
  }

  override refreshData(): void {
    this.forceFullRefresh(this.filters);
  }

  /**
   * @description Loads and opens the detail of a row.
   * @param item Row of the table.
   */
  override handleViewDetails(item: { id?: number }): void {
    if (!item.id) return;
    this.getItemDetails(item.id).subscribe({
      next: details => {
        this.selectedItemForDetails = details;
        this.showDetails = true;
        this.cd.markForCheck();
      },
      complete: () => this.cd.markForCheck(),
    });
  }

  /** @description Closes the detail. */
  override handleCloseDetails(): void {
    this.selectedItemForDetails = null;
    this.showDetails = false;
    this.cd.markForCheck();
  }
}
