/**
 * @file base-dashboard.component.ts
 * @path src/app/admin/components/base-dashboard/base-dashboard.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Shared logic of the module dashboards (core, web …): stat tiles loaded in
 * parallel for the allowed endpoints only, the hero tile with its metric dropdown, the
 * comparison and distribution bars, the recent audit events with their breakdown, the icon
 * library and the manual refresh. A dashboard declares only its stat tiles, shortcut cards, log
 * and event maps; DashboardViewComponent renders it. The texts every dashboard shares are in the
 * translation section `dashboard` (SHARED_DASHBOARD_KEYS), the others in its own section.
 * @dependencies
 * - BaseDataComponent: i18n, permissionService, dataHandler, cd.
 * - ResourceCacheService: TTL cache of the stats / activity fetch (keys
 *   `<translationSection>:stats` / `<translationSection>:activity`).
 * - AdminIconComponent: the icons of the dashboard (`iconOf()` gives their names - no HTML inserted).
 * - AppStatusService: the manual refresh reloads the state of the application (`appId`).
 */

import { Directive, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminIconName } from '../admin-icon/admin-icon.component';
import { forkJoin, catchError, of } from 'rxjs';

import * as Core from '../../../shared/imports/core-providers';
import { ApiPage } from '../../../shared/interfaces/api-envelope';
import { UserLogin } from '../../../shared/interfaces/user';
import { BaseDataComponent } from '../base-data/base-data.component';
import { ResourceCacheService } from '../../../core/services/resource-cache.service';
import { AppStatusService } from '../app-status/app-status.service';

/**
 * @description One metric tile. Carries a translation KEY, not resolved text, so a language
 * change needs no rebuild; `key` identifies the tile for the hero dropdown.
 */
export interface QuickStat {
  key: string;
  labelKey: string;
  value: number | string;
  icon: string;
  /** Highlights an actionable metric (e.g. orders waiting for processing > 0). */
  urgent?: boolean;
}

/**
 * @description Definition of one stat tile - what to fetch and who may see it. `isAllowed` is
 * a function, not a permission key, because some tiles are gated by a role check.
 */
export interface DashboardStatDef {
  key: string;
  labelKey: string;
  icon: string;
  endpoint: string;
  isAllowed: () => boolean;
}

/** @description One segment of the distribution bar. */
export interface DistributionSegment {
  key: string;
  labelKey: string;
  value: number;
  pct: number;
  opacity: number;
}

/** @description Translation section of the texts shared by every dashboard. */
export const DASHBOARD_SECTION = 'dashboard';

/** @description Keys read from DASHBOARD_SECTION instead of the section of the dashboard. */
const SHARED_DASHBOARD_KEYS = new Set([
  'hero_select_aria', 'last_updated_label', 'refresh_button', 'refresh_button_title', 'hero_caption',
  'hero_caption_urgent', 'bars_card_title', 'bars_card_empty', 'no_visible_stats', 'distribution_card_title',
  'section_quick_nav', 'activity_view_all', 'activity_loading', 'breakdown_card_title', 'breakdown_hint',
  'breakdown_create_label', 'breakdown_update_label', 'breakdown_delete_label', 'breakdown_restore_label',
  'breakdown_export_label', 'breakdown_error_label', 'breakdown_default_label', 'ev_label_create',
  'ev_label_update', 'ev_label_soft_delete', 'ev_label_hard_delete', 'ev_label_restore', 'ev_label_export',
  'ev_label_error', 'footer_help_text',
]);

/** @description One shortcut card of the quick navigation (translation keys + guard). */
export interface DashboardNavSection {
  titleKey: string;
  icon: string;
  route: string;
  descriptionKey: string;
  isAllowed: () => boolean;
}

/** @description Row of a module audit log (core_logs / web_logs / shop_logs). */
export interface ActivityLog {
  id: number;
  created_at: string;
  origin: string;
  event_type: string;
  module: string;
  description: string;
  user_plain?: string | null;
}

/** @description One row of the "recent events breakdown" widget. */
export interface ActivityBreakdownEntry {
  classKey: string;
  labelKey: string;
  count: number;
}

/**
 * Icons of the dashboards: the key of `QuickStat.icon` / `DashboardNavSection.icon` → the icon of
 * AdminIconComponent (drawn by its template - no HTML inserted).
 */
const DASHBOARD_ICONS: Record<string, AdminIconName> = {
  briefcase: 'briefcase',
  file: 'file-text',
  globe: 'globe',
  inbox: 'inbox',
  legal: 'legal',
  link: 'link',
  logs: 'clipboard',
  mail: 'mail',
  settings: 'settings',
  shield: 'shield',
  users: 'users',
};

/** `eventTypeClass()` CSS key -> translation key of the "recent events breakdown" widget. */
const BREAKDOWN_LABEL_KEYS: Record<string, string> = {
  'ev-create': 'breakdown_create_label',
  'ev-update': 'breakdown_update_label',
  'ev-delete': 'breakdown_delete_label',
  'ev-restore': 'breakdown_restore_label',
  'ev-export': 'breakdown_export_label',
  'ev-error': 'breakdown_error_label',
  'ev-default': 'breakdown_default_label',
};

