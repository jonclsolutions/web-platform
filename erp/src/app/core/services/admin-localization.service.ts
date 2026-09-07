/**
 * @file admin-localization.service.ts
 * @path src/app/core/services/admin-localization.service.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Static (bundled, non-editable-in-admin-UI) multi-language support for the
 * ADMIN interface itself - distinct from `LocalizationService`, which handles the PUBLIC
 * website's content translations (fetched from the backend, editable via
 * EditWebsiteComponent/EditEshopComponent). Admin UI strings live as plain JSON files
 * shipped with the frontend build (`assets/i18n/admin/{code}/{code}.json`), one file per
 * language, each with a matching flag icon in the same folder
 * (`assets/i18n/admin/{code}/{code}.png`) - json and icon deliberately live together
 * since they're the same "add a language" unit of work for a developer, not because
 * they're loaded together at runtime.
 *
 * Each JSON file is a flat map of SECTION -> { key: string, ... }. `shared` is a
 * special section every component's `strings` getter automatically merges in (see
 * BaseDataComponent.strings) - keys common across the whole admin (confirm/cancel/save/
 * error/etc). Every other top-level key is a per-page/per-component section
 * (`user-request`, `administrators`, ...), populated gradually as pages migrate away
 * from hardcoded Czech text.
 *
 * @note Missing key / not-yet-loaded language intentionally returns the literal string
 * `'Cannot load text'` (English, always the same regardless of selected language) - NOT
 * a Czech fallback. This keeps the lookup logic simple (one failure mode, not "try
 * language X, then fall back to Czech, then fall back to key itself") and makes a
 * missing translation immediately obvious/greppable in the UI during development,
 * rather than silently masquerading as legitimate Czech copy.
 */

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

const STORAGE_KEY = 'rpsw_admin_language';
const DEFAULT_LANGUAGE = 'cz';
const FALLBACK_TEXT = 'Cannot load text';

/** One entry in the language switcher (personal-info dropdown, etc). */
export interface AdminLanguageMeta {
  code: string;
  /** Human-readable name, itself hardcoded per-language (e.g. 'English' inside the
   * en.json's own metadata isn't needed - the switcher shows every language's name
   * in ITS OWN language, so a Czech admin sees 'English', not 'Angličtina'). */
  name: string;
  /** Path to the flag icon, served from the app's own bundled assets. */
  icon: string;
}

/**
 * @description Every admin-UI language currently shipped with the frontend. Adding a
 * language means: add its JSON+PNG under `assets/i18n/admin/{code}/`, then add one
 * entry here. Deliberately a hardcoded list, not a directory scan - Angular's asset
 * pipeline has no runtime directory listing, and a static list is easier to review in
 * one place than inferring "what languages exist" from the filesystem.
 */
export const ADMIN_AVAILABLE_LANGUAGES: AdminLanguageMeta[] = [
  { code: 'cz', name: 'Čeština', icon: 'assets/i18n/admin/cz/cz.png' },
  { code: 'en', name: 'English', icon: 'assets/i18n/admin/en/en.png' },
];



/**
 * @description Loads and serves the currently selected admin-UI language. Selection is
 * persisted in `localStorage` (per-browser, not per-account - see project decision:
 * switching back is "2 clicks", not worth a backend round-trip/column).
 * @usage Injected directly by `BaseDataComponent` (covers ~99% of admin components via
 * inheritance) and manually by the handful of admin components that don't extend it
 * (e.g. `PersonalInfoComponent`, `EditWebsiteComponent`/`EditEshopComponent` - the
 * latter two already have their OWN unrelated i18n concern, the PUBLIC site's editable
 * content, so this is just one more injected service there, no conflict).
 */
@Injectable({
  providedIn: 'root'
})
export class AdminLocalizationService {
  /** Raw parsed JSON of the currently active language, or `null` before the first load
   * completes / after a failed load. `null` is a valid, expected transient state -
   * every lookup method treats it as "nothing loaded yet" and returns the fallback
   * text, never throws. */
  private translationsSource = new BehaviorSubject<Record<string, any> | null>(null);
  public translations$ = this.translationsSource.asObservable();

  private currentLanguageSource = new BehaviorSubject<string>(this.getStoredLanguage());
  public currentLanguage$ = this.currentLanguageSource.asObservable();

