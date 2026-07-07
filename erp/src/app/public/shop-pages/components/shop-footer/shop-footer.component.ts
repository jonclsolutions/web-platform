/**
 * @file shop-footer.component.ts
 * @path src/app/public/shop-pages/components/shop-footer/shop-footer.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Presentational component for the e-shop footer, managing dynamic content such as site settings, social links, payment icons, and localized navigation.
 * @dependencies
 * - LocalizationService: Supplies translated strings based on user locale.
 * - PublicDataService: Fetches global configuration, social media links, and payment method assets.
 * - RouterModule: Facilitates navigation to internal support/legal pages.
 * - RxJS: Manages subscription lifecycles to prevent memory leaks.
 */

import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { LocalizationService } from '../../../../shared/services/localization.service';
import { PublicDataService } from '../../../../shared/services/public-data.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

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
  styleUrls: ['./shop-footer.component.css'],
  imports: [RouterModule],
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

  private destroy$ = new Subject<void>();

  constructor(
    private localizationService: LocalizationService,
    private publicDataService: PublicDataService,
    private cdr: ChangeDetectorRef
  ) {
    this.currentYear = new Date().getFullYear();
  }

  /**
   * @description Initializes subscriptions for localization and site configuration data.
   */
  ngOnInit(): void {
    this.loadSiteData();
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
   * @description Fetches global site metadata and social links from the Public API.
   * @note Automatically injects the current year into the footer text template.
   */
  private loadSiteData(): void {
    this.publicDataService.getSiteSettings()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.siteSettings = data.settings;
          this.socialLinks = data.social_links;
          
          if (this.siteSettings?.footer_text) {
            this.siteSettings.footer_text = this.siteSettings.footer_text.replace('{year}', this.currentYear.toString());
          }
          
          this.cdr.markForCheck();
        },
        error: (err) => console.error('Error loading footer site data:', err)
      });
  }

  /**
   * @description Fetches enabled payment methods and resolves their icon URLs.
   */
  private loadPaymentMethods(): void {
    this.publicDataService.getPaymentMethods()
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
    const navLinkKeys = [
      { route: '/home', key: 'navigation.home', ext: false },
      { route: '/faq', key: 'navigation.faq_full', ext: false }
    ];
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
      { route: '/tos', key: 'legal.terms_of_service' },
      { route: '/privacy-policy', key: 'legal.privacy_policy' }
    ];
    this.footerLegalLinks = legalLinkKeys.map(link => ({ 
      route: link.route, 
      text: this.localizationService.getText(link.key) || '', 
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