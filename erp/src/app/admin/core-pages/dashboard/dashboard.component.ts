/**
 * @file dashboard.component.ts
 * @path src/app/admin/core-pages/dashboard/dashboard.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Central administrative dashboard for the "Core" module - system-wide
 * settings and resources shared across the Web and Shop modules (user accounts, roles &
 * permissions, legal documents, external links, system-level audit logs). Gated behind
 * `core-view-dashboard` permission.
 *
 * @dependencies
 * - BaseDataComponent: Provides errorMessage/cd/alertDialogService.
 * - LoadingService: Manages global loading states.
 * - DataHandler: Facilitates API communication for dashboard aggregation endpoints.
 * - HasPermissionDirective: Gates the "Recent system events" section on `view-core`.
 * - PermissionService: Synchronous check of permission keys - decides which stat / nav /
 *   activity requests are sent at all.
 * - ResourceCacheService: TTL cache of the stats / activity fetch.
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
import { ResourceCacheService } from '../../../core/services/resource-cache.service';

/**
 * @description A single aggregated metric tile shown in the stats grid. Carries a
 * translation KEY, not resolved text for why (avoids the NG0956 pitfall documented in UserRequestComponent).
 * `key` (2026-09-07v2) identifies the tile for the hero-selector dropdown.
 */
interface QuickStat {
  key: string;
  labelKey: string;
  value: number | string;
  icon: string;
}

/**
 * @description A single shortcut card shown in the quick-navigation grid. Carries
 * translation KEYS (`titleKey`/`descriptionKey`), not resolved text - same reasoning
 * as `QuickStat`.
 */
interface NavSection {
  titleKey: string;
  icon: string;
  route: string;
  descriptionKey: string;
}

/**
 * @description Row shape returned by the `core_logs` audit endpoint.
 */
interface ActivityLog {
  id: number;
  created_at: string;
  origin: string;
  event_type: string;
  module: string;
  description: string;
  affected_entity_type?: string | null;
  affected_entity_id?: number | null;
  user_id?: number | null;
  user_id_plain?: string | null;
  user_plain?: string | null;
}

/**
 * @description Declarative definition of a single dashboard stat tile - what to fetch,
 * how to render it, and the predicate that decides whether the current user may see it.
 * `isAllowed` is a function rather than a plain permission string because one entry
 * (`roles`) is gated by a sysadmin role check, not a permission key.
 */
interface DashboardStatDef {
  key: string;
  labelKey: string;
  icon: string;
  endpoint: string;
  isAllowed: () => boolean;
}

/**
 * @description `NavSection` shortcut card, extended with the same `isAllowed` predicate
 * used by `DashboardStatDef`.
 */
interface NavSectionWithGuard extends NavSection {
  isAllowed: () => boolean;
}

/**
 * @description One row of the "recent events breakdown" widget - a count of how many
 * of the currently loaded `recentActivity` rows fall into a given `eventTypeClass()`
 * bucket (create/update/delete/restore/error/default).
 */
interface ActivityBreakdownEntry {
  classKey: string;
  labelKey: string;
  count: number;
}

/**
 * @description Serves as the sensitive system-configuration overview for administrators
 * with Core access. Aggregates counts from every resource owned by the Core module and
 * offers one-click navigation into each management screen.
 * @note Implements component-level data aggregation from multiple API endpoints, same
 * pattern as `WebDashboardComponent`. Every aggregated piece is additionally gated by
 * `PermissionService`/`isSysadmin()`.
 */
