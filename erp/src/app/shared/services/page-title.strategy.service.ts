/**
 * @file page-title.strategy.ts
 * @path src/app/shared/services/page-title.strategy.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Sets the browser tab title (<title>) of public pages from the texts
 *   the client writes in admin (Firemní údaje -> záložka "Názvy stránek").
 * @dependencies
 * - PublicDataService: loads the title map once from `public/legal/page-titles`.
 * - LocalizationService: current language + language changes (title switches
 *   immediately when the visitor changes the language).
 * @usage
 *   1) Every public route gets `title: 'area.page_key'` (e.g. 'web.services'),
 *      see app.routes.ts. The key must match a row in `legal_page_titles`.
 *   2) Register in app.config.ts:
 *        { provide: TitleStrategy, useClass: PageTitleStrategy }
 * @note Fallback order: current language -> 'cz' -> any filled language ->
 *   the static <title> from index.html. Routes without any `title` in their
 *   route chain also get the index.html title (admin + auth use 'admin.panel'). The title is set via Angular `Title`
 *   (document.title = text), so client text can never inject HTML.
 * @bugfix-note (2026-09-30) The router creates TitleStrategy very early – while
 *   HTTP interceptors (AuthTokenInterceptor) are still being constructed. Injecting
 *   PublicDataService / LocalizationService and firing an HTTP request in the
 *   constructor re-entered HttpClient -> interceptors -> Router -> this strategy
 *   (circular DI) and the app did not start. Both services are now resolved lazily
 *   through the Injector on the FIRST updateTitle() call (after the first
 *   navigation, when DI is fully built). Nothing HTTP-related runs in the constructor.
 */

import { Injectable, Injector, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { PublicDataService } from './public-data.service';
import { LocalizationService } from './localization.service';

/** Map "area.page_key" -> { languageCode: title }. */
type PageTitleMap = Record<string, Record<string, string>>;

/**
 * @description Router TitleStrategy that resolves the route `title` as a key into
 *   the client-editable title map instead of using it as the literal title.
 */
@Injectable({ providedIn: 'root' })
export class PageTitleStrategy extends TitleStrategy {

  // Only dependencies WITHOUT HttpClient are injected eagerly (see bugfix-note).
  private readonly titleService = inject(Title);
  private readonly injector     = inject(Injector);

  /** Static <title> from index.html, captured before any change. */
  private readonly fallbackTitle: string = inject(DOCUMENT).title;

  /** Resolved lazily in ensureInit() – never in the constructor. */
  private localization: LocalizationService | null = null;
  private initialized = false;

  private titles: PageTitleMap = {};
  private currentKey: string | null = null;

  /**
   * @description Called by the router after every navigation.
   * @param snapshot Router state – buildTitle() returns the deepest route `title`.
   */
  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.currentKey = this.buildTitle(snapshot) ?? null;
    this.ensureInit();
    this.apply();
  }

  /**
   * @description One-time lazy setup after DI is fully built: loads the title map
   *   (one small public request) and follows language changes.
   */
  private ensureInit(): void {
    if (this.initialized) return;
    this.initialized = true;

    const publicData  = this.injector.get(PublicDataService);
    this.localization = this.injector.get(LocalizationService);

    publicData.get('public/legal/page-titles')
      .pipe(catchError(() => of(null)))
      .subscribe((res: any) => {
        const map = res?.titles;
        this.titles = (map && typeof map === 'object' && !Array.isArray(map)) ? map : {};
        this.apply();
      });

    // Singleton service – lives as long as the app, no unsubscribe needed.
    this.localization.currentLanguage$.subscribe(() => this.apply());
  }

  /** @description Writes the resolved title into the document. */
  private apply(): void {
    this.titleService.setTitle(this.resolve(this.currentKey));
  }

  /**
   * @description Picks the title for a page key in the current language.
   * @param key Route title key ("web.services") or null.
   * @returns Title text, never empty.
   */
  private resolve(key: string | null): string {
    if (!key) return this.fallbackTitle;

    const byLang = this.titles[key];
    if (!byLang || typeof byLang !== 'object' || Array.isArray(byLang)) return this.fallbackTitle;

    const lang = this.localization?.getCurrentLanguage() ?? 'cz';
    return byLang[lang]
      || byLang['cz']
      || Object.values(byLang).find(v => !!v)
      || this.fallbackTitle;
  }
}