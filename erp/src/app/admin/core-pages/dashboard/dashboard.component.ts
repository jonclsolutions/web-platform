/**
 * @file dashboard.component.ts
 * @path src/app/admin/core-pages/dashboard/dashboard.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Central administrative dashboard for the "Core" module - system-wide
 * settings and resources shared across the Web and Shop modules (user accounts, roles &
 * permissions, legal documents, external links, system-level audit logs). Gated behind
 * `core-view-dashboard` permission.
 *
 * @note Mirrors the structure of the Web dashboard (`web-pages/dashboard`) by design so
 * both dashboards share the same visual language and CSS classes (`cd-*` prefix). Does
 * NOT surface profile-related pages (`personal-info`, `welcome-page`) - those are visible
 * to every logged-in user regardless of `core-view-dashboard` and therefore do not belong
 * on a permission-gated overview page.
 *
 * @refactor-note (2026-08) `core_logs` je nyní plnohodnotná log tabulka se stejnou
 * strukturou jako `web_logs`/`shop_logs` (nahradila původní odlehčenou `web_system_logs`
 * bez `user_id`/`affected_entity_*`/`user_plain`) - `ActivityLog` proto sdílí přesně stejný
 * tvar jako u `WebDashboardComponent`, žádný zvláštní `SystemActivityLog` typ už není
 * potřeba. Endpoint `core/system_logs` (dočasně neexistující 404) nahrazen skutečnou
 * routou `core/logs` (`CoreLogController`).
 *
 * @refactor-note (2026-08-8) TTL CACHE + RUČNÍ REFRESH (backlog: "zbytečně moc dotazů na
 * API"). Dashboard je typicky NEJNAVŠTĚVOVANĚJŠÍ stránka v adminu (výchozí landing po
 * přihlášení, k ní se často vracíme přes modul switcher) - `loadStats()`
 * (5 souběžných requestů) a `loadRecentActivity()` dřív běžely při KAŽDÉM vstupu na
 * stránku bez ohledu na to, jak nedávno se to samé stalo. Obě metody teď jdou přes
 * `ResourceCacheService` (2min TTL - kratší než tabulkové 3min, protože dashboard je
 * "co se teď děje" přehled, kde je čerstvost o něco důležitější). Přidáno ruční
 * "Aktualizovat" tlačítko (`refresh()` - obchází TTL, invaliduje oba cache klíče a
 * refetchne) a `lastUpdatedAt` timestamp zobrazovaný v hlavičce, stejný UX vzor jako u
 * tabulek (TableBuilderComponent).
 *
 * @bugfix-note (2026-08-16) KRITICKÁ OPRAVA - PERMISSION-AWARE DASHBOARD: `loadStats()`
 * dřív pálila `forkJoin` na všech 5 endpointů (`core/users`, `core/roles`,
 * `legal/document-sections`, `core/external_links`, `core/logs`) bez ohledu na
 * oprávnění uživatele - stejný symptom jako u `WebDashboardComponent`/
 * `ShopDashboardComponent` (viz jejich bugfix-note 2026-08-16). Zvláštní případ tady je
 * `core/roles` - ten NENÍ gated permission klíčem vůbec (viz api.php hlavička a
 * CoreRoleController), jen kontrolou `role_name === 'sysadmin'` přímo v controlleru, takže
 * i s `core-administrators-view` by nesysadmin dostal 403 na "Role a oprávnění" kartu.
 * ŘEŠENÍ: `quickStats`/`navSections` teď staví z deklarativního pole `STAT_DEFS`, kde má
 * každá položka `isAllowed(): boolean` - u čtyř resources volá
 * `permissionService.hasPermission(...)` (`core-administrators-view`,
 * `core-legal-documents-view`, `core-external-links-view`, `view-core` pro logy - stejný
 * klíč jako gate `core/logs` GET v api.php), u "roles" volá `isSysadmin()`.
 * @TODO-CONFIRM `isSysadmin()` je DOČASNÝ placeholder (čte `localStorage.getItem('userRole')`,
 * stejný vzor jako `PermissionService` čte `userPermissions`) - nahradit voláním skutečné
 * role-check metody (pravděpodobně `AuthService`/`CurrentUserProfileService`, stejný zdroj
 * jako `userRole` v `admin-layout.component.ts`), jakmile bude potvrzeno API té služby.
 * Je to fail-closed (nesysadmin nikdy neuvidí kartu navíc), takže i beze změny je to
 * bezpečné, jen nemusí být 100% konzistentní se zdrojem pravdy, pokud by se lišil formát
 * uloženého klíče/hodnoty.
 *
 * @dependencies
 * - BaseDataComponent: Provides errorMessage/cd/alertDialogService (no CRUD needed here).
 * - LoadingService: Manages global loading states.
 * - DataHandler: Facilitates API communication for dashboard aggregation endpoints.
 * - HasPermissionDirective: Gate the "Poslední systémové události" section on `view-core`.
 * - PermissionService: Synchronní kontrola permission klíčů - řídí, které dílčí stat/nav/
 *   activity požadavky se vůbec pošlou (viz bugfix-note výše).
 * - ResourceCacheService: TTL cache pro stats/activity fetch (viz refactor-note výše).
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
import { ResourceCacheService } from '../../../core/services/resource-cache.service';

/**
 * @description A single aggregated metric tile shown in the stats grid.
 */