@Component({
  selector: 'app-core-dashboard',
  standalone: true,
  imports: [RouterModule, CommonModule, HasPermissionDirective],
  templateUrl: './dashboard.component.html',
  styleUrls: ['../../shared-styles/dashboard.css', '../../shared-styles/dashboard-cards.css', './dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CoreDashboardComponent extends BaseDataComponent<UserLogin> implements Core.OnInit {

  private sanitizer = inject(DomSanitizer);
  private resourceCache = inject(ResourceCacheService);

  override apiEndpoint = 'core/users';

  protected override translationSection: string = 'core-dashboard';
  public override t(key: string): string {
    return this.i18n.getValue(`core-dashboard.${key}`);
  }

  private readonly TTL_MS = 2 * 60 * 1000;
  private readonly STATS_CACHE_KEY = 'core-dashboard:stats';
  private readonly ACTIVITY_CACHE_KEY = 'core-dashboard:activity';

  /** Permission key gating the `core/logs` GET in api.php (`CheckPermission` middleware). */
  private readonly LOGS_PERMISSION = 'view-core';

  /**
   * Single source of truth of the dashboard stat cards - `loadStats()` keeps only the items whose
   * `isAllowed()` returns true and sends requests ONLY for those.
   */
  private readonly STAT_DEFS: DashboardStatDef[] = [
    {
      key: 'users', labelKey: 'stat_users_label', icon: 'users',
      endpoint: 'core/users?per_page=1',
      isAllowed: () => this.permissionService.hasPermission('core-administrators-view'),
    },
    {
      // core/roles is NOT gated by a permission key - only by the sysadmin check in the controller.
      key: 'roles', labelKey: 'stat_roles_label', icon: 'shield',
      endpoint: 'core/roles?per_page=1',
      isAllowed: () => this.isSysadmin(),
    },
    {
      key: 'legalDocs', labelKey: 'stat_legal_docs_label', icon: 'legal',
      endpoint: 'legal/document-sections?per_page=1',
      isAllowed: () => this.permissionService.hasPermission('core-legal-documents-view'),
    },
    {
      key: 'externalLinks', labelKey: 'stat_external_links_label', icon: 'link',
      endpoint: 'core/external_links?per_page=1',
      isAllowed: () => this.permissionService.hasPermission('core-external-links-view'),
    },
    {
      key: 'coreLogs', labelKey: 'stat_core_logs_label', icon: 'logs',
      endpoint: 'core/logs?per_page=1',
      isAllowed: () => this.permissionService.hasPermission(this.LOGS_PERMISSION),
    },
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

  readonly navSections: NavSectionWithGuard[] = [
    {
      titleKey: 'nav_administrators_title',
      icon: 'users',
      route: '/admin/core/administrators',
      descriptionKey: 'nav_administrators_desc',
      isAllowed: () => this.permissionService.hasPermission('core-administrators-view'),
    },
    {
      titleKey: 'nav_roles_title',
      icon: 'shield',
      route: '/admin/core/edit-roles',
      descriptionKey: 'nav_roles_desc',
      // The core/edit-roles route is protected by sysadminGuard, not by a permission key.
      isAllowed: () => this.isSysadmin(),
    },
    {
      titleKey: 'nav_legal_title',
      icon: 'legal',
      route: '/admin/core/edit-legal',
      descriptionKey: 'nav_legal_desc',
      isAllowed: () => this.permissionService.hasPermission('core-legal-documents-view'),
    },
    {
      titleKey: 'nav_external_links_title',
      icon: 'link',
      route: '/admin/core/external-links',
      descriptionKey: 'nav_external_links_desc',
      isAllowed: () => this.permissionService.hasPermission('core-external-links-view'),
    },
    {
      titleKey: 'nav_logs_title',
      icon: 'logs',
      route: '/admin/core/logs',
      descriptionKey: 'nav_logs_desc',
      isAllowed: () => this.permissionService.hasPermission(this.LOGS_PERMISSION),
    },
    {
      titleKey: 'nav_web_settings_title',
      icon: 'settings',
      route: '/admin/core/web-settings',
      descriptionKey: 'nav_web_settings_desc',
      // WebSettingsComponent calls legal/config/* (SiteConfigurationController).
      isAllowed: () => this.permissionService.hasPermission('core-legal-config-view'),
    },
  ];

  /**
   * @description Subset of `navSections` the logged-in user may access - the template iterates
   * this getter instead of `navSections` directly.
   */
  get visibleNavSections(): NavSectionWithGuard[] {
    return this.navSections.filter(section => section.isAllowed());
  }

  /**
   * @description Metric highlighted in the hero tile - either chosen by the admin in the dropdown
   * (`selectedHeroKey`) or (default / fallback) the first allowed metric of `quickStats`. When
   * the earlier chosen `key` is no longer among the allowed metrics (permissions changed),
   * `find()` returns `undefined` and `??` falls back to `quickStats[0]` - no extra reset code
   * needed.
   */
  get heroStat(): QuickStat | null {
    if (this.quickStats.length === 0) return null;
    return this.quickStats.find(s => s.key === this.selectedHeroKey) ?? this.quickStats[0];
  }

  /**
   * @description The remaining allowed metrics (EVERYTHING except the current hero, not simply
   * "everything from the second position") - rendered as a comparison bar chart.
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

  /** @description Highest count across `activityBreakdown` - scales the bar width of the widget. */
  get maxBreakdownCount(): number {
    return Math.max(1, ...this.activityBreakdown.map(b => b.count));
  }

  breakdownBarPct(entry: ActivityBreakdownEntry): number {
    return Math.round((entry.count / this.maxBreakdownCount) * 100);
  }

  /**
   * Icon library used on this dashboard - key matches the `icon` value in
   * `QuickStat`/`NavSection`. Deliberately without `viewBox` (sizing is controlled purely
   * by CSS via `.cd-stat-icon svg` / `.cd-nav-icon svg`).
   */
  private readonly ICONS: Record<string, string> = {
    users: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    shield: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    legal: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M7 21h10"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/><path d="m7 7 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m17 7 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/></svg>`,
    link: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
    logs: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="13" y2="15"/></svg>`,
    settings: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  };

  /** @description event_type -> translation key for `eventTypeLabel()`. */
  private readonly EVENT_TYPE_LABEL_KEYS: Record<string, string> = {
    login_success: 'ev_label_login_success',
    login_failed: 'ev_label_login_failed',
    logout: 'ev_label_logout',
    password_reset_requested: 'ev_label_password_reset_requested',
    password_reset_completed: 'ev_label_password_reset_completed',
    password_reset_failed: 'ev_label_password_reset_failed',
    password_reset_email_rate_limited: 'ev_label_password_reset_rate_limited',
    create: 'ev_label_create',
    update: 'ev_label_update',
    soft_delete: 'ev_label_soft_delete',
    hard_delete: 'ev_label_hard_delete',
    restore: 'ev_label_restore',
    error: 'ev_label_error',
  };

  /** @description `eventTypeClass()` CSS key -> translation key of the "recent events breakdown" widget. */
  private readonly BREAKDOWN_LABEL_KEYS: Record<string, string> = {
    'ev-create': 'breakdown_create_label',
    'ev-update': 'breakdown_update_label',
    'ev-delete': 'breakdown_delete_label',
    'ev-restore': 'breakdown_restore_label',
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
  }

  /**
   * @description Returns a safely sanitized SVG markup string for the given icon key
   * (see `ICONS`), for rendering via `[innerHTML]` in the template.
   * @param key Icon identifier used in `QuickStat.icon` / `NavSection.icon`.
   * @returns Sanitized SVG markup, or an empty sanitized string if the key is unknown.
   */
  getIcon(key: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.ICONS[key] ?? '');
  }

  /**
   * @description Manual "Refresh" - bypasses the TTL cache of both dashboard sections (stats +
   * activity) and forces a fresh fetch. The permission guards of `loadStats()` /
   * `loadRecentActivity()` apply here too - a manual refresh does not skip the permission check.
   */
  refresh(): void {
    if (this.isRefreshing) return;
    this.isRefreshing = true;
    this.resourceCache.invalidate(this.STATS_CACHE_KEY);
    this.resourceCache.invalidate(this.ACTIVITY_CACHE_KEY);
    this.loadStats();
    this.loadRecentActivity();
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
   * @description Aggregates resource counts from every Core-owned endpoint the current
   * user is permitted to see, concurrently using forkJoin. Cached through
   * ResourceCacheService (2 min TTL).
   * @note If an individual request fails, it defaults to null so the rest of the
   * dashboard remains functional. `getPaginatedCollection` is used deliberately (not
   * `getCollection`) to keep `meta.total` from the response instead of just the unwrapped
   * page of records.
   */
  private loadStats(): void {
    this.loadingStats = true;

    const allowedDefs = this.STAT_DEFS.filter(def => def.isAllowed());

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
    }, this.TTL_MS).subscribe({
      next: (res: Record<string, any>) => {
        this.quickStats = allowedDefs.map(def => ({
          key: def.key,
          labelKey: def.labelKey, value: res[def.key]?.meta?.total ?? '—', icon: def.icon,
        }));
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
   * @description Fetches the latest system-level audit events (authentication, role/
   * permission changes, legal document changes) for the activity feed AND the
   * "recent events breakdown" widget (`activityBreakdown` - computed client-side from
   * the same rows, no extra request). Cached through ResourceCacheService (2 min TTL).
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
      () => this.dataHandler.getPaginatedCollection<any>('core/logs?per_page=8&sort_by=created_at&sort_direction=desc')
        .pipe(catchError(() => of(null))),
      this.TTL_MS
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
   * (create/update/delete/restore/error/default) and counts occurrences, producing the
   * data for the "recent events breakdown" widget. Purely client-side - reuses the same
   * 8 rows already fetched for the activity list, no additional endpoint.
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
        labelKey: this.BREAKDOWN_LABEL_KEYS[classKey] ?? 'breakdown_default_label',
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * @description Whether the signed-in user has the 'sysadmin' role - `core/roles` (and the
   *   `/admin/core/edit-roles` route) are not gated by a permission key, only by the role name.
   * @returns True when the current user's role is 'sysadmin'.
   */
  private isSysadmin(): boolean {
    return this.authService.getUserRole() === 'sysadmin';
  }

  formatDate(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString(this.i18n.getDateLocale(), {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  /**
   * @description Maps raw `event_type` values from `core_logs` to a translated,
   * human-readable label - covers both auth-level events and Core-resource CRUD
   * (roles, legal docs, site settings).
   * @param type Raw event type string.
   * @returns Translated label, falling back to the raw value if unmapped.
   */
  eventTypeLabel(type: string): string {
    const key = this.EVENT_TYPE_LABEL_KEYS[type];
    return key ? this.t(key) : type;
  }

  /**
   * @description Maps raw `event_type` values to a CSS badge class controlling color.
   * @param type Raw event type string.
   * @returns CSS class name, falling back to a neutral default.
   */
  eventTypeClass(type: string): string {
    const map: Record<string, string> = {
      login_success: 'ev-create',
      login_failed: 'ev-delete',
      logout: 'ev-update',
      password_reset_requested: 'ev-update',
      password_reset_completed: 'ev-create',
      password_reset_failed: 'ev-delete',
      password_reset_email_rate_limited: 'ev-error',
      create: 'ev-create', update: 'ev-update', soft_delete: 'ev-delete',
      hard_delete: 'ev-delete', restore: 'ev-restore', error: 'ev-error',
    };
    return map[type] ?? 'ev-default';
  }
}