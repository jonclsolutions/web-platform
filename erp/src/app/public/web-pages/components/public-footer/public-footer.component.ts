/**
 * @file public-footer.component.ts
 * @path src/app/public/web-pages/components/public-footer/public-footer.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Manages the public-facing footer component, handling internationalized navigation, legal links, and dynamic site settings (copyright, taglines, social links).
 * @dependencies
 * - LocalizationService: Manages multi-language support and translation keys.
 * - PublicDataService: Fetches global configuration and assets from the backend.
 * - RxJS: Handles asynchronous data streams and subscription lifecycle.
 */

import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { LocalizationService } from '../../../../shared/services/localization.service';
import { PublicDataService } from '../../../../shared/services/public-data.service';
import { Subject } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';

interface FooterNavLink {
  route: string;
  text: string;
  external: boolean;
}

/**
 * @description Presentational component for the site's primary footer.
 * @usage Renders consistent site-wide navigation, legal documents, and dynamic branding.
 * @note Implements OnPush change detection and reactive streams to handle language switching and configuration updates seamlessly.
 */
@Component({
  selector: 'app-public-footer',
  standalone: true,
  templateUrl: './public-footer.component.html',
  styleUrls: ['./public-footer.component.css'],
  imports: [RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PublicFooterComponent implements OnInit, OnDestroy {
  t: any = null;
  settings: any = null;
  socialLinks: any[] = [];
  currentYear: number;
  footerNavLinks: FooterNavLink[] = [];
  footerLegalLinks: FooterNavLink[] = [];

  private destroy$ = new Subject<void>();

  constructor(
    private localizationService: LocalizationService,
    private publicDataService: PublicDataService,
    private cdr: ChangeDetectorRef
  ) {
    this.localizationService.setModule('web');
    this.currentYear = new Date().getFullYear();
  }

  /**
   * @description Initializes component state by subscribing to localization changes and fetching site configuration.
   */
  ngOnInit(): void {
      this.localizationService.currentTranslations$
        .pipe(takeUntil(this.destroy$))
        .subscribe(translations => {
          if (translations) {
            this.t = translations.footer;
            this.loadFooterNavLinks();
            this.loadFooterLegalLinks();
            this.cdr.markForCheck();
          }
        });

      this.localizationService.currentLanguage$
        .pipe(
          takeUntil(this.destroy$),
          switchMap(() => this.publicDataService.get<{settings: any, social_links: any[]}>('public/legal/config'))
        )
        .subscribe(res => {
          this.settings = res.settings;
          this.socialLinks = res.social_links;
          this.cdr.markForCheck();
        });
    }

  /**
   * @description Resolves absolute storage paths from relative database paths.
   * @param path The relative asset path.
   * @returns The fully qualified URI to the asset.
   */
  getIconUrl(path: string): string {
    return this.publicDataService.getStorageUrl(path);
  }

  /**
   * @description Computes the copyright text with dynamic year injection.
   * @note Prioritizes localized database strings (i18n), falling back to global settings, then translation files, and finally a hardcoded default.
   */
  get copyrightText(): string {
    const lang = this.localizationService.getCurrentLanguage();
    const i18n = this.settings?.copyright_text_i18n;
    
    const text = (i18n && i18n[lang]) 
      ? i18n[lang] 
      : (this.settings?.copyright_text || this.t?.copyright_text || '© {year} RegioPartner. All rights reserved.');
    
    return text.replace('{year}', this.currentYear.toString());
  }

  /**
   * @description Computes the brand tagline for the footer display.
   * @note Prioritizes localized database strings (i18n), with fallbacks to settings and translation files.
   */
  get brandTagline(): string {
    const lang = this.localizationService.getCurrentLanguage();
    const i18n = this.settings?.brand_tagline_i18n;
    
    return (i18n && i18n[lang]) 
      ? i18n[lang] 
      : (this.settings?.brand_tagline || this.t?.brand_tagline || 'We build digital products you\'ll be proud of.');
  }

  /**
   * @description Maps navigation keys to their localized labels for the footer menu.
   */
  private loadFooterNavLinks(): void {
    const navLinkKeys = [
      { route: '/home', key: 'navigation.home', ext: false },
      { route: '/services', key: 'navigation.services', ext: false },
      { route: '/academy', key: 'navigation.contact', ext: false },
      { route: '/shop', key: 'navigation.shop', ext: true }, 
      { route: '/references', key: 'navigation.references_full', ext: false },
      { route: '/faq', key: 'navigation.faq_full', ext: false },
      { route: '/about-us', key: 'navigation.about-us', ext: false },
      { route: '/jobs', key: 'navigation.jobs', ext: false },
      { route: '/auth/login', key: 'navigation.login_btn', ext: false },
    ];

    this.footerNavLinks = navLinkKeys.map(link => ({
      route: link.route,
      text: this.localizationService.getText(link.key),
      external: link.ext
    }));
  }

  /**
   * @description Maps legal navigation keys to localized labels.
   */
  private loadFooterLegalLinks(): void {
    const legalLinkKeys = [
      { route: '/privacy-policy', key: 'legal.privacy_policy' },
      { route: '/tos', key: 'legal.terms_of_service' }
    ];

    this.footerLegalLinks = legalLinkKeys.map(link => ({
      route: link.route,
      text: this.localizationService.getText(link.key),
      external: false
    }));
  }

  /**
   * @description Unsubscribes from all reactive streams to prevent memory leaks on component destruction.
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}