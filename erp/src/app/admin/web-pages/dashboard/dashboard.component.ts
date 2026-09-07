/**
 * @file dashboard.component.ts
 * @path src/app/admin/web-pages/dashboard/dashboard.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Central administrative dashboard component providing website-content
 * metrics, recent activity, and navigation shortcuts. Gated behind `web-view-dashboard`
 * permission.
 *
 * (Earlier refactor-notes for the WelcomePageComponent split, the Core/Web dashboard
 * split, the maintenance-mode card migration to `web/settings`, TTL cache + manual
 * refresh, and the permission-aware stat/nav/activity/maintenance filtering are
 * unchanged - see version history, omitted here for brevity.)
 *
 * @refactor-note (2026-09-07) BACKLOG "vícejazyčná administrace, žádné hardcoded texty"
 * + VIZUÁLNÍ REFAKTOR (sjednoceno s `CoreDashboardComponent`, viz jeho refactor-note
 * stejné datum pro plné odůvodnění vzoru):
 * - `translationSection`/`t()` doplněny stejně jako u `CoreDashboardComponent`/
 *   `UserRequestComponent`. `ActivityLog`/`QuickStat`/`NavSection` z dřívějšího
 *   `import { ... } from './'` NAHRAZENY lokálními typy (`WebDashboardStatDef`,
 *   `NavSectionWithPermission`, ...) nesoucími překladové KLÍČE (`labelKey`/
 *   `titleKey`/`descriptionKey`), ne hotový text ani pevnou barvu z `QuickStat.color`
 *   union - černobílá paleta z `admin-layout` žádnou per-modul barvu nepotřebuje.
 *   Sdílený `./` barrel touhle změnou není dotčen - jen ho tento soubor přestal
 *   importovat, jiné komponenty ho můžou používat dál beze změny.
 * - Bývalá "otevřené tickety mění barvu podle počtu" logika nahrazena sémanticky
 *   čistším `urgent` příznakem (`openTickets > 0`) - zvýrazní se `--warning` tokenem
 *   POUZE když je to skutečně naléhavé, ne jako dekorace.
 * - `eventTypeLabel()`/`eventTypeClass()` přepsány na klíče - navíc oproti Core verzi
 *   nesou `export`/`payment`, zmapované na `ev-export`/`ev-create` třídy.
 * - `currentDateTime`/`formatDate()` respektují `i18n.getDateLocale()` místo natvrdo
 *   `'cs-CZ'`.
 * - NOVÉ widgety (bez jakéhokoliv nového API volání, jen přepočet už načtených dat):
 *   `heroStat`/`secondaryStats`/`statBarPct()` - stejný hero + comparison-bars vzor
 *   jako `CoreDashboardComponent`. `distributionSegments` - PLNOŠÍŘKOVÁ segmentovaná
 *   tyč srovnávající VŠECHNY povolené moduly vedle sebe najednou - druhý graf navíc,
 *   který dává smysl jen u dashboardu s 7 moduly. `activityBreakdown`/
 *   `computeActivityBreakdown()` - rozklad POSLEDNÍCH načtených `recentActivity`
 *   záznamů podle `eventTypeClass()`, stejně jako u `CoreDashboardComponent`.
 * - Karta "Režim údržby" zůstává funkčně BEZE ZMĚNY - jen texty přes `t()`.
 *
 * @refactor-note (2026-09-07v2) BACKLOG "výběr metriky v hero dlaždici": `QuickStat`
 * dostal `selectedHeroKey`/`heroDropdownOpen` + trojici metod
 * (`toggleHeroDropdown`/`selectHeroStat`/`closeHeroDropdown`), stejný vzor jako
 * `CoreDashboardComponent` (viz jeho refactor-note stejné datum pro plné vysvětlení).
 * `heroStat`/`secondaryStats` gettery přepsány stejně - `secondaryStats` je vždy
 * "všechno kromě aktuálně zvoleného hero", ne natvrdo `.slice(1)`.
 * `distributionSegments` zůstává BEZE ZMĚNY - ukazuje VŠECH 7 modulů bez ohledu na to,
 * který z nich je zrovna v hero dlaždici, protože jde o nezávislý srovnávací graf.
 *
 * @dependencies
 * - BaseDataComponent: Poskytuje errorMessage/cd/alertDialogService/i18n.
 * - LoadingService: Manages global loading states.
 * - DataHandler: Facilitates API communication for dashboard aggregation endpoints.
 * - HasPermissionDirective: Gate karty údržby a aktivity na příslušný permission klíč.
 * - PermissionService: Synchronní kontrola permission klíčů - řídí, které dílčí
 *   stat/nav/activity/maintenance požadavky se vůbec pošlou.
 * - ResourceCacheService: TTL cache pro stats/activity/maintenance fetch.
 * - RxJS: Handles asynchronous data aggregation using forkJoin.
 */

