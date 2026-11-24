/**
 * @file language-url-serializer.ts
 * @path src/app/shared/services/language-url-serializer.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description URL serializer of the router that puts the language into the public URLs
 *   (`/cs/services`, `/en/shop/cart`, `/cs/projects/…`). The routes, links (`routerLink="/faq"`),
 *   guards and redirects of the applications stay without a language: reading a URL removes the
 *   prefix and remembers its language for that URL tree (languageOf), writing a URL (address bar,
 *   href of every link, Router.url) adds the current language. Admin and sign-in URLs (`/admin`,
 *   `/auth`) are left as they are. LanguageRoutingService makes the language of the URL of a
 *   navigation the current one when the navigation starts.
 * @usage `{ provide: UrlSerializer, useClass: LanguageUrlSerializer }` in app.config.ts.
 * @dependencies DefaultUrlSerializer (Angular), LocalizationService, language-url helpers.
 * @note parse() has no side effects on purpose: the router also parses the current address of
 *   the browser only to compare it (every navigation) - switching the language there would undo
 *   a switch.
 * @note Consequences, all intended:
 *   - an old URL without a language (`/services`, a link in an e-mail) is written back as
 *     `/<current language>/services` (replaceState at the first navigation);
 *   - a URL with a language the area does not have (`/fr/…`) is written back with the current
 *     language;
 *   - the Back button to a page in another language switches the texts back to it.
 *   Code that compares a URL with a route path must use stripLanguagePrefix() on Router.url /
 *   NavigationEnd.urlAfterRedirects.
 */

import { Injectable, inject } from '@angular/core';
import { DefaultUrlSerializer, UrlTree } from '@angular/router';
import { LocalizationService } from './localization.service';
import { splitLanguagePrefix, withLanguagePrefix } from '../utils/language-url';

@Injectable()
export class LanguageUrlSerializer extends DefaultUrlSerializer {
  private readonly localization = inject(LocalizationService);
  /** Language of the URL each parsed tree came from (only trees parsed from a prefixed URL). */
  private readonly languages = new WeakMap<UrlTree, string>();

  /**
   * @description Parses a URL without its language prefix and remembers the language for the tree.
   * @param url URL from the address bar / navigateByUrl (`/cs/services?x=1`).
   * @returns The tree of the URL without the prefix (`/services?x=1`).
   */
  override parse(url: string): UrlTree {
    const { language, path } = splitLanguagePrefix(url);
    const tree = super.parse(path);
    if (language) {
      this.languages.set(tree, language);
    }
    return tree;
  }

  /**
   * @description Language of the URL a tree was parsed from.
   * @param tree Tree returned by parse() (e.g. the initial URL of a navigation).
   * @returns Translation code (`cz`, `en`), null for a URL without a prefix or a built tree.
   */
  languageOf(tree: UrlTree | null | undefined): string | null {
    return (tree && this.languages.get(tree)) ?? null;
  }

  /**
   * @description Serializes a tree and adds the current language to a public URL.
   * @param tree Router URL tree (without a language).
   * @returns `/cs/services`; `/admin/web` without a prefix.
   */
  override serialize(tree: UrlTree): string {
    return withLanguagePrefix(super.serialize(tree), this.localization.getCurrentLanguage());
  }
}
