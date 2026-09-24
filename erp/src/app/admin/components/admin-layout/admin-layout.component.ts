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
 * - AdminLocalizationService: Statické i18n admin UI + jazykový přepínač v headeru.
 * - ScrollLockService: Shared background scroll lock (mobile overlay panels).
 * (Earlier redesign/refactor-notes for mobile actions panel, core module, unified
 * web/... route prefix, maintenance switch removal, permission-based nav-group
 * visibility, and the header language switcher relocation are unchanged - see version
 * history, omitted here for brevity.)
 *
 * @bugfix-note (2026-09e) KRITICKÝ BUG - PŘEPÍNAČ MODULŮ V HEADERU NEREAGOVAL NA
 * PŘÍMOU NAVIGACI: `currentModule` se dřív měnil VÝHRADNĚ kliknutím na tlačítko
 * modulu (`switchModule()`), které samo volalo `router.navigate()`. Jakákoliv JINÁ
 * cesta k navigaci (routerLink odjinud, jako "Exit" tlačítko v Knowledge Base
 * mířící natvrdo na `/admin/core/welcome-page`, deep link, návrat v historii
 * prohlížeče) obsah stránky správně vyměnila, ale `currentModule` (a s ním i
 * zvýrazněné tlačítko v headeru) zůstal na PŘEDCHOZÍ hodnotě - header tak lhal o
 * tom, ve kterém modulu se admin skutečně nachází. Opraveno přidáním
 * `router.events` subscribe na `NavigationEnd`, který `currentModule` ODVOZUJE
 * PŘÍMO Z AKTUÁLNÍ URL (`syncModuleFromUrl()`) při KAŽDÉ navigaci, bez ohledu na
 * to, jak k ní došlo. `switchModule()` (klik na tlačítko) zůstává funkční beze
 * změny - vyvolá `router.navigate()`, což samo spustí `NavigationEnd` a
 * `syncModuleFromUrl()` synchronizaci potvrdí (žádná duplicitní/konfliktní logika).
 *
 * @refactor-note (2026-09-25) BACKLOG "zablokovaný scroll pozadí při otevřeném bočním
 * panelu": on mobile (<= 768px) the sidebar (`isMenuOpen`) and the mobile actions
 * panel (`isMobileActionsOpen`) are modal overlays, so the page behind them must not
 * scroll (scroll chaining, iOS rubber-band, lost scroll position). Implemented via the
 * shared `ScrollLockService` (same service as FormBuilderComponent) through ONE
 * central method `updateScrollLock()`, called after every state change of either
 * panel and on mobile/desktop breakpoint crossing. A local `scrollLocked` flag
 * guarantees lock()/unlock() are always called in pairs (never twice in a row), so
 * the layout never leaks or double-releases a lock held by another component (e.g. an
 * open form modal). On desktop the sidebar sits next to the content (not an overlay),
 * so no lock is applied there. The lock is released in `ngOnDestroy()`.
 * No other behavior of this component changed.
 */