/** Number of audit events shown in the activity feed. */
const RECENT_ACTIVITY_COUNT = 8;

/**
 * @description Base of the module dashboards.
 * @usage `export class XDashboardComponent extends BaseDashboardComponent { ... }` with
 * `translationSection`, `statDefs`, `navSections`, `logsEndpoint`, `logsPermission`, `logsRoute`,
 * `eventTypeLabelKeys`, `eventTypeClassMap` (and `appId` for the state of an application in the
 * header); template `<app-dashboard-view [d]="this">`.
 */
@Directive()
export abstract class BaseDashboardComponent extends BaseDataComponent<UserLogin> implements Core.OnInit {

  protected resourceCache = inject(ResourceCacheService);
  private readonly appStatus = inject(AppStatusService);

  override apiEndpoint = 'core/users';

  /** TTL of the stats / activity cache. */
  protected readonly TTL_MS = 2 * 60 * 1000;

  /** Application of the dashboard - its state and maintenance switch are in the header (null = core). */
  readonly appId: string | null = null;

  /** Stat tiles of the module; only the allowed ones are requested. */
  protected abstract readonly statDefs: DashboardStatDef[];
  /** Shortcut cards of the module. */
  abstract readonly navSections: DashboardNavSection[];
  /** Log list endpoint of the module, e.g. 'core/logs'. */
  protected abstract readonly logsEndpoint: string;
  /** Permission key of the log list endpoint - shows the activity section. */
  abstract readonly logsPermission: string;
  /** Admin page of the log ("view all"), e.g. '/admin/core/logs'. */
  abstract readonly logsRoute: string;
  /** event_type -> translation key for `eventTypeLabel()`. */
  protected abstract readonly eventTypeLabelKeys: Record<string, string>;
  /** event_type -> CSS badge class for `eventTypeClass()`. */
  protected abstract readonly eventTypeClassMap: Record<string, string>;

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

  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: Core.ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
  ) {
    super(dataHandler, cd, genericTableService);
    this.i18n.translations$.pipe(takeUntilDestroyed()).subscribe(() => this.cd.markForCheck());
  }

  /**
   * @description Text of the dashboard: a shared key from `dashboard`, any other from the
   *   section of the dashboard.
   * @param key Key without section.
   */
  public override t(key: string): string {
    return this.i18n.getValue(`${SHARED_DASHBOARD_KEYS.has(key) ? DASHBOARD_SECTION : this.translationSection}.${key}`);
  }

  /** @description Cache key of the stat tiles. */
  protected get STATS_CACHE_KEY(): string {
    return `${this.translationSection}:stats`;
  }

  /** @description Cache key of the activity feed. */
  protected get ACTIVITY_CACHE_KEY(): string {
    return `${this.translationSection}:activity`;
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.loadStats();
    this.loadRecentActivity();
  }

  /** @description Shortcut cards the signed-in user may open. */
  get visibleNavSections(): DashboardNavSection[] {
    return this.navSections.filter(section => section.isAllowed());
  }

  /**
   * @description Metric of the hero tile - the one chosen in the dropdown, or the first allowed
   * one (also when the chosen one is no longer allowed).
   */
  get heroStat(): QuickStat | null {
    if (this.quickStats.length === 0) return null;
    return this.quickStats.find(s => s.key === this.selectedHeroKey) ?? this.quickStats[0];
  }

  /** @description Every allowed metric except the hero one - the comparison bars. */
  get secondaryStats(): QuickStat[] {
    const heroKey = this.heroStat?.key;
    return this.quickStats.filter(s => s.key !== heroKey);
  }

  /** @description Logarithm of the largest numeric metric - scale of `statBarPct()`. */
  private get maxStatLog(): number {
    const numericValues = this.quickStats.map(s => typeof s.value === 'number' ? s.value : 0);
    return Math.log(Math.max(1, ...numericValues) + 1);
  }

  /**
   * @description Width of a comparison bar on a log scale; at least 8 %, so a value many orders
   * smaller than the largest one stays a visible bar (4 % for zero / no value).
   * @param stat Metric of the bar.
   * @returns Width in percent.
   */
  statBarPct(stat: QuickStat): number {
    const value = typeof stat.value === 'number' ? stat.value : 0;
    if (value <= 0) return 4;
    return Math.max(8, Math.round((Math.log(value + 1) / this.maxStatLog) * 100));
  }

  /**
   * @description Distribution bar: every allowed numeric metric (log-weighted width, zero = a
   *   small segment), largest first; monochrome with a decreasing opacity by rank.
   */
  get distributionSegments(): DistributionSegment[] {
    const numericStats = this.quickStats.filter(s => typeof s.value === 'number') as (QuickStat & { value: number })[];
    if (numericStats.length === 0) return [];

    /** Weight of a zero value - roughly the value 1 on the log scale. */
    const ZERO_WEIGHT = 0.35;
    const OPACITY_STEPS = [1, 0.82, 0.66, 0.52, 0.4, 0.3, 0.22];
    const weighted = numericStats.map(stat => ({ stat, weight: stat.value > 0 ? Math.log(stat.value + 1) : ZERO_WEIGHT }));
    const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);

    return [...weighted]
      .sort((a, b) => b.stat.value - a.stat.value)
      .map(({ stat, weight }, index) => ({
        key: stat.key,
        labelKey: stat.labelKey,
        value: stat.value,
        pct: Math.round((weight / totalWeight) * 1000) / 10,
        opacity: OPACITY_STEPS[Math.min(index, OPACITY_STEPS.length - 1)],
      }));
  }

  /** @description Highest count of `activityBreakdown` - scale of the breakdown bars. */
  get maxBreakdownCount(): number {
    return Math.max(1, ...this.activityBreakdown.map(b => b.count));
  }

  /** @description Width of one breakdown bar in percent. */
  breakdownBarPct(entry: ActivityBreakdownEntry): number {
    return Math.round((entry.count / this.maxBreakdownCount) * 100);
  }

  /**
   * @description Icon of a statistic / section of the dashboard.
   * @param key Icon key (`DASHBOARD_ICONS`).
   * @returns Name of the AdminIconComponent icon, null for an unknown key (nothing drawn).
   */
  iconOf(key: string): AdminIconName | null {
    return DASHBOARD_ICONS[key] ?? null;
  }

  /**
   * @description Manual refresh - bypasses the cache and loads everything again; the permission
   * guards of the loaders still apply. Ignored while a refresh runs.
   */
  refresh(): void {
    if (this.isRefreshing) return;
    this.isRefreshing = true;
    this.resourceCache.invalidate(this.STATS_CACHE_KEY);
    this.resourceCache.invalidate(this.ACTIVITY_CACHE_KEY);
    this.loadStats();
    this.loadRecentActivity();
    if (this.appId) this.appStatus.load(true);
    this.refreshExtras();
  }

  /** @description Hook of `refresh()` for module-specific sections (default: nothing). */
  protected refreshExtras(): void {}

  toggleHeroDropdown(): void {
    this.heroDropdownOpen = !this.heroDropdownOpen;
  }

  /** @param key `QuickStat.key` of the chosen metric. */
  selectHeroStat(key: string): void {
    this.selectedHeroKey = key;
    this.heroDropdownOpen = false;
  }

  closeHeroDropdown(): void {
    this.heroDropdownOpen = false;
  }

  /**
   * @description Tile of one loaded metric - a module can extend it (e.g. `urgent`).
   * @param def Stat definition.
   * @param total `meta.total` of the response, '—' when the request failed.
   */
  protected toQuickStat(def: DashboardStatDef, total: number | string): QuickStat {
    return { key: def.key, labelKey: def.labelKey, value: total, icon: def.icon };
  }

  /**
   * @description Loads the counts of the allowed stat tiles in parallel (forkJoin, cached). A
   * failed request shows '—' and leaves the other tiles working; `getPaginatedCollection` keeps
   * `meta.total` of the response.
   */
  protected loadStats(): void {
    this.loadingStats = true;
    const allowedDefs = this.statDefs.filter(def => def.isAllowed());

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
        this.quickStats = allowedDefs.map(def => this.toQuickStat(def, res[def.key]?.meta?.total ?? '—'));
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
   * @description Loads the latest audit events of the module (cached) for the activity feed and
   * its breakdown - only with the log permission.
   */
  protected loadRecentActivity(): void {
    if (!this.permissionService.hasPermission(this.logsPermission)) {
      this.recentActivity = [];
      this.activityBreakdown = [];
      this.loadingActivity = false;
      return;
    }

    this.loadingActivity = true;

    this.resourceCache.get(
      this.ACTIVITY_CACHE_KEY,
      () => this.dataHandler.getPaginatedCollection<any>(`${this.logsEndpoint}?per_page=${RECENT_ACTIVITY_COUNT}&sort_by=created_at&sort_direction=desc`)
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
   * @description Counts the loaded events by `eventTypeClass()` (largest group first) - purely
   * client-side, no extra request.
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
        // every class of the class maps (incl. 'ev-default') has a label key
        labelKey: BREAKDOWN_LABEL_KEYS[classKey],
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }

  /** @description Date and time in the admin locale, '—' when missing. */
  formatDate(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString(this.i18n.getDateLocale(), {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  /**
   * @description Translated label of an `event_type`.
   * @returns The label, or the raw value when unmapped.
   */
  eventTypeLabel(type: string): string {
    const key = this.eventTypeLabelKeys[type];
    return key ? this.t(key) : type;
  }

  /**
   * @description CSS badge class of an `event_type`.
   * @returns The class, 'ev-default' when unmapped.
   */
  eventTypeClass(type: string): string {
    return this.eventTypeClassMap[type] ?? 'ev-default';
  }
}