import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { forkJoin, catchError, of } from 'rxjs';

import * as Core from '../../../shared/imports/core-providers';
import { UserLogin } from '../../../shared/interfaces/user';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import { LoadingService } from '../../../core/services/loading.service';
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
 * translation KEY, not resolved text or a fixed palette color - see refactor-note
 * (2026-09-07) in the file header. `key` identifies the tile for the hero-selector
 * dropdown (2026-09-07v2).
 */
interface QuickStat {
  key: string;
  labelKey: string;
  value: number | string;
  icon: string;
  /** True only for "otevřené tickety" when the count is > 0 - the one metric on this dashboard that is genuinely actionable/urgent, not decorative. */
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
  styleUrl: './dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent extends BaseDataComponent<UserLogin> implements Core.OnInit {

  public override loadingService = inject(LoadingService);
  private sanitizer = inject(DomSanitizer);
  private resourceCache = inject(ResourceCacheService);
  override permissionService = inject(PermissionService);
  // Pozn.: `alertDialogService` se ZDE ZÁMĚRNĚ znovu nedeklaruje - už ho poskytuje
  // zděděný BaseDataComponent, stačí `this.alertDialogService`.

  override apiEndpoint = 'core/users';

  /**
   * @refactor-note (2026-09-07) i18n - stejný vzor jako `CoreDashboardComponent.t()`.
   */
  protected override translationSection: string = 'web-dashboard';
  public override t(key: string): string {
    return this.i18n.getValue(`web-dashboard.${key}`);
  }

  private readonly STATS_TTL_MS = 2 * 60 * 1000;
  private readonly MAINTENANCE_TTL_MS = 60 * 1000;
  private readonly STATS_CACHE_KEY = 'web-dashboard:stats';
  private readonly ACTIVITY_CACHE_KEY = 'web-dashboard:activity';
  private readonly MAINTENANCE_CACHE_KEY = 'web-dashboard:maintenance';

  /** Permission klíč, který stránka `web/settings` (maintenance) v api.php vyžaduje. */
  private readonly MAINTENANCE_PERMISSION = 'web-set-maintenance-mode';
  /** Permission klíč, který endpoint `web/logs` (GET) v api.php vyžaduje. */
  private readonly LOGS_PERMISSION = 'web-view-web-logs';

  /**
   * Jediné místo pravdy pro stat karty dashboardu - `loadStats()` z tohoto pole
   * vyfiltruje jen položky, na které má přihlášený uživatel dané `permission`, a JEN
   * za ty pošle request.
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

  /** Rozklad `recentActivity` podle `eventTypeClass()` - viz refactor-note v hlavičce. */
  activityBreakdown: ActivityBreakdownEntry[] = [];

  /** Kdy naposledy proběhlo úspěšné načtení dashboardu - zobrazeno v hlavičce. */
  lastUpdatedAt: Date | null = null;
  isRefreshing = false;

  /**
   * @refactor-note (2026-09-07v2) Výběr metriky pro hero dlaždici - `null` = výchozí
   * chování (první povolená metrika). Viz `heroStat` getter a `selectHeroStat()`.
   */
  selectedHeroKey: string | null = null;
  heroDropdownOpen = false;

  // ── Režim údržby webu ────────────────────────────────────────────
  isWebActive = true;
  webMaintenanceMessage = '';
  showWebMaintenanceModal = false;
  webConfirmPasswordValue = '';
  pendingWebTargetState = true;

  readonly navSections: NavSectionWithPermission[] = [
    { titleKey: 'nav_news_title', icon: 'newspaper', route: '/admin/web/edit-news', descriptionKey: 'nav_news_desc', permission: 'web-news-view' },
    { titleKey: 'nav_website_title', icon: 'globe', route: '/admin/web/edit-website', descriptionKey: 'nav_website_desc', permission: 'web-view-edit-website' },
    { titleKey: 'nav_requests_title', icon: 'mail', route: '/admin/web/user-request', descriptionKey: 'nav_requests_desc', permission: 'web-user-requests-view' },
    { titleKey: 'nav_sales_orders_title', icon: 'inbox', route: '/admin/web/sales-orders', descriptionKey: 'nav_sales_orders_desc', permission: 'web-sales-orders-view' },
    { titleKey: 'nav_leads_title', icon: 'briefcase', route: '/admin/web/sales-leads', descriptionKey: 'nav_leads_desc', permission: 'web-sales-leads-view' },
    { titleKey: 'nav_tickets_title', icon: 'ticket', route: '/admin/web/support-tickets', descriptionKey: 'nav_tickets_desc', permission: 'web-support-tickets-view' },
    { titleKey: 'nav_job_apps_title', icon: 'file', route: '/admin/web/job-applications', descriptionKey: 'nav_job_apps_desc', permission: 'web-job-applications-view' },
    { titleKey: 'nav_business_logs_title', icon: 'logs', route: '/admin/web/business-logs', descriptionKey: 'nav_business_logs_desc', permission: this.LOGS_PERMISSION },
  ];

