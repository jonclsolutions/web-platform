/**
 * @file admin-layout.component.ts
 * @path src/app/admin/components/admin-layout/admin-layout.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Main shell component for the administrative panel: the header with ONE module
 *   switcher (core + applications in one menu, the button always names the module the user is
 *   in), the sidebar built from the navigation data of the module (CORE_NAV / the manifest of the
 *   application) with My account, the manual ("Nápověda") and sign-out at its bottom, the
 *   account panel (opened by the own account in the header, on a phone by the avatar) and global
 *   UI state. The header has no language switcher and no calendar button (2026-11): the language
 *   is set once in the account panel or My account > Preferences.
 * @dependencies
 * - AuthService: Manages user authentication and session status.
 * - PermissionService: Validates access to specific administrative modules.
 * - LoadingService: Observes global loading states for the UI.
 * - AdminLocalizationService: Static i18n of the admin UI + the language of the administration
 *   (the account panel; kept in this browser).
 * - ScrollLockService: Shared background scroll lock (mobile overlay panels).
 * - UserAvatarComponent: own profile photo in the header.
 * - AdminModulesService: which modules and pages the user may open; admin-navigation.config +
 *   apps.registry: the sidebars and the applications; AdminIconComponent: icons of the menus.
 * - ReleaseNoticeComponent: the notice after an update of the current module (the running
 *   version and the release notes are on the page Core → Releases).
 * - AdminNotificationsService + NavBadgeComponent: unread records - red numbers at the menu
 *   items, the sections and the module switcher; things needing attention (texts missing in a
 *   language …) - an orange dot at the same places; the label names what is behind them
 *   (started while a user is signed in).
 * @note Mobile header (2026-11): menu button (pages of the module) - module switcher in the
 *   middle - own avatar (account panel: account, personal info, calendar, language, sign-out).
 * @note Layout: the header and the sidebar stay in place, only the page content (`<main>`) and,
 * independently, a long sidebar menu scroll. A navigation therefore scrolls `<main>` back to the
 * top itself - the router's scroll restoration only moves the window.
 */

