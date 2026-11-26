/**
 * @file page-title.strategy.ts
 * @path src/app/shared/services/page-title.strategy.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Sets the browser tab title (<title>) of public pages from the texts
 *   the client writes in admin - tab "Page titles" of the module that owns the pages
 *   (web: Edit website, e-shop: Edit e-shop, ...). The administration has no editable titles:
 *   its title is a text of the admin UI with the company name.
 * @dependencies
 * - PublicDataService: loads the title map once from `public/legal/page-titles`.
 * - LocalizationService: current language of the public pages + its changes (title switches
 *   immediately when the visitor changes the language).
 * - AdminLocalizationService: the admin titles (`admin.*` keys → `shared.page_title_*` of the
 *   admin UI texts, in the admin UI language) - resolved only when such a page is shown (it loads
 *   the admin texts); PublicDataService.siteSettingsValue$: the company name appended to them.
 * @usage
 *   1) Every public route gets `title: 'area.page_key'` (e.g. 'web.services'),
 *      see app.routes.ts. The key must match a row in `legal_page_titles`.
 *   2) Register in app.config.ts:
 *        { provide: TitleStrategy, useClass: PageTitleStrategy }
 * @note The administration (keys `admin.*`: admin, login) is not editable: `admin.panel` →
 *   `shared.page_title_panel` of the admin UI texts ('Administrace') + ' | ' + the company name
 *   of the company details, in the language of the admin UI - not the one the visitor chose on the
 *   public site (both live in the same browser storage). Before the admin texts load: the
 *   index.html title; a text missing in them: 'Cannot load text'.
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
import { catchError } from 'rxjs/operators';
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
  /** The admin UI texts are loaded (any language) - until then the index.html title. */
  private adminTextsLoaded = false;
  /** Company name of the company details (appended to the admin title), '' when unknown. */
  private companyName = '';
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
    if (key.startsWith(ADMIN_KEY_PREFIX)) return this.adminTitle(key.slice(ADMIN_KEY_PREFIX.length));

    const byLang = this.titles[key];
    if (!byLang || typeof byLang !== 'object' || Array.isArray(byLang)) return this.fallbackTitle;

    const lang = this.localization?.getCurrentLanguage() ?? 'cz';
    const own = byLang[lang];
    // never the title of another language
    return typeof own === 'string' && own.trim() !== '' ? own : MISSING_TEXT;
  }

  /**
   * @description Title of an admin page: its admin UI text (`shared.page_title_<page>`) and the
   *   company name. On the first call follows the admin texts (loaded / another admin language)
   *   and the company details.
   * @param page Page of the key without `admin.` (e.g. 'panel').
   * @returns 'Administrace | Firma'; without a company name the text alone; index.html title
   *   before the texts load.
   */
  private adminTitle(page: string): string {
    if (!this.adminLocalization) {
      const admin = this.injector.get(AdminLocalizationService);
      this.adminLocalization = admin;
      // singleton - lives as long as the app; the current values arrive synchronously
      admin.translations$.subscribe(texts => {
        this.adminTextsLoaded = texts !== null;
        this.apply();
      });
      this.injector.get(PublicDataService).siteSettingsValue$.subscribe(config => {
        const name = config?.settings?.company_name;
        this.companyName = typeof name === 'string' ? name.trim() : '';
        this.apply();
      });
    }
    if (!this.adminTextsLoaded) return this.fallbackTitle;
    const text = this.adminLocalization.getValue(`shared.page_title_${page.replace(/-/g, '_')}`);
    return this.companyName ? `${text} | ${this.companyName}` : text;
  }
}