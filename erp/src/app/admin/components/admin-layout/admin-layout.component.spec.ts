/**
 * @file admin-layout.component.spec.ts
 * @path src/app/admin/components/admin-layout/admin-layout.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of AdminLayoutComponent – the admin shell: module switch (web / core /
 *   shop) incl. sync from the URL, sidebar open/resize state in localStorage, mobile scroll lock,
 *   admin language switch, logout, which menu groups the permissions show, collapsible menu
 *   sections, the own profile photo in the header, the scroll reset of the content area and the
 *   "Help" link to the knowledge base.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (auth, permission, i18n stubs), ScrollLockService (spy)
 */

import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { throwError } from 'rxjs';

import { AdminLayoutComponent, NAV_COLLAPSED_STORAGE_KEY } from './admin-layout.component';
import { ScrollLockService } from '../../../core/services/scroll-lock.service';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('AdminLayoutComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<AdminLayoutComponent>;
  let component: AdminLayoutComponent;
  let router: Router;
  let scrollLock: jasmine.SpyObj<ScrollLockService>;
  const KEYS = ['admin_sidebar_width', 'admin_menu_open', 'admin_current_module', NAV_COLLAPSED_STORAGE_KEY];

  beforeEach(async () => {
    KEYS.forEach(k => localStorage.removeItem(k));
    ctx = createAdminTestContext({ granted: [] });
    scrollLock = jasmine.createSpyObj<ScrollLockService>('ScrollLockService', ['lock', 'unlock']);
    await TestBed.configureTestingModule({
      imports: [AdminLayoutComponent],
      providers: [...ctx.providers, { provide: ScrollLockService, useValue: scrollLock }]
    }).compileComponents();
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
    fixture = TestBed.createComponent(AdminLayoutComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => KEYS.forEach(k => localStorage.removeItem(k)));

  /**
   * @description On init the layout reads the login state, role and e-mail of the session.
   * @input  logged in as 'admin@example.test' with role 'admin'; ngOnInit()
   * @output isLoggedIn true, userRole 'admin', userEmail 'admin@example.test'
   */
  it('shows the logged-in user', () => {
    component.ngOnInit();
    expect(component.isLoggedIn).toBeTrue();
    expect(component.userRole).toBe('admin');
    expect(component.userEmail).toBe('admin@example.test');
  });

  /**
   * @description Sidebar width, open state and module are restored from localStorage (desktop).
   * @input  localStorage width '320', menu 'false', module 'shop'; ngOnInit() on a wide window
   * @output sidebarWidth 320; isMenuOpen false; currentModule 'shop'
   */
  it('restores the sidebar state from localStorage', () => {
    localStorage.setItem('admin_sidebar_width', '320');
    localStorage.setItem('admin_menu_open', 'false');
    localStorage.setItem('admin_current_module', 'shop');
    component.ngOnInit();
    expect(component.sidebarWidth).toBe(320);
    if (window.innerWidth > 768) expect(component.isMenuOpen).toBeFalse();
    expect(component.currentModule).toBe('shop');
  });

  /**
   * @description A module tab opens the first page of the module the user may open (welcome page
   *   first); the active tab is NOT changed by the click - only by the URL the router really
   *   reaches (bugfix 2026-10-27: a refused navigation left the wrong tab active).
   * @input  granted core-view-welcome-page: switchModule('core'); granted only shop-orders-view:
   *         switchModule('shop'); no web page: switchModule('web').
   * @output navigate(['/admin/core/welcome-page']); navigate(['/admin/shop/orders']); no navigation
   *         for web; currentModule stays 'web' (default) and nothing stored until NavigationEnd.
   */
  it('switchModule() opens the first page the user may open', () => {
    ctx.permissions.granted = new Set(['core-view-welcome-page']);
    component.switchModule('core');
    expect(router.navigate).toHaveBeenCalledWith(['/admin/core/welcome-page']);

    ctx.permissions.granted = new Set(['shop-orders-view']);
    component.switchModule('shop');
    expect(router.navigate).toHaveBeenCalledWith(['/admin/shop/orders']);

    (router.navigate as jasmine.Spy).calls.reset();
    component.switchModule('web');
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.currentModule).toBe('web');
    expect(localStorage.getItem('admin_current_module')).toBeNull();
  });

  /**
   * @description A module tab is shown only with its tab permission AND at least one page of the
   *   module (bugfix 2026-10-27: `view-web` alone showed Web with every web permission removed);
   *   a role-only page (edit roles) counts for the sysadmin only; the sysadmin sees every tab.
   * @input  view-web alone; view-web + web-news-view; web-news-view without view-web;
   *         view-core + nothing else; view-core role admin vs sysadmin for edit-roles only;
   *         view-eshop + shop-coupons-view; sysadmin without any permission.
   * @output false; true; false; core true (view-core opens the core dashboard); shop true;
   *         sysadmin: every tab true; the rendered header shows exactly the available tabs.
   */
  it('shows a module tab only when the module has a page for the user', () => {
    ctx.permissions.granted = new Set(['view-web']);
    expect(component.isModuleAvailable('web')).toBeFalse();
    ctx.permissions.granted = new Set(['view-web', 'web-news-view']);
    expect(component.isModuleAvailable('web')).toBeTrue();
    ctx.permissions.granted = new Set(['web-news-view']);
    expect(component.isModuleAvailable('web')).toBeFalse();

    ctx.permissions.granted = new Set(['view-core']);
    expect(component.isModuleAvailable('core')).toBeTrue();
    ctx.permissions.granted = new Set(['view-eshop', 'shop-coupons-view']);
    expect(component.isModuleAvailable('shop')).toBeTrue();
    expect(component.isModuleAvailable('core')).toBeFalse();

    ctx.permissions.granted = new Set(['view-core', 'view-web']);
    component.userRole = 'admin';
    expect(component.isModuleAvailable('web')).toBeFalse();

    ctx.permissions.granted = new Set([]);
    component.userRole = 'sysadmin';
    expect(['web', 'core', 'shop'].map(m => component.isModuleAvailable(m as any))).toEqual([true, true, true]);
    component.switchModule('core');
    expect(router.navigate).toHaveBeenCalledWith(['/admin/core/welcome-page']);
  });

  /**
   * @description The rendered header shows only the available tabs (desktop switcher).
   * @input  granted view-web, view-core, view-eshop, core-view-welcome-page, shop-orders-view; render.
   * @output buttons of Core and E-shop only (no Web - no web page).
   */
  it('renders only the available module tabs', () => {
    ctx.permissions.granted = new Set(['view-web', 'view-core', 'view-eshop', 'core-view-welcome-page', 'shop-orders-view']);
    fixture.detectChanges();
    const tabs = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.module-switcher button'))
      .map(b => b.textContent!.trim());
    expect(tabs.length).toBe(2);
    expect(tabs.some(t => t.includes('module_web'))).toBeFalse();
  });

  /**
   * @description Opening an /admin/<module>/… URL directly selects that module.
   * @input  router.url '/admin/shop/orders?page=2'
   * @output currentModule 'shop'; stored in localStorage
   */
  it('syncs the module from the URL', () => {
    spyOnProperty(router, 'url', 'get').and.returnValue('/admin/shop/orders?page=2');
    component.ngOnInit();
    expect(component.currentModule).toBe('shop');
    expect(localStorage.getItem('admin_current_module')).toBe('shop');
  });

  /**
   * @description URLs outside /admin/<module> do not change the module.
   * @input  router.url '/auth/login'
   * @output currentModule stays 'web'
   */
  it('ignores URLs without a module', () => {
    spyOnProperty(router, 'url', 'get').and.returnValue('/auth/login');
    component.ngOnInit();
    expect(component.currentModule).toBe('web');
  });

  /**
   * @description Sidebar resizing works only inside 150–500 px and is saved on mouse up.
   * @input  startResizing; mousemove x=100, x=300, x=900; mouseup
   * @output sidebarWidth 300 (100 and 900 ignored); localStorage width '300'
   */
  it('resizes the sidebar within limits', () => {
    if (window.innerWidth <= 768) { pending('needs a desktop-sized window'); }
    component.startResizing({ preventDefault: () => {} } as any);
    component.onMouseMove({ clientX: 100 } as any);
    component.onMouseMove({ clientX: 300 } as any);
    component.onMouseMove({ clientX: 900 } as any);
    component.onMouseUp();
    expect(component.sidebarWidth).toBe(300);
    expect(localStorage.getItem('admin_sidebar_width')).toBe('300');
    expect(component.isResizing).toBeFalse();
  });

  /**
   * @description On desktop the menu toggle is remembered, the page scroll is never locked.
   * @input  wide window; toggleMenu()
   * @output isMenuOpen flipped; localStorage menu saved; scrollLock.lock() not called
   */
  it('toggleMenu() remembers the state on desktop', () => {
    if (window.innerWidth <= 768) { pending('needs a desktop-sized window'); }
    component.ngOnInit();
    const before = component.isMenuOpen;
    component.toggleMenu();
    expect(component.isMenuOpen).toBe(!before);
    expect(localStorage.getItem('admin_menu_open')).toBe(String(!before));
    expect(scrollLock.lock).not.toHaveBeenCalled();
  });

  /**
   * @description On mobile an open menu or action panel locks the page scroll; closing unlocks.
   * @input  mobile viewport; toggleMobileActions(); closeMobileActions()
   * @output scrollLock.lock() once, then unlock() once
   */
  it('locks scrolling for the mobile menu', () => {
    (component as any).isMobileViewport = true;
    component.isMenuOpen = false;
    component.toggleMobileActions();
    expect(scrollLock.lock).toHaveBeenCalledTimes(1);
    component.closeMobileActions();
    expect(scrollLock.unlock).toHaveBeenCalledTimes(1);
  });

  /**
   * @description A still-held scroll lock is released when the layout is destroyed.
   * @input  mobile actions open (locked); ngOnDestroy()
   * @output scrollLock.unlock() called
   */
  it('releases the scroll lock on destroy', () => {
    (component as any).isMobileViewport = true;
    component.isMenuOpen = false;
    component.toggleMobileActions();
    component.ngOnDestroy();
    expect(scrollLock.unlock).toHaveBeenCalled();
  });

  /**
   * @description While the admin is shown, the confirmation dialog buttons follow the admin
   *   language; leaving the admin clears them (finding #20).
   * @input  layout created (translations emitted); language change; ngOnDestroy()
   * @output setDefaultLabels({ confirm: 'shared.confirm', cancel: 'shared.cancel' }) on create and on
   *   every language change; setDefaultLabels(null) on destroy
   */
  it('sets the admin labels of the confirmation dialog', () => {
    expect(ctx.confirm.setDefaultLabels).toHaveBeenCalledWith({ confirm: 'shared.confirm', cancel: 'shared.cancel' });
    const calls = ctx.confirm.setDefaultLabels.calls.count();
    ctx.i18n.translations$.next({});
    expect(ctx.confirm.setDefaultLabels.calls.count()).toBe(calls + 1);
    component.ngOnDestroy();
    expect(ctx.confirm.setDefaultLabels).toHaveBeenCalledWith(null);
  });

  /**
   * @description The language menu switches the admin language and closes.
   * @input  toggleLangMenu(); selectLanguage('en')
   * @output i18n.setLanguage('en'); isLangMenuOpen false; currentLanguageCode 'en'; currentLanguageMeta.code 'en'
   */
  it('switches the admin language', () => {
    component.toggleLangMenu();
    expect(component.isLangMenuOpen).toBeTrue();
    component.selectLanguage('en');
    expect(ctx.i18n.setLanguage).toHaveBeenCalledWith('en');
    expect(component.isLangMenuOpen).toBeFalse();
    expect(component.currentLanguageCode).toBe('en');
    expect(component.currentLanguageMeta?.code).toBe('en');
    expect(component.dateLocale).toBe('en-US');
  });

  /**
   * @description Logout clears permissions and goes to the login page; on error it still goes there.
   * @input  logout() succeeding, then logout() failing
   * @output clearPermissions() once; navigate(['/auth/login']) twice
   */
  it('logout() clears permissions and redirects', () => {
    component.logout();
    ctx.auth.logout.and.returnValue(throwError(() => new Error('x')));
    component.logout();
    expect(ctx.permissions.clearPermissions).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledTimes(2);
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
  });

  /**
   * @description Menu groups follow the permissions ("a|b" = any of them).
   * @input  granted ['web-news-view', 'shop-orders-view', 'core-legal-config-view']
   * @output web content, shop transactions, core legal groups visible; web business, shop catalog hidden
   */
  it('shows menu groups by permission', () => {
    ctx.permissions.granted = new Set(['web-news-view', 'shop-orders-view', 'core-legal-config-view']);
    expect(component.showWebContentGroup).toBeTrue();
    expect(component.showShopTransactionsGroup).toBeTrue();
    expect(component.showCoreLegalGroup).toBeTrue();
    expect(component.showWebBusinessGroup).toBeFalse();
    expect(component.showShopCatalogGroup).toBeFalse();
  });

  /**
   * @description The own personal info page (password, 2FA) is open to every signed-in user
   *   (VT-13): the header e-mail links to it (desktop and mobile panel), the sidebar item needs no
   *   permission, and as a page without a permission it counts as accessible for every role.
   * @input  logged in as admin without any permission; render with the mobile panel open; click the mobile link.
   * @output header + mobile links to /admin/core/personal-info with the e-mail; sidebar link
   *   present; firstAccessiblePage('core') = personal-info; the mobile panel closes.
   */
  it('opens the own personal info page for every user', () => {
    ctx.permissions.granted = new Set([]);
    component.ngOnInit();
    component.currentModule = 'core';
    component.isMobileActionsOpen = true;
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const links = Array.from(el.querySelectorAll('a.header-user-link')) as HTMLAnchorElement[];
    expect(links.length).toBe(2);
    links.forEach(a => {
      expect(a.getAttribute('href')).toBe('/admin/core/personal-info');
      expect(a.textContent!.trim()).toBe('admin@example.test');
    });
    expect(el.querySelector('.admin-nav a[href="/admin/core/personal-info"]')).not.toBeNull();
    expect((component as any).firstAccessiblePage('core').path).toBe('personal-info');

    const close = spyOn(component, 'closeMobileActions');
    links[1].click();
    expect(close).toHaveBeenCalled();
  });

  /**
   * @description After logout the role is cleared.
   * @input  isLoggedIn$ emits false
   * @output isLoggedIn false; userRole null
   */
  it('clears the role when logged out', () => {
    component.ngOnInit();
    ctx.auth.isLoggedIn$.next(false);
    expect(component.isLoggedIn).toBeFalse();
    expect(component.userRole).toBeNull();
  });

  /**
   * @description The layout renders without errors (shell, router outlet).
   * @input  detectChanges()
   * @output router-outlet present
   */
  it('renders the shell', fakeAsync(() => {
    fixture.detectChanges();
    tick(1000);
    expect(fixture.nativeElement.querySelector('router-outlet')).not.toBeNull();
    fixture.destroy();
  }));
  /**
   * @description Viewport changes: starting on mobile closes the menu; growing restores the
   *   saved state, shrinking closes menu + actions; the same size does nothing.
   * @input width 500 + init; resize to 1200 (saved 'false'); resize 1200 again; resize to 500.
   * @output closed + mobile; isMenuOpen false (saved); unchanged; closed, actions closed, scroll unlocked.
   */
  it('adapts the menu to viewport changes', () => {
    const width = spyOnProperty(window, 'innerWidth', 'get').and.returnValue(500);
    localStorage.setItem('admin_menu_open', 'true');
    component.ngOnInit();
    expect([component.isMenuOpen, (component as any).isMobileViewport]).toEqual([false, true]);

    component.toggleMobileActions();
    expect(component.isMobileActionsOpen).toBeTrue();
    expect(scrollLock.lock).toHaveBeenCalledTimes(1);
    component.closeMobileActions();
    expect(scrollLock.unlock).toHaveBeenCalledTimes(1);

    localStorage.setItem('admin_menu_open', 'false');
    width.and.returnValue(1200);
    component.onWindowResize();
    expect([(component as any).isMobileViewport, component.isMenuOpen]).toEqual([false, false]);
    localStorage.removeItem('admin_menu_open');
    component.onWindowResize();
    expect(component.isMenuOpen).toBeFalse();

    width.and.returnValue(500);
    component.toggleMobileActions();
    component.onWindowResize();
    expect([(component as any).isMobileViewport, component.isMenuOpen, component.isMobileActionsOpen]).toEqual([true, false, false]);
    width.and.returnValue(1200);
    component.onWindowResize();
    expect(component.isMenuOpen).toBeTrue();
  });

  /**
   * @description Mobile: a menu link closes the menu, resizing by drag is disabled; desktop:
   *   links keep the menu open.
   * @input width 500: menu open + onLinkClick; startResizing. width 1200: onLinkClick.
   * @output menu closed, no resizing (preventDefault not called); desktop menu stays open.
   */
  it('handles links and resizing on mobile', () => {
    const width = spyOnProperty(window, 'innerWidth', 'get').and.returnValue(500);
    component.ngOnInit();
    component.toggleMenu();
    expect(component.isMenuOpen).toBeTrue();
    component.onLinkClick();
    expect(component.isMenuOpen).toBeFalse();
    const event = jasmine.createSpyObj<MouseEvent>('MouseEvent', ['preventDefault']);
    component.startResizing(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
    component.onMouseMove({ clientX: 300 } as MouseEvent);
    component.onMouseUp();
    expect(localStorage.getItem('admin_sidebar_width')).toBeNull();

    width.and.returnValue(1200);
    component.isMenuOpen = true;
    component.onLinkClick();
    expect(component.isMenuOpen).toBeTrue();
  });

  /**
   * @description Navigation events switch the module; language menu toggles; metadata of the
   *   current language; failed logout still goes to the login page.
   * @input NavigationEnd to /admin/shop/orders; toggle / close lang menu; logout() error.
   * @output module 'shop' stored; open → closed; meta code cz, dateLocale cs-CZ; navigate login, permissions kept.
   */
  it('follows navigation, the language menu and a failed logout', async () => {
    component.ngOnInit();
    router.resetConfig([{ path: '**', component: AdminLayoutComponent }]);
    await router.navigateByUrl('/admin/shop/orders');
    expect(component.currentModule).toBe('shop');
    expect(localStorage.getItem('admin_current_module')).toBe('shop');

    component.toggleLangMenu();
    expect(component.isLangMenuOpen).toBeTrue();
    component.closeLangMenu();
    expect(component.isLangMenuOpen).toBeFalse();
    expect(component.currentLanguageMeta?.code).toBe('cz');
    expect(component.dateLocale).toBe('cs-CZ');

    ctx.auth.logout.and.returnValue(throwError(() => new Error('x')));
    component.logout();
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
    expect(ctx.permissions.clearPermissions).not.toHaveBeenCalled();
  });

  /**
   * @description Every menu group appears exactly with its permissions.
   * @input Each group's permission granted alone.
   * @output That group shown, all others hidden.
   */
  it('shows every menu group only with its permission', () => {
    const groups: Record<string, string> = {
      showWebWelcomeGroup: 'web-welcome-page-view', showShopWelcomeGroup: 'shop-welcome-page-view',
      showWebOverviewGroup: 'web-view-dashboard', showWebBusinessGroup: 'web-projects-view', showWebContentGroup: 'web-news-view',
      showWebPeopleGroup: 'web-support-tickets-view', showWebSystemGroup: 'web-view-web-logs', showCoreOverviewGroup: 'core-view-welcome-page',
      showCoreLegalGroup: 'core-external-links-view', showShopOverviewGroup: 'shop-view-dashboard',
      showShopCatalogGroup: 'shop-suppliers-view', showShopTransactionsGroup: 'shop-coupons-view', showShopCustomersGroup: 'shop-customers-view',
      showShopLogisticsGroup: 'shop-payment-methods-view', showShopContentGroup: 'shop-edit-eshop-view', showShopSystemGroup: 'shop-view-logs'
    };
    for (const [group, permission] of Object.entries(groups)) {
      ctx.permissions.granted = new Set([permission]);
      const shown = Object.keys(groups).filter(g => (component as any)[g]);
      expect(shown).withContext(permission).toEqual([group]);
    }
    ctx.permissions.granted = new Set(['view-core']);
    expect([component.showCoreOverviewGroup, component.showCoreSystemGroup]).toEqual([true, true]);
    ctx.permissions.granted = new Set(['core-legal-documents-view']);
    expect(component.showCoreLegalGroup).toBeTrue();
  });

  /**
   * @description Menu sections: expanded by default; the chevron collapses / expands a section and
   *   the choice is stored; a new layout reads it; opening a page of a collapsed section expands
   *   it; the narrow (closed) desktop menu shows every item.
   * @input  sysadmin in core; click the "System" title; new instance; onGroupActive('core-system',
   *         true); collapse again + isMenuOpen false.
   * @output aria-expanded true -> false, items hidden, storage ["core-system"]; restored collapsed;
   *         expanded again + storage []; closed menu: items not hidden.
   */
  it('collapses and remembers menu sections', () => {
    ctx.auth.session.role = 'sysadmin';
    ctx.permissions.granted = new Set(['view-core']);
    component.ngOnInit();
    component.currentModule = 'core';
    component.isMenuOpen = true;
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const title = () => el.querySelector('button[aria-controls="nav-group-core-system"]') as HTMLButtonElement;
    const items = () => el.querySelector('#nav-group-core-system') as HTMLElement;

    expect(title().getAttribute('aria-expanded')).toBe('true');
    expect(items().classList).not.toContain('nav-group-items--collapsed');
    title().click();
    fixture.detectChanges();
    expect(title().getAttribute('aria-expanded')).toBe('false');
    expect(items().classList).toContain('nav-group-items--collapsed');
    expect(JSON.parse(localStorage.getItem(NAV_COLLAPSED_STORAGE_KEY)!)).toEqual(['core-system']);

    const second = TestBed.createComponent(AdminLayoutComponent).componentInstance;
    second.ngOnInit();
    expect(second.isGroupExpanded('core-system')).toBeFalse();
    expect(second.isGroupExpanded('core-users')).toBeTrue();

    component.onGroupActive('core-system', true);
    fixture.detectChanges();
    expect(component.isGroupExpanded('core-system')).toBeTrue();
    expect(JSON.parse(localStorage.getItem(NAV_COLLAPSED_STORAGE_KEY)!)).toEqual([]);
    component.onGroupActive('core-users', false);
    expect(component.isGroupExpanded('core-users')).toBeTrue();

    component.toggleGroup('core-system');
    component.isMenuOpen = false;
    fixture.detectChanges();
    expect(items().classList).not.toContain('nav-group-items--collapsed');
    fixture.destroy();
  });

  /**
   * @description A broken or unavailable storage never breaks the menu: everything is expanded and
   *   collapsing still works for the open page.
   * @input  stored '{"x":1}', then 'not json'; then getItem / setItem throwing; toggleGroup() twice.
   * @output empty set each time; collapse and expand work without an error.
   */
  it('survives a broken storage of the menu sections', () => {
    localStorage.setItem(NAV_COLLAPSED_STORAGE_KEY, '{"x":1}');
    component.ngOnInit();
    expect(component.collapsedGroups.size).toBe(0);
    localStorage.setItem(NAV_COLLAPSED_STORAGE_KEY, 'not json');
    component.ngOnInit();
    expect(component.collapsedGroups.size).toBe(0);

    spyOn(localStorage, 'getItem').and.throwError('blocked');
    spyOn(localStorage, 'setItem').and.throwError('blocked');
    expect((component as any).readCollapsedGroups().size).toBe(0);
    expect(() => component.toggleGroup('web-content')).not.toThrow();
    expect(component.isGroupExpanded('web-content')).toBeFalse();
    component.toggleGroup('web-content');
    expect(component.isGroupExpanded('web-content')).toBeTrue();
  });

  /**
   * @description The header shows the own profile photo, the default image without one or when
   *   logged out.
   * @input  no photo; avatarUrl$ emits a URL; logged out.
   * @output default svg; img with the URL in the header and the mobile panel; default svg.
   */
  it('shows the own profile photo in the header', () => {
    component.ngOnInit();
    component.isMobileActionsOpen = true;
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.header-user-avatar svg.user-avatar--default')).not.toBeNull();

    ctx.auth.avatarUrl$.next('data:image/gif;base64,R0lGODlhAQABAAAAACw=');
    fixture.detectChanges();
    expect(component.avatarUrl).toContain('data:image/gif');
    expect((el.querySelector('.header-user-avatar img') as HTMLImageElement).src).toContain('data:image/gif');
    expect(el.querySelector('.map-user-icon img')).not.toBeNull();

    ctx.auth.isLoggedIn$.next(false);
    fixture.detectChanges();
    expect(el.querySelector('.header-user-avatar img')).toBeNull();
    fixture.destroy();
  });

  /**
   * @description A navigation to another page scrolls the content area back to the top; a change
   *   of only the query (filter, page number) keeps the position.
   * @input  scrollContentToTop('/admin/a'), ('/admin/a?page=2'), ('/admin/b#x').
   * @output scrollTo called for /admin/a and /admin/b only.
   */
  it('scrolls the content to the top on a new page', () => {
    fixture.detectChanges();
    const main = fixture.nativeElement.querySelector('main.admin-content') as HTMLElement;
    const scrollTo = spyOn(main, 'scrollTo') as jasmine.Spy;
    (component as any).scrollContentToTop('/admin/a');
    (component as any).scrollContentToTop('/admin/a?page=2');
    (component as any).scrollContentToTop('/admin/b#x');
    expect(scrollTo).toHaveBeenCalledTimes(2);
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0 });
    fixture.destroy();
  });
  /**
   * @description "Help" of the header (and of the mobile menu) opens the home of the knowledge
   *   base on every page - the help of one page is the "?" in its own header (PageHelpComponent).
   * @input Rendered layout; mobile actions open.
   * @output header link text 'admin-layout.wiki_label', href /admin/intranet/knowledge-base; the
   *   mobile menu has the same link.
   */
  it('opens the knowledge base home from the header', () => {
    component.isMobileActionsOpen = true;
    fixture.detectChanges();
    const header = fixture.nativeElement.querySelector('a.header-action-btn--wiki') as HTMLAnchorElement;
    expect(header.textContent?.trim()).toBe('admin-layout.wiki_label');
    expect(header.getAttribute('href')).toBe('/admin/intranet/knowledge-base');
    const mobile = Array.from(fixture.nativeElement.querySelectorAll('.map-links a')) as HTMLAnchorElement[];
    expect(mobile.some(a => a.getAttribute('href') === '/admin/intranet/knowledge-base')).toBeTrue();
    fixture.destroy();
  });
});
