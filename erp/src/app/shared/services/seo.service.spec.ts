/**
 * @file seo.service.spec.ts
 * @path src/app/shared/services/seo.service.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of SeoService: the head tags (description, author, og:*, canonical) and
 *   the Organization JSON-LD follow the site settings, the public language and the navigation;
 *   empty values remove their tag; a second init() is ignored.
 * @dependencies
 * - PublicDataService / LocalizationService stubs (BehaviorSubjects), Router events Subject,
 *   real Meta and document head (tags cleaned after each test).
 */

import { TestBed } from '@angular/core/testing';
import { Meta } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { BehaviorSubject, Subject } from 'rxjs';

import { SeoService } from './seo.service';
import { PublicDataService } from './public-data.service';
import { LocalizationService } from './localization.service';

describe('SeoService', () => {
  let settings$: BehaviorSubject<any>;
  let lang$: BehaviorSubject<string>;
  let events$: Subject<any>;
  let service: SeoService;
  let meta: Meta;

  const content = (selector: string) => meta.getTag(selector)?.content ?? null;
  const jsonLd = () => JSON.parse(document.getElementById('organization-jsonld')!.textContent!);
  const cleanHead = () => {
    ['name="description"', 'name="author"', 'property="og:site_name"', 'property="og:title"', 'property="og:description"',
      'property="og:image"', 'property="og:url"', 'property="og:locale"'].forEach(s => meta.removeTag(s));
    document.head.querySelector('link[rel="canonical"]')?.remove();
    document.getElementById('organization-jsonld')?.remove();
  };

  beforeEach(() => {
    settings$ = new BehaviorSubject<any>(null);
    lang$ = new BehaviorSubject<string>('cz');
    events$ = new Subject<any>();
    TestBed.configureTestingModule({
      providers: [
        { provide: PublicDataService, useValue: { siteSettingsValue$: settings$, getStorageUrl: (p: string) => `/storage/${p}` } },
        { provide: LocalizationService, useValue: { currentLanguage$: lang$ } },
        { provide: Router, useValue: { url: '/home?x=1', events: events$ } },
      ]
    });
    service = TestBed.inject(SeoService);
    meta = TestBed.inject(Meta);
    cleanHead();
  });

  afterEach(cleanHead);

  /**
   * @description Before the settings arrive only the URL tags exist; the settings fill the brand
   *   tags and the JSON-LD; a language switch takes the translated tagline and og:locale; a
   *   navigation moves the canonical URL (query dropped).
   * @input init(); settings Acme (tagline cz/en, logo, contacts); lang 'en'; NavigationEnd '/about#team'.
   * @output canonical + og:url origin/home, og:locale cs_CZ, no description; description 'Software',
   *   author / og:title 'Acme', og:image origin/storage/logo.png, JSON-LD Organization with
   *   email / telephone / address; 'Software EN' + en_US; canonical origin/about.
   */
  it('builds the head tags from the site settings, language and page', () => {
    service.init();
    const origin = document.location.origin;
    expect(document.head.querySelector('link[rel="canonical"]')!.getAttribute('href')).toBe(`${origin}/home`);
    expect(content('property="og:url"')).toBe(`${origin}/home`);
    expect(content('property="og:locale"')).toBe('cs_CZ');
    expect(content('name="description"')).toBeNull();

    settings$.next({ settings: {
      company_name: 'Acme', brand_tagline: 'Software', brand_tagline_i18n: { en: 'Software EN' }, logo_path: 'logo.png',
      contact_email: 'info@acme.cz', contact_phone: '+420 1', address: 'Praha',
    } });
    expect(content('name="description"')).toBe('Software');
    expect(content('name="author"')).toBe('Acme');
    expect(content('property="og:title"')).toBe('Acme');
    expect(content('property="og:site_name"')).toBe('Acme');
    expect(content('property="og:image"')).toBe(`${origin}/storage/logo.png`);
    expect(jsonLd()).toEqual({
      '@context': 'https://schema.org', '@type': 'Organization', name: 'Acme', url: `${origin}/`,
      logo: `${origin}/storage/logo.png`, description: 'Software', email: 'info@acme.cz', telephone: '+420 1', address: 'Praha',
    });

    lang$.next('en');
    expect(content('name="description"')).toBe('Software EN');
    expect(content('property="og:locale"')).toBe('en_US');

    events$.next(new NavigationEnd(1, '/about#team', '/about#team'));
    expect(document.head.querySelector('link[rel="canonical"]')!.getAttribute('href')).toBe(`${origin}/about`);
    expect(document.head.querySelectorAll('link[rel="canonical"]').length).toBe(1);
  });

  /**
   * @description Empty values remove their tags and stay out of the JSON-LD; an unknown language
   *   is used as the locale as is; a second init() adds no second subscription.
   * @input init() twice; lang 'pl'; settings without name, tagline and logo; empty router URL.
   * @output no description / author / og:image; JSON-LD only @context, @type, name, url;
   *   og:locale 'pl'.
   */
  it('removes empty tags and ignores a second init', () => {
    (TestBed.inject(Router) as any).url = '';
    lang$.next('pl');
    service.init();
    service.init();
    settings$.next({ settings: { brand_tagline: '', logo_path: null } });
    expect(content('name="description"')).toBeNull();
    expect(content('name="author"')).toBeNull();
    expect(content('property="og:image"')).toBeNull();
    expect(content('property="og:locale"')).toBe('pl');
    expect(Object.keys(jsonLd())).toEqual(['@context', '@type', 'name', 'url']);
    expect(document.querySelectorAll('#organization-jsonld').length).toBe(1);
  });
});