  public readonly availableLanguages = ADMIN_AVAILABLE_LANGUAGES;
/**
 * @description Mapuje interní kód admin jazyka (`cz`/`en`/...) na BCP-47 locale
 * string očekávaný Angular `DatePipe`/`registerLocaleData` (`cs-CZ`/`en-US`/...).
 * Nový jazyk vyžaduje: 1) přidat sem mapování, 2) zaregistrovat jeho locale data
 * v main.ts (`registerLocaleData(localeXx)`), 3) přidat JSON+PNG jako u ostatních.
 */
private readonly DATE_LOCALE_MAP: Record<string, string> = {
  cz: 'cs-CZ',
  en: 'en-US',
};

public getDateLocale(): string {
  return this.DATE_LOCALE_MAP[this.getCurrentLanguage()] ?? 'en-US';
}
  constructor(private http: HttpClient) {
    this.loadLanguage(this.currentLanguageSource.getValue());
  }

  private getStoredLanguage(): string {
    if (typeof localStorage === 'undefined') return DEFAULT_LANGUAGE;
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_LANGUAGE;
  }

  /**
   * @description Fetches the JSON for the given language code and publishes it. On
   * failure (missing file, network error, malformed JSON), publishes an empty object
   * rather than leaving the previous language's data in place - a failed switch should
   * visibly surface as `'Cannot load text'` everywhere, not silently keep showing the
   * old language (which would look like the switch silently did nothing, or worse,
   * like a successful switch to a language that happens to look identical).
   */
  private loadLanguage(code: string): void {
    this.http.get<Record<string, any>>(`assets/i18n/admin/${code}/${code}.json`)
      .pipe(
        catchError((err) => {
          console.error(`[AdminLocalizationService] Failed to load admin language "${code}":`, err);
          return of({});
        })
      )
      .subscribe(data => {
        this.translationsSource.next(data);
      });
  }

  /**
   * @description Switches the active admin-UI language, persists the choice, and
   * (re)loads its JSON. Safe to call with a code not present in `availableLanguages`
   * (e.g. stale localStorage value from a language that was later removed) - the fetch
   * will simply fail and fall back to the empty-object/`'Cannot load text'` state above,
   * rather than the app crashing or silently doing nothing.
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
   * @description Synchronous single-string lookup by full dot path (e.g.
   * `'shared.confirm'`, `'user-request.save_failed'`) - for use in imperative code
   * (alert/confirm dialog text, thrown messages, anywhere a template binding isn't
   * available). Always resolves immediately from whatever is currently loaded; never
   * subscribes/waits, since callers need a plain `string` synchronously at the call site.
   * @param path Dot-separated path, first segment is the top-level JSON section.
   * @returns The resolved string, or `'Cannot load text'` if the language hasn't
   * loaded yet or the path doesn't resolve to a string.
   */
  public getValue(path: string): string {
    const data = this.translationsSource.getValue();
    if (!data) return FALLBACK_TEXT;

    const resolved = path.split('.').reduce<any>(
      (acc, part) => (acc && typeof acc === 'object' ? acc[part] : undefined),
      data
    );
    return typeof resolved === 'string' ? resolved : FALLBACK_TEXT;
  }

  /**
   * @description Synchronous lookup of an entire section, shallow-merged with `shared`
   * (`shared` keys first, section-specific keys override same-named `shared` keys) -
   * for template binding via `BaseDataComponent.strings` (`{{ strings.confirm }}`,
   * `{{ strings.save_failed }}`, no need to prefix every binding with the section name).
   * @param section Top-level JSON section name (e.g. `'user-request'`). Empty string
   * or an unknown section resolves to just `shared` (or `{}` if not loaded yet).
   * @note Return type is deliberately `any` (not `Record<string, string>`) - JSON keys
   * are dynamic per-language content, not a fixed shape known at compile time, and
   * TypeScript's `noPropertyAccessFromIndexSignature` (enabled in this project's
   * strict config) would otherwise force every template binding to use bracket
   * notation (`strings['language_hint']`) instead of dot notation
   * (`strings.language_hint`), which defeats the whole point of a clean template API.
   */
  public getMergedSection(section: string): any {
    const data = this.translationsSource.getValue();
    if (!data) return {};

    const shared = (data['shared'] && typeof data['shared'] === 'object') ? data['shared'] : {};
    const own = (section && data[section] && typeof data[section] === 'object') ? data[section] : {};
    return { ...shared, ...own };
  }
}