/**
 * @file base-public.component.ts
 * @path src/app/public/base-public.component.ts
 * @project RPSW Web
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
 */

import { Directive, inject, ChangeDetectorRef, OnInit, OnDestroy } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { LocalizationService } from '../shared/services/localization.service';
import { PublicDataService } from '../shared/services/public-data.service';
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

  // ── RxJS cleanup ─────────────────────────────────────────────
  protected destroy$ = new Subject<void>();

  // ─────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
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

    // 2. Site settings (opt-in)
    if (this.loadSiteSettings) {
      this.publicDataService.getSiteSettings()
        .pipe(takeUntil(this.destroy$))
        .subscribe(res => {
          this.settings   = res.settings;
          this.socialLinks = res.social_links;
          this.cdr.markForCheck();
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

  get currentLanguage$(): Observable<string> {
    return this.localizationService.currentLanguage$;
  }
}