  /**
   * @description Podmnožina `navSections`, na kterou má přihlášený uživatel právo -
   * šablona nad tímto getterem iteruje místo nad `navSections` přímo.
   */
  get visibleNavSections(): NavSectionWithPermission[] {
    return this.navSections.filter(section => this.permissionService.hasPermission(section.permission));
  }

  /**
   * @description Metrika zvýrazněná v hero dlaždici - buď admin zvolená přes dropdown
   * (`selectedHeroKey`), nebo (výchozí/fallback) první povolená metrika v `quickStats`.
   * Pokud dřív zvolený `key` mezi aktuálně povolenými metrikami už není, `find()`
   * vrátí `undefined` a `??` tiše spadne zpět na `quickStats[0]`.
   */
  get heroStat(): QuickStat | null {
    if (this.quickStats.length === 0) return null;
    return this.quickStats.find(s => s.key === this.selectedHeroKey) ?? this.quickStats[0];
  }

  /**
   * @description Zbývající povolené metriky (VŠECHNO kromě aktuálně zvoleného hero) -
   * vykresleny jako srovnávací pruhový graf.
   */
  get secondaryStats(): QuickStat[] {
    const heroKey = this.heroStat?.key;
    return this.quickStats.filter(s => s.key !== heroKey);
  }

  /**
 * @refactor-note (2026-09-07v4) BACKLOG "logy jsou o řády větší než ostatní moduly":
 * lineární škála (value / max) dělala z jakéhokoliv modulu vedle `core_logs`/`web_logs`
 * (stovky až tisíce záznamů) vizuálně neviditelný pruh, i když číselně šlo o desítky
 * záznamů. Přepnuto na LOGARITMICKOU škálu šířky pruhu - zobrazená HODNOTA
 * (`{{ stat.value }}`) zůstává přesné číslo, mění se jen vizuální reprezentace jeho
 * podílu na pruhu, takže menší moduly dostanou čitelnou, nenulovou šířku i vedle
 * řádově většího modulu. `log(0)` je nedefinované, proto nulové hodnoty (typicky
 * "Otevřené tickety: 0") dostávají pevných 4 % místo pokusu o log(0)/NaN.
 */
private get maxStatLog(): number {
  const numericValues = this.quickStats.map(s => typeof s.value === 'number' ? s.value : 0);
  const max = Math.max(1, ...numericValues);
  return Math.log(max + 1);
}

statBarPct(stat: QuickStat): number {
  const value = typeof stat.value === 'number' ? stat.value : 0;
  if (value <= 0) return 4;
  const pct = (Math.log(value + 1) / this.maxStatLog) * 100;
  // Dolní hranice 8 % - i hodnota o mnoho řádů menší než max zůstane vizuálně patrná
  // jako pruh, ne jako tenká čárka.
  return Math.max(8, Math.round(pct));
}

