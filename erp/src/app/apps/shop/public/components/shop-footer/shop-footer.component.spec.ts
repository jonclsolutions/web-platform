/**
 * @file shop-footer.component.spec.ts
 * @path src/app/apps/shop/public/components/shop-footer/shop-footer.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of ShopFooterComponent: shop module, site data, the copyright line of the e-shop texts (with {year}, switch of the texts page), social
 *   links, navigation / legal links, payment method icons (image or icon) and request errors.
 * @dependencies
 * - createPublicPageContext (get spy routed by URL).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { ShopFooterComponent } from './shop-footer.component';
import { PublicPageContext, createPublicPageContext } from '../../../../../../testing/public-test-helpers';
import { requiresApps } from '../../../../../../testing/requires-apps';

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
   * @input social links; translations with footer.copyright_text '© {year} Shop'; translations null.
   * @output copyrightText '© <year> Shop'; social [fb]; nav [Home, navigation.faq_full]; legal [legal.terms_of_service, Privacy]; icons /storage/card.svg, /storage/cash.svg.
   */
  it('builds the footer from site data and translations', () => {
    requiresApps('web');
    create(of({ settings: {}, social_links: [{ id: 1, url: 'https://fb' }] }));
    ctx.setTranslations({ footer: { title: 'Shop', copyright_text: '© {year} Shop' }, navigation: { home: 'Home' }, legal: { privacy_policy: 'Privacy' } });
    expect(ctx.localization.setModule).toHaveBeenCalledWith('shop');
    expect(footer.copyrightText).toBe(`© ${new Date().getFullYear()} Shop`);
    expect(footer.socialLinks.length).toBe(1);
    expect(footer.footerNavLinks.map(l => [l.route, l.text])).toEqual([['/home', 'Home'], ['/faq', 'navigation.faq_full']]);
    expect(footer.footerLegalLinks.map(l => l.text)).toEqual(['legal.terms_of_service', 'Privacy', 'legal.cookies_policy']);
    expect(footer.paymentMethods).toEqual([{ name: 'Card', icon: '/storage/card.svg' }, { name: 'Cash', icon: '/storage/cash.svg' }]);
    expect(footer.getStorageUrl('x.png')).toBe('/storage/x.png');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Shop');

    ctx.setTranslations(null);
    expect(footer.t).toEqual({ title: 'Shop', copyright_text: '© {year} Shop' });
  });

  /**
   * @description The language switcher sits in the bottom bar (moved from the header 2026-11),
   *   named by the shop translation.
   * @input translations footer.language_label 'Language'; languages cz / en.
   * @output .footer-bottom contains the switcher button with aria-label 'Language'; opened, two
   *   languages.
   */
  it('shows the language switcher in the bottom bar', () => {
    create(of({ settings: {}, social_links: [] }));
    ctx.setTranslations({ footer: { title: 'Shop', language_label: 'Language' }, navigation: {}, legal: {} });
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const trigger = root.querySelector('.footer-bottom app-footer-language-switcher .fls-trigger') as HTMLButtonElement;
    expect(trigger).not.toBeNull();
    expect(trigger.getAttribute('aria-label')).toBe('Language');
    trigger.click();
    fixture.detectChanges();
    expect(root.querySelectorAll('.footer-bottom .fls-option').length).toBe(2);
  });

  /**
   * @description The copyright line is left out when switched off on the texts page
   *   (shop/public/status show_footer_copyright false).
   * @input status { show_footer_copyright: false }; translations with the copyright.
   * @output status read; copyrightText ''; no line in the footer bottom.
   */
  it('hides the copyright line switched off on the texts page', () => {
    create(of({ settings: {}, social_links: [] }));
    expect(ctx.publicData.get).toHaveBeenCalledWith('shop/public/status');
    ctx.publicData.get.and.callFake(((url: string) => url === 'shop/public/status'
      ? of({ is_shop_active: true, show_footer_copyright: false })
      : of([])) as any);
    (footer as any).loadFooterOptions();
    ctx.setTranslations({ footer: { title: 'Shop', copyright_text: '© {year} Shop' }, navigation: {}, legal: {} });
    fixture.detectChanges();
    expect(footer.showCopyright).toBeFalse();
    expect(footer.copyrightText).toBe('');
    expect(fixture.nativeElement.querySelector('.footer-bottom .footer-text')).toBeNull();
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
   *   only with a value; without a copyright text (texts not loaded) the bottom bar has no line;
   *   with the e-shop texts the copyright line is shown (also without company details).
   * @input Settings with IČO only, translations without a copyright; then no settings and the
   *   translations with the copyright.
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
