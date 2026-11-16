/**
 * @file dashboard.component.ts
 * @path src/app/apps/web/admin/dashboard/dashboard.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Central administrative dashboard component providing website-content
 * metrics, recent activity, and navigation shortcuts. Gated behind `web-view-dashboard`
 * permission.
 *
 * @dependencies
 * - BaseDashboardComponent: stat tiles, hero, comparison bars, activity feed, icons, refresh.
 * - DashboardViewComponent: the layout, with the state and maintenance switch of the web in the
 *   header (appId).
 * - PermissionService (inherited): decides which stat / nav / activity requests are sent at all.
 * - ResourceCacheService (inherited): TTL cache.
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';

import {
  BaseDashboardComponent, DashboardNavSection, DashboardStatDef
} from '../../../../admin/components/base-dashboard/base-dashboard.component';
import { DashboardViewComponent } from '../../../../admin/components/base-dashboard/dashboard-view.component';

/**
 * @description Serves as the website-content overview page for administrators with
 * dashboard access. Not the post-login landing page - see WelcomePageComponent.
 * System-wide/cross-module metrics (users, roles, legal, system logs) live on
 * `CoreDashboardComponent` instead.
 * @note The loading and rendering logic is shared with the core dashboard
 * (BaseDashboardComponent); every aggregated piece is gated by `PermissionService`.
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [DashboardViewComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['../../../../admin/shared-styles/dashboard.css', '../../../../admin/shared-styles/dashboard-cards.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent extends BaseDashboardComponent {

  protected override translationSection: string = 'web-dashboard';

  /** The header shows the state of the public web with its maintenance switch. */
  override readonly appId = 'web';

  protected readonly logsEndpoint = 'web/logs';
  /** Permission key required by the `web/logs` (GET) endpoint. */
  readonly logsPermission = 'web-view-web-logs';
  readonly logsRoute = '/admin/web/logs';

  /**
   * Stat cards of the dashboard - only the items the signed-in user has the permission for are
   * requested.
   */
  protected readonly statDefs: DashboardStatDef[] = [
    { key: 'jobApps', isAllowed: () => this.can('web-job-applications-view'), labelKey: 'stat_job_apps_label', icon: 'file', endpoint: 'web/job_applications?per_page=1' },
    { key: 'rawRequests', isAllowed: () => this.can('web-user-requests-view'), labelKey: 'stat_raw_requests_label', icon: 'mail', endpoint: 'web/raw_request_commissions?per_page=1' },
    { key: 'webLogs', isAllowed: () => this.can(this.logsPermission), labelKey: 'stat_web_logs_label', icon: 'logs', endpoint: 'web/logs?per_page=1' },
  ];

  readonly navSections: DashboardNavSection[] = [
    { titleKey: 'nav_website_title', icon: 'globe', route: '/admin/web/edit-website', descriptionKey: 'nav_website_desc', isAllowed: () => this.can('web-edit-website-view') },
    { titleKey: 'nav_requests_title', icon: 'mail', route: '/admin/web/user-request', descriptionKey: 'nav_requests_desc', isAllowed: () => this.can('web-user-requests-view') },
    { titleKey: 'nav_job_apps_title', icon: 'file', route: '/admin/web/job-applications', descriptionKey: 'nav_job_apps_desc', isAllowed: () => this.can('web-job-applications-view') },
    { titleKey: 'nav_web_logs_title', icon: 'logs', route: '/admin/web/logs', descriptionKey: 'nav_web_logs_desc', isAllowed: () => this.can(this.logsPermission) },
  ];

  /** @description event_type -> translation key for `eventTypeLabel()`. */
  protected readonly eventTypeLabelKeys: Record<string, string> = {
    create: 'ev_label_create',
    update: 'ev_label_update',
    soft_delete: 'ev_label_soft_delete',
    hard_delete: 'ev_label_hard_delete',
    restore: 'ev_label_restore',
    export: 'ev_label_export',
    error: 'ev_label_error',
    payment: 'ev_label_payment',
  };

  /** @description event_type -> CSS badge class (`export` / `payment` exist only in web_logs). */
  protected readonly eventTypeClassMap: Record<string, string> = {
    create: 'ev-create', update: 'ev-update', soft_delete: 'ev-delete',
    hard_delete: 'ev-delete', restore: 'ev-restore',
    export: 'ev-export', error: 'ev-error', payment: 'ev-create',
  };

  /** @description Synchronous permission check of the stat / nav guards. */
  private can(permission: string): boolean {
    return this.permissionService.hasPermission(permission);
  }
}
