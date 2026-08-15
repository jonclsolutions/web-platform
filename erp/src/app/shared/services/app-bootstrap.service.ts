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
 *   Additionally sets up a global CSSOM-based ':hover' disabler for touch/narrow viewports,
 *   so hover-triggered styles never get "stuck" after a tap on mobile/tablet.
 * @note All requests inside init()'s Promise.all run in parallel — total wait time is bounded
 *   by the slowest one, not their sum. The logo image itself is preloaded as raw bytes (not
 *   just its path) so the <img> in the header can paint instantly from browser cache.
 *
 * @bugfix-note (2026-08-15) CRITICAL, part 1: init() used to fire preloadSiteSettings() and
 *   prefetchLegalDocs() unconditionally, before Angular Router could evaluate
 *   webMaintenanceGuard. Putting the web into maintenance mode did NOT stop these downloads.
 * @bugfix-note (2026-08-15) CRITICAL, part 2 (correction of the part-1 fix): the part-1 fix
 *   was too broad - it skipped preloadSiteSettings() entirely during maintenance, which also
 *   silently removed contact email/phone/social links from WebMaintenanceComponent, even
 *   though that component is explicitly designed to show them (see its refactor-note:
 *   "zobrazuje sociální ikony a kontaktní údaje"). The actual concern was narrower: only
 *   the full GDPR/TOS document BODIES (prefetchLegalDocs()) have no reason to download
 *   during maintenance - contact/social settings are legitimately needed by the
 *   maintenance page itself and are NOT sensitive/embargoed content. Fix: preloadSiteSettings()
 *   now runs unconditionally (same as before any of this); only prefetchLegalDocs() is
 *   skipped when the web is inactive.
 */

import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { LocalizationService } from './localization.service';
import { PublicDataService } from './public-data.service';
import { LegalDocsService } from './legal-docs.service';

/**
 * @description Viewport width (in px) at or below which ':hover' rules are
 *   globally suppressed. Matches the app's mobile/tablet breakpoint, where
 *   input is touch-based and hover has no meaningful interaction model.
 */
const HOVER_DISABLE_MAX_WIDTH = 906;

@Injectable({ providedIn: 'root' })
export class AppBootstrapService {
  private localizationService = inject(LocalizationService);
  private publicDataService = inject(PublicDataService);
  private legalDocsService = inject(LegalDocsService);

  /**
   * @description Stores the original inline cssText of every ':hover' CSSStyleRule
   *   found across all readable stylesheets, so it can be restored exactly when the
   *   viewport grows back above HOVER_DISABLE_MAX_WIDTH. Keyed by rule reference —
   *   safe because CSSOM rule objects are stable for the lifetime of the stylesheet.
   */
  private savedHoverDeclarations = new Map<CSSStyleRule, string>();

  /**
   * @description Entry point called by APP_INITIALIZER. Angular bootstrap is
   *   held until this Promise resolves — keep this to critical, above-the-fold
   *   data only (translations, settings, logo). Anything else goes to
   *   prefetchLegalDocs(), which is deliberately NOT awaited here.
   * @note See bugfix-notes in the file header: web-active status is checked first and
   *   used ONLY to gate prefetchLegalDocs() (full GDPR/TOS document bodies) - everything
   *   else (translations, site settings/contact/social links, logo) loads unconditionally,
   *   maintenance or not, since the maintenance page itself depends on it.
   */
  async init(): Promise<void> {
    const webActive = await this.checkWebActiveStatus();

    await Promise.all([
      this.localizationService.initTranslations(),
      this.preloadSiteSettings(),
    ]);

    // Fire-and-forget: runs after the app has already started rendering.
    // Skipped entirely during maintenance - full GDPR/TOS document bodies have no
    // legitimate reason to be downloaded while the site is dark (see bugfix-note).
    // If it fails or is slow, nobody waits on it — the legal-page components
    // simply fall back to fetching on demand (see LegalDocsService.getDocument).
    if (webActive) {
      this.prefetchLegalDocs();
    }

    // UI-only concern, must never block or delay app startup — set up once,
    // reacts to viewport changes for the lifetime of the session.
    this.initHoverDisabling();
  }

