/**
 * @file admin-layout.component.ts
 * @path src/app/admin/components/admin-layout/admin-layout.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Main shell component for the administrative panel, managing sidebar navigation, module switching, and global UI state.
 * @dependencies
 * - AuthService: Manages user authentication and session status.
 * - PermissionService: Validates access to specific administrative modules.
 * - LoadingService: Observes global loading states for the UI.
 * - AdminLocalizationService: Static i18n of the admin UI + the language switcher in the header.
 * - ScrollLockService: Shared background scroll lock (mobile overlay panels).
 * - UserAvatarComponent: own profile photo in the header.
 * @note Layout: the header and the sidebar stay in place, only the page content (`<main>`) and,
 * independently, a long sidebar menu scroll. A navigation therefore scrolls `<main>` back to the
 * top itself - the router's scroll restoration only moves the window.
 */

import { Component, OnInit, OnDestroy, ChangeDetectorRef, ElementRef, HostListener, LOCALE_ID, ViewChild, inject } from '@angular/core';
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
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { ADMIN_MODULE_PAGES, ADMIN_MODULE_TAB_PERMISSION, AdminModule, AdminNavPage } from '../../admin-navigation.config';
import { SYSADMIN_ROLE_NAME } from '../../../core/auth/guards/auth.guard';
import { UserAvatarComponent } from '../user-avatar/user-avatar.component';

/**
 * @description localStorage key of the menu sections the user collapsed (JSON array of section
 * keys, e.g. ["web-content"]) - only a layout preference, no personal data.
 */
export const NAV_COLLAPSED_STORAGE_KEY = 'jsw_admin_nav_collapsed';

/**
 * @description The layout shell for the administration area, handling sidebar controls and navigation.
 * @usage Used as the root component for all '/admin' routes.
 * @note Implements persistent storage for layout preferences (sidebar width, menu state).
 */
