/**
 * @file web-layout.component.ts
 * @path src/app/apps/web/public/web-layout/web-layout.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Layout container for all public-facing web pages, providing a consistent structure with shared header and footer components.
 * @dependencies
 * - PublicHeaderComponent: Displays top-level navigation.
 * - PublicFooterComponent: Displays site-wide legal and contact information.
 * - CookieConsentComponent: Global cookie consent bar.
 * - AnalyticsService: Google Analytics 4 + Consent Mode v2 - started here, because this layout
 *   wraps the whole public web regardless of the current subpage.
 * - SeoService: meta description, canonical, og:* and JSON-LD from the site settings.
 * - LanguageSuggestionComponent: one-time offer of the visitor's own language (dark look).
 */

import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PublicHeaderComponent } from '../components/public-header/public-header.component';
import { PublicFooterComponent } from '../components/public-footer/public-footer.component';
import { AnalyticsService } from '../../../../shared/services/analytics.service';
import { SeoService } from '../../../../shared/services/seo.service';
import { CookieConsentComponent } from '../../../../public/legal/cookie-consent/cookie-consent.component';
import { LanguageSuggestionComponent } from '../../../../shared/components/language-suggestion/language-suggestion.component';
/**
 * @description Main layout wrapper for the web application's public pages.
 * @usage Used in app.routes.ts to define the structure for all children routes under the root path.
 * @note Implements logic to manage global scrolling state based on navigation menu visibility.
 */
@Component({
  selector: 'app-web-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    PublicHeaderComponent,
    PublicFooterComponent,
    CookieConsentComponent,
    LanguageSuggestionComponent,
  ],
  templateUrl: './web-layout.component.html',
})
export class WebLayoutComponent implements OnInit {

  private analyticsService = inject(AnalyticsService);
  private seoService = inject(SeoService);

  ngOnInit(): void {
    this.analyticsService.init();
    this.seoService.init();
  }
}