interface QuickStat {
  label: string;
  value: number | string;
  icon: string;
  color: string;
}

/**
 * @description A single shortcut card shown in the quick-navigation grid.
 */
interface NavSection {
  title: string;
  icon: string;
  route: string;
  description: string;
  color: string;
}

/**
 * @description Row shape returned by the `core_logs` audit endpoint. Structurally
 * identical to the `ActivityLog` shape used by `WebDashboardComponent` (`web_logs`),
 * since both tables share the same columns by design - see @refactor-note above.
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
 * (`roles`) is gated by a sysadmin role check, not a permission key - see bugfix-note in
 * the file header. Adding a new module to the dashboard means adding one entry here,
 * never touching `loadStats()`/the template.
 */
interface DashboardStatDef {
  key: string;
  label: string;
  icon: string;
  color: string;
  endpoint: string;
  isAllowed: () => boolean;
}

/**
 * @description `NavSection` shortcut card, extended with the same `isAllowed` predicate
 * used by `DashboardStatDef` (see above).
 */
interface NavSectionWithGuard extends NavSection {
  isAllowed: () => boolean;
}

/**
 * @description Serves as the sensitive system-configuration overview for administrators
 * with Core access. Aggregates counts from every resource owned by the Core module and
 * offers one-click navigation into each management screen.
 * @note Implements component-level data aggregation from multiple API endpoints, same
 * pattern as `WebDashboardComponent`. Every aggregated piece is additionally gated by
 * `PermissionService`/`isSysadmin()` - see bugfix-note (2026-08-16) in the file header.
 */
