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
 * @note Language (2026-11): the language in the URL (`/cs/…`, `/en/…` - LanguageUrlSerializer
 *   calls useUrlLanguage()) wins when the area has it. A URL without one uses the visitor's own
 *   choice (localStorage `selectedLanguage`, written only by setLanguage() - the language
 *   switchers); without that, the first language of the browser the area offers, otherwise
 *   English, otherwise the first active language (pickInitialLanguage) - that guess is not
 *   stored. Storing the explicit choice is a functional preference the visitor asked for (no
 *   consent needed).
 * @note Visual text editor (2026-11): inside the frame of the editor the published texts are the
 *   loaded ones with the unsaved texts of the admin applied and every text marked with its key
 *   (PublicTextEditorService.decorate); saved texts are written into the cached ones. Outside
 *   the editor the loaded texts are published unchanged.
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, firstValueFrom } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../interfaces/api-envelope';
import { DEFAULT_PUBLIC_LANGUAGE, browserLanguages, pickInitialLanguage } from '../utils/language-preference';
import { PublicTextEditorService, setAtPath } from '../../public/text-editor/public-text-editor.service';

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

  /** Editor mode of the website (visual text editor of the admin). */
  private readonly textEditor = inject(PublicTextEditorService);
  /** Last published texts as loaded (without the marks of the editor) and their language. */
  private publishedRaw: any = null;
  private publishedLang = '';

  /**
   * @description Current language list of currentModule (filled by `fetchLanguages()`, e.g. by
   *   a module switch or the header of a public application).
   */
  private languagesSource = new BehaviorSubject<LangMeta[]>([]);
  /** Active languages of the current module whenever they are (re)loaded (hreflang of SeoService). */
  public languages$ = this.languagesSource.asObservable();

  /** The visitor chose the language in the switcher (stored); false = guessed from the browser. */
  private chosenByVisitor = false;

  constructor(private http: HttpClient) {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    this.chosenByVisitor = !!stored;
    this.currentLanguageSource.next(stored || DEFAULT_PUBLIC_LANGUAGE);
    if (this.textEditor.active) {
      // saved texts become the loaded ones (the cached object is the published one)
      this.textEditor.commits$.subscribe(commit => {
        const cached = this.translationsCache.get(commit.lang);
        const published = this.publishedLang === commit.lang ? this.publishedRaw : null;
        for (const [path, value] of Object.entries(commit.values)) {
          if (cached) setAtPath(cached, path, value);
          if (published && published !== cached) setAtPath(published, path, value);
        }
      });
      // new drafts: publish the same texts again with them
      this.textEditor.changes$.subscribe(() => {
        if (this.publishedRaw) {
          this.currentTranslationsSource.next(this.textEditor.decorate(this.publishedRaw, this.publishedLang));
        }
      });
    }
  }

  /**
   * @description Publishes the texts of a language - in the editor with the drafts and the marks.
   * @param data Loaded translations.
   * @param lang Their language.
   */
  private publish(data: any, lang: string): void {
    this.publishedRaw = data;
    this.publishedLang = lang;
    this.currentTranslationsSource.next(this.textEditor.decorate(data, lang));
  }

  /**
   * @description Loads the texts of a module before the first render (AppBootstrapService) -
   *   the module of the public area of the first URL. With a language in the URL, or without a
   *   language chosen by the visitor, the languages of the module are loaded first (one extra
   *   small request on such visits only): the URL language is used when the module has it,
   *   otherwise the stored choice, otherwise the browser preferences (pickInitialLanguage).
   * @param module Translation module.
   * @param urlLanguage Translation code of the language in the first URL (null without a prefix).
   * @returns The translations (null when they could not be loaded).
   */
  public async initTranslations(module: string, urlLanguage: string | null = null): Promise<any> {
    this.currentModule = module;
    if (urlLanguage || !this.chosenByVisitor) {
      const { languages } = await firstValueFrom(this.fetchLanguages());
      const codes = languages.map(l => l.code);
      if (urlLanguage && codes.includes(urlLanguage)) {
        this.currentLanguageSource.next(urlLanguage);
      } else if (!this.chosenByVisitor || (codes.length && !codes.includes(this.currentLanguageSource.getValue()))) {
        this.currentLanguageSource.next(pickInitialLanguage(codes, browserLanguages()));
      }
    }
    const lang = this.currentLanguageSource.getValue();
    return firstValueFrom(this.loadTranslations$(lang)).then(data => {
      if (data) {
        this.publish(data, lang);
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
      this.publishedRaw = null;
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
        this.publish(data, lang);
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

  /**
   * @description Follows the language of a URL (a link, the Back button) without remembering it
   *   as the visitor's choice. A language the area does not have is ignored - the URL is then
   *   written back with the current language.
   * @param code Translation code from the URL.
   * @returns true when the URL language is (now) the current one.
   */
  public useUrlLanguage(code: string): boolean {
    if (code === this.currentLanguageSource.getValue()) {
      return true;
    }
    // Before the languages are known (no list loaded yet) the URL is trusted.
    if (this.languagesCache.length && !this.languagesCache.some(l => l.code === code)) {
      return false;
    }
    this.currentLanguageSource.next(code);
    this.loadTranslations(code);
    return true;
  }

  /**
   * @description Whether the visitor chose the language in a switcher (stored), i.e. it is not
   *   only taken from a URL or guessed from the browser.
   * @returns true after setLanguage() or with a stored choice.
   */
  public isChosenByVisitor(): boolean {
    return this.chosenByVisitor;
  }

  /**
   * @description Active languages of the current module as last loaded (empty before the first
   *   fetchLanguages()).
   * @returns The language list.
   */
  public getLanguages(): LangMeta[] {
    return this.languagesCache;
  }

  /**
   * @description Texts of the current module in another language than the current one (e.g. the
   *   offer of that language in the language-suggestion bar) - not cached, not published.
   * @param lang Translation code.
   * @returns The translations, null when they cannot be loaded.
   */
  public fetchTexts(lang: string): Observable<any> {
    return this.http.get<ApiEnvelope<any>>(`${this.API_URL}/translations/${this.currentModule}/${lang}`).pipe(
      map(res => res.data ?? null),
      catchError(() => of(null))
    );
  }
}