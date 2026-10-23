/**
 * @file public-header.component.spec.ts
 * @path src/app/public/web-pages/components/public-header/public-header.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of PublicHeaderComponent: texts, languages and settings, the active
 *   link highlight + sliding indicator after navigation (desktop only), the scrolled state,
 *   mobile menu / scroll lock, language dropdowns and that a destroyed header no longer reacts
 *   to navigation (bugfix 2026-10-23).
 * @dependencies
 * - createPublicPageContext with real routes (dummy page); window.innerWidth / scrollY spied;
 *   fakeAsync for the requestAnimationFrame / indicator timers.
 */

import { Component } from '@angular/core';
import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, flush, tick } from '@angular/core/testing';
import { Router } from '@angular/router';

import { PublicHeaderComponent } from './public-header.component';
import { PublicPageContext, STUB_LANGUAGES, createPublicPageContext } from '../../../../../testing/public-test-helpers';

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
   * @description Start: web module, languages, texts and settings; active language meta.
   * @input Default context.
   * @output setModule('web'); availableLanguages = stub list; 'Home' rendered; siteSettings; getActiveLang cz.
   */
  it('loads texts, languages and settings', fakeAsync(() => {
    create();
    expect(ctx.localization.setModule).toHaveBeenCalledWith('web');
    expect(header.availableLanguages).toEqual(STUB_LANGUAGES);
    expect(fixture.nativeElement.textContent).toContain('Services');
    expect(header.siteSettings.contact_email).toBe('a@b.cz');
    expect(header.getActiveLang()!.code).toBe('cz');
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
   * @description Language dropdowns: toggle / close, outside click closes, inside click keeps,
   *   selection switches the language.
   * @input toggleLangDropdown(); click on body; toggle + click inside .lang-dropdown; selectLanguage('en'); drawer toggles.
   * @output open → closed; stays open; setLanguage('en'); drawer open → closed.
   */
  it('switches languages from the dropdowns', fakeAsync(() => {
    create();
    header.toggleLangDropdown();
    expect(header.isLangOpen).toBeTrue();
    document.body.click();
    expect(header.isLangOpen).toBeFalse();

    header.toggleLangDropdown();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.lang-dropdown') as HTMLElement).click();
    expect(header.isLangOpen).toBeTrue();
    header.closeLangDropdown();
    expect(header.isLangOpen).toBeFalse();

    header.selectLanguage('en');
    expect(ctx.localization.setLanguage).toHaveBeenCalledWith('en');
    header.toggleDrawerLangDropdown();
    expect(header.isDrawerLangOpen).toBeTrue();
    header.closeDrawerLangDropdown();
    expect(header.isDrawerLangOpen).toBeFalse();
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
