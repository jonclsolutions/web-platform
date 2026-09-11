/**
 * @file project-portal-localization.service.ts
 * @path src/app/public/web-pages/project-portal/project-portal-localization.service.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Static (bundled, non-editable-in-admin-UI) multi-language support for the
 * CUSTOMER-facing project portal (`ProjectPortalComponent`) - a THIRD, separate i18n
 * concern in this codebase, distinct from both:
 * - `AdminLocalizationService` (admin UI chrome, `assets/i18n/admin/`, `rpsw_admin_language`
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
 * JSON lives at `assets/i18n/project-portal/{code}/{code}.json` - own folder, own
 * asset unit, separate from both `assets/i18n/admin/` and the public site's translation
 * tables. Flat structure (no `shared`/section nesting like `AdminLocalizationService`) -
 * the portal is a single page, there is no cross-section reuse to justify the extra
 * merge complexity.
 *
 * @note Missing key / not-yet-loaded language returns the literal string
 * `'Cannot load text'` (English, always the same) - same rationale as
 * `AdminLocalizationService`: one obvious failure mode, immediately greppable, never a
 * silent Czech-looking fallback masquerading as a real translation.
 */

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

const STORAGE_KEY = 'rpsw_project_portal_language';
const DEFAULT_LANGUAGE = 'cz';
const FALLBACK_TEXT = 'Cannot load text';

/** One entry in the portal's language toggle (CZ/EN chips in the sidebar). */
export interface ProjectPortalLanguageMeta {
  code: string;
  /** Human-readable name, shown in ITS OWN language (matches AdminLocalizationService convention). */
  name: string;
  /**
   * @refactor-note (2026-09-11) BACKLOG "dropdown jazykový přepínač": path k flag
   * ikoně. Záměrně sdílené soubory s adminem (`assets/i18n/admin/{code}/{code}.png`)
   * - jde o identické vlaječky, netřeba je duplikovat do vlastní `project-portal`
   * assets složky jen kvůli obrázku.
   */
  icon: string;
}

/**
 * @description Every language currently shipped for the project portal. Adding one
 * means: add its JSON under `assets/i18n/project-portal/{code}/`, then add one entry
 * here - same deliberately-hardcoded-list rationale as `ADMIN_AVAILABLE_LANGUAGES`.
 */
export const PROJECT_PORTAL_AVAILABLE_LANGUAGES: ProjectPortalLanguageMeta[] = [
  { code: 'cz', name: 'Čeština', icon: 'assets/i18n/admin/cz/cz.png' },
  { code: 'en', name: 'English', icon: 'assets/i18n/admin/en/en.png' },
];

/**
 * @description Loads and serves the currently selected project-portal language.
 * Selection is persisted in `localStorage` under its OWN key (`rpsw_project_portal_language`)
 * - deliberately independent from `rpsw_admin_language`, since a customer using the
 * portal has no relationship to (and likely no access to) the admin panel, and an
 * admin previewing the portal shouldn't have their admin-language choice silently
 * bleed into what a customer would see.
 * @usage Injected directly by `ProjectPortalComponent` - the only consumer today.
 */
@Injectable({
  providedIn: 'root'
})
export class ProjectPortalLocalizationService {
  private translationsSource = new BehaviorSubject<Record<string, any> | null>(null);
  public translations$ = this.translationsSource.asObservable();

  private currentLanguageSource = new BehaviorSubject<string>(this.getStoredLanguage());
  public currentLanguage$ = this.currentLanguageSource.asObservable();

  public readonly availableLanguages = PROJECT_PORTAL_AVAILABLE_LANGUAGES;

  constructor(private http: HttpClient) {
    this.loadLanguage(this.currentLanguageSource.getValue());
  }

  private getStoredLanguage(): string {
    if (typeof localStorage === 'undefined') return DEFAULT_LANGUAGE;
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_LANGUAGE;
  }

  /**
   * @description Fetches the JSON for the given language code and publishes it. On
   * failure, publishes an empty object rather than leaving the previous language's
   * data in place - same rationale as `AdminLocalizationService.loadLanguage()`.
   */
  private loadLanguage(code: string): void {
    this.http.get<Record<string, any>>(`assets/i18n/project-portal/${code}/${code}.json`)
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
   * @description Switches the active portal language, persists the choice, and
   * (re)loads its JSON.
   */
  public setLanguage(code: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, code);
    }
    this.currentLanguageSource.next(code);
    this.loadLanguage(code);
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