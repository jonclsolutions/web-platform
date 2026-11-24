/**
 * @file seo.service.ts
 * @path src/app/shared/services/seo.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Search engine and link preview data of the public pages built from the site
 * settings of THIS installation (company name, tagline, logo, contacts) instead of values
 * hard-coded in index.html: meta description / author, the canonical URL and og:* of the current
 * page, the schema.org Organization JSON-LD block, the language versions of the page (hreflang +
 * x-default, 2026-11) and `robots: noindex` for pages search engines should not list (route data
 * SEO_NOINDEX_DATA: 404, maintenance). Updated on every navigation, language change, language
 * list and settings load.
 * @dependencies
 * - PublicDataService: site settings cached at bootstrap (`siteSettingsValue$`).
 * - LocalizationService: current public language (tagline translation, og:locale) and the active
 *   languages of the area (hreflang).
 * - language-url / language-preference helpers: URL codes (`cz` → `cs`) and the x-default language.
 * - seo-route-data: SEO_NOINDEX_DATA route data key.
 * - Meta / DOCUMENT / Router: head tags, canonical link, current path.
 * @note The data are set in the browser - search engines that render JavaScript read them;
 * link preview bots that do not run JavaScript see only the neutral defaults of index.html. The
 * same language versions are listed server-side in /sitemap.xml (PublicSeoController).
 */

import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Meta } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { combineLatest, filter, map, of, startWith } from 'rxjs';

import { PublicDataService } from './public-data.service';
import { LangMeta, LocalizationService } from './localization.service';
import { isLocalizedPath, stripLanguagePrefix, urlCodeOfLanguage, withLanguagePrefix } from '../utils/language-url';
import { pickInitialLanguage } from '../utils/language-preference';
import { SEO_NOINDEX_DATA } from '../utils/seo-route-data';

/** @description id of the JSON-LD script element in <head>. */
const JSON_LD_ID = 'organization-jsonld';

/** @description Public language code -> og:locale. */
const OG_LOCALES: Record<string, string> = { cz: 'cs_CZ', en: 'en_US', sk: 'sk_SK', de: 'de_DE' };

@Injectable({ providedIn: 'root' })
export class SeoService {

  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly publicDataService = inject(PublicDataService);
  private readonly localizationService = inject(LocalizationService);

  private initialized = false;

