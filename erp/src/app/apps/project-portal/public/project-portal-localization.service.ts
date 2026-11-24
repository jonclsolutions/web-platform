/**
 * @file project-portal-localization.service.ts
 * @path src/app/apps/project-portal/public/project-portal-localization.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Static (bundled, non-editable-in-admin-UI) multi-language support for the
 * CUSTOMER-facing project portal (PortalLayoutComponent and its sections) - a THIRD, separate i18n
 * concern in this codebase, distinct from both:
 * - `AdminLocalizationService` (admin UI chrome, `assets/i18n/admin/`, `jsw_admin_language`
 *   localStorage key) - the project portal is NOT part of the admin.
 * - `LocalizationService` (public website's EDITABLE content, fetched from the backend,
 *   managed via `EditWebsiteComponent`) - the project portal's UI text is static/
 *   developer-maintained, not something an admin edits through a translation-key table,
 *   and the portal itself sits outside the normal public site's page tree (accessed only
 *   via a project-specific token URL, never linked from public navigation).
 *
 * Same architectural pattern as `AdminLocalizationService` (flat JSON per language,
 * shipped with the frontend build, `BehaviorSubject`-backed, synchronous `getValue()`
 * lookup, `localStorage`-persisted selection) - deliberately copy-pasted rather than
 * shared, because the three concerns have genuinely different lifecycles (admin UI text
 * changes with admin features; public site content is backend-editable; portal text
 * changes with the portal's own feature set) and forcing them through one shared service
 * would couple unrelated release cycles together.
 *
 * JSON lives in `i18n/{code}.json` next to this service (copied by angular.json to
 * `assets/i18n/apps/project-portal/public/i18n/`) - own folder, own asset unit, separate from both `assets/i18n/admin/` and the public site's translation
 * tables. Flat structure (no `shared`/section nesting like `AdminLocalizationService`) -
 * the portal is a single page, there is no cross-section reuse to justify the extra
 * merge complexity.
 *
 * @note Language (2026-11): the portal has no language of its own any more - it follows the
 * language of the public pages (LocalizationService), which is the language in the URL
 * (`/cs/projects/…`, `/en/projects/…`), else the visitor's choice, else the browser / English. A
 * language the portal texts do not have shows English (or the first portal language).
 * setLanguage() switches through LanguageRoutingService, so the URL follows. The former key
 * `jsw_project_portal_language` is no longer read.
 * @note Missing key / not-yet-loaded language returns the literal string
 * `'Cannot load text'` (English, always the same) - same rationale as
 * `AdminLocalizationService`: one obvious failure mode, immediately greppable, never a
 * silent Czech-looking fallback masquerading as a real translation.
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { LocalizationService } from '../../../shared/services/localization.service';
import { LanguageRoutingService } from '../../../shared/services/language-routing.service';

/** Portal language shown when the public language has no portal texts. */
const FALLBACK_LANGUAGE = 'en';
const FALLBACK_TEXT = 'Cannot load text';

/** One entry in the portal's language toggle (CZ/EN chips in the sidebar). */
export interface ProjectPortalLanguageMeta {
  code: string;
  /** Human-readable name, shown in ITS OWN language (matches AdminLocalizationService convention). */
  name: string;
  icon: string;
}

/**
 * @description Every language currently shipped for the project portal. Adding one
 * means: add its JSON as `i18n/{code}.json` next to this service, then add one entry
 * here - same deliberately-hardcoded-list rationale as `ADMIN_AVAILABLE_LANGUAGES`.
 */
export const PROJECT_PORTAL_AVAILABLE_LANGUAGES: ProjectPortalLanguageMeta[] = [
  { code: 'cz', name: 'Čeština', icon: 'assets/i18n/admin/cz/cz.png' },
  { code: 'en', name: 'English', icon: 'assets/i18n/admin/en/en.png' },
];

/**
 * @description Loads and serves the project-portal texts in the language of the public pages
 * (see the note in the file header) - independent from the admin language
 * (`jsw_admin_language`): a customer using the portal has no relationship to the admin panel.
 * @usage Injected by the portal pages (layout, sign-in, order form, maintenance) and the portal
 * language switcher.
 */
@Injectable({
  providedIn: 'root'
})
export class ProjectPortalLocalizationService {
  private translationsSource = new BehaviorSubject<Record<string, any> | null>(null);
  public translations$ = this.translationsSource.asObservable();

  private readonly http = inject(HttpClient);
  private readonly localization = inject(LocalizationService);
  private readonly languageRouting = inject(LanguageRoutingService);

  public readonly availableLanguages = PROJECT_PORTAL_AVAILABLE_LANGUAGES;

  private currentLanguageSource = new BehaviorSubject<string>(this.portalLanguageOf(this.localization.getCurrentLanguage()));
  public currentLanguage$ = this.currentLanguageSource.asObservable();

  constructor() {
    this.loadLanguage(this.currentLanguageSource.getValue());
    // Follow the language of the public pages (URL / choice / browser).
    this.localization.currentLanguage$.subscribe(code => {
      const portalCode = this.portalLanguageOf(code);
      if (portalCode !== this.currentLanguageSource.getValue()) {
        this.currentLanguageSource.next(portalCode);
        this.loadLanguage(portalCode);
      }
    });
  }

  /**
   * @description Portal language for a public language: the same when the portal has its texts,
   *   otherwise English, otherwise the first portal language.
   * @param code Public language code.
   * @returns Portal language code.
   */
  private portalLanguageOf(code: string): string {
    const codes = this.availableLanguages.map(l => l.code);
    if (codes.includes(code)) return code;
    return codes.includes(FALLBACK_LANGUAGE) ? FALLBACK_LANGUAGE : codes[0];
  }

  /**
   * @description Fetches the JSON for the given language code and publishes it. On
   * failure, publishes an empty object rather than leaving the previous language's
   * data in place - same rationale as `AdminLocalizationService.loadLanguage()`.
   */
  private loadLanguage(code: string): void {
    this.http.get<Record<string, any>>(`assets/i18n/apps/project-portal/public/i18n/${code}.json`)
      .pipe(
        catchError((err) => {
          console.error(`[ProjectPortalLocalizationService] Failed to load language "${code}":`, err);
          return of({});
        })
      )
      .subscribe(data => {
        this.translationsSource.next(data);
      });
  }

  /**
   * @description The visitor switches the language in the portal: it becomes the language of the
   *   public pages (remembered) and the URL moves to it (`/cs/projects/…` → `/en/projects/…`);
   *   the portal texts follow.
   * @param code Language code.
   */
  public setLanguage(code: string): void {
    this.languageRouting.switchTo(code);
  }

  public getCurrentLanguage(): string {
    return this.currentLanguageSource.getValue();
  }

  /**
   * @description Synchronous single-string lookup by flat key (no section nesting -
   * see file header). Always resolves immediately from whatever is currently loaded.
   * @param key Flat key into the currently loaded language JSON.
   * @returns The resolved string, or `'Cannot load text'` if the language hasn't
   * loaded yet or the key doesn't resolve to a string.
   */
  public getValue(key: string): string {
    const data = this.translationsSource.getValue();
    if (!data) return FALLBACK_TEXT;
    const resolved = data[key];
    return typeof resolved === 'string' ? resolved : FALLBACK_TEXT;
  }
}