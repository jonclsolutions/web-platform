/**
 * @file shop-header.component.spec.ts
 * @path src/app/public/shop-pages/components/shop-header/shop-header.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of ShopHeaderComponent: shop module texts, languages and site data, scrolled
 *   state, the language dropdown (closed by outside clicks), language
 *   switch and opening the cart.
 * @refactor-note (2026-10-31) Open finding #64: test of the hidden phone / company rows.
 * @dependencies
 * - createPublicPageContext (get spy answers the site config); real CartService.
 */

import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync } from '@angular/core/testing';
import { Router } from '@angular/router';
import { throwError } from 'rxjs';
import { of } from 'rxjs';

import { ShopHeaderComponent } from './shop-header.component';
import { PublicPageContext, STUB_LANGUAGES, createPublicPageContext } from '../../../../../testing/public-test-helpers';

describe('ShopHeaderComponent', () => {
  let ctx: PublicPageContext;
  let fixture: ComponentFixture<ShopHeaderComponent>;
  let header: ShopHeaderComponent;

  /** Creates the header; `config` answers public/legal/config. */
  function create(config: any = of({ settings: { contact_phone: '+420 777 1', logo_path: 'l.svg' } })): void {
    localStorage.removeItem('shop_cart');
    ctx = createPublicPageContext({ translations: { header: { cart: 'Cart' } } });
    ctx.publicData.get.and.returnValue(config);
    TestBed.configureTestingModule({ imports: [ShopHeaderComponent], providers: ctx.providers });
    fixture = TestBed.createComponent(ShopHeaderComponent);
    header = fixture.componentInstance;
    fixture.detectChanges();
  }

  /**
   * @description Start: shop module, header texts, languages, site settings; missing header
   *   section → null; failing config is logged.
   * @input Default; translations without header; config error.
   * @output setModule('shop'); t {cart}; languages; settings; t null; console.error.
   */
  it('loads texts, languages and site data', fakeAsync(() => {
    create();
    expect(ctx.localization.setModule).toHaveBeenCalledWith('shop');
    expect(header.t).toEqual({ cart: 'Cart' });
    expect(header.availableLanguages).toEqual(STUB_LANGUAGES);
    expect(header.siteSettings.logo_path).toBe('l.svg');
    ctx.setTranslations({});
    expect(header.t).toBeNull();
    fixture.destroy();

    TestBed.resetTestingModule();
    spyOn(console, 'error');
    create(throwError(() => new Error('x')));
    expect(console.error).toHaveBeenCalled();
    expect(header.siteSettings).toBeNull();
    discardPeriodicTasks();
  }));

  /**
   * @description Language dropdown; outside click closes it, click inside keeps it; scrolled flag;
   *   language and cart actions; no currency switch any more (finding #43).
   * @input toggleLang, click body / inside .custom-dropdown; scrollY 30 / 0; selectLang; openCart; render.
   * @output open; closed; kept; scrolled true / false; setLanguage('en'); navigate cart; no CZK in the header.
   */
  it('handles dropdowns, scrolling and actions', fakeAsync(() => {
    create();
    header.toggleLang();
    expect(header.showLang).toBeTrue();
    header.clickout({ target: document.body });
    expect(header.showLang).toBeFalse();
    const inside = document.createElement('div');
    inside.className = 'custom-dropdown';
    const child = inside.appendChild(document.createElement('span'));
    header.toggleLang();
    header.clickout({ target: child });
    expect(header.showLang).toBeTrue();

    const scrollY = spyOnProperty(window, 'scrollY', 'get').and.returnValue(30);
    header.onWindowScroll();
    expect(header.isScrolled).toBeTrue();
    scrollY.and.returnValue(0);
    header.onWindowScroll();
    expect(header.isScrolled).toBeFalse();

    header.selectLang('en');
    expect(ctx.localization.setLanguage).toHaveBeenCalledWith('en');
    expect(fixture.nativeElement.textContent).not.toContain('CZK');
    expect((header as any).selectCurrency).toBeUndefined();
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    header.openCart();
    expect(router.navigate).toHaveBeenCalledWith(['/shop/cart']);
    fixture.destroy();
    discardPeriodicTasks();
  }));

  /**
   * @description Open finding #64: the phone link renders only with a phone.
   * @input Default settings (phone '+420 777 1'); settings without a phone.
   * @output tel:+4207771; then no tel: link.
   */
  it('shows the phone link only with a phone', fakeAsync(() => {
    create();
    expect(fixture.nativeElement.querySelector('a[href^="tel:"]')?.getAttribute('href')).toBe('tel:+4207771');
    fixture.destroy();
    TestBed.resetTestingModule();
    create(of({ settings: { contact_email: 'a@b.cz' } }));
    expect(fixture.nativeElement.querySelector('a[href^="tel:"]')).toBeNull();
    discardPeriodicTasks();
  }));
});