@Component({
  selector: 'app-core-dashboard',
  standalone: true,
  imports: [RouterModule, CommonModule, HasPermissionDirective],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CoreDashboardComponent extends BaseDataComponent<UserLogin> implements Core.OnInit {

  public override loadingService = inject(LoadingService);
  private sanitizer = inject(DomSanitizer);
  private resourceCache = inject(ResourceCacheService);

  override apiEndpoint = 'core/users';

  private readonly TTL_MS = 2 * 60 * 1000;
  private readonly STATS_CACHE_KEY = 'core-dashboard:stats';
  private readonly ACTIVITY_CACHE_KEY = 'core-dashboard:activity';

  /** Permission klíč gatující `core/logs` GET v api.php (`CheckPermission` middleware). */
  private readonly LOGS_PERMISSION = 'view-core';

  /**
   * Jediné místo pravdy pro stat karty dashboardu - viz bugfix-note (2026-08-16) v
   * hlavičce souboru. `loadStats()` z tohoto pole vyfiltruje jen položky, kde
   * `isAllowed()` vrátí true, a JEN za ty pošle request.
   */
  private readonly STAT_DEFS: DashboardStatDef[] = [
    {
      key: 'users', label: 'Uživatelé systému', icon: 'users', color: 'sky',
      endpoint: 'core/users?per_page=1',
      isAllowed: () => this.permissionService.hasPermission('core-administrators-view'),
    },
    {
      // core/roles NENÍ gated permission klíčem - jen sysadmin kontrolou v controlleru.
      // Viz @TODO-CONFIRM v hlavičce souboru.
      key: 'roles', label: 'Role a oprávnění', icon: 'shield', color: 'indigo',
      endpoint: 'core/roles?per_page=1',
      isAllowed: () => this.isSysadmin(),
    },
    {
      key: 'legalDocs', label: 'Právní dokumenty', icon: 'legal', color: 'slate',
      endpoint: 'legal/document-sections?per_page=1',
      isAllowed: () => this.permissionService.hasPermission('core-legal-documents-view'),
    },
    {
      key: 'externalLinks', label: 'Externí odkazy', icon: 'link', color: 'green',
      endpoint: 'core/external_links?per_page=1',
      isAllowed: () => this.permissionService.hasPermission('core-external-links-view'),
    },
    {
      key: 'coreLogs', label: 'Systémové logy', icon: 'logs', color: 'amber',
      endpoint: 'core/logs?per_page=1',
      isAllowed: () => this.permissionService.hasPermission(this.LOGS_PERMISSION),
    },
  ];

  quickStats: QuickStat[] = [];
  loadingStats = true;

  recentActivity: ActivityLog[] = [];
  loadingActivity = true;

  /** Kdy naposledy proběhlo úspěšné načtení dashboardu - zobrazeno v hlavičce. */
  lastUpdatedAt: Date | null = null;
  isRefreshing = false;

  readonly navSections: NavSectionWithGuard[] = [
    {
      title: 'Administrátoři',
      icon: 'users',
      route: '/admin/core/administrators',
      description: 'Správa uživatelských účtů administrátorů',
      color: 'sky',
      isAllowed: () => this.permissionService.hasPermission('core-administrators-view'),
    },
    {
      title: 'Role a oprávnění',
      icon: 'shield',
      route: '/admin/core/edit-roles',
      description: 'Definice rolí a jejich přístupových práv',
      color: 'indigo',
      // core/edit-roles route je chráněná sysadminGuard, ne permission klíčem - viz
      // admin-routing.module.ts a @TODO-CONFIRM v hlavičce souboru.
      isAllowed: () => this.isSysadmin(),
    },
    {
      title: 'Právní dokumenty',
      icon: 'legal',
      route: '/admin/core/edit-legal',
      description: 'GDPR, obchodní podmínky a další dokumenty',
      color: 'slate',
      isAllowed: () => this.permissionService.hasPermission('core-legal-documents-view'),
    },
    {
      title: 'Externí odkazy',
      icon: 'link',
      route: '/admin/core/external-links',
      description: 'Odkazy na analytiku a externí nástroje',
      color: 'green',
      isAllowed: () => this.permissionService.hasPermission('core-external-links-view'),
    },
    {
      title: 'Systémové logy',
      icon: 'logs',
      route: '/admin/core/logs',
      description: 'Auditní záznamy autentizace a systému',
      color: 'amber',
      isAllowed: () => this.permissionService.hasPermission(this.LOGS_PERMISSION),
    },
    {
      title: 'Nastavení webu',
      icon: 'settings',
      route: '/admin/core/web-settings',
      description: 'Globální konfigurace webu a e-shopu',
      color: 'rose',
      // WebSettingsComponent volá legal/config/* (SiteConfigurationController) - stejný
      // klíč jako menu položka "Firemní údaje" v admin-layout.component.html, viz
      // bugfix-note (2026-08-6) v admin-routing.module.ts.
      isAllowed: () => this.permissionService.hasPermission('core-legal-config-view'),
    },
  ];

  /**
   * @description Podmnožina `navSections`, na kterou má přihlášený uživatel právo -
   * šablona nad tímto getterem iteruje místo nad `navSections` přímo (viz bugfix-note
   * (2026-08-16) v hlavičce souboru).
   */
  get visibleNavSections(): NavSectionWithGuard[] {
    return this.navSections.filter(section => section.isAllowed());
  }

  /**
   * Icon library used on this dashboard - key matches the `icon` value in
   * `QuickStat`/`NavSection`. Deliberately without `viewBox` (sizing is controlled purely
   * by CSS via `.cd-stat-icon svg` / `.cd-nav-icon svg`) - see the identical note in
   * `WebDashboardComponent` for why `viewBox` would otherwise get lower-cased and ignored
   * when injected through `[innerHTML]`.
   */
  private readonly ICONS: Record<string, string> = {
    users: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    shield: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    legal: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M7 21h10"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/><path d="m7 7 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m17 7 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/></svg>`,
    link: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
    logs: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="13" y2="15"/></svg>`,
    settings: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
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
   * @description Ruční "Aktualizovat" - obchází TTL cache pro obě sekce dashboardu
   * (stats + activity) a vynutí čerstvý fetch. Stejný UX vzor jako refresh tlačítko u
   * tabulek (TableBuilderComponent.refreshRequested). Permission guardy v `loadStats()`/
   * `loadRecentActivity()` platí i tady - ruční refresh nepřeskakuje kontrolu práv, jen
   * obchází TTL cache.
   */
  refresh(): void {
    if (this.isRefreshing) return;
    this.isRefreshing = true;
    this.resourceCache.invalidate(this.STATS_CACHE_KEY);
    this.resourceCache.invalidate(this.ACTIVITY_CACHE_KEY);
    this.loadStats();
    this.loadRecentActivity();
  }

  /**
   * @description Aggregates resource counts from every Core-owned endpoint the current
   * user is permitted to see, concurrently using forkJoin. Cached přes
   * ResourceCacheService (2min TTL) - viz refactor-note (2026-08-8) v hlavičce souboru.
   * @note If an individual request fails, it defaults to null so the rest of the
   * dashboard remains functional. `getPaginatedCollection` is used deliberately (not
   * `getCollection`) to keep `.total` from the response instead of just the unwrapped
   * page of records.
   * @bugfix-note (2026-08-16) Endpointy, na které uživatel nemá právo (viz
   * `STAT_DEFS[].isAllowed`), se teď VŮBEC nevolají - žádný zbytečný 403 (`core/roles`
   * pro nesysadminy, `core/logs`/`core/external_links`/`legal/document-sections`/
   * `core/users` pro chybějící permission), žádná karta s "—" pro resource, který
   * uživatel nesmí vidět. Viz hlavička souboru.
   */
  private loadStats(): void {
    this.loadingStats = true;

    const allowedDefs = this.STAT_DEFS.filter(def => def.isAllowed());

    this.resourceCache.get(this.STATS_CACHE_KEY, () => {
      const calls: Record<string, ReturnType<typeof this.dataHandler.getPaginatedCollection<any>>> = {};
      for (const def of allowedDefs) {
        calls[def.key] = this.dataHandler.getPaginatedCollection<any>(def.endpoint).pipe(catchError(() => of(null)));
      }
      return forkJoin(calls);
    }, this.TTL_MS).subscribe({
      next: (res: Record<string, any>) => {
        this.quickStats = allowedDefs.map(def => ({
          label: def.label, value: res[def.key]?.total ?? '—', icon: def.icon, color: def.color,
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
   * permission changes, legal document changes) for the activity feed. Cached přes
   * ResourceCacheService (2min TTL) - viz refactor-note (2026-08-8) v hlavičce souboru.
   * @bugfix-note (2026-08-16) `core/logs` (GET) vyžaduje `view-core` - bez kontroly by
   * uživatel bez tohoto práva dostal 403 při každém vstupu na dashboard. Bez práva se
   * teď rovnou vrátí prázdný seznam bez volání API - sekce navíc v šabloně obalena
   * `*appHasPermission` (viz dashboard.component.html).
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
      () => this.dataHandler.getPaginatedCollection<any>('core/logs?per_page=8&sort_by=created_at&sort_direction=desc')
        .pipe(catchError(() => of(null))),
      this.TTL_MS
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
   * @TODO-CONFIRM DOČASNÝ placeholder pro kontrolu role sysadmina - `core/roles` (a
   * route `/admin/core/edit-roles`) nejsou gated permission klíčem, jen kontrolou
   * `role_name === 'sysadmin'` (viz `sysadmin.guard.ts`/`CoreRoleController` a
   * bugfix-note v hlavičce souboru). Zrcadlí vzor `PermissionService`
   * (`localStorage.getItem('userPermissions')`), ale klíč `userRole` v localStorage NENÍ
   * potvrzený - `admin-layout.component.ts` má vlastní `userRole` property odjinud
   * (pravděpodobně AuthService/CurrentUserProfileService). Nahradit voláním té stejné
   * služby, jakmile bude její API potvrzené. Fail-closed: dokud klíč v localStorage
   * chybí nebo nesedí, nesysadmin kartu/nav položku nikdy neuvidí.
   * @returns True, pokud aktuálně přihlášený uživatel má roli 'sysadmin'.
   */
  private isSysadmin(): boolean {
    return localStorage.getItem('userRole') === 'sysadmin';
  }

  formatDate(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('cs-CZ', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  /**
   * @description Maps raw `event_type` values from `core_logs` to human-readable Czech
   * labels - covers both auth-level events and Core-resource CRUD (roles, legal docs,
   * site settings).
   * @param type Raw event type string.
   * @returns Human-readable label, falling back to the raw value if unmapped.
   */
  eventTypeLabel(type: string): string {
    const map: Record<string, string> = {
      login_success: 'Přihlášení',
      login_failed: 'Neúspěšné přihlášení',
      logout: 'Odhlášení',
      password_reset_requested: 'Žádost o reset hesla',
      password_reset_completed: 'Reset hesla dokončen',
      password_reset_failed: 'Reset hesla selhal',
      password_reset_email_rate_limited: 'Reset hesla - limit vyčerpán',
      create: 'Vytvoření', update: 'Úprava', soft_delete: 'Smazání',
      hard_delete: 'Trvalé smazání', restore: 'Obnova', error: 'Chyba',
    };
    return map[type] ?? type;
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