  /**
   * @description Starts keeping the head tags in sync. Call once from the public layouts -
   * a second call is ignored.
   */
  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    const navigation$ = this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => e.urlAfterRedirects),
      startWith(this.router.url),
    );

    combineLatest([
      this.publicDataService.siteSettingsValue$,
      this.localizationService.currentLanguage$,
      navigation$,
      this.localizationService.languages$ ?? of([] as LangMeta[]),
    ]).subscribe(([data, lang, url, languages]) => this.apply(data?.settings ?? null, lang, url, languages));
  }

  /**
   * @description Writes the head tags for one page.
   * @param settings Site settings (null until loaded - only the URL tags are set).
   * @param lang Current public language code.
   * @param url Router URL of the page (query and fragment are dropped from the canonical URL).
   * @param languages Active languages of the area (hreflang alternates).
   */
  private apply(settings: any, lang: string, url: string, languages: LangMeta[] = []): void {
    const origin = this.document.location.origin;
    const path = (url || '/').split(/[?#]/)[0];
    const pageUrl = origin + path;
    const noindex = this.currentRouteNoindex();

    this.setCanonical(pageUrl);
    // Same default as index.html; the 404 page also sets noindex itself (NotFoundComponent).
    this.meta.updateTag({ name: 'robots', content: noindex ? 'noindex' : 'index, follow' });
    this.setAlternates(noindex ? [] : this.alternates(origin, stripLanguagePrefix(path), languages));
    this.meta.updateTag({ property: 'og:url', content: pageUrl });
    this.meta.updateTag({ property: 'og:locale', content: OG_LOCALES[lang] ?? lang });

    if (!settings) return;

    const name: string = settings.company_name ?? '';
    const description = this.tagline(settings, lang);
    const logo = settings.logo_path ? origin + this.publicDataService.getStorageUrl(settings.logo_path) : '';

    this.setOrRemove({ name: 'description' }, description);
    this.setOrRemove({ name: 'author' }, name);
    this.setOrRemove({ property: 'og:site_name' }, name);
    this.setOrRemove({ property: 'og:title' }, name);
    this.setOrRemove({ property: 'og:description' }, description);
    this.setOrRemove({ property: 'og:image' }, logo);

    this.setJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name,
      url: origin + '/',
      ...(logo && { logo }),
      ...(description && { description }),
      ...(settings.contact_email && { email: settings.contact_email }),
      ...(settings.contact_phone && { telephone: settings.contact_phone }),
      ...(settings.address && { address: settings.address }),
    });
  }

  /**
   * @description Tagline in the current language, else the default one.
   * @returns The tagline, '' when there is none.
   */
  private tagline(settings: any, lang: string): string {
    return settings.brand_tagline_i18n?.[lang] || settings.brand_tagline || '';
  }

  /**
   * @description Sets a meta tag, or removes it when the value is empty (no empty tags).
   * @param key `{ name }` or `{ property }` of the tag.
   * @param content Value of the tag.
   */
  private setOrRemove(key: { name: string } | { property: string }, content: string): void {
    const selector = 'name' in key ? `name="${key.name}"` : `property="${key.property}"`;
    if (content) {
      this.meta.updateTag({ ...key, content });
    } else {
      this.meta.removeTag(selector);
    }
  }

  /**
   * @description Language versions of a public page: one per active language and the x-default
   *   (English, else the first language) - none for admin / sign-in pages or a single language.
   * @param origin Origin of the site.
   * @param path Path of the page without the language (`/services`).
   * @param languages Active languages of the area.
   * @returns `[hreflang, href]` pairs, e.g. `['cs', 'https://…/cs/services']`.
   */
  private alternates(origin: string, path: string, languages: LangMeta[]): [string, string][] {
    if (languages.length < 2 || !isLocalizedPath(path)) {
      return [];
    }
    const codes = languages.map(l => l.code);
    const pairs: [string, string][] = codes.map(code => [urlCodeOfLanguage(code), origin + withLanguagePrefix(path, code)]);
    pairs.push(['x-default', origin + withLanguagePrefix(path, pickInitialLanguage(codes, []))]);
    return pairs;
  }

  /**
   * @description Replaces the `<link rel="alternate" hreflang>` elements of the head.
   * @param pairs `[hreflang, href]` pairs (empty = remove them all).
   */
  private setAlternates(pairs: [string, string][]): void {
    this.document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach(link => link.remove());
    for (const [hreflang, href] of pairs) {
      const link = this.document.createElement('link');
      link.setAttribute('rel', 'alternate');
      link.setAttribute('hreflang', hreflang);
      link.setAttribute('href', href);
      this.document.head.appendChild(link);
    }
  }

  /**
   * @description Whether the current route (or one of its parents) asks not to be listed.
   * @returns true with route data SEO_NOINDEX_DATA.
   */
  private currentRouteNoindex(): boolean {
    let snapshot: ActivatedRouteSnapshot | null | undefined = this.router.routerState?.snapshot?.root;
    while (snapshot) {
      if (snapshot.data?.[SEO_NOINDEX_DATA]) {
        return true;
      }
      snapshot = snapshot.firstChild;
    }
    return false;
  }

  /** @description Creates or updates <link rel="canonical">. */
  private setCanonical(href: string): void {
    let link = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', href);
  }

  /**
   * @description Creates or updates the JSON-LD block. `textContent` + JSON.stringify - the
   * values are never parsed as HTML.
   */
  private setJsonLd(data: Record<string, unknown>): void {
    let script = this.document.getElementById(JSON_LD_ID) as HTMLScriptElement | null;
    if (!script) {
      script = this.document.createElement('script');
      script.id = JSON_LD_ID;
      script.type = 'application/ld+json';
      this.document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(data);
  }
}
