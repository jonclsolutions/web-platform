/**
 * @file web-layout.component.ts
 * @path src/app/public/web-pages/web-layout/web-layout.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Layout container for all public-facing web pages, providing a consistent structure with shared header and footer components.
 * @dependencies
 * - PublicHeaderComponent: Displays top-level navigation.
 * - PublicFooterComponent: Displays site-wide legal and contact information.
 * - CookieConsentComponent: Globální lišta souhlasu s cookies (2026) - vložena sem, ne do
 *   jednotlivých stránek, protože musí být viditelná/aktivní na celém veřejném webu, bez
 *   ohledu na to, na které podstránce se uživatel zrovna nachází.
 */

import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PublicHeaderComponent } from '../components/public-header/public-header.component';
import { PublicFooterComponent } from '../components/public-footer/public-footer.component';
import { CookieConsentComponent } from '../cookie-consent/cookie-consent.component';

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
  ],
  templateUrl: './web-layout.component.html',
  styleUrls: ['./web-layout.component.css']
})
export class WebLayoutComponent {
  /**
   * @description Toggles the 'no-scroll' class on the document root to block page scrolling when a mobile menu is active.
   * @param isMenuOpen Boolean flag indicating the visibility state of the navigation menu.
   * @note Manipulating document.documentElement is necessary here to ensure the browser's root scroll is disabled regardless of container layout.
   */
  toggleRootScroll(isMenuOpen: boolean): void {
    const htmlElement = document.documentElement;
    if (isMenuOpen) {
      htmlElement.classList.add('no-scroll');
    } else {
      htmlElement.classList.remove('no-scroll');
    }
  }
}