  /**
   * @description Checks whether the public web is currently active, using the same
   *   no-cache status endpoint webMaintenanceGuard uses (GET /web/public/status).
   *   Used only to gate prefetchLegalDocs() - see init().
   * @note Fails open (returns true) on any error, exactly like webMaintenanceGuard's
   *   own catchError — a transient status-check failure must never prevent the app
   *   from starting normally.
   */
  private async checkWebActiveStatus(): Promise<boolean> {
    try {
      const res = await firstValueFrom(this.publicDataService.getWebStatus());
      return res.is_web_active;
    } catch {
      return true;
    }
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
      // FIX: cache the whole response ({ settings, social_links }), not just
      // data.settings — caching only the settings sub-object silently drops
      // social_links, so anything reading from cache gets an empty array.
      this.publicDataService.setCachedSettings(data);

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

  /**
   * @description Registers the resize listener, starts the stylesheet MutationObserver,
   *   and runs an initial pass of applyHoverState(). This is the public entry point for
   *   the hover-disabling feature — called once from init() and left running for the
   *   app's lifetime.
   * @note Deliberately does NOT use the '(hover: none)' media feature: that only
   *   reflects the input device's real capability, not viewport width, so shrinking
   *   a desktop browser window would not trigger it. Width-based matching is what
   *   the business requirement actually asks for (disable hover under 906px,
   *   regardless of device type).
   */
  private initHoverDisabling(): void {
    this.applyHoverState();
    window.addEventListener('resize', () => this.applyHoverState());
    this.observeLazyStyleInjection();
  }

  /**
   * @description Watches <head> for newly inserted <style> tags and re-runs
   *   applyHoverState() whenever one appears.
   * @note This is the critical piece that makes hover-disabling actually work on
   *   this app: routes use loadComponent() lazy loading, so each component's CSS
   *   is only injected into document.styleSheets at the moment that route chunk
   *   loads — which happens AFTER APP_INITIALIZER has already run once. Without
   *   this observer, a user landing directly on a mobile-width page would see
   *   working hovers on any component whose stylesheet arrived after the single
   *   initial applyHoverState() call, since 'resize' never fires on first load.
   * @note Debounced with a microtask (Promise.resolve().then) rather than firing
   *   once per individual <style> tag — Angular can inject several stylesheets
   *   in the same tick when a chunk with child components loads.
   */
  private observeLazyStyleInjection(): void {
    let scheduled = false;

    const observer = new MutationObserver(mutations => {
      const hasNewStyleTag = mutations.some(m =>
        Array.from(m.addedNodes).some(
          node => node instanceof HTMLStyleElement || node instanceof HTMLLinkElement
        )
      );

      if (hasNewStyleTag && !scheduled) {
        scheduled = true;
        Promise.resolve().then(() => {
          scheduled = false;
          this.applyHoverState();
        });
      }
    });

    observer.observe(document.head, { childList: true });
  }

  /**
   * @description Walks every stylesheet reachable from the document, finds all
   *   CSSStyleRule instances whose selector contains ':hover', and either strips
   *   their declarations (viewport <= HOVER_DISABLE_MAX_WIDTH) or restores the
   *   originally saved declarations (viewport above the breakpoint).
   * @note Only clears the hover rule's OWN declarations — never touches unrelated
   *   rules, non-hover states, or inherited values. This avoids the color/layout
   *   corruption caused by broader approaches like 'all: revert !important' on
   *   '*:hover', which interacts unpredictably with the cascade.
   * @note Cross-origin stylesheets (e.g. CDN fonts) throw on .cssRules access and
   *   are silently skipped — there is nothing hover-related to control there anyway.
   */
  private applyHoverState(): void {
    const shouldDisable = window.innerWidth <= HOVER_DISABLE_MAX_WIDTH;

    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }

      Array.from(rules).forEach(rule => {
        if (!(rule instanceof CSSStyleRule) || !rule.selectorText?.includes(':hover')) {
          return;
        }

        if (shouldDisable) {
          if (!this.savedHoverDeclarations.has(rule)) {
            this.savedHoverDeclarations.set(rule, rule.style.cssText);
          }
          rule.style.cssText = '';
        } else if (this.savedHoverDeclarations.has(rule)) {
          rule.style.cssText = this.savedHoverDeclarations.get(rule)!;
          this.savedHoverDeclarations.delete(rule);
        }
      });
    }
  }
}