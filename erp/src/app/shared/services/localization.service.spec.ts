/**
 * @file localization.service.spec.ts
 * @path src/app/shared/services/localization.service.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of the public LocalizationService: stored language, initial load,
 *   fallback to Czech (not cached under the failed language - bugfix 2026-10-23), translation
 *   cache, module switching (stale responses dropped), out-of-order language responses (bugfix
 *   2026-10-23), key lookup and the active-language list.
 * @dependencies
 * - HttpTestingController; real localStorage ('selectedLanguage' cleared around tests).
 */

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { LocalizationService } from './localization.service';
import { environment } from '../../../environments/environment';

const API = environment.base_api_url;

describe('LocalizationService', () => {
  let http: HttpTestingController;
  let texts: any;

  /** Creates the service and records currentTranslations$. */
  function create(): LocalizationService {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    const service = TestBed.inject(LocalizationService);
    service.currentTranslations$.subscribe(t => (texts = t));
    return service;
  }

  beforeEach(() => localStorage.removeItem('selectedLanguage'));
  afterEach(() => {
    http.verify();
    localStorage.removeItem('selectedLanguage');
  });

  /**
   * @description initTranslations loads the stored language of the 'web' module and publishes
   *   it; getText resolves dotted keys and returns the key when missing / not loaded.
   * @input localStorage 'en'; response {home: {title: 'Home'}}.
   * @output GET translations/web/en; resolves the data; 'Home'; 'home.x' → 'home.x'.
   */
  it('loads the stored language on init and resolves keys', async () => {
    localStorage.setItem('selectedLanguage', 'en');
    const service = create();
    expect(service.getCurrentLanguage()).toBe('en');
    expect(service.getText('home.title')).toBe('home.title');

    const done = service.initTranslations();
    http.expectOne(`${API}/translations/web/en`).flush({ data: { home: { title: 'Home' } } });
    expect(await done).toEqual({ home: { title: 'Home' } });
    expect(service.getText('home.title')).toBe('Home');
    expect(service.getText('home.x')).toBe('home.x');
  });

  /**
   * @description A failing language falls back to Czech; the Czech texts are NOT cached as that
   *   language, so switching back later asks the API again. A failing Czech gives null.
   * @input init 'en' → 500, cz ok; setLanguage('cz') (cached); setLanguage('en') → ok.
   * @output Czech texts shown; no request for cz; new request for en with English texts.
   */
  it('falls back to Czech without caching it under the failed language', async () => {
    localStorage.setItem('selectedLanguage', 'en');
    const service = create();
    const done = service.initTranslations();
    http.expectOne(`${API}/translations/web/en`).flush('x', { status: 500, statusText: 'Error' });
    http.expectOne(`${API}/translations/web/cz`).flush({ data: { t: 'CZ' } });
    expect(await done).toEqual({ t: 'CZ' });

    service.setLanguage('cz');
    http.expectNone(`${API}/translations/web/cz`);
    expect(texts).toEqual({ t: 'CZ' });
    expect(localStorage.getItem('selectedLanguage')).toBe('cz');

    service.setLanguage('en');
    http.expectOne(`${API}/translations/web/en`).flush({ data: { t: 'EN' } });
    expect(texts).toEqual({ t: 'EN' });

    service.setModule('shop');
    http.expectOne(`${API}/translations/shop/en`).flush('x', { status: 500, statusText: 'Error' });
    http.expectOne(`${API}/translations/shop/cz`).flush('x', { status: 500, statusText: 'Error' });
    http.expectOne(`${API}/languages/shop`).flush({ data: [] });
    expect(texts).toBeNull();
  });

  /**
   * @description Quick language switches: a slower response of a language that is no longer
   *   selected is ignored.
   * @input setLanguage('en'), setLanguage('de'); de answers first, then en.
   * @output German texts stay on screen.
   */
  it('ignores responses of a language that is no longer selected', () => {
    const service = create();
    service.setLanguage('en');
    service.setLanguage('de');
    const en = http.expectOne(`${API}/translations/web/en`);
    http.expectOne(`${API}/translations/web/de`).flush({ data: { t: 'DE' } });
    en.flush({ data: { t: 'EN' } });
    expect(texts).toEqual({ t: 'DE' });
  });

  /**
   * @description setModule clears the texts and cache, loads the new module and its languages;
   *   the same module is a no-op; a response of the previous module is dropped.
   * @input setModule('shop') while a web request is pending; setModule('shop') again.
   * @output texts null then shop texts; web response ignored; no new requests on the 2nd call.
   */
  it('switches modules and drops stale responses', () => {
    const service = create();
    service.loadTranslations('cz');
    const web = http.expectOne(`${API}/translations/web/cz`);

    service.setModule('shop');
    expect(texts).toBeNull();
    http.expectOne(`${API}/translations/shop/cz`).flush({ data: { m: 'shop' } });
    http.expectOne(`${API}/languages/shop`).flush({ data: [] });
    web.flush({ data: { m: 'web' } });
    expect(texts).toEqual({ m: 'shop' });

    service.setModule('shop');
    http.expectNone(() => true);
  });

  /**
   * @description fetchLanguages maps active languages (default flag icon); on error returns the
   *   last successful list.
   * @input [{cz active icon}, {en active no icon}, {de inactive}]; then HTTP 500.
   * @output [{cz, Čeština, icon, true}, {en, English, default.png, true}] both times.
   */
  it('lists active languages and falls back to the last list', () => {
    const service = create();
    let result: any;
    service.fetchLanguages().subscribe(r => (result = r));
    http.expectOne(`${API}/languages/web`).flush({ data: [
      { code: 'cz', name: 'Čeština', active: true, iconUrl: 'cz.png' },
      { code: 'en', name: 'English', active: true },
      { code: 'de', name: 'Deutsch', active: false }
    ] });
    const expected = [
      { code: 'cz', label: 'Čeština', flag: 'cz.png', active: true },
      { code: 'en', label: 'English', flag: 'assets/images/icons/default.png', active: true }
    ];
    expect(result.languages).toEqual(expected);

    service.fetchLanguages().subscribe(r => (result = r));
    http.expectOne(`${API}/languages/web`).flush('x', { status: 500, statusText: 'Error' });
    expect(result.languages).toEqual(expected);
  });
});