import { Component, OnInit, OnDestroy, ChangeDetectorRef, ElementRef, HostListener, LOCALE_ID, ViewChild, inject } from '@angular/core';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { Subscription, interval, Observable, filter } from 'rxjs';
import { distinctUntilChanged, map, startWith } from 'rxjs/operators';
import { AuthService } from '../../../core/auth/auth.service';
import { PermissionService } from '../../../core/auth/services/permission.service';
import { LoadingService } from '../../../core/services/loading.service';
import { AdminLocalizationService, AdminLanguageMeta } from '../../../core/services/admin-localization.service';
import { ScrollLockService } from '../../../core/services/scroll-lock.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { ACCOUNT_PAGES, AdminModule, AdminNavGroup, AdminNavItem, CORE_MODULE, adminModules, navOf } from '../../admin-navigation.config';
import { AdminModulesService } from '../../admin-modules.service';
import { AppManifest, appById } from '../../../apps/apps.registry';
import { AdminIconComponent, AdminIconName } from '../admin-icon/admin-icon.component';
import { UserAvatarComponent } from '../user-avatar/user-avatar.component';
import { KNOWLEDGE_BASE_URL } from '../page-help/page-help.component';
import { ReleaseNoticeComponent } from '../releases/release-notice.component';
import { AdminNotificationsService, NavBadge } from '../../../core/services/admin-notifications.service';
import { NavBadgeComponent } from '../nav-badge/nav-badge.component';

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
  imports: [CommonModule, RouterModule, DatePipe, UserAvatarComponent, AdminIconComponent, ReleaseNoticeComponent, NavBadgeComponent],
  providers: [
    { provide: LOCALE_ID, useValue: 'cs-CZ' }
  ]
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
  userEmail: string | null = null;
  /** Display name of the own account (null = none set). */
  userName: string | null = null;
  /** Signed URL of the own profile photo (null = the default image). */
  avatarUrl: string | null = null;
  userRole: string | null = null;
  isLoggedIn: boolean = false;

  /** Module the user is in: 'core' or the id of an application (first URL segment after /admin/). */
  currentModule: AdminModule = CORE_MODULE;

  /** Dropdown of the application switcher in the header is open. */
  isAppsMenuOpen = false;

  isLoadingGlobal$: Observable<boolean>;

  /**
   * Clock of the header: hours and minutes (no seconds, 2026-11) - checked every second, but
   * emitted only when the minute changes, so the header re-renders once a minute.
   */
  currentDate$: Observable<Date> = interval(1000).pipe(
    startWith(0),
    map(() => new Date()),
    distinctUntilChanged((a, b) => Math.floor(a.getTime() / 60000) === Math.floor(b.getTime() / 60000))
  );

  /** Name shown on the own account button: the name, the e-mail when the account has none. */
  get displayName(): string | null {
    return this.userName || this.userEmail;
  }

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
  /** Button of the module switcher - gets the focus back when its menu closes by keyboard. */
  @ViewChild('switcherBtn') private switcherBtnRef?: ElementRef<HTMLButtonElement>;
  /** Open menu of the module switcher (keyboard navigation of its items). */
  @ViewChild('appsMenu') private appsMenuRef?: ElementRef<HTMLElement>;

  /** Path of the last navigation (without query / fragment) - only a new page scrolls to the top. */
  private lastPath: string | null = null;

  /**
   * Account panel - opened by the own account in the header (desktop) or the avatar on the right
   * (mobile): my account, calendar, language of the administration, sign-out.
   */
  isAccountPanelOpen: boolean = false;
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

  /** Unread records of the signed-in admin (numbers in the menus). */
  readonly notifications = inject(AdminNotificationsService);

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

  // ── Language of the administration (the account panel; kept in this browser) ──────────────
  readonly languages: AdminLanguageMeta[] = this.i18n.availableLanguages;

  /** Code of the language the administration is shown in. */
  get currentLanguageCode(): string {
    return this.i18n.getCurrentLanguage();
  }

  /**
   * @description Switches the language of the administration (stored in this browser); the
   *   account panel stays open, so the choice is visible at once.
   * @param code Language code.
   */
  selectLanguage(code: string): void {
    this.i18n.setLanguage(code);
  }

  public get dateLocale(): string {
    return this.i18n.getDateLocale();
  }

  /** Pages of the own account at the bottom of the sidebar (My account) - in the core. */
  readonly accountPages = ACCOUNT_PAGES;
  readonly coreModule = CORE_MODULE;

  /** "Help" of the header: home of the knowledge base (the help of one page is in its header). */
  readonly knowledgeBaseUrl = KNOWLEDGE_BASE_URL;

  /**
   * Narrowest width of the opened sidebar: the longest word of a page name ("Bezpečnostní")
   * still fits whole next to its icon - names wrap between words, never inside one (2026-11).
   */
  private minWidth: number = 180;
  private maxWidth: number = 500;
  private authSubscription: Subscription | undefined;
  private userEmailSubscription: Subscription | undefined;
  private avatarSubscription: Subscription | undefined;
  private userNameSubscription: Subscription | undefined;
  private routerSubscription: Subscription | undefined;
  /** Re-render on admin language change. */
  private i18nSubscription: Subscription | undefined;

  constructor(
    private router: Router,
    private authService: AuthService,
    private permissionService: PermissionService,
    private cdr: ChangeDetectorRef,
    private loadingService: LoadingService,
    private modules: AdminModulesService
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
      // A width saved before the limits (or edited by hand) is clamped into them.
      const parsedWidth = savedWidth ? parseInt(savedWidth, 10) : NaN;
      if (Number.isFinite(parsedWidth)) this.sidebarWidth = Math.min(this.maxWidth, Math.max(this.minWidth, parsedWidth));

      // Default value from localStorage until the router confirms the real current URL for
      // the first time (see syncModuleFromUrl() below) - prevents a short flash of a wrongly
      // highlighted module on the first render.
      const savedState = localStorage.getItem('admin_menu_open');
      const savedModule = localStorage.getItem('admin_current_module');
      if (savedModule && adminModules().includes(savedModule)) this.currentModule = savedModule;

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
      if (loggedIn) this.notifications.start();
      else this.notifications.stop();
      this.cdr.markForCheck();
    });

    this.userEmailSubscription = this.authService.userEmail$.subscribe(email => {
      this.userEmail = email;
      this.cdr.markForCheck();
    });

    this.userNameSubscription = this.authService.userName$.subscribe(name => {
      this.userName = name;
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
   * (`/admin/core/welcome-page` -> `'core'`, `/admin/project-portal/projects` ->
   * `'project-portal'`). A segment that is no module (e.g. `/admin` itself, `/admin/forbidden`)
   * leaves `currentModule` unchanged - no point clearing the last valid choice because of a
   * transient / unmatched URL.
   */
  private syncModuleFromUrl(url: string): void {
    const match = url.match(/^\/admin\/([^/?#]+)/);
    if (!match || !adminModules().includes(match[1])) return;

    const module = match[1];
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
      this.isAccountPanelOpen = false;
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
   * @description Opens a module: navigates to the first page of it the user may open (sidebar
   *   order - the welcome page first where the module has one).
   * @param module 'core' or an application id.
   */
  switchModule(module: AdminModule): void {
    this.isAppsMenuOpen = false;
    const url = this.modules.landingUrl(module);
    if (url) this.router.navigate([url]);
  }

  /**
   * @description Whether the header offers a module (the core tab, an item of the application
   *   switcher) - see AdminModulesService.isAvailable().
   * @param module 'core' or an application id.
   */
  isModuleAvailable(module: AdminModule): boolean {
    return this.modules.isAvailable(module);
  }

  /** @description Applications of the switcher: the installed ones the user may open. */
  get availableApps(): AppManifest[] {
    return this.modules.availableApps();
  }

  /** @description Manifest of the application the user is in (undefined in the core). */
  get currentApp(): AppManifest | undefined {
    return appById(this.currentModule);
  }

  /**
   * @description Name of the module the user is in - shown in the header at all times (the
   *   switcher button, on mobile in the middle of the header).
   */
  get currentModuleName(): string {
    const app = this.currentApp;
    return app ? this.strings[app.nameKey] : this.strings.module_core;
  }

  /**
   * @description Modules of the switcher: the core (when the user may open a page of it) and the
   *   applications - more than one = a menu, one = only its name.
   */
  get switcherModules(): AdminModule[] {
    return [...(this.isModuleAvailable('core') ? ['core' as AdminModule] : []), ...this.availableApps.map(app => app.id as AdminModule)];
  }

  /** @description Icon of the module the user is in (the core: `layout`). */
  get currentModuleIcon(): AdminIconName {
    return this.currentApp?.icon ?? 'layout';
  }

  /** @description Badge of the switcher button - the numbers of all modules (each in its menu item). */
  get switcherBadge(): NavBadge | null {
    return this.notifications.navBadge(this.notifications.kinds());
  }

  /**
   * @description Opens / closes the menu of the module switcher; an opened menu moves the focus
   *   to the module the user is in (keyboard and screen readers continue in the menu).
   */
  toggleAppsMenu(): void {
    this.isAppsMenuOpen = !this.isAppsMenuOpen;
    if (this.isAppsMenuOpen) {
      setTimeout(() => this.focusMenuItem(items => Math.max(0, items.findIndex(item => item.classList.contains('active')))));
    }
  }

  /**
   * @description Closes the menu of the module switcher.
   * @param restoreFocus Return the focus to the switcher button (closed by keyboard).
   */
  closeAppsMenu(restoreFocus = false): void {
    this.isAppsMenuOpen = false;
    if (restoreFocus) {
      this.switcherBtnRef?.nativeElement.focus();
    }
  }

  /**
   * @description Keyboard on the closed switcher button: arrow down / up opens the menu.
   * @param event Key event.
   */
  onSwitcherKeydown(event: KeyboardEvent): void {
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !this.isAppsMenuOpen) {
      event.preventDefault();
      this.toggleAppsMenu();
    }
  }

  /**
   * @description Keyboard in the open menu (WAI-ARIA menu button): arrows move between the items
   *   (round), Home / End to the first / last, Escape closes and returns to the button, Tab closes.
   * @param event Key event.
   */
  onAppsMenuKeydown(event: KeyboardEvent): void {
    const moves: Record<string, (index: number, count: number) => number> = {
      ArrowDown: (i, n) => (i + 1) % n,
      ArrowUp: (i, n) => (i - 1 + n) % n,
      Home: () => 0,
      End: (_, n) => n - 1,
    };
    if (moves[event.key]) {
      event.preventDefault();
      this.focusMenuItem(items => moves[event.key](items.indexOf(document.activeElement as HTMLElement), items.length));
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.closeAppsMenu(true);
    } else if (event.key === 'Tab') {
      this.closeAppsMenu();
    }
  }

  /**
   * @description Focuses an item of the open switcher menu.
   * @param pick Index of the item to focus from the list of the items.
   */
  private focusMenuItem(pick: (items: HTMLElement[]) => number): void {
    const items = Array.from(this.appsMenuRef?.nativeElement.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    if (items.length) {
      items[pick(items)]?.focus();
    }
  }

  /** @description Sections of the sidebar of the current module. */
  get navGroups(): AdminNavGroup[] {
    return navOf(this.currentModule);
  }

  /** Up to this many pages (the user may open) the sidebar of a module is one flat list. */
  static readonly FLAT_NAV_MAX_ITEMS = 8;

  /**
   * @description A small module (for this user - counted by the permissions) has no section
   *   titles: one flat list of its pages in the order of the sections. Titles over one or two
   *   links only cost room; large modules keep their sections.
   */
  get isFlatNav(): boolean {
    let count = 0;
    for (const group of this.navGroups) {
      for (const item of group.items) {
        if (this.canOpen(item) && ++count > AdminLayoutComponent.FLAT_NAV_MAX_ITEMS) return false;
      }
    }
    return true;
  }

  /**
   * @description Whether a section of the sidebar is shown (at least one of its pages may be
   *   opened - *appHasPermission cannot hide the parent when all children vanish).
   * @param group The section.
   */
  isGroupVisible(group: AdminNavGroup): boolean {
    return this.modules.isGroupVisible(group);
  }

  /**
   * @description Whether a page of the sidebar is shown.
   * @param item The page.
   */
  canOpen(item: AdminNavItem): boolean {
    return this.modules.canOpen(item);
  }

  /**
   * @description Text of the admin-layout section (the labels of the sidebar).
   * @param key Key inside `admin-layout`.
   */
  label(key: string): string {
    return this.strings[key] ?? this.i18n.getValue(`admin-layout.${key}`);
  }

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
    if (window.innerWidth > 768) {
      localStorage.setItem('admin_menu_open', this.isMenuOpen.toString());
    }
    this.updateScrollLock();
    this.cdr.markForCheck();
  }

  /**
   * @description Click on a page of the sidebar: its unread records are seen (also when the page
   *   is already open), then the common link handling.
   * @param item The page.
   */
  onNavClick(item: AdminNavItem): void {
    this.notifications.markSeenLink(this.itemLink(item));
    this.onLinkClick();
  }

  /**
   * @description Address of a page of the sidebar of the current module.
   * @param item The page.
   */
  itemLink(item: AdminNavItem): string {
    return '/admin/' + this.currentModule + '/' + item.path;
  }

  /**
   * @description Badge of a page of the sidebar - red unread records, or orange things needing
   *   attention ("99+" above 99, null without any).
   * @param item The page.
   */
  itemBadge(item: AdminNavItem): NavBadge | null {
    return this.notifications.badgeFor(this.itemLink(item));
  }

  /**
   * @description Badge of a collapsed menu section - its pages the user may open.
   * @param group The section.
   */
  groupBadge(group: AdminNavGroup): NavBadge | null {
    return this.notifications.badgeForLinks(group.items.filter(item => this.canOpen(item)).map(item => this.itemLink(item)));
  }

  /**
   * @description Badge of a module in the switcher.
   * @param module 'core' or an application id.
   */
  moduleBadge(module: AdminModule): NavBadge | null {
    return this.notifications.moduleBadge(module);
  }

  /**
   * @description Dot on the menu button while it is closed (mobile): the current module has
   *   numbers - null without any; red with unread records, orange when only something needs
   *   attention. (The other modules show theirs on the module switcher in the header.)
   */
  get moduleDot(): NavBadge | null {
    return this.notifications.moduleBadge(this.currentModule);
  }

  onLinkClick(): void {
    if (window.innerWidth <= 768) {
      this.isMenuOpen = false;
    }
    this.updateScrollLock();
  }

  /**
   * @description Opens / closes the mobile account panel (the own avatar top right, visible
   *              only on mobile through the CSS media query).
   */
  /** @description Opens / closes the account panel. */
  toggleAccountPanel(): void {
    this.isAccountPanelOpen = !this.isAccountPanelOpen;
    this.updateScrollLock();
    this.cdr.markForCheck();
  }

  /** @description Closes the account panel. */
  closeAccountPanel(): void {
    this.isAccountPanelOpen = false;
    this.updateScrollLock();
    this.cdr.markForCheck();
  }

  /** @description Escape closes the open account panel. */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isAccountPanelOpen) this.closeAccountPanel();
  }

  /**
   * @description Single place that decides whether the page behind the layout may
   * scroll. Locks only on mobile (<= 768px) while the sidebar or the account
   * panel is open (both are modal overlays there); on desktop the sidebar is part of
   * the layout, so the page scrolls normally. The `scrollLocked` flag makes every
   * call idempotent - lock()/unlock() on ScrollLockService are always paired.
   */
  private updateScrollLock(): void {
    const shouldLock = this.isMobileViewport && (this.isMenuOpen || this.isAccountPanelOpen);

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
    this.notifications.stop();
    this.authService.logout().subscribe({
      next: () => {
        this.permissionService.clearPermissions();
        this.router.navigate(['/auth/login']);
      },
      error: () => this.router.navigate(['/auth/login'])
    });
  }

  ngOnDestroy(): void {
    this.notifications.stop();
    this.authSubscription?.unsubscribe();
    this.userEmailSubscription?.unsubscribe();
    this.avatarSubscription?.unsubscribe();
    this.userNameSubscription?.unsubscribe();
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