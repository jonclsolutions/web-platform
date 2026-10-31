/**
 * @file shop-footer.component.spec.ts
 * @path src/app/public/shop-pages/components/shop-footer/shop-footer.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of ShopFooterComponent: shop module, site data (footer text with {year}), social
 *   links, navigation / legal links, payment method icons (image or icon) and request errors.
 * @refactor-note (2026-10-31) Open finding #64: test of the hidden phone / company rows.
 * @dependencies
 * - createPublicPageContext (get spy routed by URL).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { ShopFooterComponent } from './shop-footer.component';
import { PublicPageContext, createPublicPageContext } from '../../../../../testing/public-test-helpers';

describe('ShopFooterComponent', () => {
  let ctx: PublicPageContext;
  let fixture: ComponentFixture<ShopFooterComponent>;
  let footer: ShopFooterComponent;

  /** Creates the footer; `config` answers public/legal/config. */
  function create(config: any): void {
    ctx = createPublicPageContext({ translations: { footer: { title: 'Shop' }, navigation: { home: 'Home' }, legal: { privacy_policy: 'Privacy' } } });
    ctx.publicData.get.and.callFake(((url: string) => url === 'public/legal/config'
      ? config
      : of([{ name: 'Card', image_url: 'card.svg' }, { name: 'Cash', icon: 'cash.svg' }])) as any);
    TestBed.configureTestingModule({ imports: [ShopFooterComponent], providers: ctx.providers });
    fixture = TestBed.createComponent(ShopFooterComponent);
    footer = fixture.componentInstance;
    fixture.detectChanges();
  }

  /**
   * @description Site data with {year}, links and payment icons; a translation reload repeats
   *   the links; without translations nothing is built.
   * @input footer_text '© {year} Shop', social links; translations; translations null.
   * @output '© <year> Shop'; social [fb]; nav [Home, navigation.faq_full]; legal [legal.terms_of_service, Privacy]; icons /storage/card.svg, /storage/cash.svg.
   */
  it('builds the footer from site data and translations', () => {
    create(of({ settings: { footer_text: '© {year} Shop' }, social_links: [{ id: 1, url: 'https://fb' }] }));
    expect(ctx.localization.setModule).toHaveBeenCalledWith('shop');
    expect(footer.siteSettings.footer_text).toBe(`© ${new Date().getFullYear()} Shop`);
    expect(footer.socialLinks.length).toBe(1);
    expect(footer.footerNavLinks.map(l => [l.route, l.text])).toEqual([['/home', 'Home'], ['/faq', 'navigation.faq_full']]);
    expect(footer.footerLegalLinks.map(l => l.text)).toEqual(['legal.terms_of_service', 'Privacy']);
    expect(footer.paymentMethods).toEqual([{ name: 'Card', icon: '/storage/card.svg' }, { name: 'Cash', icon: '/storage/cash.svg' }]);
    expect(footer.getStorageUrl('x.png')).toBe('/storage/x.png');
    expect(fixture.nativeElement.textContent).toContain('Shop');

    ctx.setTranslations(null);
    expect(footer.t).toEqual({ title: 'Shop' });
  });

  /**
   * @description Settings without footer text are kept as they are; a failing config is logged.
   * @input settings {}; config error.
   * @output siteSettings {}; console.error + siteSettings null.
   */
  it('handles missing footer text and failing site data', () => {
    create(of({ settings: {}, social_links: [] }));
    expect(footer.siteSettings).toEqual({});
    fixture.destroy();
    TestBed.resetTestingModule();
    spyOn(console, 'error');
    create(throwError(() => new Error('x')));
    expect(console.error).toHaveBeenCalled();
    expect(footer.siteSettings).toBeNull();
  });

  /**
   * @description Open finding #64 + optional company details: address, IČO, DIČ and phone render
   *   only with a value; a switched-off footer text (null) shows no line, the generic copyright
   *   is only for missing company details.
   * @input Settings with IČO only; then no settings (config without settings).
   * @output one company row (IČO), no phone row, empty footer bottom; then the translated copyright.
   */
  it('renders only the filled-in company details', () => {
    create(of({ settings: { company_name: 'Shop s.r.o.', ico: '123', contact_email: 'a@b.cz' }, social_links: [] }));
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.company-info p').length).toBe(1);
    expect(el.querySelector('.company-info p')?.textContent).toContain('123');
    expect(el.querySelectorAll('.contact-info p').length).toBe(1);
    expect(el.querySelector('.footer-bottom p')).toBeNull();
    fixture.destroy();

    TestBed.resetTestingModule();
    create(of({ settings: null, social_links: [] }));
    ctx.setTranslations({ footer: { title: 'Shop', copyright_text: '© {year} All' }, navigation: {}, legal: {} });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.footer-bottom p')?.textContent).toContain(`© ${new Date().getFullYear()} All`);
  });
});
