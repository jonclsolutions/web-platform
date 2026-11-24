/**
 * @file public-header.component.spec.ts
 * @path src/app/apps/web/public/components/public-header/public-header.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of PublicHeaderComponent: texts and settings, no language switcher
 *   (it is in the footer since 2026-11), the active link highlight + sliding indicator after
 *   navigation (desktop only; also for URLs with a language), the scrolled state, mobile menu / scroll lock and that a destroyed
 *   header no longer reacts to navigation (bugfix 2026-10-23).
 * @dependencies
 * - createPublicPageContext with real routes (dummy page); window.innerWidth / scrollY spied;
 *   fakeAsync for the requestAnimationFrame / indicator timers.
 */

import { Component } from '@angular/core';
import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, flush, tick } from '@angular/core/testing';
import { Event as RouterEvent, NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';

import { PublicHeaderComponent } from './public-header.component';
import { PublicPageContext, createPublicPageContext } from '../../../../../../testing/public-test-helpers';

/** Routed dummy page. */
@Component({ standalone: true, template: '' })
class PageComponent {}

describe('PublicHeaderComponent', () => {
  let ctx: PublicPageContext;
  let fixture: ComponentFixture<PublicHeaderComponent>;
  let header: PublicHeaderComponent;
  let width: jasmine.Spy;
  let router: Router;
  const link = (name: string) => (fixture.nativeElement.querySelector(`a[routerLink="${name}"]`) as HTMLAnchorElement);

  /** Creates the header at the given viewport width. */
  function create(innerWidth = 1200): void {
    width.and.returnValue(innerWidth);
    fixture = TestBed.createComponent(PublicHeaderComponent);
    header = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    ctx = createPublicPageContext({
      translations: { navigation: { home: 'Home', services: 'Services', contact: 'Contact' } },
      settings: { settings: { contact_phone: '+420 777 123', contact_email: 'a@b.cz' } },
      routes: ['home', 'services', 'contact', 'shop', 'other'].map(path => ({ path, component: PageComponent }))
    });
    TestBed.configureTestingModule({ imports: [PublicHeaderComponent], providers: ctx.providers });
    router = TestBed.inject(Router);
    width = spyOnProperty(window, 'innerWidth', 'get');
    spyOn(window, 'scrollTo');
  });
  afterEach(() => document.documentElement.classList.remove('no-scroll'));

  /**
   * @description Start: web module, texts and settings; the header has no language switcher
   *   (desktop nor drawer) and does not load the languages.
   * @input Default context.
   * @output setModule('web'); 'Services' rendered; siteSettings; no select / .lang-dropdown /
   *   .m-drawer-lang-dropdown; fetchLanguages not called.
   */
  it('loads texts and settings without a language switcher', fakeAsync(() => {
    create();
    expect(ctx.localization.setModule).toHaveBeenCalledWith('web');
    expect(fixture.nativeElement.textContent).toContain('Services');
    expect(header.siteSettings.contact_email).toBe('a@b.cz');
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('select, .lang-dropdown, .m-drawer-lang-dropdown')).toBeNull();
    expect(ctx.localization.fetchLanguages).not.toHaveBeenCalled();
    ctx.publicData.siteSettingsValue$.next(null);
    expect(header.siteSettings).toBeNull();
    fixture.destroy();
    flush();
  }));

  /**
   * @description Navigation on desktop: scroll to top, link highlighted while the indicator
   *   slides, 'active' after 400 ms; the indicator sits under the 2nd link (100 px + 12 px gap).
   * @input navigate('/services'); tick.
   * @output scrollTo(0, 0); highlight-text then active on /services; transform translateX(112px).
   */
  it('highlights the active link after navigation', fakeAsync(() => {
    create();
    tick(50);
    router.navigateByUrl('/services');
    tick();
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
    expect(link('/services').classList.contains('highlight-text')).toBeTrue();
    expect(header.showIndicator).toBeTrue();
    tick(40);
    expect(header.indicatorStyle.transform).toBe('translateX(112px) translateY(-50%)');
    expect(header.indicatorStyle.opacity).toBe(1);

    tick(400);
    expect(header.showIndicator).toBeFalse();
    expect(link('/services').classList.contains('active')).toBeTrue();
    expect(link('/home').classList.contains('active')).toBeFalse();
    fixture.destroy();
    flush();
  }));

  /**
   * @description URLs carry the language (`/cs/services`, 2026-11): the link `/services` is still
   *   recognized as the active one.
   * @input NavigationEnd with urlAfterRedirects '/cs/services' (router.url the same); tick 400.
   * @output /services highlighted, then active; /home not active.
   */
  it('highlights the active link of a URL with a language', fakeAsync(() => {
    create();
    tick(50);
    spyOnProperty(router, 'url', 'get').and.returnValue('/cs/services');
    (router.events as Subject<RouterEvent>).next(new NavigationEnd(1, '/cs/services', '/cs/services'));
    tick();
    expect(link('/services').classList.contains('highlight-text')).toBeTrue();
    tick(440);
    expect(link('/services').classList.contains('active')).toBeTrue();
    expect(link('/home').classList.contains('active')).toBeFalse();
    fixture.destroy();
    flush();
  }));

  /**
   * @description Scrolled header: smaller indicator and gap; a route without nav link hides it.
   * @input Active /contact, scrollY 150 + scroll event; then route '/other' + updateIndicatorPosition().
   * @output scrolled true, height 26px, translateX(212px) (2 × 100 + 2 × 6); hidden style for /other.
   */
  it('positions the indicator for the scrolled header', fakeAsync(() => {
    create();
    router.navigateByUrl('/contact');
    tick(500);
    const scrollY = spyOnProperty(window, 'scrollY', 'get').and.returnValue(150);
    window.dispatchEvent(new Event('scroll'));
    tick(40);
    expect(header.scrolled).toBeTrue();
    expect(header.indicatorStyle.height).toBe('26px');
    expect(header.indicatorStyle.transform).toBe('translateX(212px) translateY(-50%)');
    window.dispatchEvent(new Event('scroll'));
    scrollY.and.returnValue(0);
    window.dispatchEvent(new Event('scroll'));
    expect(header.scrolled).toBeFalse();

    router.navigateByUrl('/other');
    tick(500);
    header.updateIndicatorPosition();
    expect(header.indicatorStyle).toEqual({ opacity: 0, width: '0px', height: '0px', transform: 'translateX(0px) translateY(-50%)', transition: 'none' });
    fixture.destroy();
    flush();
  }));

  /**
   * @description Mobile: no indicator work; menu toggles the page scroll lock; growing to
   *   desktop closes an open menu.
   * @input width 500; toggleMenu(); width 1200 + resize.
   * @output isMobileView; no-scroll on / off; menu closed after resize.
   */
  it('handles the mobile menu', fakeAsync(() => {
    create(500);
    expect(header.isMobileView).toBeTrue();
    header.updateIndicatorPosition();
    expect(header.indicatorStyle).toEqual({});
    window.dispatchEvent(new Event('scroll'));
    expect(header.scrolled).toBeFalse();

    header.toggleMenu();
    expect(header.isMenuOpen).toBeTrue();
    expect(document.documentElement.classList.contains('no-scroll')).toBeTrue();
    width.and.returnValue(1200);
    window.dispatchEvent(new Event('resize'));
    expect(header.isMobileView).toBeFalse();
    expect(header.isMenuOpen).toBeFalse();
    expect(document.documentElement.classList.contains('no-scroll')).toBeFalse();

    header.toggleMenu();
    header.closeMenu();
    expect(header.isMenuOpen).toBeFalse();
    fixture.destroy();
    flush();
  }));

  /**
   * @description After destroy the header ignores navigation (no scrollTo, no detectChanges on
   *   the destroyed view - bugfix 2026-10-23).
   * @input destroy(); navigate('/home').
   * @output scrollTo not called after destroy; no error.
   */
  it('stops reacting to navigation once destroyed', fakeAsync(() => {
    create();
    tick(50);
    fixture.destroy();
    (window.scrollTo as jasmine.Spy).calls.reset();
    router.navigateByUrl('/home');
    tick(500);
    expect(window.scrollTo).not.toHaveBeenCalled();
    flush();
    discardPeriodicTasks();
  }));
});
