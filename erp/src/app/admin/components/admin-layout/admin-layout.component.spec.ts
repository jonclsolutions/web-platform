/**
 * @file admin-layout.component.spec.ts
 * @path src/app/admin/components/admin-layout/admin-layout.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of AdminLayoutComponent – the admin shell: module switch (web / core /
 *   shop) incl. sync from the URL, sidebar open/resize state in localStorage, mobile scroll lock,
 *   admin language switch, logout, and which menu groups the permissions show.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (auth, permission, i18n stubs), ScrollLockService (spy)
 */

import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { throwError } from 'rxjs';

import { AdminLayoutComponent } from './admin-layout.component';
import { ScrollLockService } from '../../../core/services/scroll-lock.service';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('AdminLayoutComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<AdminLayoutComponent>;
  let component: AdminLayoutComponent;
  let router: Router;
  let scrollLock: jasmine.SpyObj<ScrollLockService>;
  const KEYS = ['admin_sidebar_width', 'admin_menu_open', 'admin_current_module'];

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
   * @description The users group is always visible for the sysadmin role.
   * @input  no permissions, role 'sysadmin'
   * @output showCoreUsersGroup true; with role 'admin' false
   */
  it('shows the users group to sysadmin', () => {
    ctx.auth.session.role = 'sysadmin';
    component.ngOnInit();
    expect(component.showCoreUsersGroup).toBeTrue();
    ctx.auth.session.role = 'admin';
    ctx.auth.isLoggedIn$.next(true);
    expect(component.showCoreUsersGroup).toBeFalse();
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
      showCoreLegalGroup: 'core-external-links-view', showCoreUsersGroup: 'core-administrators-view', showShopOverviewGroup: 'shop-view-dashboard',
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
});
