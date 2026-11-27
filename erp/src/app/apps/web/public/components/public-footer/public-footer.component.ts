/**
 * @file public-footer.component.ts
 * @path src/app/apps/web/public/components/public-footer/public-footer.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Public site footer – brand block, grouped quick links
 *   (offer / company / support), contact, bottom bar with the language switcher, copyright,
 *   legal links and login.
 * @note The tagline is the company profile text of the current language only (companyText): a
 *   missing one is 'Cannot load text', a switched-off one is left out - never another language.
 * @note The copyright line is a text of the website (`footer.copyright_text`, Texty webu), shown
 *   unless switched off on that page (`show_footer_copyright` of web/public/status).
 * @dependencies BasePublicComponent, FooterLanguageSwitcherComponent, apps.registry, companyText
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { takeUntil } from 'rxjs';
import { RouterModule } from '@angular/router';
import { BasePublicComponent } from '../../../../../public/base-public.component';
import { hasApp } from '../../../../apps.registry';
import { FooterLanguageSwitcherComponent } from '../../../../../shared/components/footer-language-switcher/footer-language-switcher.component';
import { companyText } from '../../../../../shared/utils/company-text';

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
  styleUrls: ['../../shared-styles/theme.css', '../../../../../shared/styles/base.css', './public-footer.component.css'],
  imports: [RouterModule, FooterLanguageSwitcherComponent],
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
   *   titleKey = key inside the `footer` translation object (this.t).
   */
  private readonly linkGroupDefs: { titleKey: string; links: FooterLinkDef[] }[] = [
    {
      titleKey: 'group_offer',
      links: [
        { route: '/services',   key: 'navigation.services',        ext: false },
        { route: '/references', key: 'navigation.references_full', ext: false },
        // The e-shop only when it is part of this build (apps.registry).
        ...(hasApp('shop') ? [{ route: '/shop', key: 'navigation.shop', ext: true }] : []),
      ],
    },
    {
      titleKey: 'group_company',
      links: [
        { route: '/about-us', key: 'navigation.about-us', ext: false },
        { route: '/jobs',     key: 'navigation.jobs',     ext: false },
        { route: '/contact',  key: 'navigation.contact',  ext: false },
      ],
    },
    {
      titleKey: 'group_support',
      links: [
        { route: '/faq',            key: 'navigation.faq_full',                  ext: false },
        { route: '/knowledge-base', key: 'knowledge-base.knowledge-base_footer', ext: false },
      ],
    },
  ];

  /** The copyright line is shown (web/public/status; shown until the answer comes). */
  showCopyright = true;

  constructor() {
    super();
    // Localization module for the public web
    this.localizationService.setModule('web');
  }

  /** @description Reads whether the copyright line is switched on (Texty webu). */
  protected override onInit(): void {
    this.publicDataService.get<{ show_footer_copyright?: boolean }>('web/public/status')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: status => {
          this.showCopyright = status?.show_footer_copyright !== false;
          this.cdr.markForCheck();
        },
        error: () => {},
      });
  }

  /**
   * @description Hook from BasePublicComponent, called after every translation change.
   */
  protected override onTranslationsLoaded(): void {
    this.loadFooterLinkGroups();
    this.loadFooterLegalLinks();
    this.loadFooterLoginLink();
  }

  /**
   * @description Copyright line of the website texts in the current language ('{year}'
   *   replaced; a missing text is 'Cannot load text' - the texts of the API); '' when switched
   *   off on the texts page (the line is left out).
   * @returns The copyright text or ''.
   */
  get copyrightText(): string {
    // `t` = the section `footer` of the texts (no key shown before the texts arrive)
    const text = this.showCopyright ? this.t?.copyright_text : '';

    return typeof text === 'string' ? text.replace('{year}', this.currentYear.toString()) : '';
  }

  /**
   * @description Brand tagline of the current language; 'Cannot load text' when the language has
   *   none; '' when switched off in the admin.
   * @returns The tagline, the missing-text mark or ''.
   */
  get brandTagline(): string {
    return companyText(this.settings?.brand_tagline_i18n, this.localizationService.getCurrentLanguage());
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
      title: this.t?.[group.titleKey] ?? '',
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