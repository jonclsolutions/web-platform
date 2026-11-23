/**
 * @file shop-header.component.spec.ts
 * @path src/app/apps/shop/public/components/shop-header/shop-header.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of ShopHeaderComponent: shop module texts and site data, no language
 *   switcher (it is in the footer since 2026-11), scrolled state and opening the cart.
 * @dependencies
 * - createPublicPageContext (get spy answers the site config); real CartService.
 */

import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync } from '@angular/core/testing';
import { Router } from '@angular/router';
import { throwError } from 'rxjs';
import { of } from 'rxjs';

import { ShopHeaderComponent } from './shop-header.component';
import { PublicPageContext, createPublicPageContext } from '../../../../../../testing/public-test-helpers';

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
   * @description Start: shop module, header texts, site settings, no language switcher (languages
   *   not loaded); missing header section → null; failing config is logged.
   * @input Default; translations without header; config error.
   * @output setModule('shop'); t {cart}; settings; no .custom-dropdown / select, fetchLanguages not
   *   called; t null; console.error.
   */
  it('loads texts and site data without a language switcher', fakeAsync(() => {
    create();
    expect(ctx.localization.setModule).toHaveBeenCalledWith('shop');
    expect(header.t).toEqual({ cart: 'Cart' });
    expect((fixture.nativeElement as HTMLElement).querySelector('.custom-dropdown, select')).toBeNull();
    expect(ctx.localization.fetchLanguages).not.toHaveBeenCalled();
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
   * @description Scrolled flag and the cart action; no currency switch any more (finding #43).
   * @input scrollY 30 / 0; openCart; render.
   * @output scrolled true / false; navigate cart; no CZK in the header.
   */
  it('handles scrolling and the cart', fakeAsync(() => {
    create();
    const scrollY = spyOnProperty(window, 'scrollY', 'get').and.returnValue(30);
    header.onWindowScroll();
    expect(header.isScrolled).toBeTrue();
    scrollY.and.returnValue(0);
    header.onWindowScroll();
    expect(header.isScrolled).toBeFalse();

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
