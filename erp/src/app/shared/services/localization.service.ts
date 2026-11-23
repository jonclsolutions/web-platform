/**
 * @file localization.service.ts
 * @path src/app/shared/services/localization.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Texts of the public pages: the translation module of the public area shown (the
 *   id of an application), its languages, the active language and the loaded texts.
 * @dependencies
 * - HttpClient: Performs API requests to fetch language definitions and translation JSONs.
 * @note Nothing is loaded in the constructor: AppBootstrapService calls initTranslations()
 *   with the module of the first URL during APP_INITIALIZER (no render before the texts are
 *   ready); a public page then switches the module with setModule().
 * @note Language: the visitor's own choice (localStorage `selectedLanguage`, written only by
 *   setLanguage() - the switcher in the footer) wins. Without one, initTranslations() picks the
 *   first language of the browser the area offers, otherwise English, otherwise the first active
 *   language (pickInitialLanguage) - that guess is not stored, so a later visit guesses again.
 *   Storing the explicit choice is a functional preference the visitor asked for (no consent).
 */

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, firstValueFrom } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../interfaces/api-envelope';
import { DEFAULT_PUBLIC_LANGUAGE, browserLanguages, pickInitialLanguage } from '../utils/language-preference';

/** localStorage key of the language the visitor chose in the switcher. */
const LANGUAGE_STORAGE_KEY = 'selectedLanguage';
/** Language every public area has (the seed of the translations) - texts fall back to it. */
const BASE_LANGUAGE = 'cz';

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
  /** Translation module of the public area shown ('' until a public page / the bootstrap sets it). */
  private currentModule: string = '';
  private readonly API_URL = environment.base_api_url;
  private translationsCache = new Map<string, any>();
  private languagesCache: LangMeta[] = [];

  private currentLanguageSource = new BehaviorSubject<string>(DEFAULT_PUBLIC_LANGUAGE);
  public currentLanguage$ = this.currentLanguageSource.asObservable();

  private currentTranslationsSource = new BehaviorSubject<any>(null);
  public currentTranslations$ = this.currentTranslationsSource.asObservable();

  /**
   * @description Current language list of currentModule (filled by `fetchLanguages()`, e.g. by
   *   a module switch or the header of a public application).
   */
  private languagesSource = new BehaviorSubject<LangMeta[]>([]);

  /** The visitor chose the language in the switcher (stored); false = guessed from the browser. */
  private chosenByVisitor = false;

  constructor(private http: HttpClient) {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    this.chosenByVisitor = !!stored;
    this.currentLanguageSource.next(stored || DEFAULT_PUBLIC_LANGUAGE);
  }

  /**
   * @description Loads the texts of a module before the first render (AppBootstrapService) -
   *   the module of the public area of the first URL. Without a language chosen by the visitor
   *   the languages of the module are loaded first and the language is picked from the browser
   *   preferences (one extra small request on such visits only).
   * @param module Translation module.
   * @returns The translations (null when they could not be loaded).
   */
  public async initTranslations(module: string): Promise<any> {
    this.currentModule = module;
    if (!this.chosenByVisitor) {
      const { languages } = await firstValueFrom(this.fetchLanguages());
      this.currentLanguageSource.next(pickInitialLanguage(languages.map(l => l.code), browserLanguages()));
    }
    const lang = this.currentLanguageSource.getValue();
    return firstValueFrom(this.loadTranslations$(lang)).then(data => {
      if (data) {
        this.currentTranslationsSource.next(data);
      }
      return data;
    });
  }

  /**
   * @description Switches the translation module (of a public area) and loads the current
   *   language of the new module. No-op when the module is already active.
   * @param module Backend translation module.
   */
  public setModule(module: string): void {
    if (this.currentModule !== module) {
      this.currentModule = module;
      this.translationsCache.clear();
      this.currentTranslationsSource.next(null);
      this.loadTranslations(this.currentLanguageSource.getValue());
      this.fetchLanguages().subscribe();
    }
  }

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
   * @note The backend endpoint /languages/{module} returns ALL languages of the module (also
   *       inactive) - on purpose, the admin (EditWebsiteComponent) uses the same endpoint and
   *       needs to see and manage deactivated languages. This service is for the PUBLIC web
   *       only, so inactive languages are filtered out here - otherwise the language switcher
   *       would show languages the admin switched off.
   */
  public fetchLanguages(): Observable<{ languages: LangMeta[] }> {
    // Payload = the language list (`{data: [...]}`, finding #6 - was `{languages: [...]}`).
    return this.http.get<ApiEnvelope<ApiLanguage[]>>(`${this.API_URL}/languages/${this.currentModule}`).pipe(
      map(res => ({
        languages: (res.data ?? [])
          .filter((l: ApiLanguage) => l.active)
          .map((l: ApiLanguage) => ({
            code: l.code,
            label: l.name,
            flag: l.iconUrl || 'assets/images/icons/default.png',
            active: l.active
          }))
      })),
      tap(res => {
        this.languagesCache = res.languages;
        this.languagesSource.next(res.languages);
      }),
      catchError(() => of({ languages: this.languagesCache }))
    );
  }

  private loadTranslations$(lang: string): Observable<any> {
    if (this.translationsCache.has(lang)) {
      return of(this.translationsCache.get(lang));
    }

    const module = this.currentModule;
    const url = `${this.API_URL}/translations/${module}/${lang}`;

    return this.http.get<ApiEnvelope<any>>(url).pipe(
      map(res => res.data),  // translation dictionary in `data` (finding #6)
      tap(data => { if (module === this.currentModule) this.translationsCache.set(lang, data); }),
      catchError(() => {
        if (lang !== BASE_LANGUAGE) {
          return this.loadTranslations$(BASE_LANGUAGE);
        }
        return of(null);
      })
    );
  }

  public loadTranslations(lang: string): void {
    const module = this.currentModule;
    this.loadTranslations$(lang).subscribe(data => {
      // a response for a module / language that is no longer active is dropped (see notes)
      if (data && module === this.currentModule && lang === this.currentLanguageSource.getValue()) {
        this.currentTranslationsSource.next(data);
      }
    });
  }

  /**
   * @description Switches to the language the visitor chose (language switcher) and remembers it
   *   for later visits.
   * @param code Language code.
   */
  public setLanguage(code: string): void {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
    this.chosenByVisitor = true;
    this.currentLanguageSource.next(code);
    this.loadTranslations(code);
  }

  public getCurrentLanguage(): string {
    return this.currentLanguageSource.getValue();
  }
}