import { Component, OnInit, OnDestroy, ChangeDetectorRef, HostListener, LOCALE_ID, inject } from '@angular/core';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { Subscription, interval, Observable, filter } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { AuthService } from '../../../core/auth/auth.service';
import { PermissionService } from '../../../core/auth/services/permission.service';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { LoadingService } from '../../../core/services/loading.service';
import { AdminLocalizationService, AdminLanguageMeta } from '../../../core/services/admin-localization.service';
import { ScrollLockService } from '../../../core/services/scroll-lock.service';

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
  /**
   * @description Ručně injektovaná i18n služba - tahle komponenta `BaseDataComponent`
   * nedědí (je to layout shell, ne datová stránka), stejný manuální vzor jako
   * ostatní ručně injektované komponenty - viz base-data.component.ts refactor-note.
   */
  public readonly i18n = inject(AdminLocalizationService);

  /**
   * @description Shared background scroll lock - see refactor-note (2026-09-25) in the
   * file header.
   */
  private scrollLock = inject(ScrollLockService);

  /**
   * @description Whether THIS component currently holds a lock in ScrollLockService.
   * Guarantees lock()/unlock() are always called in pairs - see `updateScrollLock()`.
   */
  private scrollLocked: boolean = false;

  /**
   * @description Merged `shared` + `admin-layout` i18n section - viz refactor-note
   * v hlavičce souboru (BACKLOG "vícejazyčná administrace, žádné hardcoded texty").
   * @note Typ `any` záměrně - viz `AdminLocalizationService.getMergedSection()`.
   */
  public get strings(): any {
    return this.i18n.getMergedSection('admin-layout');
  }

  // ── Jazykový přepínač (BACKLOG "jazykový přepínač do headeru") ──────────────
  readonly languages: AdminLanguageMeta[] = this.i18n.availableLanguages;
  isLangMenuOpen = false;

  get currentLanguageCode(): string {
    return this.i18n.getCurrentLanguage();
  }

  get currentLanguageMeta(): AdminLanguageMeta | undefined {
    return this.languages.find(l => l.code === this.currentLanguageCode);
  }

  toggleLangMenu(): void {
    this.isLangMenuOpen = !this.isLangMenuOpen;
  }

  closeLangMenu(): void {
    this.isLangMenuOpen = false;
  }

  selectLanguage(code: string): void {
    this.i18n.setLanguage(code);
    this.isLangMenuOpen = false;
  }

  public get dateLocale(): string {
    return this.i18n.getDateLocale();
  }

  private minWidth: number = 150;
  private maxWidth: number = 500;
  private authSubscription: Subscription | undefined;
  private userEmailSubscription: Subscription | undefined;
  /**
   * @bugfix-note (2026-09e) Sleduje KAŽDOU dokončenou navigaci, ať `currentModule`
   * nikdy nezůstane "za pravdou" - viz hlavička souboru.
   */
  private routerSubscription: Subscription | undefined;

  constructor(
    private router: Router,
    private authService: AuthService,
    private permissionService: PermissionService,
    private cdr: ChangeDetectorRef,
    private loadingService: LoadingService
  ) {
    this.isLoadingGlobal$ = this.loadingService.isLoading$;

    // Po přepnutí admin jazyka donutí i tenhle persistentní layout shell přehodnotit
    // `strings` výstup - stejný důvod jako u BaseDataComponent, jen řešeno ručně
    // (tahle komponenta ji nedědí).
    this.i18n.translations$.subscribe(() => this.cdr.markForCheck());

    /**
     * @bugfix-note (2026-09e) Jediné autoritativní místo, které nastavuje
     * `currentModule` NA ZÁKLADĚ SKUTEČNÉ URL - `switchModule()` (klik na tlačítko)
     * i libovolná jiná navigace (routerLink odjinud, historie prohlížeče, deep
     * link) proto vždy skončí se správně zvýrazněným modulem v headeru.
     */
    this.routerSubscription = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(event => this.syncModuleFromUrl(event.urlAfterRedirects));
  }

  /**
   * @description Initializes layout state from LocalStorage and sets up authentication observation.
   * @note Automatically adjusts sidebar visibility based on viewport width.
   */
  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      const savedWidth = localStorage.getItem('admin_sidebar_width');
      if (savedWidth) this.sidebarWidth = parseInt(savedWidth, 10);

      // Výchozí hodnota z localStorage, dokud router poprvé nepotvrdí skutečnou
      // aktuální URL (viz syncModuleFromUrl() níže) - zabraňuje krátkému probliknutí
      // špatně zvýrazněného modulu při prvním vykreslení.
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

    // Okamžitá synchronizace podle SKUTEČNÉ aktuální URL - kryje první vykreslení
    // (NavigationEnd z konstruktoru mohl proběhnout dřív, než tahle komponenta
    // vůbec existovala, typicky při hard-refresh na konkrétní stránce).
    this.syncModuleFromUrl(this.router.url);

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
   * @description Odvodí `currentModule` z první cestové segmentu za `/admin/`
   * (`/admin/core/welcome-page` -> `'core'`). Neznámý/chybějící segment (např.
   * `/admin` samotné, nebo cesty mimo web/core/shop) ponechá `currentModule` beze
   * změny - nemá smysl mazat poslední platný výběr kvůli přechodné/neshodné URL.
   * @bugfix-note (2026-09e) BACKLOG "přepínač modulů v headeru nereaguje na přímou
   * navigaci" - viz hlavička souboru.
   */
  private syncModuleFromUrl(url: string): void {
    const match = url.match(/^\/admin\/(web|core|shop)(\/|$|\?)/);
    if (!match) return;

    const module = match[1] as 'web' | 'core' | 'shop';
    if (module === this.currentModule) return;

    this.currentModule = module;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('admin_current_module', module);
    }
    this.cdr.markForCheck();
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

    this.updateScrollLock();
    this.cdr.markForCheck();
  }

  /**
   * @description Switches between main application modules ('web' / 'core' / 'shop') and updates navigation.
   * @param module The target module to navigate into.
   * @bugfix-note (2026-09e) Ruční nastavení `currentModule`/localStorage tady ZŮSTÁVÁ
   * (okamžitá odezva na klik, ať uživatel nečeká na dokončení navigace) -
   * `syncModuleFromUrl()` po dokončení `NavigationEnd` hodnotu jen znovu potvrdí,
   * nepřepíše ji na nic jiného.
   */
  switchModule(module: 'web' | 'core' | 'shop'): void {
    this.currentModule = module;
    localStorage.setItem('admin_current_module', module);

    const landingRoute: Record<'web' | 'core' | 'shop', string> = {
      web: '/admin/web/welcome-page',
      core: '/admin/core/welcome-page',
      shop: '/admin/shop/welcome-page'
    };
    this.router.navigate([landingRoute[module]]);
    this.cdr.markForCheck();
  }

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
    if (window.innerWidth > 768) {
      localStorage.setItem('admin_menu_open', this.isMenuOpen.toString());
    }
    this.updateScrollLock();
    this.cdr.markForCheck();
  }

  onLinkClick(): void {
    if (window.innerWidth <= 768) {
      this.isMenuOpen = false;
    }
    this.updateScrollLock();
  }

  /**
   * @description Otevře/zavře mobilní panel s uživatelskými informacemi a akcemi
   *              (hamburger vpravo nahoře, viditelný jen na mobilu přes CSS media query).
   */
  toggleMobileActions(): void {
    this.isMobileActionsOpen = !this.isMobileActionsOpen;
    this.updateScrollLock();
    this.cdr.markForCheck();
  }

  closeMobileActions(): void {
    this.isMobileActionsOpen = false;
    this.updateScrollLock();
    this.cdr.markForCheck();
  }

  /**
   * @description Single place that decides whether the page behind the layout may
   * scroll. Locks only on mobile (<= 768px) while the sidebar or the mobile actions
   * panel is open (both are modal overlays there); on desktop the sidebar is part of
   * the layout, so the page scrolls normally. The `scrollLocked` flag makes every
   * call idempotent - lock()/unlock() on ScrollLockService are always paired.
   * @refactor-note (2026-09-25) See file header.
   */
  private updateScrollLock(): void {
    const shouldLock = this.isMobileViewport && (this.isMenuOpen || this.isMobileActionsOpen);

    if (shouldLock && !this.scrollLocked) {
      this.scrollLock.lock();
      this.scrollLocked = true;
    } else if (!shouldLock && this.scrollLocked) {
      this.scrollLock.unlock();
      this.scrollLocked = false;
    }
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
   */
  hasAnyPermission(keys: string[]): boolean {
    return keys.some(key =>
      key.split('|').some(single => this.permissionService.hasPermission(single.trim()))
    );
  }

  // ── Web modul ────────────────────────────────────────────────────────

  get showWebOverviewGroup(): boolean {
    return this.hasAnyPermission(['web-view-dashboard']);
  }

  get showWebBusinessGroup(): boolean {
    return this.hasAnyPermission([
      'web-user-requests-view',
      'web-sales-leads-view',
      'web-sales-orders-view',
      'web-projects-view'
    ]);
  }

  get showWebContentGroup(): boolean {
    return this.hasAnyPermission(['web-edit-website-view', 'web-news-view']);
  }

  get showWebPeopleGroup(): boolean {
    return this.hasAnyPermission(['web-job-applications-view', 'web-support-tickets-view']);
  }

  get showWebSystemGroup(): boolean {
    return this.hasAnyPermission(['web-view-web-logs']);
  }

  // ── Core modul ───────────────────────────────────────────────────────

  get showCoreOverviewGroup(): boolean {
    return this.hasAnyPermission(['core-view-welcome-page', 'view-core']);
  }

  get showCoreLegalGroup(): boolean {
    return this.hasAnyPermission([
      'core-legal-documents-view|core-legal-config-view',
      'core-legal-config-view',
      'core-external-links-view'
    ]);
  }

  get showCoreUsersGroup(): boolean {
    return this.hasAnyPermission(['core-administrators-view', 'web-view-personal-info'])
      || this.userRole === 'sysadmin';
  }

  get showCoreSystemGroup(): boolean {
    return this.hasAnyPermission(['view-core']);
  }

  // ── Shop modul ───────────────────────────────────────────────────────

  get showShopOverviewGroup(): boolean {
    return this.hasAnyPermission(['shop-view-dashboard']);
  }

  get showShopCatalogGroup(): boolean {
    return this.hasAnyPermission([
      'shop-products-view',
      'shop-categories-view',
      'shop-suppliers-view'
    ]);
  }

  get showShopTransactionsGroup(): boolean {
    return this.hasAnyPermission(['shop-orders-view', 'shop-coupons-view']);
  }

  get showShopCustomersGroup(): boolean {
    return this.hasAnyPermission(['shop-customers-view']);
  }

  get showShopLogisticsGroup(): boolean {
    return this.hasAnyPermission([
      'shop-shipping-methods-view',
      'shop-payment-methods-view'
    ]);
  }

  get showShopContentGroup(): boolean {
    return this.hasAnyPermission(['shop-edit-eshop-view']);
  }

  get showShopSystemGroup(): boolean {
    return this.hasAnyPermission(['shop-view-logs']);
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
    this.userEmailSubscription?.unsubscribe();
    this.routerSubscription?.unsubscribe();

    // Release the background scroll lock if this component still holds it
    // (e.g. logout / leaving /admin while a mobile panel is open).
    if (this.scrollLocked) {
      this.scrollLock.unlock();
      this.scrollLocked = false;
    }
  }
}