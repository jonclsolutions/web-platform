/**
 * @file analytics.service.ts
 * @path src/app/shared/services/analytics.service.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Dynamicky vkládá Google Analytics 4 (gtag.js) a řídí Google Consent Mode v2.
 * @note Neguje potřebu mít GA skript napevno v index.html - respektuje souhlas uživatele
 * (viz CookieConsentService) i to, jestli je vůbec Measurement ID nastavené (viz
 * SiteSetting.google_analytics_id, spravováno v adminu na stránce Nastavení webu).
 *
 * @dependencies
 * - PublicDataService: Zdroj `google_analytics_id` (z cache naplněné při bootstrapu).
 * - CookieConsentService: Zdroj aktuálního stavu souhlasu s cookies.
 *
 * Postup podle doporučení Google (Consent Mode v2):
 * 1) Defaultní stav (denied) se nastaví HNED při startu - dřív, než se cokoliv
 *    dalšího stihne stát, bez ohledu na to, jestli už známe Measurement ID.
 * 2) Skript gtag.js se vloží teprve, když jsou splněné OBĚ podmínky: známe
 *    Measurement ID A uživatel odsouhlasil kategorii "Analytické".
 * 3) Při jakékoli další změně souhlasu se pošle `consent update` signál -
 *    skript se needstraňuje, GA jen podle signálu přestane/začne sbírat data.
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
   * @description Spustí sledování defaultního consent stavu a reaguje na příchod
   *              Measurement ID / změny souhlasu. Volat jednou při startu aplikace
   *              (viz WebLayoutComponent) - je bezpečné zavolat vícekrát, druhé
   *              volání se ignoruje.
   */
  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    // 1) Defaultní stav HNED, bez čekání na cokoliv dalšího.
    this.setDefaultConsentState();

    // 2) Jakmile dorazí site settings (z cache naplněné při bootstrapu, viz
    //    AppBootstrapService), zjistíme Measurement ID a zkusíme případně načíst.
    this.publicDataService.siteSettingsValue$.subscribe(data => {
      const id = data?.settings?.google_analytics_id || null;
      if (id && id !== this.measurementId) {
        this.measurementId = id;
        this.maybeLoadGtag();
      }
    });

    // 3) Reakce na (jakoukoli) změnu souhlasu - i opakovanou.
    this.cookieConsentService.consent$.subscribe(consent => {
      this.updateConsentState(consent);
      this.maybeLoadGtag();
    });
  }

  /**
   * @description Nastaví výchozí (odmítnutý) stav pro všechny 4 signály Consent Mode v2.
   *              `wait_for_update` dává gtag.js 500ms na to počkat na případnou aktualizaci
   *              souhlasu, než odešle první data - drobná pojistka proti race podmínce.
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
   * @description Aktualizuje Consent Mode signály podle aktuálního stavu souhlasu.
   *              Marketingové cookies řídí ad_* signály, analytické analytics_storage.
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
   * @description Vloží gtag.js skript, pokud (a jen pokud) máme Measurement ID
   *              a uživatel zároveň odsouhlasil analytické cookies. Skript se
   *              vloží nejvýše jednou (viz `gaLoaded`).
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