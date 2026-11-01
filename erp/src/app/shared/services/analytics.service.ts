/**
 * @file analytics.service.ts
 * @path src/app/shared/services/analytics.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Injects Google Analytics 4 (gtag.js) dynamically and drives Google Consent Mode v2.
 * @note No GA script hard-coded in index.html - respects the user's consent (see
 * CookieConsentService) and whether a Measurement ID is set at all (see
 * SiteSetting.google_analytics_id, managed in the admin on the web settings page).
 *
 * @dependencies
 * - PublicDataService: Source of `google_analytics_id` (from the cache filled at bootstrap).
 * - CookieConsentService: Source of the current cookie consent state.
 *
 * @note Procedure recommended by Google (Consent Mode v2):
 * 1) The default state (denied) is set AT ONCE on start - before anything else can happen,
 *    regardless of whether the Measurement ID is known yet.
 * 2) The gtag.js script is injected only when BOTH conditions are met: the Measurement ID is
 *    known AND the user accepted the "Analytics" category.
 * 3) On any further consent change a `consent update` signal is sent - the script is not
 *    removed, GA only stops / starts collecting data by the signal.
 */

import { Injectable, inject } from '@angular/core';
import { PublicDataService } from './public-data.service';
import { CookieConsentService, CookieConsentState } from './cookie-consent.service';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {

  private publicDataService = inject(PublicDataService);
  private cookieConsentService = inject(CookieConsentService);

  private measurementId: string | null = null;
  private gaLoaded = false;
  private initialized = false;

  /**
   * @description Starts tracking the default consent state and reacts to the Measurement ID
   *              arriving / consent changes. Call once on application start (see
   *              WebLayoutComponent) - calling it again is safe, the second call is ignored.
   */
  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    // 1) Default state AT ONCE, without waiting for anything else.
    this.setDefaultConsentState();

    // 2) Once the site settings arrive (from the cache filled at bootstrap, see
    //    AppBootstrapService), read the Measurement ID and try loading.
    this.publicDataService.siteSettingsValue$.subscribe(data => {
      const id = data?.settings?.google_analytics_id || null;
      if (id && id !== this.measurementId) {
        this.measurementId = id;
        this.maybeLoadGtag();
      }
    });

    // 3) React to (any) consent change - also repeated.
    this.cookieConsentService.consent$.subscribe(consent => {
      this.updateConsentState(consent);
      this.maybeLoadGtag();
    });
  }

  /**
   * @description Sets the default (denied) state of all 4 Consent Mode v2 signals.
   *              `wait_for_update` gives gtag.js 500 ms to wait for a consent update before
   *              sending the first data - a small safeguard against a race condition.
   */
  private setDefaultConsentState(): void {
    this.pushToDataLayer('consent', 'default', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      wait_for_update: 500,
    });
  }

  /**
   * @description Updates the Consent Mode signals by the current consent state.
   *              Marketing cookies drive the ad_* signals, analytics drive analytics_storage.
   */
  private updateConsentState(consent: CookieConsentState | null): void {
    if (!consent) return;

    this.pushToDataLayer('consent', 'update', {
      analytics_storage: consent.analytics ? 'granted' : 'denied',
      ad_storage: consent.marketing ? 'granted' : 'denied',
      ad_user_data: consent.marketing ? 'granted' : 'denied',
      ad_personalization: consent.marketing ? 'granted' : 'denied',
    });
  }

  /**
   * @description Injects the gtag.js script if (and only if) the Measurement ID is known and the
   *              user accepted analytics cookies. Injected at most once (see `gaLoaded`).
   */
  private maybeLoadGtag(): void {
    if (this.gaLoaded) return;
    if (!this.measurementId) return;
    if (!this.cookieConsentService.current?.analytics) return;

    this.gaLoaded = true;
    this.injectScript(this.measurementId);
  }

  private injectScript(measurementId: string): void {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);

    this.pushToDataLayer('js', new Date());
    this.pushToDataLayer('config', measurementId);
  }

  private pushToDataLayer(...args: unknown[]): void {
    const win = window as any;
    win.dataLayer = win.dataLayer || [];
    win.dataLayer.push(args);
  }
}