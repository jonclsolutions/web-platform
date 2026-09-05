/**
 * @file admin-layout.component.ts
 * @path src/app/admin/pages/admin-layout/admin-layout.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Main shell component for the administrative panel, managing sidebar navigation, module switching, and global UI state.
 * @dependencies
 * - AuthService: Manages user authentication and session status.
 * - PermissionService: Validates access to specific administrative modules.
 * - LoadingService: Observes global loading states for the UI.
 * - TableRefreshBusService: Vyvolání globálního "Aktualizovat vše" tlačítka pro tabulky.
 * @redesign-note (2026) Přidán `isMobileActionsOpen` + `toggleMobileActions()`/`closeMobileActions()`.
 *      Na mobilu (viz CSS) header schovává většinu obsahu (uživatel, hodiny, přepínač modulů,
 *      wiki/bug odkazy), aby se nic neořezávalo - místo toho se všechno přesune do vysouvacího
 *      panelu ovládaného novým hamburger tlačítkem vpravo nahoře. Desktopové chování je beze změny.
 * @redesign-note (2026-2) `currentModule` rozšířeno o třetí hodnotu `'core'` (nová sekce
 *      systémových/sdílených stránek napříč Web a E-shop - viz admin-routing.module.ts).
 *      `switchModule()` zná novou cílovou cestu `/admin/core/dashboard`. Viditelnost tlačítka
 *      v přepínači řeší nová permission `view-core` přes `*appHasPermission` v šabloně,
 *      stejně jako u stávajících 'view-web'/'view-eshop'.
 * @redesign-note (2026-3) `switchModule('web')` nyní míří na `/admin/web/dashboard` místo
 *      `/admin/dashboard` - web stránky sjednoceny pod prefix `web/...`, stejně jako
 *      `core/...` a `shop/...` (viz admin-routing.module.ts).
 * @refactor-note (2026-08) Přepínač "E-shop: Aktivní/Údržba" + potvrzovací modál s heslem
 *      KOMPLETNĚ ODSTRANĚN z headeru - logika se přesunula na `shop-pages/dashboard`
 *      (nová karta "Režim údržby e-shopu"). Analogický přepínač pro veřejný web přibyl na
 *      `web-pages/dashboard`. Header adminu už žádné maintenance ovládání neobsahuje -
 *      `dataHandler`/`alertDialogService` injekce a `isShopActive`/`maintenanceMessage`/
 *      `showConfirmModal`/`confirmPasswordValue`/`pendingTargetState`/`toggleShopStatus()`/
 *      `submitShopStatusChange()`/`cancelShopStatusChange()`/`loadShopSettings()` byly
 *      odstraněny, protože už v této komponentě nemají žádné využití.
 * @refactor-note (2026-08-6) Přidáno globální "Aktualizovat vše" tlačítko (desktop header
 *      i mobilní panel) - `refreshAllTables()` deleguje na `TableRefreshBusService`, který
 *      zneplatní CELOU cache `GenericTableService` (žádný síťový dotaz sám o sobě) a vyšle
 *      signál, na který aktuálně mountnutá stránka s tabulkou zareaguje reálným
 *      refetchem (viz BaseDataComponent.initWithAuthCheck()). Součást řešení backlog
 *      tasku "zbytečně moc dotazů na API" / lepší UX správy tabulek.
 * @refactor-note (2026-08-17) Přidána metoda `hasAnyPermission()` + sada getterů
 *      `show*Group` (jeden pro každou sekci levého menu ve všech třech modulech).
 *      Šablona (admin-layout.component.html) je používá jako `*ngIf` na `.nav-group`.
 *      Důvod: `*appHasPermission` na jednotlivých `<li>` sama o sobě neumí schovat
 *      nadpis sekce (`.nav-group-label`), pokud uživateli po vyhodnocení oprávnění
 *      nezůstane v sekci ani jedna viditelná položka - bez tohoto by v menu zbýval
 *      "prázdný" nadpis s prázdným seznamem. Gettery drží 1:1 stejné permission klíče
 *      (včetně OR syntaxe '|'), jaké má odpovídající `*appHasPermission` v šabloně u
 *      jednotlivých položek dané sekce - při přidání/odebrání položky do/ze sekce je
 *      nutné getter ručně zaktualizovat (viz komentáře u jednotlivých getterů níže).
 */

