/**
 * @file public-footer.component.spec.ts
 * @path src/app/apps/web/public/components/public-footer/public-footer.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of PublicFooterComponent: link groups (translated titles, no Czech
 *   fallback any more - finding #44), legal and login links, the tagline per language (the text of
 *   the language only), the copyright of the website texts (switch of the texts page) and rendering without a
 *   contact phone (bugfix 2026-10-23 - the footer is on every web page) and the language switcher
 *   in the bottom bar (moved from the header 2026-11).
 * @dependencies
 * - createPublicPageContext (getText resolves the navigation keys).
 */

import { MISSING_TEXT } from '../../../../../shared/utils/missing-text';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { PublicFooterComponent } from './public-footer.component';
import { PublicPageContext, createPublicPageContext } from '../../../../../../testing/public-test-helpers';
import { hasApp } from '../../../../apps.registry';

describe('PublicFooterComponent', () => {
  let ctx: PublicPageContext;
  let fixture: ComponentFixture<PublicFooterComponent>;
  let footer: PublicFooterComponent;
  const translations = {
    footer: { group_offer: 'Offer', contact_header: 'Contact', ico_label: 'ID', dic_label: 'VAT', language_label: 'Language' },
    navigation: { services: 'Services', jobs: 'Jobs', login_btn: 'Login' },
    legal: { privacy_policy: 'Privacy' }
  };

  beforeEach(() => {
    ctx = createPublicPageContext({ translations, settings: { settings: { company_name: 'RPSW', contact_email: 'a@b.cz', ico: '123' }, social_links: [] } });
    TestBed.configureTestingModule({ imports: [PublicFooterComponent], providers: ctx.providers });
    fixture = TestBed.createComponent(PublicFooterComponent);
    footer = fixture.componentInstance;
    fixture.detectChanges();
  });

  /**
   * @description Groups with translated titles (an untranslated group title stays empty instead of
   *   a Czech fallback, finding #44), link texts from getText (key when missing), legal and login
   *   links; renders without a phone, address, DIČ, tagline and copyright in the settings
   *   (missing or switched off in the admin) - no empty rows.
   * @input Translations with group_offer only; settings name, e-mail, IČO.
   * @output ['Offer', '', '']; 'Services', key for missing; /shop external (only with the e-shop
   *   installed);
   *   legal 3 links; login '/auth/login' 'Login'; 'RPSW' + 'a@b.cz' rendered; one meta item (IČO);
   *   no tel: link, address, tagline or copyright element.
   */
  it('builds the link groups and renders without a phone', () => {
    expect(ctx.localization.setModule).toHaveBeenCalledWith('web');
    expect(footer.footerLinkGroups.map(g => g.title)).toEqual(['Offer', '', '']);
    expect(footer.footerLinkGroups[0].links.map(l => [l.route, l.text, l.external])).toEqual([
      ['/services', 'Services', false], ['/references', 'navigation.references_full', false],
      ...(hasApp('shop') ? [['/shop', 'navigation.shop', true]] : []),
    ]);
    expect(footer.footerLegalLinks.map(l => [l.route, l.text])).toEqual([['/privacy-policy', 'Privacy'], ['/tos', 'legal.terms_of_service'], ['/cookies-policy', 'legal.cookies_policy']]);
    expect(footer.footerLoginLink).toEqual({ route: '/auth/login', text: 'Login', external: false });
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('RPSW');
    expect(text).toContain('a@b.cz');
  });

  /**
   * @description Tagline: the company profile text of the current language only - a language
   *   without it → 'Cannot load text' (never the Czech text), switched off (null map) or no
   *   settings → '' (left out). Copyright: the website text `footer.copyright_text` with {year}
   *   replaced, left out when switched off on the texts page (web/public/status).
   * @input tagline map for en; language en / cz; no map; copyright text; status show false;
   *   no settings and the copyright switched off.
   * @output 'EN tag'; MISSING_TEXT; ''; '© <year> Web'; status read once, '' when switched off;
   *   no tagline / copyright elements.
   */
  it('resolves the tagline per language and the copyright of the website texts', () => {
    const year = new Date().getFullYear();
    footer.settings = { brand_tagline_i18n: { en: 'EN tag' }, brand_tagline: 'Plain tag' };
    ctx.localization.currentLanguage$.next('en');
    expect(footer.brandTagline).toBe('EN tag');
    ctx.localization.currentLanguage$.next('cz');
    expect(footer.brandTagline).toBe(MISSING_TEXT);
    footer.settings = {};
    expect(footer.brandTagline).toBe('');

    ctx.setTranslations({ ...translations, footer: { ...translations.footer, copyright_text: '© {year} Web' } });
    expect(footer.copyrightText).toBe(`© ${year} Web`);
    expect(ctx.publicData.get).toHaveBeenCalledWith('web/public/status');
    ctx.publicData.get.and.returnValue(of({ is_web_active: true, show_footer_copyright: false }));
    (footer as any).onInit();
    expect(footer.showCopyright).toBeFalse();
    expect(footer.copyrightText).toBe('');
    footer.settings = { company_name: 'RPSW', contact_email: 'a@b.cz', ico: '123' };
    (footer as any).cdr.markForCheck();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.footer-copy')).toBeNull();

    footer.settings = null;
    footer.t = null;
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.footer-meta-item').length).toBe(1);
    expect(el.querySelector('.footer-meta-item')?.textContent).toContain('123');
    expect(el.querySelector('a[href^="tel:"]')).toBeNull();
    expect(el.querySelector('.footer-contact-address')).toBeNull();
    expect(el.querySelector('.footer-brand-tagline')).toBeNull();
  });

  /**
   * @description The language switcher sits in the bottom bar, named by the translation.
   * @input translations footer.language_label 'Language'; languages cz / en.
   * @output .footer-bottom contains the switcher button with aria-label 'Language'; opened, two
   *   languages.
   */
  it('shows the language switcher in the bottom bar', () => {
    const root = fixture.nativeElement as HTMLElement;
    const trigger = root.querySelector('.footer-bottom app-footer-language-switcher .fls-trigger') as HTMLButtonElement;
    expect(trigger).not.toBeNull();
    expect(trigger.getAttribute('aria-label')).toBe('Language');
    trigger.click();
    fixture.detectChanges();
    expect(root.querySelectorAll('.footer-bottom .fls-option').length).toBe(2);
  });

  /**
   * @description With every company detail filled in, all rows render.
   * @input Settings with tagline, IČO, DIČ, phone, address (Czech texts); the copyright of the website texts.
   * @output two meta items; tel: link '+420111'; address, tagline and copyright elements.
   */
  it('renders every filled-in company detail', () => {
    footer.settings = { company_name: 'RPSW', contact_email: 'a@b.cz', ico: '123', dic: 'CZ123', contact_phone: '+420 111',
      address: 'Praha', brand_tagline_i18n: { cz: 'Tag' } };
    ctx.setTranslations({ ...translations, footer: { ...translations.footer, copyright_text: '© RPSW' } });
    (footer as any).cdr.markForCheck();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.footer-meta-item').length).toBe(2);
    expect(el.querySelector('a[href^="tel:"]')?.getAttribute('href')).toBe('tel:+420111');
    expect(el.querySelector('.footer-contact-address')?.textContent).toContain('Praha');
    expect(el.querySelector('.footer-brand-tagline')?.textContent).toContain('Tag');
    expect(el.querySelector('.footer-copy')?.textContent).toContain('© RPSW');
  });
});
