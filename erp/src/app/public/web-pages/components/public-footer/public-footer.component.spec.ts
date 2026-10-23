/**
 * @file public-footer.component.spec.ts
 * @path src/app/public/web-pages/components/public-footer/public-footer.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of PublicFooterComponent: link groups (translated titles, no Czech
 *   fallback any more - finding #44), legal and login links, the copyright / tagline per language (localized
 *   setting → plain setting → translation) and rendering without a contact phone (bugfix
 *   2026-10-23 - the footer is on every web page).
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
    footer: { group_offer: 'Offer', contact_header: 'Contact', copyright_text: '© {year} T', brand_tagline: 'T tagline', ico_label: 'ID' },
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
   *   links; renders without a phone in the settings.
   * @input Translations with group_offer only.
   * @output ['Offer', '', '']; 'Services', key for missing; /shop external;
   *   legal 3 links; login '/auth/login' 'Login'; 'RPSW' + 'a@b.cz' rendered.
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
   * @description Copyright and tagline: localized setting for the language → plain setting →
   *   translation; {year} replaced; nothing at all → ''.
   * @input i18n settings for en; language en / cz; plain settings; none.
   * @output 'EN 2026'-style text; plain; translation; ''.
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
    expect(footer.copyrightText).toBe(`© ${year} T`);
    expect(footer.brandTagline).toBe('T tagline');

    footer.settings = null;
    footer.t = null;
    expect(footer.copyrightText).toBe('');
    expect(footer.brandTagline).toBeUndefined();
  });
});