import { Component, OnInit, OnDestroy, ChangeDetectorRef, HostListener, LOCALE_ID } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { Subscription, interval, Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { AuthService } from '../../../core/auth/auth.service';
import { PermissionService } from '../../../core/auth/services/permission.service';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { LoadingService } from '../../../core/services/loading.service';
import { TableRefreshBusService } from '../../../core/services/table-refresh-bus.service';

/**
 * @description The layout shell for the administration area, handling sidebar controls and navigation.
 * @usage Used as the root component for all '/admin' routes.
 * @note Implements persistent storage for layout preferences (sidebar width, menu state).
 */
@Component({
  selector: 'app-admin-layout',
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.css'],
  standalone: true,
  imports: [CommonModule, RouterModule, DatePipe, HasPermissionDirective],
  providers: [
    { provide: LOCALE_ID, useValue: 'cs-CZ' }
  ]
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
  userEmail: string | null = null;
  userRole: string | null = null;
  isLoggedIn: boolean = false;

  currentModule: 'web' | 'core' | 'shop' = 'web';

  isLoadingGlobal$: Observable<boolean>;

  currentDate$: Observable<Date> = interval(1000).pipe(
    startWith(0),
    map(() => new Date())
  );

  isMenuOpen: boolean = true;
  sidebarWidth: number = 200;
  isResizing: boolean = false;

  private isMobileViewport: boolean = false;

  /** Vysouvací panel na mobilu (hamburger vpravo nahoře) - uživatel, role, hodiny, moduly, odkazy. */
  isMobileActionsOpen: boolean = false;

  private minWidth: number = 150;
  private maxWidth: number = 500;
  private authSubscription: Subscription | undefined;
  private userEmailSubscription: Subscription | undefined;

  constructor(
    private router: Router,
    private authService: AuthService,
    private permissionService: PermissionService,
    private cdr: ChangeDetectorRef,
    private loadingService: LoadingService,
    private tableRefreshBus: TableRefreshBusService
  ) {
    this.isLoadingGlobal$ = this.loadingService.isLoading$;
  }

  /**
   * @description Initializes layout state from LocalStorage and sets up authentication observation.
   * @note Automatically adjusts sidebar visibility based on viewport width.
   */
  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      const savedWidth = localStorage.getItem('admin_sidebar_width');
      if (savedWidth) this.sidebarWidth = parseInt(savedWidth, 10);

      const savedState = localStorage.getItem('admin_menu_open');
      const savedModule = localStorage.getItem('admin_current_module') as 'web' | 'core' | 'shop';
      if (savedModule) this.currentModule = savedModule;

      if (window.innerWidth <= 768) {
        this.isMenuOpen = false;
      } else {
        this.isMenuOpen = savedState !== null ? savedState === 'true' : true;
      }
      this.isMobileViewport = window.innerWidth <= 768;
    }

    this.authSubscription = this.authService.isLoggedIn$.subscribe(loggedIn => {
      this.isLoggedIn = loggedIn;
      this.userRole = loggedIn ? this.authService.getUserRole() : null;
      this.cdr.markForCheck();
    });

    this.userEmailSubscription = this.authService.userEmail$.subscribe(email => {
      this.userEmail = email;
      this.cdr.markForCheck();
    });
  }

  /**
   * @description Reaguje POUZE na přechod přes hranici 768px (mobil/desktop) - viz
   * bugfix-note výše. Nikdy nemění `isMenuOpen`, pokud viewport zůstává ve stejné
   * kategorii, takže běžné plynulé zmenšování/zvětšování okna žádný panel
   * nerozbaluje ani nesbaluje samo od sebe.
   */
  @HostListener('window:resize')
  onWindowResize(): void {
    if (typeof window === 'undefined') return;

    const nowMobile = window.innerWidth <= 768;
    if (nowMobile === this.isMobileViewport) return;

    this.isMobileViewport = nowMobile;

    if (nowMobile) {
      // Přechod DO mobilu - panel VŽDY zavřít, bez ohledu na předchozí desktopový stav.
      this.isMenuOpen = false;
      this.isMobileActionsOpen = false;
    } else {
      // Návrat NA desktop - obnovit uloženou desktopovou preferenci, ne transientní
      // hodnotu z mobilního režimu.
      const savedState = localStorage.getItem('admin_menu_open');
      this.isMenuOpen = savedState !== null ? savedState === 'true' : true;
    }

    this.cdr.markForCheck();
  }

  /**
   * @description Switches between main application modules ('web' / 'core' / 'shop') and updates navigation.
   * @param module The target module to navigate into.
   */
  switchModule(module: 'web' | 'core' | 'shop'): void {
    this.currentModule = module;
    localStorage.setItem('admin_current_module', module);

    const landingRoute: Record<'web' | 'core' | 'shop', string> = {
      web: '/admin/web/dashboard',
      core: '/admin/core/welcome-page',
      shop: '/admin/shop/dashboard'
    };
    this.router.navigate([landingRoute[module]]);
    this.cdr.markForCheck();
  }

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
    if (window.innerWidth > 768) {
      localStorage.setItem('admin_menu_open', this.isMenuOpen.toString());
    }
    this.cdr.markForCheck();
  }

  onLinkClick(): void {
    if (window.innerWidth <= 768) {
      this.isMenuOpen = false;
    }
  }

  /**
   * @description Otevře/zavře mobilní panel s uživatelskými informacemi a akcemi
   *              (hamburger vpravo nahoře, viditelný jen na mobilu přes CSS media query).
   */
  toggleMobileActions(): void {
    this.isMobileActionsOpen = !this.isMobileActionsOpen;
    this.cdr.markForCheck();
  }

  closeMobileActions(): void {
    this.isMobileActionsOpen = false;
    this.cdr.markForCheck();
  }

  /**
   * @description Vyvolá globální "Aktualizovat vše" napříč všemi tabulkami v adminu.
   * Zneplatní celou cache `GenericTableService` (žádný síťový dotaz sám o sobě) a
   * přinutí aktuálně mountnutou stránku s tabulkou k tvrdému refetchi. Ostatní, právě
   * neotevřené stránky se přefetchnou samy při příští návštěvě.
   */
  refreshAllTables(): void {
    this.tableRefreshBus.triggerGlobalRefresh();
  }

  /**
   * @description Initiates sidebar resizing.
   * @param event The mouse interaction event.
   */
  startResizing(event: MouseEvent): void {
    if (window.innerWidth > 768) {
      this.isResizing = true;
      event.preventDefault();
    }
  }

  /**
   * @description Dynamically updates the sidebar width during resize operations.
   */
  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (!this.isResizing) return;
    let newWidth = event.clientX;
    if (newWidth >= this.minWidth && newWidth <= this.maxWidth) {
      this.sidebarWidth = newWidth;
      this.cdr.markForCheck();
    }
  }

  @HostListener('window:mouseup')
  onMouseUp(): void {
    if (this.isResizing) {
      this.isResizing = false;
      localStorage.setItem('admin_sidebar_width', this.sidebarWidth.toString());
    }
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.permissionService.clearPermissions();
        this.router.navigate(['/auth/login']);
      },
      error: () => this.router.navigate(['/auth/login'])
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // VIDITELNOST SEKCÍ LEVÉHO MENU (nav-group)
  // ══════════════════════════════════════════════════════════════════════

  /**
   * @description Ověří, zda má aktuální uživatel ALESPOŇ JEDNO z předaných oprávnění.
   *      Používá se ke skrytí celé sekce menu (nav-group), pokud by v ní po vyhodnocení
   *      *appHasPermission na jednotlivých položkách nezůstala viditelná ani jedna -
   *      direktiva sama o sobě neumí "schovat rodiče, když zmizí všechny děti", proto
   *      se viditelnost sekce počítá zde a řídí se přes *ngIf na .nav-group v šabloně.
   * @param keys Seznam permission klíčů odpovídající položkám v sekci. Každý prvek
   *      pole může sám obsahovat OR syntaxi ('core-legal-documents-view|core-legal-config-view')
   *      stejně jako *appHasPermission - viz has-permission.directive.ts.
   * @returns true, pokud uživatel splňuje alespoň jeden z klíčů (resp. alespoň jednu
   *      stranu některé OR skupiny).
   * @refactor-note (2026-08-17) Přidáno kvůli požadavku: sekce v menu s 0 viditelnými
   *      položkami se nemá vůbec renderovat (prázdný nadpis sekce bez obsahu).
   */
  hasAnyPermission(keys: string[]): boolean {
    return keys.some(key =>
      key.split('|').some(single => this.permissionService.hasPermission(single.trim()))
    );
  }

  // ── Web modul ────────────────────────────────────────────────────────

  /** @description Sekce "Přehled" (Web) - viditelná, pokud uživatel vidí web dashboard. */
  get showWebOverviewGroup(): boolean {
    return this.hasAnyPermission(['web-view-dashboard']);
  }

  /** @description Sekce "Obchod" (Web) - webový formulář, obchodní leady, přijaté poptávky. */
  get showWebBusinessGroup(): boolean {
    return this.hasAnyPermission([
      'web-user-requests-view',
      'web-sales-leads-view',
      'web-sales-orders-view',
      'web-projects-view'
    ]);
  }

  /** @description Sekce "Obsah webu" (Web) - správa webu, správa novinek. */
  get showWebContentGroup(): boolean {
    return this.hasAnyPermission(['web-edit-website-view', 'web-news-view']);
  }

  /** @description Sekce "Lidé" (Web) - uchazeči, helpdesk tikety. */
  get showWebPeopleGroup(): boolean {
    return this.hasAnyPermission(['web-job-applications-view', 'web-support-tickets-view']);
  }

  /** @description Sekce "Systém" (Web) - serverové logy. */
  get showWebSystemGroup(): boolean {
    return this.hasAnyPermission(['web-view-web-logs']);
  }

  // ── Core modul ───────────────────────────────────────────────────────

  /** @description Sekce "Přehled" (Core) - vítejte, core dashboard. */
  get showCoreOverviewGroup(): boolean {
    return this.hasAnyPermission(['core-view-welcome-page', 'view-core']);
  }

  /** @description Sekce "Právní a firemní" (Core) - GDPR/TOS/COOKIES, firemní údaje, externí odkazy. */
  get showCoreLegalGroup(): boolean {
    return this.hasAnyPermission([
      'core-legal-documents-view|core-legal-config-view',
      'core-legal-config-view',
      'core-external-links-view'
    ]);
  }

  /**
   * @description Sekce "Uživatelé" (Core) - správa účtů, osobní informace.
   *      "Správa rolí" je v šabloně vázaná na `userRole === 'sysadmin'`, ne na
   *      permission klíč (viz sysadminGuard), proto je zohledněná zvlášť přes OR.
   */
  get showCoreUsersGroup(): boolean {
    return this.hasAnyPermission(['core-administrators-view', 'web-view-personal-info'])
      || this.userRole === 'sysadmin';
  }

  /** @description Sekce "Systém" (Core) - core logy. */
  get showCoreSystemGroup(): boolean {
    return this.hasAnyPermission(['view-core']);
  }

  // ── Shop modul ───────────────────────────────────────────────────────

  /** @description Sekce "Přehled" (Shop) - e-shop dashboard. */
  get showShopOverviewGroup(): boolean {
    return this.hasAnyPermission(['shop-view-dashboard']);
  }

  /** @description Sekce "Katalog" (Shop) - produkty, kategorie, dodavatelé. */
  get showShopCatalogGroup(): boolean {
    return this.hasAnyPermission([
      'shop-products-view',
      'shop-categories-view',
      'shop-suppliers-view'
    ]);
  }

  /** @description Sekce "Transakce" (Shop) - objednávky, slevové kupóny. */
  get showShopTransactionsGroup(): boolean {
    return this.hasAnyPermission(['shop-orders-view', 'shop-coupons-view']);
  }

  /** @description Sekce "Zákazníci" (Shop). */
  get showShopCustomersGroup(): boolean {
    return this.hasAnyPermission(['shop-customers-view']);
  }

  /** @description Sekce "Logistika" (Shop) - způsoby dopravy, způsoby platby. */
  get showShopLogisticsGroup(): boolean {
    return this.hasAnyPermission([
      'shop-shipping-methods-view',
      'shop-payment-methods-view'
    ]);
  }

  /** @description Sekce "Obsah webu" (Shop) - správa e-shopu (texty). */
  get showShopContentGroup(): boolean {
    return this.hasAnyPermission(['shop-edit-eshop-view']);
  }

  /** @description Sekce "Systém" (Shop) - e-shop logování. */
  get showShopSystemGroup(): boolean {
    return this.hasAnyPermission(['shop-view-logs']);
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
    this.userEmailSubscription?.unsubscribe();
  }
}