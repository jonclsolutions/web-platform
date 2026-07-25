/**
 * @file localization.service.ts
 * @path src/app/shared/services/localization.service.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Centralized service for managing application localization, translation loading, and active language state.
 * @dependencies
 * - HttpClient: Performs API requests to fetch language definitions and translation JSONs.
 * @note Translation loading is NOT triggered automatically in the constructor anymore.
 *   It is triggered exactly once by AppBootstrapService.initTranslations() during
 *   APP_INITIALIZER, so the app never renders before translations are ready — and never
 *   fires the fetch twice (once in the constructor, once at bootstrap).
 */

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, firstValueFrom } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface ApiLanguage {
  code: string;
  name: string;
  active: boolean;
  iconUrl?: string;
  isBuiltIn?: boolean;
}

export interface LangMeta {
  code: string;
  label: string;
  flag: string;
  active: boolean;
}

/**
 * @description Manages application-wide translation state, caching, and language switching.
 * @usage Injected into components to provide dynamic text localization and observe language changes.
 * @note Implements a caching mechanism for translations to minimize redundant HTTP requests.
 */
@Injectable({
  providedIn: 'root'
})
export class LocalizationService {
  private currentModule: string = 'web';
  private readonly API_URL = environment.base_api_url;
  private translationsCache = new Map<string, any>();
  private languagesCache: LangMeta[] = [];

  private currentLanguageSource = new BehaviorSubject<string>('cz');
  public currentLanguage$ = this.currentLanguageSource.asObservable();

  private currentTranslationsSource = new BehaviorSubject<any>(null);
  public currentTranslations$ = this.currentTranslationsSource.asObservable();

  constructor(private http: HttpClient) {
    // Only restore the preferred language code here — do NOT fetch translations
    // yet. The actual fetch is triggered once by initTranslations() via
    // APP_INITIALIZER (see app.config.ts / app-bootstrap.service.ts).
    const stored = localStorage.getItem('selectedLanguage') || 'cz';
    this.currentLanguageSource.next(stored);
  }

  /**
   * @description Called once by AppBootstrapService during APP_INITIALIZER.
   *   Loads translations for the currently selected language and resolves only
   *   after `currentTranslations$` has a value, so components relying on `t`
   *   never render with `t = null`.
   */
  public initTranslations(): Promise<any> {
    const lang = this.currentLanguageSource.getValue();
    return firstValueFrom(this.loadTranslations$(lang)).then(data => {
      if (data) {
        this.translationsCache.set(lang, data);
        this.currentTranslationsSource.next(data);
      }
      return data;
    });
  }

  /**
   * @description Switches the operational module and refreshes available languages.
   * @param module The module context (e.g., 'web', 'admin', 'shop').
   */
  public setModule(module: string): void {
    if (this.currentModule !== module) {
      this.currentModule = module;
      this.translationsCache.clear();
      this.fetchLanguages().subscribe();
    }
  }

  /**
   * @description Resolves a nested key string into a translated value.
   * @param key Dot-notation key (e.g., 'navigation.home').
   * @returns {string} The translation or the key itself if not found.
   * @note Uses reduce to safely navigate the translation object hierarchy.
   */
  public getText(key: string): string {
    const translations = this.currentTranslationsSource.getValue();
    if (!translations) {
      return key;
    }
    return key.split('.').reduce((acc, part) => acc && acc[part], translations) || key;
  }

  /**
   * @description Fetches supported languages for the current module from the API.
   * @returns {Observable<{languages: LangMeta[]}>} Observable containing language metadata.
   */
  public fetchLanguages(): Observable<{ languages: LangMeta[] }> {
    return this.http.get<{ languages: ApiLanguage[] }>(`${this.API_URL}/languages/${this.currentModule}`).pipe(
      map(res => ({
        languages: res.languages.map((l: ApiLanguage) => ({
          code: l.code,
          label: l.name,
          flag: l.iconUrl || 'assets/images/icons/default.png',
          active: l.active
        }))
      })),
      tap(res => { this.languagesCache = res.languages; }),
      catchError(() => of({ languages: this.languagesCache })) // tichý fallback na poslední známý stav
    );
  }

  /**
   * @description Internal observable variant used by both initTranslations() (Promise-based,
   *   for APP_INITIALIZER) and loadTranslations() (fire-and-forget, for language switching).
   *   Falls back to 'cz' on error, same as before, but without duplicating the request logic.
   */
  private loadTranslations$(lang: string): Observable<any> {
    if (this.translationsCache.has(lang)) {
      return of(this.translationsCache.get(lang));
    }

    const url = `${this.API_URL}/translations/${this.currentModule}/${lang}`;

    return this.http.get(url).pipe(
      tap(data => this.translationsCache.set(lang, data)),
      catchError(() => {
        if (lang !== 'cz') {
          return this.loadTranslations$('cz');
        }
        return of(null);
      })
    );
  }

  /**
   * @description Loads translations for a specific language into the cache.
   * @param lang The language code to load.
   * @note If the language is already cached, it immediately updates the translation stream.
   *   Used for runtime language switching (see setLanguage). Startup loading goes through
   *   initTranslations() instead.
   */
  public loadTranslations(lang: string): void {
    this.loadTranslations$(lang).subscribe(data => {
      if (data) {
        this.currentTranslationsSource.next(data);
      }
    });
  }

  /**
   * @description Updates the active application language.
   * @param code The new language code.
   * @note Persists the language choice in localStorage and triggers translation loading.
   */
  public setLanguage(code: string): void {
    localStorage.setItem('selectedLanguage', code);
    this.currentLanguageSource.next(code);
    this.loadTranslations(code);
  }

  /**
   * @description Returns the currently active language code.
   * @returns {string} The active language code (e.g., 'cz', 'en').
   */
  public getCurrentLanguage(): string {
    return this.currentLanguageSource.getValue();
  }
}