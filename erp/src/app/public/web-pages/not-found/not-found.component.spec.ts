/**
 * @file not-found.component.spec.ts
 * @path src/app/public/web-pages/not-found/not-found.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of NotFoundComponent: texts of the `not_found` section and the attempted URL
 *   (previous navigation when redirected to the 404 route, otherwise the current URL).
 * @dependencies
 * - createPublicPageContext; Router.getCurrentNavigation spied.
 */

import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { NotFoundComponent } from './not-found.component';
import { createPublicPageContext } from '../../../../testing/public-test-helpers';

describe('NotFoundComponent', () => {
  beforeEach(() => {
    const ctx = createPublicPageContext({ translations: { not_found: { header: '404', text: 'Missing', button: 'Home' } } });
    TestBed.configureTestingModule({ imports: [NotFoundComponent], providers: ctx.providers });
  });

  /**
   * @description Without a running navigation the current URL is used; texts rendered.
   * @input No current navigation; router.url '/'.
   * @output attemptedUrl '/'; '404', 'Missing', link 'Home' to /home.
   */
  it('renders the texts and uses the current URL', () => {
    const fixture = TestBed.createComponent(NotFoundComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.attemptedUrl).toBe('/');
    expect(fixture.nativeElement.textContent).toContain('Missing');
    expect(fixture.nativeElement.querySelector('a').getAttribute('href')).toBe('/home');
  });

  /**
   * @description During a redirect the URL of the previous navigation is shown (or '' when it
   *   has no final URL); a navigation without a previous one falls back to router.url.
   * @input previousNavigation.finalUrl '/missing'; finalUrl undefined; no previousNavigation.
   * @output '/missing'; ''; '/'.
   */
  it('uses the URL of the previous navigation when redirected', () => {
    const router = TestBed.inject(Router);
    const nav = spyOn(router, 'getCurrentNavigation');
    const create = () => {
      const f = TestBed.createComponent(NotFoundComponent);
      f.detectChanges();
      return f.componentInstance.attemptedUrl;
    };
    nav.and.returnValue({ previousNavigation: { finalUrl: router.parseUrl('/missing') } } as any);
    expect(create()).toBe('/missing');
    nav.and.returnValue({ previousNavigation: {} } as any);
    expect(create()).toBe('');
    nav.and.returnValue({ previousNavigation: null } as any);
    expect(create()).toBe('/');
  });
});
