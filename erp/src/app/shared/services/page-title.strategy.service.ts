/**
 * @file page-title.strategy.ts
 * @path src/app/shared/services/page-title.strategy.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Sets the browser tab title (<title>) of public pages from the texts
 *   the client writes in admin - tab "Page titles" of the module that owns the pages
 *   (web: Edit website, e-shop: Edit e-shop, administration: Web settings).
 * @dependencies
 * - PublicDataService: loads the title map once from `public/legal/page-titles`.
 * - LocalizationService: current language of the public pages + its changes (title switches
 *   immediately when the visitor changes the language).
 * - AdminLocalizationService: language of the administration UI for the admin titles
 *   (`admin.*` keys) - resolved only when such a page is shown (it loads the admin texts).
 * @usage
 *   1) Every public route gets `title: 'area.page_key'` (e.g. 'web.services'),
 *      see app.routes.ts. The key must match a row in `legal_page_titles`.
 *   2) Register in app.config.ts:
 *        { provide: TitleStrategy, useClass: PageTitleStrategy }
 * @note The administration (keys `admin.*`: admin, login) uses the language of the admin UI, not
 *   the one the visitor chose on the public site (both live in the same browser storage - a
 *   public site viewed in German must not turn the admin title into 'Cannot load text').
 * @note A page with titles: its title in the current language, else 'Cannot load text' - never
 *   the title of another language (a missing title shows that something is wrong; a language is
 *   switched on only with all its titles). Without a title map / a row of the page: the static
 *   <title> from index.html. Routes without any `title` in their
 *   route chain also get the index.html title (admin + auth use 'admin.panel'). The title is set via Angular `Title`
 *   (document.title = text), so client text can never inject HTML.
 */

import { Injectable, Injector, inject } from '@angular/core';
import { MISSING_TEXT } from '../utils/missing-text';
import { DOCUMENT } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { of } from 'rxjs';
import { catchError, skip } from 'rxjs/operators';
import { PublicDataService } from './public-data.service';
import { LocalizationService } from './localization.service';
import { AdminLocalizationService } from '../../core/services/admin-localization.service';

/** Prefix of the title keys of the administration (area `admin` of the title map). */
const ADMIN_KEY_PREFIX = 'admin.';

/** Map "area.page_key" -> { languageCode: title }. */
type PageTitleMap = Record<string, Record<string, string>>;

/**
 * @description Router TitleStrategy that resolves the route `title` as a key into
 *   the client-editable title map instead of using it as the literal title.
 */
@Injectable({ providedIn: 'root' })
export class PageTitleStrategy extends TitleStrategy {

  // Only dependencies WITHOUT HttpClient are injected eagerly.
  private readonly titleService = inject(Title);
  private readonly injector     = inject(Injector);

  /** Static <title> from index.html, captured before any change. */
  private readonly fallbackTitle: string = inject(DOCUMENT).title;

  /** Resolved lazily in ensureInit() – never in the constructor. */
  private localization: LocalizationService | null = null;
  /** Resolved on the first admin page only (never on the public site - it loads the admin texts). */
  private adminLocalization: AdminLocalizationService | null = null;
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
        const map = res;  // payload = the titles map (finding #6, was {titles})
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

    const lang = key.startsWith(ADMIN_KEY_PREFIX) ? this.adminLanguage() : (this.localization?.getCurrentLanguage() ?? 'cz');
    const own = byLang[lang];
    // never the title of another language
    return typeof own === 'string' && own.trim() !== '' ? own : MISSING_TEXT;
  }

  /**
   * @description Language of the administration UI; on the first call also follows its changes
   *   (the title switches with the admin language).
   * @returns Admin language code (`cz`, `en`).
   */
  private adminLanguage(): string {
    if (!this.adminLocalization) {
      this.adminLocalization = this.injector.get(AdminLocalizationService);
      // skip(1): the current value is used right now; later switches re-apply the title
      this.adminLocalization.currentLanguage$.pipe(skip(1)).subscribe(() => this.apply());
    }
    return this.adminLocalization.getCurrentLanguage();
  }
}