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
 * - BaseDataComponent: Provides errorMessage / cd / alertDialogService / i18n.
 * - LoadingService: Manages global loading states.
 * - DataHandler: Facilitates API communication for dashboard aggregation endpoints.
 * - HasPermissionDirective: Gates the maintenance and activity cards on their permission keys.
 * - PermissionService: Synchronous check of permission keys - decides which stat / nav /
 *   activity / maintenance requests are sent at all.
 * - ResourceCacheService: TTL cache of the stats / activity / maintenance fetch.
 * - RxJS: Handles asynchronous data aggregation using forkJoin.
 */

import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { forkJoin, catchError, of } from 'rxjs';

import * as Core from '../../../shared/imports/core-providers';
import { ApiPage } from '../../../shared/interfaces/api-envelope';
import { UserLogin } from '../../../shared/interfaces/user';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { PermissionService } from '../../../core/auth/services/permission.service';
import { ResourceCacheService } from '../../../core/services/resource-cache.service';

/**
 * @description Row shape returned by the `web_logs` audit endpoint.
 */
interface ActivityLog {
  id: number;
  event_type: string;
  module: string;
  description: string;
  user_plain: string;
  origin: string;
  created_at: string;
}

/**
 * @description A single aggregated metric tile shown in the stats grid. Carries a
 * translation KEY, not resolved text or a fixed palette color
 * (2026-09-07) in the file header. `key` identifies the tile for the hero-selector
 * dropdown (2026-09-07v2).
 */
interface QuickStat {
  key: string;
  labelKey: string;
  value: number | string;
  icon: string;
  /** True only for "open tickets" when the count is > 0 - the one metric on this dashboard that is genuinely actionable/urgent, not decorative. */
  urgent?: boolean;
}

/**
 * @description Declarative definition of a single dashboard stat tile - what to fetch,
 * how to render it, and which permission key gates it. Adding a new module to the
 * dashboard means adding one entry here, never touching `loadStats()`/the template.
 */
interface WebDashboardStatDef {
  key: string;
  permission: string;
  labelKey: string;
  icon: string;
  endpoint: string;
}

/**
 * @description A single shortcut card shown in the quick-navigation grid. Carries
 * translation KEYS, not resolved text.
 */
interface NavSectionWithPermission {
  titleKey: string;
  icon: string;
  route: string;
  descriptionKey: string;
  permission: string;
}

/** @description One segment of the full-width module distribution bar. */
interface DistributionSegment {
  key: string;
  labelKey: string;
  value: number;
  pct: number;
  opacity: number;
}

/** @description One row of the "recent events breakdown" widget. */
interface ActivityBreakdownEntry {
  classKey: string;
  labelKey: string;
  count: number;
}

