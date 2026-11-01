/**
 * @file localization.service.ts
 * @path src/app/shared/services/localization.service.ts
 * @project JS web-platform
 * @author JS
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
import { ApiEnvelope } from '../interfaces/api-envelope';

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

  /**
   * @description Current language list of currentModule. Filled BEFORE the first render of the
   *   app through `initLanguages()` (called from AppBootstrapService.init()), so components like
   *   PublicHeaderComponent can just subscribe without waiting / flashing.
   */
  private languagesSource = new BehaviorSubject<LangMeta[]>([]);

  constructor(private http: HttpClient) {
    const stored = localStorage.getItem('selectedLanguage') || 'cz';
    this.currentLanguageSource.next(stored);
  }

  public initTranslations(): Promise<any> {
    const lang = this.currentLanguageSource.getValue();
    return firstValueFrom(this.loadTranslations$(lang)).then(data => {
      if (data) {
        this.currentTranslationsSource.next(data);
      }
      return data;
    });
  }

  /**
   * @description Switches the translation module (`'web'`, `'shop'`) and loads the current
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
        if (lang !== 'cz') {
          return this.loadTranslations$('cz');
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

  public setLanguage(code: string): void {
    localStorage.setItem('selectedLanguage', code);
    this.currentLanguageSource.next(code);
    this.loadTranslations(code);
  }

  public getCurrentLanguage(): string {
    return this.currentLanguageSource.getValue();
  }
}