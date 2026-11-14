/**
 * @file base-public.component.ts
 * @path src/app/public/base-public.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Abstract base for all public-facing components.
 *   Handles translation subscription, optional site-settings loading,
 *   destroy$ cleanup, and getIconUrl — so subclasses only declare
 *   what makes them unique.
 *
 * @usage
 *   export class MyComponent extends BasePublicComponent {
 *     protected readonly translationKey = 'my_section';
 *     protected override readonly loadSiteSettings = true; // optional
 *   }
 *   The translation module is the one of the public area of the route (`publicArea` in the
 *   route data of the layout of the application, public-area.ts); a page outside every layout
 *   (e.g. a maintenance page) sets `translationModule` itself.
 *
 * @hooks
 *   onTranslationsLoaded(translations) — called after t is set; override
 *     to extract extra sections from the full translations object.
 *   onInit()     — called at the end of ngOnInit; override instead of
 *     overriding ngOnInit to avoid manual super() calls.
 *   onDestroy()  — called before destroy$ completes; override for cleanup.
 *
 * @note Components that already extend BaseDataComponent (e.g. JobItemComponent)
 *   cannot use this class due to single-inheritance. They must manage
 *   translations manually as before.
 * @dependencies LocalizationService (texts), PublicDataService (site settings),
 *   routePublicArea (translation module of the area).
 */

import { Directive, inject, ChangeDetectorRef, OnInit, OnDestroy } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { LocalizationService } from '../shared/services/localization.service';
import { PublicDataService } from '../shared/services/public-data.service';
import { routePublicArea } from './public-area';
@Directive()
export abstract class BasePublicComponent implements OnInit, OnDestroy {

  // ── Injected services (no constructor needed in subclasses) ──
  protected localizationService = inject(LocalizationService);
  protected publicDataService   = inject(PublicDataService);
  protected cdr                 = inject(ChangeDetectorRef);

  // ── Shared state ─────────────────────────────────────────────
  /** Localized content for this component's section. */
  t: any = null;
  /** Global site settings (email, phone…). Available when loadSiteSettings = true. */
  settings: any = null;
  /** Social media links. Available when loadSiteSettings = true. */
  socialLinks: any[] = [];

  // ── Subclass config ──────────────────────────────────────────
  /**
   * Key inside the translations object that belongs to this component.
   * e.g. 'about_us', 'faq', 'contact', 'projects'
   */
  protected abstract readonly translationKey: string;

  /**
   * Set to true in the subclass to also load site settings + social links.
   * Defaults to false to avoid unnecessary requests on simple pages.
   */
  protected readonly loadSiteSettings: boolean = false;

  /** Translation module this component reads (`translations/{module}/{lang}`): the module of
   *  the public area of the route; empty = no texts (outside every public area). */
  protected readonly translationModule: string = routePublicArea()?.translationModule ?? '';

  // ── RxJS cleanup ─────────────────────────────────────────────
  protected destroy$ = new Subject<void>();

  // ─────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    // 0. Make sure the right translation module is active (no-op if it already is)
    if (this.translationModule) {
      this.localizationService.setModule(this.translationModule);
    }

    // 1. Translation stream
    this.localizationService.currentTranslations$
      .pipe(takeUntil(this.destroy$))
      .subscribe(translations => {
        if (translations?.[this.translationKey]) {
          this.t = translations[this.translationKey];
          this.onTranslationsLoaded(translations);
          this.cdr.markForCheck();
        }
      });

    // 2. Site settings (opt-in) — read from the cache populated by
    //    AppBootstrapService at startup, do NOT fetch again here.
    //    Cache shape is { settings, social_links } (see PublicDataService).
    if (this.loadSiteSettings) {
      this.publicDataService.siteSettingsValue$
        .pipe(takeUntil(this.destroy$))
        .subscribe(res => {
          if (res) {
            this.settings    = res.settings ?? null;
            this.socialLinks = res.social_links ?? [];
            this.cdr.markForCheck();
          }
        });
    }

    // 3. Subclass hook
    this.onInit();
  }

  ngOnDestroy(): void {
    this.onDestroy();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─────────────────────────────────────────────────────────────
  // Overrideable hooks
  // ─────────────────────────────────────────────────────────────

  /**
   * Called after `t` is assigned on every translation update.
   * Override to extract additional keys from the full translations object.
   * @param translations The complete translations payload.
   */
  protected onTranslationsLoaded(_translations: any): void {}

  /**
   * Called at the end of ngOnInit. Override instead of ngOnInit
   * to avoid having to call super.ngOnInit().
   */
  protected onInit(): void {}

  /**
   * Called before destroy$ completes. Override for extra cleanup.
   */
  protected onDestroy(): void {}

  // ─────────────────────────────────────────────────────────────
  // Shared helpers
  // ─────────────────────────────────────────────────────────────

  /** Resolves the full public URL for a storage asset. */
  getIconUrl(path: string): string {
    return this.publicDataService.getStorageUrl(path);
  }

  /** mailto: href for the current site's contact email, null-safe. */
  get emailHref(): string {
    return 'mailto:' + (this.settings?.contact_email ?? '');
  }

  /** tel: href for the current site's contact phone, null-safe and whitespace-stripped. */
  get phoneHref(): string {
    return 'tel:' + (this.settings?.contact_phone?.replace(/\s/g, '') ?? '');
  }

  get currentLanguage$(): Observable<string> {
    return this.localizationService.currentLanguage$;
  }

  /**
   * @description Formats an EUR amount in the number format of the current language (finding #44:
   *   prices were always formatted with cs-CZ).
   * @param value Amount in EUR.
   * @returns E.g. "1 234,50 €" (cz) / "€1,234.50" (en).
   */
  formatEur(value: number): string {
    const lang = this.localizationService.getCurrentLanguage();
    const locale = lang === 'cz' ? 'cs-CZ' : lang === 'en' ? 'en-GB' : lang;
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(value);
    } catch {
      return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(value);
    }
  }
}