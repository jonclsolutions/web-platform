/**
 * @file app-bootstrap.service.ts
 * @path src/app/shared/services/app-bootstrap.service.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Preloads global data (translations, site settings, logo image) before the
 *   Angular app renders its root component. Used as the APP_INITIALIZER factory in app.config.ts.
 *   Also warms the legal-docs cache (GDPR/TOS) in the background AFTER the app has rendered,
 *   so visiting /privacy-policy or /tos later usually needs no network wait — without
 *   delaying the initial paint for pages almost nobody visits.
 * @note All requests inside init()'s Promise.all run in parallel — total wait time is bounded
 *   by the slowest one, not their sum. The logo image itself is preloaded as raw bytes (not
 *   just its path) so the <img> in the header can paint instantly from browser cache.
 */

import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { LocalizationService } from './localization.service';
import { PublicDataService } from './public-data.service';
import { LegalDocsService } from './legal-docs.service';

@Injectable({ providedIn: 'root' })
export class AppBootstrapService {
  private localizationService = inject(LocalizationService);
  private publicDataService = inject(PublicDataService);
  private legalDocsService = inject(LegalDocsService);

  /**
   * @description Entry point called by APP_INITIALIZER. Angular bootstrap is
   *   held until this Promise resolves — keep this to critical, above-the-fold
   *   data only (translations, settings, logo). Anything else goes to
   *   prefetchLegalDocs(), which is deliberately NOT awaited here.
   */
  async init(): Promise<void> {
    await Promise.all([
      this.localizationService.initTranslations(),
      this.preloadSiteSettings(),
    ]);

    // Fire-and-forget: runs after the app has already started rendering.
    // If it fails or is slow, nobody waits on it — the legal-page components
    // simply fall back to fetching on demand (see LegalDocsService.getDocument).
    this.prefetchLegalDocs();
  }

  /**
   * @description Fetches site settings, caches them in PublicDataService (so the header
   *   and anyone else reads from memory instead of firing a duplicate request), and then
   *   also preloads the actual logo image bytes so it's already in the browser's HTTP
   *   cache by the time the header component renders its <img>.
   */
  private async preloadSiteSettings(): Promise<void> {
    try {
      const data = await firstValueFrom(
        this.publicDataService.getSiteSettings()
      );
      this.publicDataService.setCachedSettings(data.settings);

      if (data.settings?.logo_path) {
        const logoUrl = this.publicDataService.getStorageUrl(data.settings.logo_path);
        await this.preloadImage(logoUrl);
      }
    } catch (err) {
      // Don't block app startup if this fails — components subscribed to
      // siteSettingsValue$ simply keep their placeholder state until a retry.
      console.error('[AppBootstrapService] Failed to preload site settings', err);
    }
  }

  /**
   * @description Downloads an image into the browser's HTTP cache ahead of time.
   *   Resolves on both success and failure (a broken/missing image must never
   *   block app startup) — the header's own placeholder still covers that case.
   */
  private preloadImage(url: string): Promise<void> {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = url;
    });
  }

  /**
   * @description Warms the LegalDocsService cache for GDPR + TOS in the currently
   *   selected language only (not every language — that would be wasted bandwidth
   *   for languages the visitor may never pick). Intentionally not awaited by init().
   */
  private prefetchLegalDocs(): void {
    const lang = this.localizationService.getCurrentLanguage();
    this.legalDocsService.preload('gdpr', lang).catch(() => {});
    this.legalDocsService.preload('tos', lang).catch(() => {});
  }
}