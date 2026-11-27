/**
 * @file shop-footer.component.ts
 * @path src/app/apps/shop/public/components/shop-footer/shop-footer.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Presentational component for the e-shop footer, managing dynamic content such as site settings, social links, payment icons, and localized navigation.
 * @dependencies
 * - LocalizationService: Supplies translated strings based on user locale.
 * - PublicDataService: Fetches global configuration, social media links, and payment method assets.
 * - RouterModule: Facilitates navigation to internal support/legal pages.
 * - RxJS: Manages subscription lifecycles to prevent memory leaks.
 * - FooterLanguageSwitcherComponent: Language switcher of the bottom bar (moved from the header).
 * @note The copyright line is a text of the e-shop (`footer.copyright_text`, Texty e-shopu; a
 *   missing one is 'Cannot load text' - the texts of the API), shown unless switched off on that
 *   page (`show_footer_copyright` of shop/public/status). The company profile has no footer text.
 */

import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { LocalizationService } from '../../../../../shared/services/localization.service';
import { PublicDataService } from '../../../../../shared/services/public-data.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { hasApp } from '../../../../apps.registry';
import { FooterLanguageSwitcherComponent } from '../../../../../shared/components/footer-language-switcher/footer-language-switcher.component';

/** Data structure for internal/external navigation links */
interface FooterNavLink { route: string; text: string; external: boolean; }

/** Data structure for payment method branding */
interface PaymentMethod { name: string; icon: string; }

/** Data structure for social media references */
interface SocialLink { name: string; url: string; icon_path: string; }

/**
 * @description Component for the site-wide shop footer.
 * @usage Renders dynamic footer content including links, payment methods, and branding info.
 * @note Implements OnPush change detection to minimize re-renders after initial data binding.
 */
@Component({
  selector: 'app-shop-footer',
  standalone: true,
  templateUrl: './shop-footer.component.html',
  styleUrls: ['../../shared-styles/theme.css', './shop-footer.component.css'],
  imports: [RouterModule, FooterLanguageSwitcherComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShopFooterComponent implements OnInit, OnDestroy {
  /** Reference to localized footer strings */
  t: any = null;
  currentYear: number;
  footerNavLinks: FooterNavLink[] = [];
  footerLegalLinks: FooterNavLink[] = [];
  paymentMethods: PaymentMethod[] = [];
  
  siteSettings: any = null;
  socialLinks: SocialLink[] = [];
  /** The copyright line is shown (shop/public/status; shown until the answer comes). */
  showCopyright = true;

  private destroy$ = new Subject<void>();

  constructor(
    private localizationService: LocalizationService,
    private publicDataService: PublicDataService,
    private cdr: ChangeDetectorRef
  ) {
    this.localizationService.setModule('shop');
    this.currentYear = new Date().getFullYear();
  }

  /**
   * @description Initializes subscriptions for localization and site configuration data.
   */
  ngOnInit(): void {
    this.loadSiteData();
    this.loadFooterOptions();
    this.localizationService.currentTranslations$
      .pipe(takeUntil(this.destroy$))
      .subscribe(translations => {
        if (translations) {
          this.t = translations.footer;
          this.loadFooterNavLinks();
          this.loadFooterLegalLinks();
          this.loadPaymentMethods();
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * @description Copyright line of the e-shop texts ('{year}' replaced); '' when switched off on
   *   the texts page or before the texts are loaded.
   * @returns The copyright text or ''.
   */
  get copyrightText(): string {
    const text = this.showCopyright ? this.t?.copyright_text : '';
    return typeof text === 'string' ? text.replace('{year}', this.currentYear.toString()) : '';
  }

  /** @description Reads whether the copyright line is switched on (Texty e-shopu). */
  private loadFooterOptions(): void {
    this.publicDataService.get<{ show_footer_copyright?: boolean }>('shop/public/status')
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
   * @description Fetches global site metadata and social links from the Public API.
   */
  private loadSiteData(): void {
    this.publicDataService.get<{settings: any, social_links: SocialLink[]}>('public/legal/config')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.siteSettings = data.settings;
          this.socialLinks = data.social_links;
          this.cdr.markForCheck();
        },
        error: (err) => console.error('Error loading footer site data:', err)
      });
  }

  /**
   * @description Fetches enabled payment methods and resolves their icon URLs.
   */
  private loadPaymentMethods(): void {
    this.publicDataService.get<any[]>('shop/public/payment-methods')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (methods) => {
          this.paymentMethods = methods.map((m: any) => ({
            name: m.name,
            icon: this.publicDataService.getStorageUrl(m.image_url || m.icon)
          }));
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * @description Helper to resolve absolute storage paths from relative database paths.
   * @param path Relative path from DB.
   * @returns Full storage URI.
   */
  getStorageUrl(path: string): string {
    return this.publicDataService.getStorageUrl(path);
  }

  /**
   * @description Generates the main navigation links based on current localization.
   */
  private loadFooterNavLinks(): void {
    // Links to the public web only when it is part of this build (apps.registry).
    const navLinkKeys = hasApp('web') ? [
      { route: '/home', key: 'navigation.home', ext: false },
      { route: '/faq', key: 'navigation.faq_full', ext: false }
    ] : [];
    this.footerNavLinks = navLinkKeys.map(link => ({ 
      route: link.route, 
      text: this.localizationService.getText(link.key), 
      external: link.ext 
    }));
  }

  /**
   * @description Generates the legal navigation links based on current localization.
   */
  private loadFooterLegalLinks(): void {
    const legalLinkKeys = [
      { route: '/shop/tos', key: 'legal.terms_of_service' },
      { route: '/shop/privacy-policy', key: 'legal.privacy_policy' },
      { route: '/shop/cookies-policy', key: 'legal.cookies_policy' }
    ];
    this.footerLegalLinks = legalLinkKeys.map(link => ({ 
      route: link.route, 
      text: this.localizationService.getText(link.key), 
      external: false 
    }));
  }

  /**
   * @description Cleans up observable subscriptions to prevent memory leaks.
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}