@Component({
  selector: 'app-admin-layout',
  templateUrl: './admin-layout.component.html',
  styleUrls: ['../../shared-styles/theme.css', '../../../shared/styles/base.css', './admin-layout.component.css'],
  standalone: true,
  imports: [CommonModule, RouterModule, DatePipe, HasPermissionDirective, UserAvatarComponent],
  providers: [
    { provide: LOCALE_ID, useValue: 'cs-CZ' }
  ]
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
  userEmail: string | null = null;
  /** Signed URL of the own profile photo (null = the default image). */
  avatarUrl: string | null = null;
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

  /**
   * Menu sections the user collapsed (chevron at the section title). Every section is expanded by
   * default; the choice is remembered in this browser (NAV_COLLAPSED_STORAGE_KEY).
   */
  collapsedGroups = new Set<string>();

  /** Scrolling page area - scrolled back to the top on a navigation. */
  @ViewChild('content') private contentRef?: ElementRef<HTMLElement>;

  /** Path of the last navigation (without query / fragment) - only a new page scrolls to the top. */
  private lastPath: string | null = null;

  /** Mobile slide-out panel (hamburger top right) - user, role, clock, modules, links. */
  isMobileActionsOpen: boolean = false;
  /**
   * @description Manually injected i18n service - this component does not extend
   * `BaseDataComponent` (it is the layout shell, not a data page).
   */
  public readonly i18n = inject(AdminLocalizationService);

  /**
   * @description Shared background scroll lock
   * file header.
   */
  private scrollLock = inject(ScrollLockService);

  /** Confirmation dialog - gets the admin button labels while the admin is shown (finding #20). */
  private confirmDialog = inject(ConfirmDialogService);

  /**
   * @description Whether THIS component currently holds a lock in ScrollLockService.
   * Guarantees lock()/unlock() are always called in pairs - see `updateScrollLock()`.
   */
  private scrollLocked: boolean = false;

  /**
   * @description Merged `shared` + `admin-layout` i18n section.
   * @note Type `any` on purpose - see `AdminLocalizationService.getMergedSection()`.
   */
  public get strings(): any {
    return this.i18n.getMergedSection('admin-layout');
  }

  // ── Language switcher ──────────────
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
  private avatarSubscription: Subscription | undefined;
  private routerSubscription: Subscription | undefined;
  /** Re-render on admin language change. */
  private i18nSubscription: Subscription | undefined;

  constructor(
    private router: Router,
    private authService: AuthService,
    private permissionService: PermissionService,
    private cdr: ChangeDetectorRef,
    private loadingService: LoadingService
  ) {
    this.isLoadingGlobal$ = this.loadingService.isLoading$;

    // After switching the admin language, forces this persistent layout shell to re-evaluate
    // the `strings` output - same reason as in BaseDataComponent, only done manually
    // (this component does not extend it).
    this.i18nSubscription = this.i18n.translations$.subscribe(() => {
      this.confirmDialog.setDefaultLabels({
        confirm: this.i18n.getValue('shared.confirm'),
        cancel: this.i18n.getValue('shared.cancel'),
      });
      this.cdr.markForCheck();
    });

    this.routerSubscription = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(event => {
        this.syncModuleFromUrl(event.urlAfterRedirects);
        this.scrollContentToTop(event.urlAfterRedirects);
      });
  }

  /**
   * @description Initializes layout state from LocalStorage and sets up authentication observation.
   * @note Automatically adjusts sidebar visibility based on viewport width.
   */
  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      const savedWidth = localStorage.getItem('admin_sidebar_width');
      if (savedWidth) this.sidebarWidth = parseInt(savedWidth, 10);

      // Default value from localStorage until the router confirms the real current URL for
      // the first time (see syncModuleFromUrl() below) - prevents a short flash of a wrongly
      // highlighted module on the first render.
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
    this.collapsedGroups = this.readCollapsedGroups();

    // Immediate sync with the REAL current URL - covers the first render
    // (NavigationEnd from the constructor may have fired before this component
    // existed, typically on a hard refresh of a specific page).
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

    this.avatarSubscription = this.authService.avatarUrl$.subscribe(url => {
      this.avatarUrl = url;
      this.cdr.markForCheck();
    });
  }

  /**
   * @description Scrolls the page area to the top when a different page opens (a change of only
   *   the query, e.g. a filter or a page number, keeps the position).
   * @param url Router URL after the navigation.
   */
  private scrollContentToTop(url: string): void {
    const path = url.split(/[?#]/)[0];
    if (path === this.lastPath) return;
    this.lastPath = path;
    this.contentRef?.nativeElement.scrollTo?.({ top: 0, left: 0 });
  }

  // ══════════════════════════════════════════════════════════════════════
  // COLLAPSIBLE MENU SECTIONS
  // ══════════════════════════════════════════════════════════════════════

  /**
   * @description Whether the items of a menu section are shown.
   * @param key Section key (e.g. 'web-content').
   */
  isGroupExpanded(key: string): boolean {
    return !this.collapsedGroups.has(key);
  }

  /**
   * @description Collapses / expands a section and remembers the choice.
   * @param key Section key.
   */
  toggleGroup(key: string): void {
    if (this.collapsedGroups.has(key)) {
      this.collapsedGroups.delete(key);
    } else {
      this.collapsedGroups.add(key);
    }
    this.saveCollapsedGroups();
    this.cdr.markForCheck();
  }

  /**
   * @description The section of the open page is always expanded: opening a page of a collapsed
   *   section (link, bookmark, module switch) expands it again.
   * @param key Section key.
   * @param active Whether a link of the section matches the current URL (RouterLinkActive).
   */
  onGroupActive(key: string, active: boolean): void {
    if (active && this.collapsedGroups.delete(key)) {
      this.saveCollapsedGroups();
      this.cdr.markForCheck();
    }
  }

  /**
   * @description Collapsed sections stored in this browser; an empty set when there are none or
   *   the storage is not available / holds something else.
   */
  private readCollapsedGroups(): Set<string> {
    try {
      const stored = JSON.parse(localStorage.getItem(NAV_COLLAPSED_STORAGE_KEY) ?? '[]');
      return new Set(Array.isArray(stored) ? stored.filter((k): k is string => typeof k === 'string') : []);
    } catch {
      return new Set();
    }
  }

  /** @description Stores the collapsed sections (silently skipped without a storage). */
  private saveCollapsedGroups(): void {
    try {
      localStorage.setItem(NAV_COLLAPSED_STORAGE_KEY, JSON.stringify([...this.collapsedGroups]));
    } catch {
      // Private mode / blocked storage - the choice lasts until the page is reloaded.
    }
  }

  /**
   * @description Derives `currentModule` from the first path segment after `/admin/`
   * (`/admin/core/welcome-page` -> `'core'`). An unknown / missing segment (e.g. `/admin`
   * itself, or paths outside web/core/shop) leaves `currentModule` unchanged - no point
   * clearing the last valid choice because of a transient / unmatched URL.
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
   * @description Reacts ONLY to crossing the 768px boundary (mobile / desktop). Never changes
   * `isMenuOpen` while the viewport stays in the same category, so ordinary smooth resizing of
   * the window never opens or closes a panel by itself.
   */
  @HostListener('window:resize')
  onWindowResize(): void {
    if (typeof window === 'undefined') return;

    const nowMobile = window.innerWidth <= 768;
    if (nowMobile === this.isMobileViewport) return;

    this.isMobileViewport = nowMobile;

    if (nowMobile) {
      // Switching TO mobile - ALWAYS close the panel, whatever the previous desktop state.
      this.isMenuOpen = false;
      this.isMobileActionsOpen = false;
    } else {
      // Back TO desktop - restore the stored desktop preference, not the transient
      // value of the mobile mode.
      const savedState = localStorage.getItem('admin_menu_open');
      this.isMenuOpen = savedState !== null ? savedState === 'true' : true;
    }

    this.updateScrollLock();
    this.cdr.markForCheck();
  }

  /**
   * @description Opens a module: navigates to the first page of it the user may open (welcome page
   *   first, then the sidebar order - see ADMIN_MODULE_PAGES).
   * @param module The target module.
   */
  switchModule(module: AdminModule): void {
    const page = this.firstAccessiblePage(module);
    if (!page) return;
    this.router.navigate([`/admin/${module}/${page.path}`]);
  }

  /**
   * @description Whether the header shows the tab of a module: the tab permission (`view-web` /
   *   `view-core` / `view-eshop`) AND at least one page of the module the user may open - so a
   *   tab never opens an empty sidebar or an "Access denied" message. Sysadmin: always.
   * @param module Module of the tab.
   */
  isModuleAvailable(module: AdminModule): boolean {
    if (this.userRole === SYSADMIN_ROLE_NAME) return true;
    return this.permissionService.hasPermission(ADMIN_MODULE_TAB_PERMISSION[module])
      && this.firstAccessiblePage(module) !== null;
  }

  /**
   * @description First page of a module the user may open (same rule as the AuthGuard: sysadmin
   *   opens everything, a role-only page needs the sysadmin role, a page without a permission is
   *   open to everybody, otherwise one of the keys).
   * @param module Module.
   * @returns The page, or null when there is none.
   */
  private firstAccessiblePage(module: AdminModule): AdminNavPage | null {
    const isSysadmin = this.userRole === SYSADMIN_ROLE_NAME;
    return ADMIN_MODULE_PAGES[module].find(page =>
      isSysadmin || (!page.sysadminOnly && (page.permission === null || this.hasAnyPermission([page.permission])))
    ) ?? null;
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
   * @description Opens / closes the mobile panel with the user information and actions
   *              (hamburger top right, visible only on mobile through the CSS media query).
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
  // VISIBILITY OF THE LEFT MENU SECTIONS (nav-group)
  // ══════════════════════════════════════════════════════════════════════

  /**
   * @description Checks whether the current user has AT LEAST ONE of the given permissions.
   *      Hides a whole menu section (nav-group) when none of its items would stay visible after
   *      *appHasPermission - the directive cannot "hide the parent when all children vanish",
   *      so the section visibility is computed here and applied with *ngIf on .nav-group.
   * @param keys Permission keys of the items of the section. Each element may itself contain
   *      the OR syntax ('core-legal-documents-view|core-legal-config-view') like
   *      *appHasPermission - see has-permission.directive.ts.
   * @returns true when the user satisfies at least one of the keys (or at least one side of an
   *      OR group).
   */
  hasAnyPermission(keys: string[]): boolean {
    return keys.some(key =>
      key.split('|').some(single => this.permissionService.hasPermission(single.trim()))
    );
  }

  // ── Web modul ────────────────────────────────────────────────────────

  /** Group of the web welcome page (its own key - before 2026-10-27 it hid behind the dashboard key). */
  get showWebWelcomeGroup(): boolean {
    return this.hasAnyPermission(['web-welcome-page-view']);
  }

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

  get showCoreSystemGroup(): boolean {
    return this.hasAnyPermission(['view-core']);
  }

  // ── Shop modul ───────────────────────────────────────────────────────

  /** Group of the shop welcome page (its own key - before 2026-10-27 it hid behind the dashboard key). */
  get showShopWelcomeGroup(): boolean {
    return this.hasAnyPermission(['shop-welcome-page-view']);
  }

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
    this.avatarSubscription?.unsubscribe();
    this.routerSubscription?.unsubscribe();
    this.i18nSubscription?.unsubscribe();
    this.confirmDialog.setDefaultLabels(null);  // leaving the admin: no admin labels on the public web

    // Release the background scroll lock if this component still holds it
    // (e.g. logout / leaving /admin while a mobile panel is open).
    if (this.scrollLocked) {
      this.scrollLock.unlock();
      this.scrollLocked = false;
    }
  }
}