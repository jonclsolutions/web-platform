/**
 * @file shop-layout.component.ts
 * @path src/app/apps/shop/public/shop-layout/shop-layout.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Provides the structural wrapper for the e-shop section, incorporating the global header and footer components with an outlet for nested routes.
 * @dependencies
 * - RouterOutlet: Enables dynamic rendering of nested shop pages (catalog, product detail, checkout).
 * - ShopHeaderComponent: Persistent navigation bar for the shop module.
 * - ShopFooterComponent: Persistent footer for the shop module.
 * - SeoService: meta description, canonical, og:* and JSON-LD from the site settings.
 * - LanguageSuggestionComponent: one-time offer of the visitor's own language (light look).
 * - CookieConsentComponent + AnalyticsService: the cookie bar of the e-shop (its texts are the
 *   section `cookie_consent` of the e-shop texts) and Google Analytics - one Measurement ID for
 *   the whole domain (company profile), started only with the visitor's consent (Consent Mode v2).
 *   The consent is shared with the website (same browser storage).
 */

import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ShopFooterComponent } from '../components/shop-footer/shop-footer.component';
import { ShopHeaderComponent } from '../components/shop-header/shop-header.component';
import { SeoService } from '../../../../shared/services/seo.service';
import { LanguageSuggestionComponent } from '../../../../shared/components/language-suggestion/language-suggestion.component';
import { CookieConsentComponent } from '../../../../public/legal/cookie-consent/cookie-consent.component';
import { AnalyticsService } from '../../../../shared/services/analytics.service';
/**
 * @description Master layout component for the shop module.
 * @usage Acts as the main container for all shop-related views, ensuring header and footer are consistent across navigation.
 * @note This layout is typically associated with the main shop route in the application routing configuration.
 */
@Component({
  selector: 'app-shop-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    ShopHeaderComponent,
    ShopFooterComponent,
    LanguageSuggestionComponent,
    CookieConsentComponent,
],
  templateUrl: './shop-layout.component.html',
  styleUrls: ['./shop-layout.component.css']
})
export class ShopLayoutComponent implements OnInit {
  private seoService = inject(SeoService);
  private analyticsService = inject(AnalyticsService);

  ngOnInit(): void {
    this.seoService.init();
    // analytics of the whole domain - the same ID and consent as the website (once per app)
    this.analyticsService.init();
  }
}