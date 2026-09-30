/**
 * @file public-footer.component.ts
 * @path src/app/public/web-pages/components/public-footer/public-footer.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Public site footer – brand block, grouped quick links
 *   (offer / company / support), contact, copyright bar with legal links and login.
 * @refactor-note (2026-09-30) Flat `footerNavLinks` list replaced by
 *   `footerLinkGroups` (3 topic groups). "Home" removed (logo links home).
 *   Login moved to the bottom bar (`footerLoginLink`).
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { BasePublicComponent } from '../../../base-public.component';

/** Single footer link after translation. */
interface FooterNavLink {
  route: string;
  text: string;
  external: boolean;
}

/** Titled group of footer links (rendered as one column). */
interface FooterLinkGroup {
  title: string;
  links: FooterNavLink[];
}

/** Link definition before translation (route + translation key). */
interface FooterLinkDef {
  route: string;
  key: string;
  ext: boolean;
}

@Component({
  selector: 'app-public-footer',
  standalone: true,
  templateUrl: './public-footer.component.html',
  styleUrls: ['./public-footer.component.css'],
  imports: [RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PublicFooterComponent extends BasePublicComponent {

  protected readonly translationKey = 'footer';
  protected override readonly loadSiteSettings = true;

  logo_big: string = 'assets/images/logos/logo_big.svg';

  currentYear: number = new Date().getFullYear();
  footerLinkGroups: FooterLinkGroup[] = [];
  footerLegalLinks: FooterNavLink[] = [];
  footerLoginLink: FooterNavLink | null = null;

  /**
   * @description Footer link groups by what the visitor is looking for.
   *   titleKey = key inside the `footer` translation object (this.t),
   *   fallback = text used when the translation key is missing.
   */
  private readonly linkGroupDefs: { titleKey: string; fallback: string; links: FooterLinkDef[] }[] = [
    {
      titleKey: 'group_offer',
      fallback: 'Nabídka',
      links: [
        { route: '/services',   key: 'navigation.services',        ext: false },
        { route: '/references', key: 'navigation.references_full', ext: false },
        { route: '/shop',       key: 'navigation.shop',            ext: true  },
      ],
    },
    {
      titleKey: 'group_company',
      fallback: 'Společnost',
      links: [
        { route: '/about-us', key: 'navigation.about-us', ext: false },
        { route: '/jobs',     key: 'navigation.jobs',     ext: false },
        { route: '/contact',  key: 'navigation.contact',  ext: false },
      ],
    },
    {
      titleKey: 'group_support',
      fallback: 'Podpora',
      links: [
        { route: '/faq',            key: 'navigation.faq_full',                  ext: false },
        { route: '/knowledge-base', key: 'knowledge-base.knowledge-base_footer', ext: false },
      ],
    },
  ];

  constructor() {
    super();
    // Localization module for the public web
    this.localizationService.setModule('web');
  }

  /**
   * @description Hook from BasePublicComponent, called after every translation change.
   */
  protected override onTranslationsLoaded(): void {
    this.loadFooterLinkGroups();
    this.loadFooterLegalLinks();
    this.loadFooterLoginLink();
  }

  get copyrightText(): string {
    const lang = this.localizationService.getCurrentLanguage();
    const i18n = this.settings?.copyright_text_i18n;

    const text = (i18n && i18n[lang])
      ? i18n[lang]
      : (this.settings?.copyright_text || this.t?.copyright_text || '');

    return text.replace('{year}', this.currentYear.toString());
  }

  get brandTagline(): string {
    const lang = this.localizationService.getCurrentLanguage();
    const i18n = this.settings?.brand_tagline_i18n;

    return (i18n && i18n[lang])
      ? i18n[lang]
      : (this.settings?.brand_tagline || this.t?.brand_tagline);
  }

  /** @description Translates one link definition. */
  private toNavLink(def: FooterLinkDef): FooterNavLink {
    return {
      route: def.route,
      text: this.localizationService.getText(def.key),
      external: def.ext,
    };
  }

  private loadFooterLinkGroups(): void {
    this.footerLinkGroups = this.linkGroupDefs.map(group => ({
      title: this.t?.[group.titleKey] || group.fallback,
      links: group.links.map(def => this.toNavLink(def)),
    }));
  }

  private loadFooterLegalLinks(): void {
    const legalLinkDefs: FooterLinkDef[] = [
      { route: '/privacy-policy', key: 'legal.privacy_policy',   ext: false },
      { route: '/tos',            key: 'legal.terms_of_service', ext: false },
      { route: '/cookies-policy', key: 'legal.cookies_policy',   ext: false },
    ];

    this.footerLegalLinks = legalLinkDefs.map(def => this.toNavLink(def));
  }

  private loadFooterLoginLink(): void {
    this.footerLoginLink = this.toNavLink({ route: '/auth/login', key: 'navigation.login_btn', ext: false });
  }
}