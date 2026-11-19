/**
 * @file portal-layout.component.spec.ts
 * @path src/app/apps/project-portal/public/portal-layout/portal-layout.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of PortalLayoutComponent with the child routes of the portal
 *   (portal-sections.routes.ts, components given directly; the lazy loaders are tested apart): header and left menu like the administration (badges, counts,
 *   active section, title), sections as child routes (`?section=` and unknown sections), the
 *   safety net without a session, the session token of former versions, the language switcher,
 *   the collapsed / slid-in menu, refresh and logout.
 * @dependencies portal.testing (stubs, sample data); RouterTestingHarness; fakeAsync for timers.
 */

import { Component } from '@angular/core';
import { TestBed, discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Route, Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { PROJECT_PORTAL_AVAILABLE_LANGUAGES } from '../project-portal-localization.service';
import { PORTAL_SECTION_ROUTES } from '../portal-sections.routes';
import * as SECTIONS from '../sections/portal-sections';
import { PortalSessionService } from '../portal-session.service';
import { PublicProject } from '../portal.models';
import { PortalTestContext, setUpPortal, testProject } from '../portal.testing';
import { PORTAL_SIDEBAR_STORAGE_KEY, PortalLayoutComponent } from './portal-layout.component';

/** Stand-in of the sign-in page. */
@Component({ selector: 'app-test-login', standalone: true, template: 'login' })
class TestLoginComponent {}

/** Section component of each child route (the routes load them lazily). */
const SECTION_COMPONENTS: Record<string, unknown> = {
  overview: SECTIONS.PortalOverviewComponent, checkpoints: SECTIONS.PortalCheckpointsComponent, threads: SECTIONS.PortalThreadsComponent,
  approvals: SECTIONS.PortalApprovalsComponent, updates: SECTIONS.PortalUpdatesComponent, files: SECTIONS.PortalFilesComponent,
  contacts: SECTIONS.PortalContactsComponent, account: SECTIONS.PortalAccountComponent, help: SECTIONS.PortalHelpComponent,
};

/**
 * The real child routes with the section components given directly: the lazy chunk would load
 * outside fakeAsync (tick() cannot wait for it). The loaders are tested separately below.
 */
const EAGER_SECTION_ROUTES: Route[] = PORTAL_SECTION_ROUTES.map(route =>
  route.loadComponent ? { path: route.path, component: SECTION_COMPONENTS[route.path!] as Route['component'] } : route);

describe('PortalLayoutComponent', () => {
  let ctx: PortalTestContext;
  let harness: RouterTestingHarness;
  let router: Router;
  /** Project the stand-in resolver gives the layout (undefined = no session). */
  let resolved: PublicProject | undefined;

  /** Creates the router with the portal routes and opens the URL. */
  function open(url: string): void {
    ctx = setUpPortal({
      realRouter: true,
      start: false,
      providers: [provideRouter([
        { path: 'projects/login/:token', component: TestLoginComponent },
        { path: 'projects/:token', component: PortalLayoutComponent, resolve: { project: () => resolved }, children: EAGER_SECTION_ROUTES },
      ])],
    });
    RouterTestingHarness.create().then(h => (harness = h));
    tick();
    router = TestBed.inject(Router);
    harness.navigateByUrl(url);
    tick();
    harness.detectChanges();
  }

  /** Root element of the test. */
  const el = () => harness.fixture.nativeElement as HTMLElement;
  /** The layout and its session. */
  const layout = () => harness.fixture.debugElement.query(By.directive(PortalLayoutComponent)).componentInstance as PortalLayoutComponent;
  const session = () => harness.fixture.debugElement.query(By.directive(PortalLayoutComponent)).injector.get(PortalSessionService);
  /** Ends the test: destroys the view (polling stops). */
  function finish(): void {
    harness.fixture.destroy();
    discardPeriodicTasks();
  }

  beforeEach(() => {
    resolved = testProject();
    localStorage.removeItem(PORTAL_SIDEBAR_STORAGE_KEY);
  });
  afterEach(() => localStorage.removeItem(PORTAL_SIDEBAR_STORAGE_KEY));

  /**
   * @description Admin-like layout: the header shows "Client: <signed-in account>" and
   *   "Project: <project>" (no avatar); the section title has no icon; the menu lists the sections (unread badge of Communication, done /
   *   total of Progress) with My account, Help and logout at the bottom; a menu item opens its
   *   section as a child route and the title follows.
   * @input /projects/tok/overview (account Jana Nová, 3 unread, 1 of 3 steps done); click on "Progress".
   * @output 'header_client: Jana Nová', 'header_project: Web', no avatar / title icon; 10 items; badge 3; '1/3'; overview active and shown;
   *   URL /projects/tok/checkpoints, title tab_checkpoints, Progress shown; no account → ''.
   */
  it('renders the header and the menu like the administration', fakeAsync(() => {
    open('/projects/tok/overview');
    expect(el().querySelector('.pp-header-user-name')!.textContent!.replace(/\s+/g, ' ').trim()).toBe('header_client: Jana Nová');
    expect(el().querySelector('.pp-header-project')!.textContent!.replace(/\s+/g, ' ').trim()).toBe('header_project: Web');
    expect(el().querySelector('.pp-avatar')).toBeNull();
    expect(el().querySelector('.pp-page-head svg')).toBeNull();
    expect(el().querySelectorAll('.pp-sidebar .pp-nav-item').length).toBe(10);
    expect(el().querySelector('.pp-nav-badge')!.textContent!.trim()).toBe('3');
    expect(el().querySelector('.pp-nav-count')!.textContent!.trim()).toBe('1/3');
    expect(el().querySelector('.pp-nav-item.active')!.textContent).toContain('tab_overview');
    expect(el().querySelector('.pp-nav-item.active')!.getAttribute('aria-current')).toBe('page');
    expect(el().querySelector('app-portal-overview')).not.toBeNull();

    (el().querySelectorAll('.pp-sidebar .pp-nav-item')[1] as HTMLButtonElement).click();
    tick();
    harness.detectChanges();
    expect(router.url).toBe('/projects/tok/checkpoints');
    expect(layout().activeSection).toBe('checkpoints');
    expect(el().querySelector('.pp-page-title')!.textContent).toContain('tab_checkpoints');
    expect(el().querySelector('app-portal-checkpoints')).not.toBeNull();
    expect(el().querySelector('app-portal-overview')).toBeNull();

    session().project.set({ ...session().project()!, account: undefined });
    expect(layout().accountName).toBe('');
    finish();
  }));

  /**
   * @description /projects/:token opens the section of `?section=` (e-mail links, the sign-in
   *   keeps it) or the overview, other query parameters stay; an unknown section opens the overview.
   * @input /projects/tok?section=threads&x=1; /projects/tok?section=bogus; /projects/tok/nothing.
   * @output /projects/tok/threads?x=1 with Communication; /projects/tok/overview; /projects/tok/overview.
   */
  it('opens the section of the address', fakeAsync(() => {
    open('/projects/tok?section=threads&x=1');
    expect(router.url).toBe('/projects/tok/threads?x=1');
    expect(layout().activeSection).toBe('threads');
    expect(el().querySelector('app-portal-threads')).not.toBeNull();

    harness.navigateByUrl('/projects/tok?section=bogus');
    tick();
    expect(router.url).toBe('/projects/tok/overview');
    harness.navigateByUrl('/projects/tok/nothing');
    tick();
    expect(router.url).toBe('/projects/tok/overview');
    finish();
  }));

  /**
   * @description Without a project from the resolver (safety net) the login of the project
   *   opens; the session token a former version kept in localStorage is deleted.
   * @input legacy key project_session_tok; no resolved project.
   * @output URL /projects/login/tok; legacy key removed.
   */
  it('opens the login without a session and drops the legacy token', fakeAsync(() => {
    localStorage.setItem('project_session_tok', 'old');
    resolved = undefined;
    open('/projects/tok/overview');
    tick();
    expect(router.url).toBe('/projects/login/tok');
    expect(localStorage.getItem('project_session_tok')).toBeNull();
    finish();
  }));

  /**
   * @description The language switcher sits once in the top-right corner of the portal (in the
   *   right part of the header, not in the menu): flag + chevron, the menu opens on click with all
   *   languages. (The switcher of the sign-in page belongs to PortalLoginComponent.)
   * @input The portal; click on the switcher.
   * @output One .pp-lang-switcher inside .pp-header-right, none in the sidebar; aria-expanded
   *   false → true and one item per language.
   */
  it('shows one language switcher in the top-right corner', fakeAsync(() => {
    open('/projects/tok/overview');
    expect(el().querySelectorAll('.pp-lang-switcher').length).toBe(1);
    expect(el().querySelector('.pp-header-right .pp-lang-switcher')).not.toBeNull();
    expect(el().querySelector('.pp-sidebar .pp-lang-btn')).toBeNull();
    const btn = el().querySelector('.pp-lang-switcher .pp-lang-btn') as HTMLButtonElement;
    expect(btn.querySelector('.pp-lang-chevron')).not.toBeNull();
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    btn.click();
    harness.detectChanges();
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(el().querySelectorAll('.pp-lang-menu-item').length).toBe(PROJECT_PORTAL_AVAILABLE_LANGUAGES.length);
    finish();
  }));

  /**
   * @description The menu button collapses the menu on desktop (remembered in localStorage,
   *   restored on the next load) and slides it in on mobile, where picking a section or the
   *   overlay closes it; an unavailable storage is ignored.
   * @input desktop: toggle; new portal, toggle; mobile (matchMedia true): toggle, pick a section,
   *   toggle, overlay; storage throwing.
   * @output collapsed true + '1' stored + .pp-app--collapsed; restored true, then false + '0';
   *   mobileNavOpen true → false after the pick and after the overlay; no error without storage.
   */
  it('collapses or slides in the menu', fakeAsync(() => {
    // Desktop width whatever the size of the test browser (its window may be under 768 px).
    const media = spyOn(window, 'matchMedia').and.returnValue({ matches: false } as MediaQueryList);
    open('/projects/tok/overview');
    (el().querySelector('.pp-menu-btn') as HTMLButtonElement).click();
    harness.detectChanges();
    expect(layout().sidebarCollapsed).toBeTrue();
    expect(localStorage.getItem(PORTAL_SIDEBAR_STORAGE_KEY)).toBe('1');
    expect(el().querySelector('.pp-app--collapsed')).not.toBeNull();
    expect(el().querySelector('.pp-menu-btn')!.getAttribute('aria-expanded')).toBe('false');
    finish();

    TestBed.resetTestingModule();
    open('/projects/tok/overview');
    expect(layout().sidebarCollapsed).toBeTrue();
    layout().toggleSidebar();
    expect(localStorage.getItem(PORTAL_SIDEBAR_STORAGE_KEY)).toBe('0');

    media.and.returnValue({ matches: true } as MediaQueryList);
    layout().toggleSidebar();
    expect(layout().mobileNavOpen).toBeTrue();
    expect(layout().sidebarCollapsed).toBeFalse();
    layout().open('help');
    tick();
    expect(layout().mobileNavOpen).toBeFalse();
    expect(router.url).toBe('/projects/tok/help');
    layout().toggleSidebar();
    harness.detectChanges();
    (el().querySelector('.pp-sidebar-overlay') as HTMLElement).click();
    expect(layout().mobileNavOpen).toBeFalse();

    media.and.throwError('no matchMedia');
    spyOn(Storage.prototype, 'setItem').and.throwError('blocked');
    expect(() => layout().toggleSidebar()).not.toThrow();
    expect(layout().sidebarCollapsed).toBeTrue();
    finish();
  }));

  /**
   * @description The refresh button reloads the portal (disabled while running); the logout item
   *   ends the session and opens the login.
   * @input click on refresh; refreshing; click on logout.
   * @output GET of the project; button disabled with the spinning icon; post('…/logout'), URL /projects/login/tok.
   */
  it('refreshes and logs out from the layout', fakeAsync(() => {
    open('/projects/tok/overview');
    ctx.get.calls.reset();
    (el().querySelector('.pp-header-btn') as HTMLButtonElement).click();
    expect(ctx.get).toHaveBeenCalledWith('projects/public/tok');
    session().refreshing.set(true);
    harness.detectChanges();
    expect((el().querySelector('.pp-header-btn') as HTMLButtonElement).disabled).toBeTrue();
    expect(el().querySelector('.pp-spin-icon')).not.toBeNull();
    session().refreshing.set(false);

    (el().querySelector('.pp-nav-item--logout') as HTMLButtonElement).click();
    tick();
    expect(ctx.post).toHaveBeenCalledWith('projects/public/tok/logout', {});
    expect(router.url).toBe('/projects/login/tok');
    finish();
  }));

  /**
   * @description Every lazy section route loads its component from the one module of the sections.
   * @input The loaders of PORTAL_SECTION_ROUTES.
   * @output 9 loaders, each resolving to the component of its section.
   */
  it('loads every section component', async () => {
    const lazy = PORTAL_SECTION_ROUTES.filter(route => route.loadComponent);
    expect(lazy.length).toBe(9);
    for (const route of lazy) {
      expect(await (route.loadComponent as () => Promise<unknown>)()).toBe(SECTION_COMPONENTS[route.path!]);
    }
  });
});
