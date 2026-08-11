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

  /**
   * @description Aktuální seznam jazyků pro currentModule. Naplní se PŘED prvním renderem
   *   appky přes `initLanguages()` (volané z AppBootstrapService.init()), takže komponenty
   *   jako PublicHeaderComponent na něj mohou jen navázat subscribe bez čekání/bliknutí.
   */
  private languagesSource = new BehaviorSubject<LangMeta[]>([]);
  public languages$ = this.languagesSource.asObservable();

  constructor(private http: HttpClient) {
    const stored = localStorage.getItem('selectedLanguage') || 'cz';
    this.currentLanguageSource.next(stored);
  }

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
   * @description Entry point pro APP_INITIALIZER (viz AppBootstrapService.init()) -
   *   natáhne jazyky aktuálního modulu ('web' v okamžiku bootstrapu) a naplní jimi
   *   `languagesSource` PŘED prvním renderem. `fetchLanguages()` má vlastní catchError
   *   fallback na cache, takže tenhle try/catch je jen dodatečná pojistka, aby zcela
   *   neočekávaná chyba nikdy neblokovala start appky.
   */
  public async initLanguages(): Promise<void> {
    try {
      await firstValueFrom(this.fetchLanguages());
    } catch {
      // fetchLanguages() se sama postará o fallback; tohle je jen pojistka.
    }
  }

  public setModule(module: string): void {
    if (this.currentModule !== module) {
      this.currentModule = module;
      this.translationsCache.clear();
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
    return this.http.get<{ languages: ApiLanguage[] }>(`${this.API_URL}/languages/${this.currentModule}`).pipe(
      map(res => ({
        languages: res.languages
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

  /**
   * @description Synchronní lookup metadat jazyka z aktuální cache - použito
   *   AppBootstrapService k předehřátí obrázku vlaječky aktivního jazyka.
   */
  public getLanguageMeta(code: string): LangMeta | undefined {
    return this.languagesCache.find(l => l.code === code);
  }

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

  public loadTranslations(lang: string): void {
    this.loadTranslations$(lang).subscribe(data => {
      if (data) {
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