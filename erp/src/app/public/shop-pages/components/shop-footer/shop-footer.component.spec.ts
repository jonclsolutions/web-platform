/**
 * @file shop-footer.component.spec.ts
 * @path src/app/public/shop-pages/components/shop-footer/shop-footer.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of ShopFooterComponent: shop module, site data (footer text with {year}), social
 *   links, navigation / legal links, payment method icons (image or icon) and request errors.
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
});
