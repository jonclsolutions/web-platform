/**
 * @file admin-error-page.component.spec.ts
 * @path src/app/admin/error-pages/admin-error-page.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026-10-27
 * @description Unit tests of the admin 404 / 403 page: kind from the route data, status code and
 *   texts of the section `error-pages`, requested path (404: current URL, 403: refused address from
 *   the navigation state - never the query / fragment), Back = history back, link to the admin
 *   home, re-render on a language change. Plus the routing: an unknown /admin address and the
 *   forbidden address open this page as the last children of the admin layout.
 * @dependencies
 * - createI18nStub (texts = keys); ActivatedRoute / Location stubs; ADMIN_ROUTES.
 */

import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { Location } from '@angular/common';

import { AdminErrorPageComponent } from './admin-error-page.component';
import { AdminLocalizationService } from '../../core/services/admin-localization.service';
import { ADMIN_ROUTES } from '../admin-routing.module';
import { I18nStub, createI18nStub } from '../../../testing/admin-test-helpers';

describe('AdminErrorPageComponent', () => {
  let i18n: I18nStub;
  let routeData: Record<string, unknown>;
  let historyState: unknown;
  let currentUrl: string;
  let location: jasmine.SpyObj<Location>;

  /** Renders the page for the current stubs. */
  function render() {
    const fixture = TestBed.createComponent(AdminErrorPageComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    i18n = createI18nStub();
    routeData = {};
    historyState = null;
    currentUrl = '/admin/nothing';
    location = jasmine.createSpyObj<Location>('Location', ['back', 'getState', 'path', 'prepareExternalUrl', 'subscribe', 'go', 'replaceState', 'isCurrentPathEqualTo', 'normalize', 'forward', 'historyGo', 'onUrlChange']);
    location.getState.and.callFake(() => historyState);
    location.prepareExternalUrl.and.callFake((url: string) => url);
    TestBed.configureTestingModule({
      imports: [AdminErrorPageComponent],
      providers: [
        provideRouter([]),
        { provide: AdminLocalizationService, useValue: i18n },
        { provide: ActivatedRoute, useValue: { snapshot: { get data() { return routeData; } } } },
        { provide: Location, useValue: location },
      ],
    });
    spyOnProperty(TestBed.inject(Router), 'url', 'get').and.callFake(() => currentUrl);
  });

  /**
   * @description 404: code, texts of not_found_*, the current path without query / fragment,
   *   Back and the link to /admin.
   * @input data {adminErrorPage: 'not-found'}; router.url '/admin/shop/xyz?email=a@b.cz#top'; click Back.
   * @output kind not-found; '404'; keys error-pages.not_found_title / _message / _hint; path
   *   '/admin/shop/xyz' (no e-mail); no icon (2026-10-27b); link href '/admin'; location.back() once.
   */
  it('renders the 404 page', () => {
    routeData = { adminErrorPage: 'not-found' };
    currentUrl = '/admin/shop/xyz?email=a@b.cz#top';
    const fixture = render();
    const el = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.kind).toBe('not-found');
    expect(el.querySelector('.error-code')!.textContent).toBe('404');
    expect(el.querySelector('h1')!.textContent).toBe('error-pages.not_found_title');
    expect(el.querySelector('.error-message')!.textContent).toBe('error-pages.not_found_message');
    expect(el.querySelector('.error-hint')!.textContent).toBe('error-pages.not_found_hint');
    expect(el.querySelector('.error-path code')!.textContent).toBe('/admin/shop/xyz');
    expect(el.textContent).not.toContain('a@b.cz');
    expect(el.querySelector('svg')).toBeNull();
    expect(el.querySelector('.error-page')!.classList).not.toContain('error-page--forbidden');
    expect(el.querySelector('a.error-btn--primary')!.getAttribute('href')).toBe('/admin');
    (el.querySelector('button.error-btn--neutral') as HTMLButtonElement).click();
    expect(location.back).toHaveBeenCalledTimes(1);
  });

  /**
   * @description 403: code, texts of forbidden_*, the refused address from the navigation state
   *   (not the URL of the 403 page itself), danger variant.
   * @input data {adminErrorPage: 'forbidden'}; state {deniedUrl: '/admin/core/administrators?x=1'};
   *   router.url '/admin/forbidden'.
   * @output '403'; error-pages.forbidden_title; path '/admin/core/administrators'; class error-page--forbidden.
   */
  it('renders the 403 page with the refused address', () => {
    routeData = { adminErrorPage: 'forbidden' };
    historyState = { navigationId: 3, deniedUrl: '/admin/core/administrators?x=1' };
    currentUrl = '/admin/forbidden';
    const el = render().nativeElement as HTMLElement;

    expect(el.querySelector('.error-code')!.textContent).toBe('403');
    expect(el.querySelector('h1')!.textContent).toBe('error-pages.forbidden_title');
    expect(el.querySelector('.error-path code')!.textContent).toBe('/admin/core/administrators');
    expect(el.querySelector('.error-page')!.classList).toContain('error-page--forbidden');
  });

  /**
   * @description 403 opened without a refused address (reload, typed URL, odd state) shows no
   *   path; missing / unknown kind = 404; a language change re-renders the texts.
   * @input forbidden with state null; with state {deniedUrl: 42}; data {} ; data {adminErrorPage: 'x'};
   *   getValue changed + translations$ emits.
   * @output no .error-path twice; kind not-found twice; new title text.
   */
  it('handles a missing address, unknown kinds and language changes', () => {
    routeData = { adminErrorPage: 'forbidden' };
    historyState = null;
    expect(render().nativeElement.querySelector('.error-path')).toBeNull();
    historyState = { deniedUrl: 42 };
    expect(render().nativeElement.querySelector('.error-path')).toBeNull();

    routeData = {};
    expect(render().componentInstance.kind).toBe('not-found');
    routeData = { adminErrorPage: 'x' };
    const fixture = render();
    expect(fixture.componentInstance.kind).toBe('not-found');

    i18n.getValue.and.callFake((path: string) => `EN ${path}`);
    i18n.translations$.next({ changed: true });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h1').textContent).toBe('EN error-pages.not_found_title');
  });
});

describe('admin routes - error pages', () => {
  const layoutChildren = ADMIN_ROUTES[0].children!;

  /**
   * @description The 403 and 404 routes are the last children of the admin layout (inside the
   *   layout and its guards); the 404 is the very last one.
   * @input ADMIN_ROUTES[0].children.
   * @output second-to-last: 'forbidden' (kind forbidden); last: '**' (kind not-found); both
   *   AdminErrorPageComponent without a permission.
   */
  it('ends the admin layout with the 403 and 404 routes', () => {
    const [forbidden, notFound] = layoutChildren.slice(-2);
    expect([forbidden.path, forbidden.data?.['adminErrorPage'], forbidden.component]).toEqual(['forbidden', 'forbidden', AdminErrorPageComponent]);
    expect([notFound.path, notFound.data?.['adminErrorPage'], notFound.component]).toEqual(['**', 'not-found', AdminErrorPageComponent]);
    expect(forbidden.data?.['permission']).toBeUndefined();
    expect(notFound.data?.['permission']).toBeUndefined();
    expect(ADMIN_ROUTES[0].canActivate?.length).toBe(1);
    expect(ADMIN_ROUTES[0].canActivateChild?.length).toBe(1);
  });
});
