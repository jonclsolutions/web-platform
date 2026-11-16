/**
 * @file dashboard.component.ts
 * @path src/app/apps/project-portal/admin/dashboard/dashboard.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Dashboard of the project portal (/admin/project-portal/dashboard, permission
 *   `project-portal-view-dashboard`): tiles of the sales leads, orders, projects and log entries,
 *   shortcuts to the pages, the recent activity of the portal log, and in the header the state of
 *   the public portal with its maintenance switch. Same look as the web and core dashboards.
 * @dependencies
 * - BaseDashboardComponent: stat tiles, hero, bars, activity feed, icons, refresh.
 * - DashboardViewComponent: the layout (with AppStatusControlComponent for `appId`).
 * - PermissionService (inherited): only the allowed tiles / shortcuts / activity are requested.
 */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import {
  BaseDashboardComponent, DashboardNavSection, DashboardStatDef
} from '../../../../admin/components/base-dashboard/base-dashboard.component';
import { DashboardViewComponent } from '../../../../admin/components/base-dashboard/dashboard-view.component';

@Component({
  selector: 'app-project-portal-dashboard',
  standalone: true,
  imports: [DashboardViewComponent],
  template: '<app-dashboard-view [d]="this"></app-dashboard-view>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectPortalDashboardComponent extends BaseDashboardComponent {

  protected override translationSection = 'project-portal-dashboard';

  /** The header shows the state of the public portal with its maintenance switch. */
  override readonly appId = 'project-portal';

  protected readonly logsEndpoint = 'project-portal/logs';
  /** Permission key of the `project-portal/logs` endpoint. */
  readonly logsPermission = 'project-portal-view-logs';
  readonly logsRoute = '/admin/project-portal/logs';

  /** Tiles of the dashboard - only the ones the user may see are requested. */
  protected readonly statDefs: DashboardStatDef[] = [
    { key: 'salesLeads', isAllowed: () => this.can('project-portal-sales-leads-view'), labelKey: 'stat_sales_leads_label', icon: 'users', endpoint: 'project-portal/sales_leads?per_page=1' },
    { key: 'salesOrders', isAllowed: () => this.can('project-portal-sales-orders-view'), labelKey: 'stat_sales_orders_label', icon: 'inbox', endpoint: 'project-portal/sales_orders?per_page=1' },
    { key: 'projects', isAllowed: () => this.can('project-portal-projects-view'), labelKey: 'stat_projects_label', icon: 'briefcase', endpoint: 'project-portal/projects?per_page=1' },
    { key: 'portalLogs', isAllowed: () => this.can(this.logsPermission), labelKey: 'stat_portal_logs_label', icon: 'logs', endpoint: 'project-portal/logs?per_page=1' },
  ];

  readonly navSections: DashboardNavSection[] = [
    { titleKey: 'nav_sales_leads_title', icon: 'users', route: '/admin/project-portal/sales-leads', descriptionKey: 'nav_sales_leads_desc', isAllowed: () => this.can('project-portal-sales-leads-view') },
    { titleKey: 'nav_sales_orders_title', icon: 'inbox', route: '/admin/project-portal/sales-orders', descriptionKey: 'nav_sales_orders_desc', isAllowed: () => this.can('project-portal-sales-orders-view') },
    { titleKey: 'nav_projects_title', icon: 'briefcase', route: '/admin/project-portal/projects', descriptionKey: 'nav_projects_desc', isAllowed: () => this.can('project-portal-projects-view') },
    { titleKey: 'nav_logs_title', icon: 'logs', route: '/admin/project-portal/logs', descriptionKey: 'nav_logs_desc', isAllowed: () => this.can(this.logsPermission) },
  ];

  /** @description event_type -> translation key for `eventTypeLabel()` (shared `dashboard` texts). */
  protected readonly eventTypeLabelKeys: Record<string, string> = {
    create: 'ev_label_create',
    update: 'ev_label_update',
    soft_delete: 'ev_label_soft_delete',
    hard_delete: 'ev_label_hard_delete',
    restore: 'ev_label_restore',
    export: 'ev_label_export',
    error: 'ev_label_error',
  };

  /** @description event_type -> CSS badge class. */
  protected readonly eventTypeClassMap: Record<string, string> = {
    create: 'ev-create', update: 'ev-update', soft_delete: 'ev-delete',
    hard_delete: 'ev-delete', restore: 'ev-restore', export: 'ev-export', error: 'ev-error',
  };

  /** @description Synchronous permission check of the tile / shortcut guards. */
  private can(permission: string): boolean {
    return this.permissionService.hasPermission(permission);
  }
}
