/**
 * @file public-test-helpers.ts
 * @path src/testing/public-test-helpers.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Shared stubs of the public web / e-shop specs: LocalizationService (translations,
 *   language, language list), PublicDataService (settings stream, requests, status endpoints)
 *   plus router and HttpClient testing providers, and a TurnstileService stub (the captcha of the
 *   public forms never loads the Cloudflare script in a test). Every request returns an empty
 *   successful response unless a test overrides the spy.
 * @dependencies
 * - jasmine (spies), rxjs, @angular/router (provideRouter), @angular/common/http testing.
 */

import { EnvironmentProviders, Provider } from '@angular/core';
import { ActivatedRoute, Routes, convertToParamMap, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { BehaviorSubject, of } from 'rxjs';

import { LocalizationService, LangMeta } from '../app/shared/services/localization.service';
import { PublicDataService } from '../app/shared/services/public-data.service';
import { PUBLIC_AREA_DATA, PublicArea } from '../app/public/public-area';
import { provideUploadRulesStub } from './upload-rules-stub';
import { TurnstileService } from '../app/core/services/turnstile.service';

/** LocalizationService stub. */
export interface LocalizationStub {
  currentTranslations$: BehaviorSubject<any>;
  currentLanguage$: BehaviorSubject<string>;
  setModule: jasmine.Spy;
  getText: jasmine.Spy;
  setLanguage: jasmine.Spy;
  getCurrentLanguage: jasmine.Spy;
  fetchLanguages: jasmine.Spy;
  initTranslations: jasmine.Spy;
}

/** PublicDataService stub. */
export interface PublicDataStub {
  siteSettingsValue$: BehaviorSubject<any>;
  get: jasmine.Spy;
  post: jasmine.Spy;
  getStorageUrl: jasmine.Spy;
  getSiteSettings: jasmine.Spy;
  getFresh: jasmine.Spy;
  setCachedSettings: jasmine.Spy;
}

/** TurnstileService stub - render() resolves the widget id 'widget-1' without any script. */
export interface TurnstileStub {
  render: jasmine.Spy;
  reset: jasmine.Spy;
  remove: jasmine.Spy;
}

/** Everything a public page spec needs. */
export interface PublicPageContext {
  providers: (Provider | EnvironmentProviders)[];
  localization: LocalizationStub;
  publicData: PublicDataStub;
  turnstile: TurnstileStub;
  /** Sets translations (as the API would deliver them for the module). */
  setTranslations(translations: any): void;
}

/** Languages returned by the fetchLanguages() stub. */
export const STUB_LANGUAGES: LangMeta[] = [
  { code: 'cz', label: 'Čeština', flag: 'cz.png', active: true },
  { code: 'en', label: 'English', flag: 'en.png', active: true }
];

/**
 * @description Creates the stubs and providers of a public page.
 * @param options translations (full module object), settings (site settings response), lang, routes,
 *   area (public area of the page = route data of its layout; the page then reads the module of
 *   the area - a spec with its own ActivatedRoute puts the area into that one).
 * @returns Context; `getText(key)` resolves dotted keys in the current translations (key when missing).
 */
export function createPublicPageContext(options: { translations?: any; settings?: any; lang?: string; routes?: Routes; area?: PublicArea } = {}): PublicPageContext {
  const translations$ = new BehaviorSubject<any>(options.translations ?? null);
  const language$ = new BehaviorSubject<string>(options.lang ?? 'cz');
  const resolve = (key: string) =>
    key.split('.').reduce((acc: any, part) => (acc && typeof acc === 'object' ? acc[part] : undefined), translations$.value);

  const localization: LocalizationStub = {
    currentTranslations$: translations$,
    currentLanguage$: language$,
    setModule: jasmine.createSpy('setModule'),
    getText: jasmine.createSpy('getText').and.callFake((key: string) => {
      const value = resolve(key);
      return typeof value === 'string' ? value : key;
    }),
    setLanguage: jasmine.createSpy('setLanguage').and.callFake((code: string) => language$.next(code)),
    getCurrentLanguage: jasmine.createSpy('getCurrentLanguage').and.callFake(() => language$.value),
    fetchLanguages: jasmine.createSpy('fetchLanguages').and.returnValue(of({ languages: STUB_LANGUAGES })),
    initTranslations: jasmine.createSpy('initTranslations').and.resolveTo(options.translations ?? null)
  };

  const publicData: PublicDataStub = {
    siteSettingsValue$: new BehaviorSubject<any>(options.settings ?? null),
    get: jasmine.createSpy('get').and.returnValue(of({})),
    post: jasmine.createSpy('post').and.returnValue(of({})),
    getStorageUrl: jasmine.createSpy('getStorageUrl').and.callFake((p: string) => (p ? `/storage/${p}` : '')),
    getSiteSettings: jasmine.createSpy('getSiteSettings').and.returnValue(of(options.settings ?? { settings: {} })),
    // Status reads of the applications (no-cache GET) answer "active" by default.
    getFresh: jasmine.createSpy('getFresh').and.returnValue(of({ is_web_active: true, is_shop_active: true })),
    setCachedSettings: jasmine.createSpy('setCachedSettings')
  };

  const turnstile: TurnstileStub = {
    render: jasmine.createSpy('render').and.resolveTo('widget-1'),
    reset: jasmine.createSpy('reset'),
    remove: jasmine.createSpy('remove')
  };

  return {
    localization,
    publicData,
    turnstile,
    setTranslations: (t: any) => translations$.next(t),
    providers: [
      provideRouter(options.routes ?? []),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: LocalizationService, useValue: localization },
      { provide: PublicDataService, useValue: publicData },
      { provide: TurnstileService, useValue: turnstile },
      provideUploadRulesStub(),
      ...(options.area ? [{ provide: ActivatedRoute, useValue: areaRoute(options.area) }] : [])
    ]
  };
}

/**
 * @description ActivatedRoute stub of a page inside the layout of a public area.
 * @param area The public area.
 * @param params Route parameters.
 * @returns Stub with `snapshot` (data with the area, no parent, parameters).
 */
export function areaRoute(area: PublicArea, params: Record<string, string> = {}): Partial<ActivatedRoute> {
  return { snapshot: { data: { [PUBLIC_AREA_DATA]: area }, parent: null, paramMap: convertToParamMap(params), queryParamMap: convertToParamMap({}) } as any };
}

/** Text content of the first element matching the selector ('' when missing), trimmed. */
export function textOf(root: HTMLElement, selector: string): string {
  return (root.querySelector(selector)?.textContent ?? '').replace(/\s+/g, ' ').trim();
}
