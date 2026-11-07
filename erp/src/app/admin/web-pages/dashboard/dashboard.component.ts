/**
 * @file dashboard.component.ts
 * @path src/app/admin/web-pages/dashboard/dashboard.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Central administrative dashboard component providing website-content
 * metrics, recent activity, and navigation shortcuts. Gated behind `web-view-dashboard`
 * permission.
 *
 * @dependencies
 * - BaseDashboardComponent: stat tiles, hero, comparison bars, activity feed, icons, refresh.
 * - HasPermissionDirective: Gates the maintenance and activity cards on their permission keys.
 * - PermissionService (inherited): decides which stat / nav / activity / maintenance requests
 *   are sent at all.
 * - ResourceCacheService (inherited): TTL cache, also of the maintenance state.
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import {
  BaseDashboardComponent, DashboardNavSection, DashboardStatDef, QuickStat
} from '../../components/base-dashboard/base-dashboard.component';

/** @description One segment of the full-width module distribution bar. */
interface DistributionSegment {
  key: string;
  labelKey: string;
  value: number;
  pct: number;
  opacity: number;
}

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
  imports: [RouterModule, CommonModule, HasPermissionDirective],
  templateUrl: './dashboard.component.html',
  styleUrls: ['../../shared-styles/dashboard.css', '../../shared-styles/dashboard-maintenance.css', '../../shared-styles/dashboard-cards.css', './dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent extends BaseDashboardComponent {

  protected override translationSection: string = 'web-dashboard';
  public override t(key: string): string {
    return this.i18n.getValue(`web-dashboard.${key}`);
  }

  private readonly MAINTENANCE_TTL_MS = 60 * 1000;
  private readonly MAINTENANCE_CACHE_KEY = 'web-dashboard:maintenance';

  /** Permission key required by the `web/settings` (maintenance) endpoint in api.php. */
  private readonly MAINTENANCE_PERMISSION = 'web-set-maintenance-mode';

  protected readonly logsEndpoint = 'web/logs';
  /** Permission key required by the `web/logs` (GET) endpoint in api.php. */
  protected readonly logsPermission = 'web-view-web-logs';

  /**
   * Stat cards of the dashboard - only the items the signed-in user has the permission for are
   * requested.
   */
  protected readonly statDefs: DashboardStatDef[] = [
    { key: 'news', isAllowed: () => this.can('web-news-view'), labelKey: 'stat_news_label', icon: 'newspaper', endpoint: 'web/news?per_page=1' },
    { key: 'openTickets', isAllowed: () => this.can('web-support-tickets-view'), labelKey: 'stat_open_tickets_label', icon: 'ticket', endpoint: 'web/support_tickets?status=open&per_page=1' },
    { key: 'jobApps', isAllowed: () => this.can('web-job-applications-view'), labelKey: 'stat_job_apps_label', icon: 'file', endpoint: 'web/job_applications?per_page=1' },
    { key: 'leads', isAllowed: () => this.can('web-sales-leads-view'), labelKey: 'stat_leads_label', icon: 'briefcase', endpoint: 'web/sales_leads?per_page=1' },
    { key: 'salesOrders', isAllowed: () => this.can('web-sales-orders-view'), labelKey: 'stat_sales_orders_label', icon: 'inbox', endpoint: 'web/sales_orders?per_page=1' },
    { key: 'rawRequests', isAllowed: () => this.can('web-user-requests-view'), labelKey: 'stat_raw_requests_label', icon: 'mail', endpoint: 'web/raw_request_commissions?per_page=1' },
    { key: 'webLogs', isAllowed: () => this.can(this.logsPermission), labelKey: 'stat_web_logs_label', icon: 'logs', endpoint: 'web/logs?per_page=1' },
  ];

  // ── Web maintenance mode ────────────────────────────────────────────
  isWebActive = true;
  webMaintenanceMessage = '';
  showWebMaintenanceModal = false;
  webConfirmPasswordValue = '';
  pendingWebTargetState = true;

  readonly navSections: DashboardNavSection[] = [
    { titleKey: 'nav_news_title', icon: 'newspaper', route: '/admin/web/edit-news', descriptionKey: 'nav_news_desc', isAllowed: () => this.can('web-news-view') },
    { titleKey: 'nav_website_title', icon: 'globe', route: '/admin/web/edit-website', descriptionKey: 'nav_website_desc', isAllowed: () => this.can('web-edit-website-view') },
    { titleKey: 'nav_requests_title', icon: 'mail', route: '/admin/web/user-request', descriptionKey: 'nav_requests_desc', isAllowed: () => this.can('web-user-requests-view') },
    { titleKey: 'nav_sales_orders_title', icon: 'inbox', route: '/admin/web/sales-orders', descriptionKey: 'nav_sales_orders_desc', isAllowed: () => this.can('web-sales-orders-view') },
    { titleKey: 'nav_leads_title', icon: 'briefcase', route: '/admin/web/sales-leads', descriptionKey: 'nav_leads_desc', isAllowed: () => this.can('web-sales-leads-view') },
    { titleKey: 'nav_tickets_title', icon: 'ticket', route: '/admin/web/support-tickets', descriptionKey: 'nav_tickets_desc', isAllowed: () => this.can('web-support-tickets-view') },
    { titleKey: 'nav_job_apps_title', icon: 'file', route: '/admin/web/job-applications', descriptionKey: 'nav_job_apps_desc', isAllowed: () => this.can('web-job-applications-view') },
    { titleKey: 'nav_business_logs_title', icon: 'logs', route: '/admin/web/business-logs', descriptionKey: 'nav_business_logs_desc', isAllowed: () => this.can(this.logsPermission) },
  ];

  /**
   * @description FULL-WIDTH segmented bar comparing ALL allowed modules at once (not only
   * `secondaryStats`, not limited by the hero choice) - a second chart next to the hero + bars
   * combination. Monochrome: every segment has the same `--accent` color, only a decreasing
   * opacity by rank (largest module = darkest).
   */
  get distributionSegments(): DistributionSegment[] {
    const numericStats = this.quickStats.filter(s => typeof s.value === 'number') as (QuickStat & { value: number })[];
    if (numericStats.length === 0) return [];

    /** Minimum log weight of zero values - roughly the value "1" on the log scale. */
    const ZERO_WEIGHT = 0.35;

    const weighted = numericStats.map(stat => ({
      stat,
      weight: stat.value > 0 ? Math.log(stat.value + 1) : ZERO_WEIGHT,
    }));

    const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);

    const sorted = [...weighted].sort((a, b) => b.stat.value - a.stat.value);
    const OPACITY_STEPS = [1, 0.82, 0.66, 0.52, 0.4, 0.3, 0.22];

    return sorted.map(({ stat, weight }, index) => ({
      key: stat.key,
      labelKey: stat.labelKey,
      value: stat.value,
      pct: Math.round((weight / totalWeight) * 1000) / 10,
      opacity: OPACITY_STEPS[Math.min(index, OPACITY_STEPS.length - 1)],
    }));
  }

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

  override ngOnInit(): void {
    super.ngOnInit();
    this.loadWebMaintenanceStatus();
  }

  /** @description Synchronous permission check of the stat / nav guards. */
  private can(permission: string): boolean {
    return this.permissionService.hasPermission(permission);
  }

  /** @description Open tickets above zero are the one actionable metric - highlighted. */
  protected override toQuickStat(def: DashboardStatDef, total: number | string): QuickStat {
    return {
      ...super.toQuickStat(def, total),
      urgent: def.key === 'openTickets' && typeof total === 'number' && total > 0,
    };
  }

  /** @description The manual refresh reloads the maintenance state too (bypassing its cache). */
  protected override refreshExtras(): void {
    this.resourceCache.invalidate(this.MAINTENANCE_CACHE_KEY);
    this.loadWebMaintenanceStatus();
  }

  // ── Web maintenance mode ────────────────────────────────────────────

  /**
   * @description Loads the current web maintenance state from `web/settings`, through a short
   * TTL cache (1 min). Called separately from `loadStats()` / `loadRecentActivity()`.
   */
  private loadWebMaintenanceStatus(): void {
    if (!this.permissionService.hasPermission(this.MAINTENANCE_PERMISSION)) {
      return;
    }

    this.resourceCache.get(
      this.MAINTENANCE_CACHE_KEY,
      () => this.dataHandler.get<any>('web/settings'),
      this.MAINTENANCE_TTL_MS
    ).subscribe({
      next: (res: any) => {
        if (res) {
          this.isWebActive = !!res.is_web_active;
          this.webMaintenanceMessage = res.web_maintenance_message || '';
          this.cd.markForCheck();
        }
      },
      error: () => this.cd.markForCheck()
    });
  }

  openWebMaintenanceModal(): void {
    this.pendingWebTargetState = !this.isWebActive;
    this.webConfirmPasswordValue = '';
    this.showWebMaintenanceModal = true;
  }

  cancelWebMaintenanceModal(): void {
    this.showWebMaintenanceModal = false;
    this.webConfirmPasswordValue = '';
  }

  /**
   * @description Sends the web state change to `web/settings`. Invalidates the maintenance cache
   * key on success, so the next read (also elsewhere in the admin) reflects the new value.
   */
  submitWebMaintenanceChange(): void {
    if (!this.webConfirmPasswordValue.trim()) {
      this.alertDialogService.open(this.t('maintenance_error_title'), this.t('maintenance_error_missing_password'), 'danger');
      return;
    }

    this.dataHandler.put<any>('web/settings', {
      is_web_active: this.pendingWebTargetState,
      web_maintenance_message: this.webMaintenanceMessage || this.t('maintenance_default_message'),
      confirm_password: this.webConfirmPasswordValue
    }).subscribe({
      next: () => {
        this.isWebActive = this.pendingWebTargetState;
        this.showWebMaintenanceModal = false;
        this.resourceCache.invalidate(this.MAINTENANCE_CACHE_KEY);
        this.alertDialogService.open(
          this.t('maintenance_success_title'),
          this.pendingWebTargetState ? this.t('maintenance_success_active') : this.t('maintenance_success_maintenance'),
          'success'
        );
        this.cd.markForCheck();
      },
      error: (err: any) => {
        const message = err?.error?.message || this.t('maintenance_error_generic');
        this.alertDialogService.open(this.t('maintenance_error_auth_title'), message, 'danger');
      }
    });
  }
}