/**
 * @description Serves as the website-content overview page for administrators with
 * dashboard access. Not the post-login landing page - see WelcomePageComponent.
 * System-wide/cross-module metrics (users, roles, legal, system logs) live on
 * `CoreDashboardComponent` instead.
 * @note Implements component-level data aggregation from multiple API endpoints. Every
 * aggregated piece is additionally gated by `PermissionService`.
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterModule, CommonModule, HasPermissionDirective],
  templateUrl: './dashboard.component.html',
  styleUrls: ['../../shared-styles/dashboard.css', '../../shared-styles/dashboard-maintenance.css', '../../shared-styles/dashboard-cards.css', './dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent extends BaseDataComponent<UserLogin> implements Core.OnInit {

  private sanitizer = inject(DomSanitizer);
  private resourceCache = inject(ResourceCacheService);
  override permissionService = inject(PermissionService);
  // Note: `alertDialogService` is deliberately NOT declared again here - the inherited
  // BaseDataComponent already provides it as `this.alertDialogService`.

  override apiEndpoint = 'core/users';

  protected override translationSection: string = 'web-dashboard';
  public override t(key: string): string {
    return this.i18n.getValue(`web-dashboard.${key}`);
  }

  private readonly STATS_TTL_MS = 2 * 60 * 1000;
  private readonly MAINTENANCE_TTL_MS = 60 * 1000;
  private readonly STATS_CACHE_KEY = 'web-dashboard:stats';
  private readonly ACTIVITY_CACHE_KEY = 'web-dashboard:activity';
  private readonly MAINTENANCE_CACHE_KEY = 'web-dashboard:maintenance';

  /** Permission key required by the `web/settings` (maintenance) endpoint in api.php. */
  private readonly MAINTENANCE_PERMISSION = 'web-set-maintenance-mode';
  /** Permission key required by the `web/logs` (GET) endpoint in api.php. */
  private readonly LOGS_PERMISSION = 'web-view-web-logs';

  /**
   * Single source of truth of the dashboard stat cards - `loadStats()` keeps only the items the
   * logged-in user has the `permission` for and sends requests ONLY for those.
   */
  private readonly STAT_DEFS: WebDashboardStatDef[] = [
    { key: 'news', permission: 'web-news-view', labelKey: 'stat_news_label', icon: 'newspaper', endpoint: 'web/news?per_page=1' },
    { key: 'openTickets', permission: 'web-support-tickets-view', labelKey: 'stat_open_tickets_label', icon: 'ticket', endpoint: 'web/support_tickets?status=open&per_page=1' },
    { key: 'jobApps', permission: 'web-job-applications-view', labelKey: 'stat_job_apps_label', icon: 'file', endpoint: 'web/job_applications?per_page=1' },
    { key: 'leads', permission: 'web-sales-leads-view', labelKey: 'stat_leads_label', icon: 'briefcase', endpoint: 'web/sales_leads?per_page=1' },
    { key: 'salesOrders', permission: 'web-sales-orders-view', labelKey: 'stat_sales_orders_label', icon: 'inbox', endpoint: 'web/sales_orders?per_page=1' },
    { key: 'rawRequests', permission: 'web-user-requests-view', labelKey: 'stat_raw_requests_label', icon: 'mail', endpoint: 'web/raw_request_commissions?per_page=1' },
    { key: 'webLogs', permission: this.LOGS_PERMISSION, labelKey: 'stat_web_logs_label', icon: 'logs', endpoint: 'web/logs?per_page=1' },
  ];

  quickStats: QuickStat[] = [];
  loadingStats = true;

  recentActivity: ActivityLog[] = [];
  loadingActivity = true;

  /** Breakdown of `recentActivity` by `eventTypeClass()`. */
  activityBreakdown: ActivityBreakdownEntry[] = [];

  /** Time of the last successful dashboard load - shown in the header. */
  lastUpdatedAt: Date | null = null;
  isRefreshing = false;

  selectedHeroKey: string | null = null;
  heroDropdownOpen = false;

  // ── Web maintenance mode ────────────────────────────────────────────
  isWebActive = true;
  webMaintenanceMessage = '';
  showWebMaintenanceModal = false;
  webConfirmPasswordValue = '';
  pendingWebTargetState = true;

  readonly navSections: NavSectionWithPermission[] = [
    { titleKey: 'nav_news_title', icon: 'newspaper', route: '/admin/web/edit-news', descriptionKey: 'nav_news_desc', permission: 'web-news-view' },
    { titleKey: 'nav_website_title', icon: 'globe', route: '/admin/web/edit-website', descriptionKey: 'nav_website_desc', permission: 'web-edit-website-view' },
    { titleKey: 'nav_requests_title', icon: 'mail', route: '/admin/web/user-request', descriptionKey: 'nav_requests_desc', permission: 'web-user-requests-view' },
    { titleKey: 'nav_sales_orders_title', icon: 'inbox', route: '/admin/web/sales-orders', descriptionKey: 'nav_sales_orders_desc', permission: 'web-sales-orders-view' },
    { titleKey: 'nav_leads_title', icon: 'briefcase', route: '/admin/web/sales-leads', descriptionKey: 'nav_leads_desc', permission: 'web-sales-leads-view' },
    { titleKey: 'nav_tickets_title', icon: 'ticket', route: '/admin/web/support-tickets', descriptionKey: 'nav_tickets_desc', permission: 'web-support-tickets-view' },
    { titleKey: 'nav_job_apps_title', icon: 'file', route: '/admin/web/job-applications', descriptionKey: 'nav_job_apps_desc', permission: 'web-job-applications-view' },
    { titleKey: 'nav_business_logs_title', icon: 'logs', route: '/admin/web/business-logs', descriptionKey: 'nav_business_logs_desc', permission: this.LOGS_PERMISSION },
  ];

  /**
   * @description Subset of `navSections` the logged-in user may access - the template iterates
   * this getter instead of `navSections` directly.
   */
  get visibleNavSections(): NavSectionWithPermission[] {
    return this.navSections.filter(section => this.permissionService.hasPermission(section.permission));
  }

  /**
   * @description Metric highlighted in the hero tile - either chosen by the admin in the dropdown
   * (`selectedHeroKey`) or (default / fallback) the first allowed metric of `quickStats`. When
   * the earlier chosen `key` is no longer among the allowed metrics, `find()` returns
   * `undefined` and `??` falls back to `quickStats[0]`.
   */
  get heroStat(): QuickStat | null {
    if (this.quickStats.length === 0) return null;
    return this.quickStats.find(s => s.key === this.selectedHeroKey) ?? this.quickStats[0];
  }

  /**
   * @description The remaining allowed metrics (EVERYTHING except the current hero) - rendered as
   * a comparison bar chart.
   */
  get secondaryStats(): QuickStat[] {
    const heroKey = this.heroStat?.key;
    return this.quickStats.filter(s => s.key !== heroKey);
  }

