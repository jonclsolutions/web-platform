/**
 * @file seo.service.ts
 * @path src/app/shared/services/seo.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Search engine and link preview data of the public pages built from the site
 * settings of THIS installation (company name, tagline, logo, contacts) instead of values
 * hard-coded in index.html: meta description / author, the canonical URL and og:* of the current
 * page, and the schema.org Organization JSON-LD block. Updated on every navigation, language
 * change and settings load.
 * @dependencies
 * - PublicDataService: site settings cached at bootstrap (`siteSettingsValue$`).
 * - LocalizationService: current public language (tagline translation, og:locale).
 * - Meta / DOCUMENT / Router: head tags, canonical link, current path.
 * @note The data are set in the browser - search engines that render JavaScript read them;
 * link preview bots that do not run JavaScript see only the neutral defaults of index.html.
 */

import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Meta } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { combineLatest, filter, map, startWith } from 'rxjs';

import { PublicDataService } from './public-data.service';
import { LocalizationService } from './localization.service';

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

    combineLatest([this.publicDataService.siteSettingsValue$, this.localizationService.currentLanguage$, navigation$])
      .subscribe(([data, lang, url]) => this.apply(data?.settings ?? null, lang, url));
  }

  /**
   * @description Writes the head tags for one page.
   * @param settings Site settings (null until loaded - only the URL tags are set).
   * @param lang Current public language code.
   * @param url Router URL of the page (query and fragment are dropped from the canonical URL).
   */
  private apply(settings: any, lang: string, url: string): void {
    const origin = this.document.location.origin;
    const pageUrl = origin + (url || '/').split(/[?#]/)[0];

    this.setCanonical(pageUrl);
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
