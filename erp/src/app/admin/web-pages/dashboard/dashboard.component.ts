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
 * @refactor-note (2026) Profil uživatele, uvítací hlavička a "vytvořen účet" byly přesunuty
 * na novou WelcomePageComponent (`/admin/welcome-page`), kterou vidí každý přihlášený uživatel
 * s oprávněním `web-view-welcome-page` - tahle stránka teď obsahuje výhradně citlivé/agregační
 * přehledy (počty uživatelů, tickety, systémové logy, rychlé odkazy do modulů), které mají
 * vidět jen uživatelé s `web-view-dashboard`. Odstraněno vše, co s profilem souviselo
 * (getItemDetails/profil, e-mail subscription, welcomeMessage) - `BaseDataComponent` tu
 * zůstává jen kvůli `errorMessage`/`cd`/`alertDialogService` a jednotnému vzoru, i když
 * `apiEndpoint` se teď prakticky nevyužívá (agregace jede přes `dataHandler` napřímo).
 *
 * @refactor-note (2026-08) Core/Web split: přehledy sdílené napříč Web a Shop (uživatelé,
 * role, právní dokumenty, systémové logy) byly přesunuty na nový `CoreDashboardComponent`
 * (`core-pages/dashboard`). Tento dashboard teď obsahuje výhradně metriky a navigaci pro
 * obsah a provoz webové prezentace - doplněny chybějící moduly `edit-website`,
 * `sales-orders` a `user-request`, které v `web-pages` existují, ale dřív na dashboardu
 * chyběly.
 *
 * @icons-note (2026) `quickStats`/`navSections` teď v poli `icon` nenesou emoji, ale klíč
 *      do `ICONS` mapy (viz `getIcon()`) - šablona ho vykresluje jako inline SVG přes
 *      `[innerHTML]`. Ikony jsou záměrně bez `viewBox` a s `width="24" height="24"`
 *      (přesně dle souřadnic cest) - zmenšení na výslednou velikost řeší CSS
 *      (`.cd-stat-icon svg`/`.cd-nav-icon svg`), protože `[innerHTML]` na SVG vloženém
 *      do běžného HTML elementu prochází HTML parserem, který by atribut `viewBox`
 *      přepsal na malé `viewbox` (SVG ho pak ignoruje) - tomuhle se tak vyhneme úplně.
 *
 * @refactor-note (2026-08-2) Přidána karta "Režim údržby" (přesunuto z admin-layout
 * headeru, viz jeho @refactor-note) - `isWebActive`/`webMaintenanceMessage` +
 * potvrzovací modál s heslem (`openWebMaintenanceModal()`/`submitWebMaintenanceChange()`).
 * Karta je viditelná jen s permission `web-set-maintenance-mode` (`*appHasPermission`),
 * proto nový import `HasPermissionDirective`.
 *
 * @refactor-note (2026-08-9) TTL CACHE + RUČNÍ REFRESH (backlog: "zbytečně moc dotazů na
 * API"), stejný vzor jako `CoreDashboardComponent`/shop `DashboardComponent`. Dashboard
 * je typický post-login landing point pro roli spravující obsah webu, ke kterému se admin
 * často vrací modul switcherem. `loadStats()` (7 souběžných requestů), `loadRecentActivity()`
 * a `loadWebMaintenanceStatus()` teď jdou přes `ResourceCacheService` (2 min TTL pro
 * stats/activity, 1 min pro maintenance status - bezpečnostně/provozně citlivější).
 * Přidáno ruční "Aktualizovat" tlačítko (`refresh()` - invaliduje všechny tři cache klíče
 * a refetchne) a `lastUpdatedAt` timestamp v hlavičce, stejný UX vzor jako u tabulek a
 * `CoreDashboardComponent`. `submitWebMaintenanceChange()` po úspěchu invaliduje
 * maintenance cache klíč, ať další čtení (i jinde v adminu) odráží novou hodnotu.
 * Poznámka: `initWithAuthCheck()` se v této komponentě NIKDY nevolala (viz `ngOnInit`
 * override níže) - žádná regresní úprava `usesPaginatedList` tu proto není potřeba.
 *
 * @bugfix-note (2026-08-15) KRITICKÁ OPRAVA: `loadWebMaintenanceStatus()` a
 * `submitWebMaintenanceChange()` volaly sdílený `core/settings` endpoint, který spolu s
 * `App\Models\Core\CoreSiteSetting` a tabulkou `core_site_settings` byl zrušen (viz
 * `WebSiteSettingController`, `App\Models\Web\WebSiteSetting`, tabulka
 * `web_site_settings`). Stejný symptom jako dřívější shop bug: bez tohoto přepojení by
 * PUT požadavek narazil na neexistující route (404), UI by si ale nastavilo optimistickou
 * zelenou/oranžovou, a po refreshi (GET na neexistující/prázdný endpoint) by karta spadla
 * zpět na výchozí stav. Oba volání přepojena na `web/settings`
 * (WebSiteSettingController::show/update), který vrací/přijímá přesně
 * `is_web_active`/`web_maintenance_message` shape - zbytek komponenty beze změny.
 *
 * @bugfix-note (2026-08-16) KRITICKÁ OPRAVA - PERMISSION-AWARE DASHBOARD: `loadStats()`
 * dřív pálila `forkJoin` na VŠECH 7 endpointů bez ohledu na to, jestli na ně přihlášený
 * uživatel má právo (`web-news-view`, `web-support-tickets-view`, ...). Uživatel, který má
 * jen `web-view-dashboard` + např. `web-news-view`, tak při vstupu na dashboard dostal 403
 * na zbylých 6 endpointů - `catchError(() => of(null))` sice zabránil pádu dashboardu, ale
 * (a) DataHandler centrálně hlásí chyby přes AlertDialogService, takže se uživateli sype
 * alert/toast za KAŽDÝ endpoint, na který nemá právo, a (b) karta se stejně vykreslila
 * (jen s hodnotou "—"), místo aby zmizela úplně. Stejný bug měla `loadRecentActivity()`
 * (`web/logs` vyžaduje `web-view-web-logs`) a `loadWebMaintenanceStatus()` (`web/settings`
 * vyžaduje `web-set-maintenance-mode`) - obě se volaly bezpodmínečně v `ngOnInit()`.
 * ŘEŠENÍ: `quickStats` se teď skládá z deklarativního pole `STAT_DEFS` (label/icon/color/
 * endpoint/permission) - `loadStats()` před `forkJoin` vyfiltruje jen položky, na které má
 * uživatel `permission`, a NEVOLÁ endpoint vůbec za ty ostatní (žádný 403, žádný alert,
 * karta se v `quickStats` poli prostě neobjeví). `STAT_DEFS` je zvoleno záměrně jako
 * jediné místo pravdy pro budoucí rozšíření (nový modul = nový řádek v poli, ne nová větev
 * v `forkJoin`/šabloně). `navSections` dostalo `permission` pole a filtruje se přes nový
 * getter `visibleNavSections` (šablona iteruje přes něj místo přes `navSections`).
 * `loadRecentActivity()`/`loadWebMaintenanceStatus()` teď na začátku kontrolují
 * `permissionService.hasPermission(...)` a bez práva se rovnou vrátí (žádný fetch).
 * Sekce "Poslední aktivita" v šabloně navíc obalena `*appHasPermission="'web-view-web-logs'"`
 * (belt & suspenders - i kdyby se logika v TS někdy rozjela jinak, sekce se v DOM vůbec
 * nevytvoří). Karta údržby už `*appHasPermission="'web-set-maintenance-mode'"` měla dřív -
 * beze změny v šabloně, jen doplněn stejný guard na stranu TS fetch volání.
 *
 * @dependencies
 * - BaseDataComponent: Poskytuje errorMessage/cd/alertDialogService (žádné CRUD tu není potřeba).
 * - LoadingService: Manages global loading states.
 * - DataHandler: Facilitates API communication for dashboard aggregation endpoints.
 * - HasPermissionDirective: Gate karty údržby a aktivity na příslušný permission klíč.
 * - PermissionService: Synchronní kontrola permission klíčů - řídí, které dílčí
 *   stat/nav/activity/maintenance požadavky se vůbec pošlou (viz bugfix-note výše).
 * - ResourceCacheService: TTL cache pro stats/activity/maintenance fetch (viz refactor-note výše).
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
import { ActivityLog, QuickStat, NavSection } from './';

/**
 * @description Declarative definition of a single dashboard stat tile - what to fetch,
 * how to render it, and which permission key gates it. Adding a new module to the
 * dashboard means adding one entry here, never touching `loadStats()`/the template.
 */
interface DashboardStatDef {
  key: string;
  permission: string;
  label: string;
  icon: string;
  endpoint: string;
  color: QuickStat['color'];
}

/**
 * @description `NavSection` shortcut card, extended with the permission key required to
 * both see the card AND reach the page it links to (kept in sync with
 * `admin-routing.module.ts` `data: { permission }` for the same route).
 */
interface NavSectionWithPermission extends NavSection {
  permission: string;
}

/**
 * @description Serves as the website-content overview page for administrators with
 * dashboard access. Not the post-login landing page anymore - see WelcomePageComponent.
 * System-wide/cross-module metrics (users, roles, legal, system logs) live on
 * `CoreDashboardComponent` instead.
 * @note Implements component-level data aggregation from multiple API endpoints to populate the
 * dashboard view. Every aggregated piece is additionally gated by `PermissionService` - see
 * bugfix-note (2026-08-16) in the file header.
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
  // zděděný BaseDataComponent (stejný vzor jako EditRolesComponent), stačí `this.alertDialogService`.

  override apiEndpoint = 'core/users';

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
   * Jediné místo pravdy pro stat karty dashboardu - viz bugfix-note (2026-08-16) v
   * hlavičce souboru. `loadStats()` z tohoto pole vyfiltruje jen položky, na které má
   * přihlášený uživatel dané `permission`, a JEN za ty pošle request.
   */
  private readonly STAT_DEFS: DashboardStatDef[] = [
    { key: 'news', permission: 'web-news-view', label: 'Novinky na webu', icon: 'newspaper', color: 'rose', endpoint: 'web/news?per_page=1' },
    { key: 'openTickets', permission: 'web-support-tickets-view', label: 'Otevřené tickety', icon: 'ticket', color: 'amber', endpoint: 'web/support_tickets?status=open&per_page=1' },
    { key: 'jobApps', permission: 'web-job-applications-view', label: 'Uchazeči', icon: 'file', color: 'slate', endpoint: 'web/job_applications?per_page=1' },
    { key: 'leads', permission: 'web-sales-leads-view', label: 'Obchodní leady', icon: 'briefcase', color: 'green', endpoint: 'web/sales_leads?per_page=1' },
    { key: 'salesOrders', permission: 'web-sales-orders-view', label: 'Nabídky a objednávky', icon: 'inbox', color: 'indigo', endpoint: 'web/sales_orders?per_page=1' },
    { key: 'rawRequests', permission: 'web-user-requests-view', label: 'Poptávky', icon: 'mail', color: 'amber', endpoint: 'web/raw_request_commissions?per_page=1' },
    { key: 'webLogs', permission: this.LOGS_PERMISSION, label: 'Záznamy v logu', icon: 'logs', color: 'sky', endpoint: 'web/logs?per_page=1' },
  ];

  quickStats: QuickStat[] = [];
  loadingStats = true;

  recentActivity: ActivityLog[] = [];
  loadingActivity = true;

  /** Kdy naposledy proběhlo úspěšné načtení dashboardu - zobrazeno v hlavičce. */
  lastUpdatedAt: Date | null = null;
  isRefreshing = false;

  // ── Režim údržby webu ────────────────────────────────────────────
  isWebActive = true;
  webMaintenanceMessage = '';
  showWebMaintenanceModal = false;
  webConfirmPasswordValue = '';
  pendingWebTargetState = true;

  readonly navSections: NavSectionWithPermission[] = [
    {
      title: 'Novinky',
      icon: 'newspaper',
      route: '/admin/web/edit-news',
      description: 'Aktuality a oznámení publikovaná na webu',
      color: 'rose',
      permission: 'web-news-view',
    },
    {
      title: 'Obsah webu',
      icon: 'globe',
      route: '/admin/web/edit-website',
      description: 'Texty a obsah veřejných stránek',
      color: 'sky',
      permission: 'web-view-edit-website',
    },
    {
      title: 'Poptávky',
      icon: 'mail',
      route: '/admin/web/user-request',
      description: 'Poptávkový formulář z webu',
      color: 'amber',
      permission: 'web-user-requests-view',
    },
    {
      title: 'Nabídky a objednávky',
      icon: 'inbox',
      route: '/admin/web/sales-orders',
      description: 'Zpracované obchodní objednávky',
      color: 'indigo',
      permission: 'web-sales-orders-view',
    },
    {
      title: 'Obchodní leady',
      icon: 'briefcase',
      route: '/admin/web/sales-leads',
      description: 'Pipeline obchodních příležitostí',
      color: 'green',
      permission: 'web-sales-leads-view',
    },
    {
      title: 'Support tickety',
      icon: 'ticket',
      route: '/admin/web/support-tickets',
      description: 'Přijaté požadavky na podporu',
      color: 'amber',
      permission: 'web-support-tickets-view',
    },
    {
      title: 'Uchazeči',
      icon: 'file',
      route: '/admin/web/job-applications',
      description: 'Reakce na pracovní pozice',
      color: 'slate',
      permission: 'web-job-applications-view',
    },
    {
      title: 'Business logy',
      icon: 'logs',
      route: '/admin/web/business-logs',
      description: 'Záznamy o aktivitách na webu',
      color: 'rose',
      permission: this.LOGS_PERMISSION,
    },
  ];

  /**
   * @description Podmnožina `navSections`, na kterou má přihlášený uživatel právo -
   * šablona nad tímto getterem iteruje místo nad `navSections` přímo, ať se nenabízí
   * navigace do stránky, na kterou uživatel stejně nesmí (viz bugfix-note (2026-08-16)
   * v hlavičce souboru).
   */
  get visibleNavSections(): NavSectionWithPermission[] {
    return this.navSections.filter(section => this.permissionService.hasPermission(section.permission));
  }

  /**
   * Knihovna ikon použitých na dashboardu - klíč odpovídá hodnotě `icon` v
   * `QuickStat`/`NavSection`. Bez `viewBox` (viz @icons-note výše), velikost
   * na obrazovce řídí CSS (`.cd-stat-icon svg`, `.cd-nav-icon svg`).
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

  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: Core.ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
  ) {
    super(dataHandler, cd, genericTableService);
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.loadStats();
    this.loadRecentActivity();
    this.loadWebMaintenanceStatus();
  }

  /**
   * @description Vrátí bezpečně vysanitizovanou SVG značku pro zadaný klíč ikony
   *              (viz `ICONS`), pro vykreslení přes `[innerHTML]` v šabloně.
   */
  getIcon(key: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.ICONS[key] ?? '');
  }

  /**
   * @description Ruční "Aktualizovat" - obchází TTL cache pro všechny tři sekce
   * dashboardu (stats + activity + maintenance) a vynutí čerstvý fetch. Permission
   * guardy v `loadStats()`/`loadRecentActivity()`/`loadWebMaintenanceStatus()` platí i
   * tady - ruční refresh nepřeskakuje kontrolu práv, jen obchází TTL cache.
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
   * @description Aggregates statistical data from every website-content module the
   * current user is permitted to see, concurrently using forkJoin. Přes TTL cache (viz
   * refactor-note v hlavičce souboru).
   * @note If an individual request fails, it defaults to null to ensure the rest of the
   * dashboard remains functional. `getPaginatedCollection` je zvolený záměrně (ne
   * `getCollection`), protože potřebujeme zachovat `.total` z odpovědi, ne jen odbalené
   * pole záznamů.
   * @bugfix-note (2026-08-16) Endpointy, na které uživatel nemá permission (viz
   * `STAT_DEFS[].permission`), se teď VŮBEC nevolají - žádný zbytečný 403, žádná
   * karta s "—" pro resource, který uživatel nesmí vidět. Viz hlavička souboru.
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
          // "Otevřené tickety" mění barvu podle počtu (amber když > 0, jinak green) -
          // stejné chování jako dřív, jen teď dopočítané z dynamického pole.
          const color: QuickStat['color'] = def.key === 'openTickets' && typeof total === 'number'
            ? (total > 0 ? 'amber' : 'green')
            : def.color;
          return { label: def.label, value: total, icon: def.icon, color };
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
   * @description Fetches the latest business-level events for the activity feed
   * (content changes, CRUD actions on web-owned resources). Přes TTL cache (viz
   * refactor-note v hlavičce souboru).
   * @bugfix-note (2026-08-16) `web/logs` (GET) vyžaduje `web-view-web-logs` - bez
   * kontroly by uživatel bez tohoto práva dostal 403 při každém vstupu na dashboard.
   * Bez práva se teď rovnou vrátí prázdný seznam bez volání API - sekce navíc v šabloně
   * obalena `*appHasPermission` (viz dashboard.component.html).
   */
  private loadRecentActivity(): void {
    if (!this.permissionService.hasPermission(this.LOGS_PERMISSION)) {
      this.recentActivity = [];
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
   * @description Formats current system date for display in the dashboard header.
   */
  get currentDateTime(): string {
    return new Date().toLocaleDateString('cs-CZ', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  formatDate(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('cs-CZ', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  eventTypeLabel(type: string): string {
    const map: Record<string, string> = {
      create: 'Vytvoření', update: 'Úprava', soft_delete: 'Smazání',
      hard_delete: 'Trvalé smazání', restore: 'Obnova',
      export: 'Export', error: 'Chyba', payment: 'Platba',
    };
    return map[type] ?? type;
  }

  eventTypeClass(type: string): string {
    const map: Record<string, string> = {
      create: 'ev-create', update: 'ev-update', soft_delete: 'ev-delete',
      hard_delete: 'ev-delete', restore: 'ev-restore',
      export: 'ev-export', error: 'ev-error', payment: 'ev-create',
    };
    return map[type] ?? 'ev-default';
  }

  // ── Režim údržby webu ────────────────────────────────────────────

  /**
   * @description Načte aktuální stav režimu údržby webu z vyhrazeného `web/settings`
   * endpointu, přes krátkou TTL cache (1 min - stav je bezpečnostně/provozně citlivý).
   * Volá se samostatně od `loadStats()`/`loadRecentActivity()`, ať výpadek jednoho z nich
   * neblokuje zobrazení stavu údržby a naopak.
   * @bugfix-note (2026-08-15) Dříve volalo `core/settings` (sdílený, nyní zrušený Core
   * endpoint) - přepojeno na `web/settings` (WebSiteSettingController::show).
   * @bugfix-note (2026-08-16) `web/settings` (GET i PUT) vyžaduje `web-set-maintenance-mode`
   * - karta je v šabloně už dřív schovaná za `*appHasPermission`, ale samotný fetch se
   * volal bezpodmínečně, takže bez práva stejně přišel 403 hned při vstupu na stránku.
   * Bez práva se teď fetch vůbec nevolá.
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
   * @description Odešle změnu stavu webu na `web/settings`
   * (WebSiteSettingController::update). Po úspěchu invaliduje maintenance cache klíč, ať
   * další čtení (i jinde v adminu) odráží novou hodnotu.
   * @bugfix-note (2026-08-15) Dříve volalo `core/settings` - viz bugfix-note u
   * `loadWebMaintenanceStatus()` a hlavičky souboru pro plné vysvětlení dopadu.
   */
  submitWebMaintenanceChange(): void {
    if (!this.webConfirmPasswordValue.trim()) {
      this.alertDialogService.open('Chyba', 'Zadejte prosím heslo pro potvrzení.', 'danger');
      return;
    }

    this.dataHandler.put<any>('web/settings', {
      is_web_active: this.pendingWebTargetState,
      web_maintenance_message: this.webMaintenanceMessage || 'Omlouváme se, web je momentálně v údržbě.',
      confirm_password: this.webConfirmPasswordValue
    }).subscribe({
      next: () => {
        this.isWebActive = this.pendingWebTargetState;
        this.showWebMaintenanceModal = false;
        this.resourceCache.invalidate(this.MAINTENANCE_CACHE_KEY);
        this.alertDialogService.open(
          'Úspěch',
          this.pendingWebTargetState ? 'Web je nyní aktivní.' : 'Režim údržby webu byl aktivován.',
          'success'
        );
        this.cd.markForCheck();
      },
      error: (err: any) => {
        const message = err?.error?.message || 'Změna režimu údržby selhala.';
        this.alertDialogService.open('Chyba autorizace', message, 'danger');
      }
    });
  }
}