private get maxStatLog(): number {
  const numericValues = this.quickStats.map(s => typeof s.value === 'number' ? s.value : 0);
  const max = Math.max(1, ...numericValues);
  return Math.log(max + 1);
}

statBarPct(stat: QuickStat): number {
  const value = typeof stat.value === 'number' ? stat.value : 0;
  if (value <= 0) return 4;
  const pct = (Math.log(value + 1) / this.maxStatLog) * 100;
  // Lower bound of 8 % - even a value many orders smaller than the max stays visible
  // as a bar, not as a thin line.
  return Math.max(8, Math.round(pct));
}

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

  get maxBreakdownCount(): number {
    return Math.max(1, ...this.activityBreakdown.map(b => b.count));
  }

  breakdownBarPct(entry: ActivityBreakdownEntry): number {
    return Math.round((entry.count / this.maxBreakdownCount) * 100);
  }

  /**
   * Icon library of the dashboard - the key matches the `icon` value of `QuickStat` /
   * `NavSection`. No `viewBox`, the on-screen size is set by CSS.
   */
  private readonly ICONS: Record<string, string> = {
    logs: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="13" y2="15"/></svg>`,
    ticket: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9a3 3 0 1 0 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 1 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/></svg>`,
    file: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
    briefcase: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`,
    newspaper: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>`,
    globe: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
    mail: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`,
    inbox: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>`,
  };

  /** @description event_type -> translation key for `eventTypeLabel()`. */
  private readonly EVENT_TYPE_LABEL_KEYS: Record<string, string> = {
    create: 'ev_label_create',
    update: 'ev_label_update',
    soft_delete: 'ev_label_soft_delete',
    hard_delete: 'ev_label_hard_delete',
    restore: 'ev_label_restore',
    export: 'ev_label_export',
    error: 'ev_label_error',
    payment: 'ev_label_payment',
  };

  /** @description event_type -> CSS badge class. `export` / `payment` in addition to CoreDashboardComponent. */
  private readonly EVENT_TYPE_CLASS_MAP: Record<string, string> = {
    create: 'ev-create', update: 'ev-update', soft_delete: 'ev-delete',
    hard_delete: 'ev-delete', restore: 'ev-restore',
    export: 'ev-export', error: 'ev-error', payment: 'ev-create',
  };

  /** @description `eventTypeClass()` CSS key -> translation key of the "recent events breakdown" widget. */
  private readonly BREAKDOWN_LABEL_KEYS: Record<string, string> = {
    'ev-create': 'breakdown_create_label',
    'ev-update': 'breakdown_update_label',
    'ev-delete': 'breakdown_delete_label',
    'ev-restore': 'breakdown_restore_label',
    'ev-export': 'breakdown_export_label',
    'ev-error': 'breakdown_error_label',
    'ev-default': 'breakdown_default_label',
  };

  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: Core.ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
  ) {
    super(dataHandler, cd, genericTableService);

    this.i18n.translations$.pipe(takeUntilDestroyed()).subscribe(() => this.cd.markForCheck());
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.loadStats();
    this.loadRecentActivity();
    this.loadWebMaintenanceStatus();
  }

  getIcon(key: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.ICONS[key] ?? '');
  }

  /**
   * @description Manual "Refresh" - bypasses the TTL cache of all three dashboard sections
   * (stats + activity + maintenance) and forces a fresh fetch.
   */
  refresh(): void {
    if (this.isRefreshing) return;
    this.isRefreshing = true;
    this.resourceCache.invalidate(this.STATS_CACHE_KEY);
    this.resourceCache.invalidate(this.ACTIVITY_CACHE_KEY);
    this.resourceCache.invalidate(this.MAINTENANCE_CACHE_KEY);
    this.loadStats();
    this.loadRecentActivity();
    this.loadWebMaintenanceStatus();
  }

  toggleHeroDropdown(): void {
    this.heroDropdownOpen = !this.heroDropdownOpen;
  }

  /**
   * @param key `QuickStat.key` of the chosen metric.
   */
  selectHeroStat(key: string): void {
    this.selectedHeroKey = key;
    this.heroDropdownOpen = false;
  }

  closeHeroDropdown(): void {
    this.heroDropdownOpen = false;
  }

  /**
   * @description Aggregates statistical data from every website-content module the
   * current user is permitted to see, concurrently using forkJoin. Through the TTL cache.
   */
  private loadStats(): void {
    this.loadingStats = true;

    const allowedDefs = this.STAT_DEFS.filter(def => this.permissionService.hasPermission(def.permission));
    if (allowedDefs.length === 0) {
      this.quickStats = [];
      this.loadingStats = false;
      this.isRefreshing = false;
      this.lastUpdatedAt = new Date();
      this.cd.markForCheck();
      return;
    }

    this.resourceCache.get(this.STATS_CACHE_KEY, () => {
      const calls: Record<string, Core.Observable<ApiPage<any> | null>> = {};
      for (const def of allowedDefs) {
        calls[def.key] = this.dataHandler.getPaginatedCollection<any>(def.endpoint).pipe(catchError(() => of(null)));
      }
      return forkJoin(calls);
    }, this.STATS_TTL_MS).subscribe({
      next: (res: Record<string, any>) => {
        this.quickStats = allowedDefs.map((def): QuickStat => {
          const total = res[def.key]?.meta?.total ?? '—';
          return {
            key: def.key,
            labelKey: def.labelKey,
            value: total,
            icon: def.icon,
            urgent: def.key === 'openTickets' && typeof total === 'number' && total > 0,
          };
        });
        this.loadingStats = false;
        this.isRefreshing = false;
        this.lastUpdatedAt = new Date();
        this.cd.markForCheck();
      },
      error: () => {
        this.loadingStats = false;
        this.isRefreshing = false;
        this.cd.markForCheck();
      }
    });
  }

  /**
   * @description Fetches the latest business-level events for the activity feed AND
   * the "recent events breakdown" widget (`activityBreakdown` - computed client-side
   * from the same rows, no extra request). Through the TTL cache.
   */
  private loadRecentActivity(): void {
    if (!this.permissionService.hasPermission(this.LOGS_PERMISSION)) {
      this.recentActivity = [];
      this.activityBreakdown = [];
      this.loadingActivity = false;
      return;
    }

    this.loadingActivity = true;

    this.resourceCache.get(
      this.ACTIVITY_CACHE_KEY,
      () => this.dataHandler.getPaginatedCollection<any>('web/logs?per_page=8&sort_by=created_at&sort_direction=desc')
        .pipe(catchError(() => of(null))),
      this.STATS_TTL_MS
    ).subscribe({
      next: (res) => {
        this.recentActivity = res?.data ?? [];
        this.computeActivityBreakdown();
        this.loadingActivity = false;
        this.cd.markForCheck();
      },
      error: () => {
        this.loadingActivity = false;
        this.cd.markForCheck();
      }
    });
  }

  /**
   * @description Groups the already-loaded `recentActivity` rows by `eventTypeClass()`
   * and counts occurrences - purely client-side, reuses the same 8 rows already
   * fetched for the activity list.
   */
  private computeActivityBreakdown(): void {
    const counts = new Map<string, number>();
    for (const log of this.recentActivity) {
      const classKey = this.eventTypeClass(log.event_type);
      counts.set(classKey, (counts.get(classKey) ?? 0) + 1);
    }
    this.activityBreakdown = Array.from(counts.entries())
      .map(([classKey, count]) => ({
        classKey,
        // every class from eventTypeClass() (incl. 'ev-default') has a label key
        labelKey: this.BREAKDOWN_LABEL_KEYS[classKey],
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }

  formatDate(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString(this.i18n.getDateLocale(), {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  eventTypeLabel(type: string): string {
    const key = this.EVENT_TYPE_LABEL_KEYS[type];
    return key ? this.t(key) : type;
  }

  eventTypeClass(type: string): string {
    return this.EVENT_TYPE_CLASS_MAP[type] ?? 'ev-default';
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