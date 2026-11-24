/**
 * @file language-routing.service.ts
 * @path src/app/shared/services/language-routing.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Language of the public pages together with their URL: a navigation to a URL with
 *   a language (a link, the Back button, the first page) makes that language the current one;
 *   switching the language (a switcher) remembers the choice and moves to the same page in the
 *   new language (`/cs/services` → `/en/services`, a new history entry - Back returns to the
 *   previous language); the `lang` attribute of `<html>` follows the language of the public pages.
 * @usage `inject(LanguageRoutingService).switchTo('en')` in a language switcher;
 *   `init()` once at start (app.config.ts, provideAppInitializer).
 * @dependencies Router (with LanguageUrlSerializer), LocalizationService, DOCUMENT.
 * @note Admin and sign-in pages keep their `lang` (their language is a user setting); a switch
 *   on such a page only changes the language of the public pages.
 */

import { DOCUMENT, Injectable, inject } from '@angular/core';
import { NavigationEnd, NavigationSkipped, NavigationStart, Router, UrlSerializer } from '@angular/router';
import { combineLatest } from 'rxjs';
import { filter, map, startWith } from 'rxjs/operators';
import { LocalizationService } from './localization.service';
import { LanguageUrlSerializer } from './language-url-serializer';
import { isLocalizedPath, stripLanguagePrefix, urlCodeOfLanguage } from '../utils/language-url';

@Injectable({ providedIn: 'root' })
export class LanguageRoutingService {
  private readonly router = inject(Router);
  private readonly localization = inject(LocalizationService);
  private readonly document = inject(DOCUMENT);
  private readonly serializer = inject(UrlSerializer);
  private initialized = false;

  /**
   * @description Starts following the language of the URLs and keeps `<html lang>` in line with
   *   the language of the public pages (screen readers, hyphenation, translation offers of
   *   browsers). A second call is ignored.
   * @note The language is taken when a navigation starts - before the router writes the final
   *   URL (with the current language) into the address bar. A language the area does not have
   *   is refused by LocalizationService, the URL then gets the current language.
   * @note The same page in another language (`/cs/faq` → `/en/faq`, also Back between them) is
   *   the same route for the router, which skips such a navigation; then the language is switched
   *   here and the page is shown again under its URL (replacing the history entry after Back).
   */
  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.router.events
      .pipe(filter((event): event is NavigationStart | NavigationSkipped =>
        event instanceof NavigationStart || event instanceof NavigationSkipped))
      .subscribe(event => {
        const navigation = this.router.currentNavigation();
        const serializer = this.serializer;
        const language = serializer instanceof LanguageUrlSerializer ? serializer.languageOf(navigation?.initialUrl) : null;
        if (!language) {
          return;
        }
        const before = this.localization.getCurrentLanguage();
        this.localization.useUrlLanguage(language);
        if (event instanceof NavigationSkipped && this.localization.getCurrentLanguage() !== before) {
          this.router.navigateByUrl(this.router.url, {
            onSameUrlNavigation: 'reload',
            replaceUrl: navigation?.trigger === 'popstate',
          });
        }
      });
    const path$ = this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(event => event.urlAfterRedirects),
      startWith(this.document.location?.pathname ?? '/'),
    );
    combineLatest([this.localization.currentLanguage$, path$]).subscribe(([code, url]) => {
      if (isLocalizedPath(stripLanguagePrefix(url))) {
        this.document.documentElement.lang = urlCodeOfLanguage(code);
      }
    });
  }

  /**
   * @description The visitor switches the language: it is remembered and the current public page
   *   is shown under the URL of the new language.
   * @param code Translation code (`cz`, `en`).
   */
  switchTo(code: string): void {
    const changed = code !== this.localization.getCurrentLanguage();
    this.localization.setLanguage(code);
    // Router.url is written with the current (now new) language; the route itself is the same,
    // so the navigation must run although the router sees the same page.
    if (changed && isLocalizedPath(stripLanguagePrefix(this.router.url))) {
      this.router.navigateByUrl(this.router.url, { onSameUrlNavigation: 'reload' });
    }
  }

  /**
   * @description The current router URL without the language prefix (for comparisons with
   *   route paths and links).
   * @returns E.g. `/services`.
   */
  currentPath(): string {
    return stripLanguagePrefix(this.router.url);
  }
}
