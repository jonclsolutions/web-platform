/**
 * @file public-footer.component.spec.ts
 * @path src/app/public/web-pages/components/public-footer/public-footer.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of PublicFooterComponent: link groups (translated titles, no Czech
 *   fallback any more - finding #44), legal and login links, the copyright / tagline per language (localized
 *   setting → plain setting, no translation fallback since 2026-10-31) and rendering without a
 *   contact phone (bugfix 2026-10-23 - the footer is on every web page).
 * @refactor-note (2026-10-31) Optional company details / open finding #64: empty or switched-off
 *   fields (null from the API) render no row; no translation fallback for tagline / copyright.
 * @dependencies
 * - createPublicPageContext (getText resolves the navigation keys).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PublicFooterComponent } from './public-footer.component';
import { PublicPageContext, createPublicPageContext } from '../../../../../testing/public-test-helpers';

describe('PublicFooterComponent', () => {
  let ctx: PublicPageContext;
  let fixture: ComponentFixture<PublicFooterComponent>;
  let footer: PublicFooterComponent;
  const translations = {
    footer: { group_offer: 'Offer', contact_header: 'Contact', ico_label: 'ID', dic_label: 'VAT' },
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
   * @output ['Offer', '', '']; 'Services', key for missing; /shop external;
   *   legal 3 links; login '/auth/login' 'Login'; 'RPSW' + 'a@b.cz' rendered; one meta item (IČO);
   *   no tel: link, address, tagline or copyright element.
   */
  it('builds the link groups and renders without a phone', () => {
    expect(ctx.localization.setModule).toHaveBeenCalledWith('web');
    expect(footer.footerLinkGroups.map(g => g.title)).toEqual(['Offer', '', '']);
    expect(footer.footerLinkGroups[0].links.map(l => [l.route, l.text, l.external])).toEqual([
      ['/services', 'Services', false], ['/references', 'navigation.references_full', false], ['/shop', 'navigation.shop', true]
    ]);
    expect(footer.footerLegalLinks.map(l => [l.route, l.text])).toEqual([['/privacy-policy', 'Privacy'], ['/tos', 'legal.terms_of_service'], ['/cookies-policy', 'legal.cookies_policy']]);
    expect(footer.footerLoginLink).toEqual({ route: '/auth/login', text: 'Login', external: false });
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('RPSW');
    expect(text).toContain('a@b.cz');
  });

  /**
   * @description Copyright and tagline: localized setting for the language → plain setting;
   *   {year} replaced; a missing or switched-off value → '' (no translation fallback).
   * @input i18n settings for en; language en / cz; plain settings; empty settings; none.
   * @output 'EN 2026'-style text; plain; ''; ''.
   */
  it('resolves copyright and tagline per language', () => {
    const year = new Date().getFullYear();
    footer.settings = { copyright_text_i18n: { en: 'EN {year}' }, brand_tagline_i18n: { en: 'EN tag' }, copyright_text: 'Plain {year}', brand_tagline: 'Plain tag' };
    ctx.localization.currentLanguage$.next('en');
    expect(footer.copyrightText).toBe(`EN ${year}`);
    expect(footer.brandTagline).toBe('EN tag');

    ctx.localization.currentLanguage$.next('cz');
    expect(footer.copyrightText).toBe(`Plain ${year}`);
    expect(footer.brandTagline).toBe('Plain tag');

    footer.settings = {};
    expect(footer.copyrightText).toBe('');
    expect(footer.brandTagline).toBe('');

    footer.settings = null;
    footer.t = null;
    expect(footer.copyrightText).toBe('');
    expect(footer.brandTagline).toBe('');
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.footer-meta-item').length).toBe(1);
    expect(el.querySelector('.footer-meta-item')?.textContent).toContain('123');
    expect(el.querySelector('a[href^="tel:"]')).toBeNull();
    expect(el.querySelector('.footer-contact-address')).toBeNull();
    expect(el.querySelector('.footer-brand-tagline')).toBeNull();
    expect(el.querySelector('.footer-copy')).toBeNull();
  });

  /**
   * @description With every company detail filled in, all rows render.
   * @input Settings with tagline, IČO, DIČ, phone, address and copyright.
   * @output two meta items; tel: link '+420111'; address, tagline and copyright elements.
   */
  it('renders every filled-in company detail', () => {
    footer.settings = { company_name: 'RPSW', contact_email: 'a@b.cz', ico: '123', dic: 'CZ123', contact_phone: '+420 111',
      address: 'Praha', brand_tagline: 'Tag', copyright_text: '© RPSW' };
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