  /**
   * @description PLNOŠÍŘKOVÝ segmentovaný pruh srovnávající VŠECHNY povolené moduly
   * najednou (ne jen `secondaryStats`, ne omezeno hero volbou) - druhý, doplňkový graf
   * k hero+bars kombinaci. Monochromatický: každý segment má stejnou `--accent` barvu,
   * jen klesající opacitu podle pořadí (největší modul = nejtmavší).
   */
 /**
 * @refactor-note (2026-09-07v5) BACKLOG "logy jsou o řády větší než ostatní moduly"
 * (stejný problém jako `statBarPct()`, viz jeho refactor-note (2026-09-07v4)):
 * procentuální podíl na CELKOVÉM SOUČTU (`value / total`) měl stejnou vadu jako dřívější
 * lineární `statBarPct()` - u poměru typu 374:20:3:3:3:1:0 zabraly `core_logs`/`web_logs`
 * přes 90 % šířky tyče a zbylých 6 modulů bylo vizuálně na hranici viditelnosti/nuly.
 * Segmenty teď váží LOGARITMEM hodnoty (`log(value + 1)`), ne hodnotou samotnou - `pct`
 * pak není doslovné "procento z celkového počtu záznamů", ale relativní VIZUÁLNÍ váha
 * segmentu v tyči. `value`/legenda pod tyčí zůstávají přesná čísla beze změny - jen
 * šířka segmentu je teď čitelná i pro řádově menší moduly. `log(0)` nedefinované, proto
 * nulové hodnoty (typicky "Otevřené tickety: 0") dostávají pevnou minimální váhu místo
 * pokusu o log(0)/NaN - segment se v tyči pořád zobrazí (tenký), ne že by úplně zmizel.
 */
get distributionSegments(): DistributionSegment[] {
  const numericStats = this.quickStats.filter(s => typeof s.value === 'number') as (QuickStat & { value: number })[];
  if (numericStats.length === 0) return [];

  /** Minimální log-váha pro nulové hodnoty - odpovídá přibližně hodnotě "1" na logu. */
  const ZERO_WEIGHT = 0.35;

  const weighted = numericStats.map(stat => ({
    stat,
    weight: stat.value > 0 ? Math.log(stat.value + 1) : ZERO_WEIGHT,
  }));

  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
  if (totalWeight === 0) return [];

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
   * Knihovna ikon použitých na dashboardu - klíč odpovídá hodnotě `icon` v
   * `QuickStat`/`NavSection`. Bez `viewBox`, velikost na obrazovce řídí CSS.
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

  /** @description event_type -> překladový klíč pro `eventTypeLabel()`. */
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

  /** @description event_type -> CSS badge třída. `export`/`payment` navíc oproti CoreDashboardComponent. */
  private readonly EVENT_TYPE_CLASS_MAP: Record<string, string> = {
    create: 'ev-create', update: 'ev-update', soft_delete: 'ev-delete',
    hard_delete: 'ev-delete', restore: 'ev-restore',
    export: 'ev-export', error: 'ev-error', payment: 'ev-create',
  };

  /** @description `eventTypeClass()` CSS klíč -> překladový klíč pro "rozklad posledních událostí" widget. */
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

    /**
     * @refactor-note (2026-09-07) Stejný minimalistický vzor jako
     * `CoreDashboardComponent`/`GraphBuilderComponent` - žádné pole se nepřestavuje,
     * jen se OnPush komponenta donutí přehodnotit šablonu při přepnutí jazyka.
     */
    this.i18n.translations$.subscribe(() => this.cd.markForCheck());
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
   * @description Ruční "Aktualizovat" - obchází TTL cache pro všechny tři sekce
   * dashboardu (stats + activity + maintenance) a vynutí čerstvý fetch.
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

  /**
   * @refactor-note (2026-09-07v2) Otevře/zavře dropdown pro výběr hero metriky.
   */
  toggleHeroDropdown(): void {
    this.heroDropdownOpen = !this.heroDropdownOpen;
  }

  /**
   * @refactor-note (2026-09-07v2) Zvolí jinou metriku do hero dlaždice a dropdown
   * zavře.
   * @param key `QuickStat.key` zvolené metriky.
   */
  selectHeroStat(key: string): void {
    this.selectedHeroKey = key;
    this.heroDropdownOpen = false;
  }

  /**
   * @refactor-note (2026-09-07v2) Zavře dropdown bez výběru - volá backdrop overlay v
   * šabloně (klik mimo dropdown).
   */
  closeHeroDropdown(): void {
    this.heroDropdownOpen = false;
  }

  /**
   * @description Aggregates statistical data from every website-content module the
   * current user is permitted to see, concurrently using forkJoin. Přes TTL cache.
   */
  private loadStats(): void {
    this.loadingStats = true;

    const allowedDefs = this.STAT_DEFS.filter(def => this.permissionService.hasPermission(def.permission));

    this.resourceCache.get(this.STATS_CACHE_KEY, () => {
      const calls: Record<string, ReturnType<typeof this.dataHandler.getPaginatedCollection<any>>> = {};
      for (const def of allowedDefs) {
        calls[def.key] = this.dataHandler.getPaginatedCollection<any>(def.endpoint).pipe(catchError(() => of(null)));
      }
      return forkJoin(calls);
    }, this.STATS_TTL_MS).subscribe({
      next: (res: Record<string, any>) => {
        this.quickStats = allowedDefs.map((def): QuickStat => {
          const total = res[def.key]?.total ?? '—';
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
   * from the same rows, no extra request). Přes TTL cache.
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
        this.recentActivity = Array.isArray(res) ? res : (res?.data ?? []);
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
        labelKey: this.BREAKDOWN_LABEL_KEYS[classKey] ?? 'breakdown_default_label',
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * @refactor-note (2026-09-07) BUGFIX - natvrdo `toLocaleDateString('cs-CZ', ...)`
   * nahrazeno `this.i18n.getDateLocale()`.
   */
  get currentDateTime(): string {
    return new Date().toLocaleDateString(this.i18n.getDateLocale(), {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
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

  // ── Režim údržby webu ────────────────────────────────────────────

  /**
   * @description Načte aktuální stav režimu údržby webu z `web/settings`, přes krátkou
   * TTL cache (1 min). Volá se samostatně od `loadStats()`/`loadRecentActivity()`.
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
      }
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
   * @description Odešle změnu stavu webu na `web/settings`. Po úspěchu invaliduje
   * maintenance cache klíč, ať další čtení (i jinde v adminu) odráží novou hodnotu.
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