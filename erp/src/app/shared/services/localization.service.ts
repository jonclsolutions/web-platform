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
 * @refactor-note (2026) fetchLanguages() nyní filtruje jen jazyky s active:true - viz
 *   komentář přímo u metody. Bez toho se v jazykovém přepínači na veřejném webu zobrazovaly
 *   i jazyky, které admin v EditWebsiteComponent schválně deaktivoval.
 * @refactor-note (2026-08) Přidán `languages$` (BehaviorSubject) + `initLanguages()`,
 *   analogicky k tomu, jak `AppBootstrapService.preloadSiteSettings()` řeší `siteSettings`.
 *   Root cause opraveného bugu: `PublicHeaderComponent` dřív volalo `fetchLanguages()` samo
 *   v `ngOnInit()` - tedy AŽ PO APP_INITIALIZERu a prvním renderu, takže vlaječka aktivního
 *   jazyka na moment bliknutím zmizela/chyběla, zatímco logo (přednačtené přes bootstrap)
 *   se objevilo hned. `initLanguages()` teď volá `AppBootstrapService.init()` paralelně s
 *   `initTranslations()`, takže `languages$` má hodnotu už PŘED prvním renderem appky.
 *   `fetchLanguages()` sám o sobě zůstává beze změny v použití (stále ho volá `setModule()`
 *   při přepnutí modulu) - jen navíc plní `languagesSource`, aby zůstal jediný zdroj pravdy.
 * @refactor-note (2026-10-21) Removed unused code (no reference in TS, templates or
 *   string literals): `languages$`, `initLanguages`, `getLanguageMeta`.
 * @refactor-note (2026-10-21) Veřejný e-shop používá tuto službu 1:1 jako web, jen s modulem
 *   `'shop'` (`translations/shop/{lang}`, `languages/shop`). `setModule()` po přepnutí modulu
 *   nově rovnou načte překlady aktuálního jazyka nového modulu. Dřív jen vyčistil cache,
 *   takže po přechodu web -> shop zůstaly zobrazené překlady webu. Do doby, než nové
 *   překlady dorazí, emituje `currentTranslations$` hodnotu `null`, aby stránka nového modulu
 *   nikdy nezobrazila stejně pojmenovanou sekci (`footer`, `navigation`) z druhého modulu.
 *   Odpověď, která dorazí až po dalším přepnutí modulu, se zahodí.
 * @bugfix-note (2026-10-23) (1) initTranslations() stored the Czech FALLBACK texts (loaded
 *   because the requested language failed) in the cache under the requested language - the
 *   language then showed Czech for the rest of the session even after the API recovered; the
 *   cache is now filled only by loadTranslations$() under the language really loaded.
 *   (2) Switching languages quickly (cz → en → de) let a slower older response overwrite the
 *   newer one (wrong language on screen); a response for a language that is no longer
 *   selected is now dropped, same as for a module that is no longer active.
 * @refactor-note (2026-10-24) Open finding #6 (one API envelope `{data, meta?}`): languages /
 *  translations are read from `data` of the envelope (were `{languages}` / the bare dictionary).
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
   * @description Aktuální seznam jazyků pro currentModule. Naplní se PŘED prvním renderem
   *   appky přes `initLanguages()` (volané z AppBootstrapService.init()), takže komponenty
   *   jako PublicHeaderComponent na něj mohou jen navázat subscribe bez čekání/bliknutí.
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
   * @note Backend endpoint /languages/{module} vrací VŠECHNY jazyky modulu (i neaktivní) -
   *       to je záměr, protože stejný endpoint používá i admin (EditWebsiteComponent),
   *       který potřebuje vidět a spravovat i deaktivované jazyky. Tato služba je ale
   *       výhradně pro VEŘEJNÝ web, takže tady se neaktivní jazyky odfiltrují - jinak by
   *       se v přepínači jazyků na webu zobrazily i ty, co admin schválně vypnul.
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