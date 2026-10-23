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
   * @description Switching module navigates to its welcome page and remembers the choice.
   * @input  switchModule('core')
   * @output currentModule 'core'; localStorage module 'core'; navigate(['/admin/core/welcome-page'])
   */
  it('switchModule() navigates to the module welcome page', () => {
    component.switchModule('core');
    expect(component.currentModule).toBe('core');
    expect(localStorage.getItem('admin_current_module')).toBe('core');
    expect(router.navigate).toHaveBeenCalledWith(['/admin/core/welcome-page']);
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
});
