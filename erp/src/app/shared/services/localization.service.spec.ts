/**
 * @file localization.service.spec.ts
 * @path src/app/shared/services/localization.service.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the public LocalizationService: stored language, first-visit language
 *   from the browser (not stored; English / first active language as fallbacks), the language of
 *   the URL (first URL and later links, not stored, unknown refused), initial load,
 *   fallback to Czech (not cached under the failed language - bugfix 2026-10-23), translation
 *   cache, module switching (stale responses dropped), out-of-order language responses (bugfix
 *   2026-10-23), key lookup and the active-language list.
 * @dependencies
 * - HttpTestingController; real localStorage ('selectedLanguage' cleared around tests).
 */

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { Subject } from 'rxjs';
import { LocalizationService } from './localization.service';
import { PublicTextEditorService } from '../../public/text-editor/public-text-editor.service';
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

  /** Switches the service to a module and answers its first requests (texts failing - nothing
   *  cached, no languages). */
  function enterModule(service: LocalizationService, module: string): void {
    service.setModule(module);
    // Nothing stored: the default language (English) - its texts fail, then the Czech base fails too.
    http.expectOne(`${API}/translations/${module}/en`).flush('x', { status: 500, statusText: 'Error' });
    http.expectOne(`${API}/translations/${module}/cz`).flush('x', { status: 500, statusText: 'Error' });
    http.expectOne(`${API}/languages/${module}`).flush({ data: [] });
  }

  beforeEach(() => localStorage.removeItem('selectedLanguage'));
  afterEach(() => {
    http.verify();
    localStorage.removeItem('selectedLanguage');
  });

  /**
   * @description initTranslations('web') loads the stored language of the given module and publishes
   *   it; getText resolves dotted keys and returns the key when missing / not loaded.
   * @input localStorage 'en'; response {home: {title: 'Home'}}.
   * @output GET translations/web/en; resolves the data; 'Home'; 'home.x' → 'home.x'.
   */
  it('loads the stored language on init and resolves keys', async () => {
    localStorage.setItem('selectedLanguage', 'en');
    const service = create();
    expect(service.getCurrentLanguage()).toBe('en');
    expect(service.getText('home.title')).toBe('home.title');

    const done = service.initTranslations('web');
    http.expectOne(`${API}/translations/web/en`).flush({ data: { home: { title: 'Home' } } });
    expect(await done).toEqual({ home: { title: 'Home' } });
    expect(service.getText('home.title')).toBe('Home');
    expect(service.getText('home.x')).toBe('home.x');
  });

  /**
   * @description First visit (nothing stored): the languages of the module are loaded first and
   *   the browser's first offered language is used - not stored, the visitor did not choose it.
   * @input no stored language; browser ['de-DE', 'cs-CZ']; languages cz + en active.
   * @output GET languages/web, then translations/web/cz; current 'cz'; localStorage still empty.
   */
  it('picks the first-visit language from the browser without storing it', async () => {
    spyOnProperty(navigator, 'languages').and.returnValue(['de-DE', 'cs-CZ']);
    const service = create();
    const done = service.initTranslations('web');
    http.expectOne(`${API}/languages/web`).flush({ data: [
      { code: 'cz', name: 'Čeština', active: true }, { code: 'en', name: 'English', active: true }
    ] });
    await Promise.resolve();
    http.expectOne(`${API}/translations/web/cz`).flush({ data: { t: 'CZ' } });
    expect(await done).toEqual({ t: 'CZ' });
    expect(service.getCurrentLanguage()).toBe('cz');
    expect(localStorage.getItem('selectedLanguage')).toBeNull();
  });

  /**
   * @description First visit with a browser language the web does not offer: English; without
   *   English the first active language.
   * @input browser ['fr']; languages cz + en → 'en'; new service, languages cz + de (inactive en).
   * @output translations/web/en; then translations/web/cz.
   */
  it('falls back to English, then to the first active language, on a first visit', async () => {
    spyOnProperty(navigator, 'languages').and.returnValue(['fr']);
    let service = create();
    let done = service.initTranslations('web');
    http.expectOne(`${API}/languages/web`).flush({ data: [{ code: 'cz', name: 'Čeština', active: true }, { code: 'en', name: 'English', active: true }] });
    await Promise.resolve();
    http.expectOne(`${API}/translations/web/en`).flush({ data: { t: 'EN' } });
    expect(await done).toEqual({ t: 'EN' });

    TestBed.resetTestingModule();
    service = create();
    done = service.initTranslations('web');
    http.expectOne(`${API}/languages/web`).flush({ data: [
      { code: 'cz', name: 'Čeština', active: true }, { code: 'de', name: 'Deutsch', active: true }, { code: 'en', name: 'English', active: false }
    ] });
    await Promise.resolve();
    http.expectOne(`${API}/translations/web/cz`).flush({ data: { t: 'CZ' } });
    expect(await done).toEqual({ t: 'CZ' });
  });

  /**
   * @description A language in the first URL wins over the stored choice when the module has it
   *   (not stored); an unknown URL language falls back to the stored choice.
   * @input stored 'en'; initTranslations('web', 'cz') with cz + en; new service with URL 'fr'.
   * @output translations/web/cz, stored stays 'en'; then translations/web/en.
   */
  it('uses the language of the first URL when the module has it', async () => {
    localStorage.setItem('selectedLanguage', 'en');
    let service = create();
    let done = service.initTranslations('web', 'cz');
    http.expectOne(`${API}/languages/web`).flush({ data: [{ code: 'cz', name: 'Čeština', active: true }, { code: 'en', name: 'English', active: true }] });
    await Promise.resolve();
    http.expectOne(`${API}/translations/web/cz`).flush({ data: { t: 'CZ' } });
    expect(await done).toEqual({ t: 'CZ' });
    expect(localStorage.getItem('selectedLanguage')).toBe('en');
    expect(service.isChosenByVisitor()).toBeTrue();

    TestBed.resetTestingModule();
    service = create();
    done = service.initTranslations('web', 'fr');
    http.expectOne(`${API}/languages/web`).flush({ data: [{ code: 'cz', name: 'Čeština', active: true }, { code: 'en', name: 'English', active: true }] });
    await Promise.resolve();
    http.expectOne(`${API}/translations/web/en`).flush({ data: { t: 'EN' } });
    expect(await done).toEqual({ t: 'EN' });
  });

  /**
   * @description Later URL languages (links, Back): a known one becomes current without being
   *   stored and loads its texts; an unknown one is refused; the same one does nothing. Texts of
   *   another language can be fetched without switching.
   * @input languages cz + en loaded; useUrlLanguage('cz'), ('fr'), ('cz'); fetchTexts('en').
   * @output true + translations/web/cz, nothing stored; false; true without a request; EN texts,
   *   current still 'cz'.
   */
  it('follows URL languages without storing them', () => {
    const service = create();
    enterModule(service, 'web');
    service.fetchLanguages().subscribe();
    http.expectOne(`${API}/languages/web`).flush({ data: [{ code: 'cz', name: 'Čeština', active: true }, { code: 'en', name: 'English', active: true }] });
    expect(service.getLanguages().map(l => l.code)).toEqual(['cz', 'en']);

    expect(service.useUrlLanguage('cz')).toBeTrue();
    http.expectOne(`${API}/translations/web/cz`).flush({ data: { t: 'CZ' } });
    expect(service.getCurrentLanguage()).toBe('cz');
    expect(localStorage.getItem('selectedLanguage')).toBeNull();
    expect(service.isChosenByVisitor()).toBeFalse();

    expect(service.useUrlLanguage('fr')).toBeFalse();
    expect(service.getCurrentLanguage()).toBe('cz');
    expect(service.useUrlLanguage('cz')).toBeTrue();
    http.expectNone(() => true);

    let other: any;
    service.fetchTexts('en').subscribe(t => (other = t));
    http.expectOne(`${API}/translations/web/en`).flush({ data: { t: 'EN' } });
    expect(other).toEqual({ t: 'EN' });
    expect(service.getCurrentLanguage()).toBe('cz');
  });

  /**
   * @description A language chosen in the switcher is stored and wins on the next start (no
   *   language list needed before the texts).
   * @input setLanguage('en') on a fresh service; a new service initTranslations('web').
   * @output localStorage 'en'; new service asks translations/web/en directly.
   */
  it('remembers the language chosen in the switcher', async () => {
    let service = create();
    service.setLanguage('en');
    http.match(() => true).forEach(req => req.flush({ data: {} }));
    expect(localStorage.getItem('selectedLanguage')).toBe('en');

    TestBed.resetTestingModule();
    service = create();
    const done = service.initTranslations('web');
    http.expectOne(`${API}/translations/web/en`).flush({ data: { t: 'EN' } });
    expect(await done).toEqual({ t: 'EN' });
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
    const done = service.initTranslations('web');
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
    enterModule(service, 'web');
    service.setLanguage('en');
    service.setLanguage('de');
    const en = http.expectOne(`${API}/translations/web/en`);
    http.expectOne(`${API}/translations/web/de`).flush({ data: { t: 'DE' } });
    en.flush({ data: { t: 'EN' } });
    expect(texts).toEqual({ t: 'DE' });
  });

  /**
   * @description The admin in another tab saved texts: the current language of the module shown is
   *   loaded again and shown in place; another language only leaves the cache; another module
   *   and changed languages (the switcher reloads) are handled apart.
   * @input web in cz (cached); texts web/cz; texts web/en; texts shop/cz; languages web
   * @output new GET translations/web/cz → shown; no request for en / shop; GET languages/web
   */
  it('shows texts saved by the admin in another tab', async () => {
    const service = create();
    enterModule(service, 'web');
    service.setLanguage('cz');
    http.expectOne(`${API}/translations/web/cz`).flush({ data: { t: 'Staré' } });
    expect(texts).toEqual({ t: 'Staré' });
    const apply = (change: unknown) => (service as any).applyTextsChange(change);

    apply({ kind: 'texts', module: 'web', lang: 'cz' });
    http.expectOne(`${API}/translations/web/cz`).flush({ data: { t: 'Nové' } });
    expect(texts).toEqual({ t: 'Nové' });

    apply({ kind: 'texts', module: 'web', lang: 'en' });
    apply({ kind: 'texts', module: 'shop', lang: 'cz' });
    http.expectNone(() => true);

    apply({ kind: 'languages', module: 'web' });
    http.expectOne(`${API}/languages/web`).flush({ data: [] });
  });

  /**
   * @description setModule clears the texts and cache, loads the new module and its languages;
   *   the same module is a no-op; a response of the previous module is dropped.
   * @input setModule('shop') while a web request is pending; setModule('shop') again.
   * @output texts null then shop texts; web response ignored; no new requests on the 2nd call.
   */
  it('switches modules and drops stale responses', () => {
    const service = create();
    enterModule(service, 'web');
    service.loadTranslations('cz');
    const web = http.expectOne(`${API}/translations/web/cz`);

    service.setModule('shop');
    expect(texts).toBeNull();
    http.expectOne(`${API}/translations/shop/en`).flush({ data: { m: 'shop' } });
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
    enterModule(service, 'web');
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

  /**
   * @description Visual text editor: the published texts are decorated by the editor mode
   *   (drafts, marks); new drafts publish the same texts again; saved drafts are written into
   *   the loaded (cached) texts.
   * @input editor stub (active, decorate adds the language); init 'cz' {faq: {title}}; changes;
   *   commit {faq.title: 'Nové'} cz
   * @output published = decorate(data, 'cz'); republished on changes; cached faq.title 'Nové'
   */
  it('publishes the texts through the editor mode in the visual text editor', async () => {
    const changes$ = new Subject<void>();
    const commits$ = new Subject<{ lang: string; values: Record<string, string> }>();
    const editor = { active: true, changes$, commits$, decorate: jasmine.createSpy('decorate').and.callFake((d: any, lang: string) => ({ ...d, shownIn: lang })) };
    localStorage.setItem('selectedLanguage', 'cz');
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: PublicTextEditorService, useValue: editor }] });
    http = TestBed.inject(HttpTestingController);
    const service = TestBed.inject(LocalizationService);
    let published: any;
    service.currentTranslations$.subscribe(t => (published = t));

    const done = service.initTranslations('web');
    http.expectOne(`${API}/translations/web/cz`).flush({ data: { faq: { title: 'Staré' } } });
    await done;
    expect(published).toEqual({ faq: { title: 'Staré' }, shownIn: 'cz' });

    changes$.next();
    expect(editor.decorate).toHaveBeenCalledTimes(2);
    commits$.next({ lang: 'cz', values: { 'faq.title': 'Nové' } });
    changes$.next();
    expect(published.faq.title).toBe('Nové');
  });

  /**
   * @description In the frame of the visual text editor a chosen language is never stored (the
   *   storage of the administrator's own visits), changed languages announced by the admin
   *   reload the switcher, announced texts are left to the editor (its drafts and saves).
   * @input editor mode, stored 'cz'; setLanguage('en'); broadcast texts web/cz, then languages web
   * @output stored language still 'cz'; no request for the texts; GET languages/web
   */
  it('stores no language and follows changed languages in the editor frame', async () => {
    const editor = { active: true, changes$: new Subject<void>(), commits$: new Subject<any>(), decorate: (d: any) => d };
    localStorage.setItem('selectedLanguage', 'cz');
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: PublicTextEditorService, useValue: editor }] });
    http = TestBed.inject(HttpTestingController);
    const service = TestBed.inject(LocalizationService);
    const done = service.initTranslations('web');
    http.expectOne(`${API}/translations/web/cz`).flush({ data: {} });
    await done;
    http.match(() => true).forEach(request => request.flush({ data: [] }));

    service.setLanguage('en');
    expect(localStorage.getItem('selectedLanguage')).toBe('cz');
    http.match(() => true).forEach(request => request.flush({ data: {} }));

    const channel = new BroadcastChannel('jsw-texts');
    channel.postMessage({ kind: 'texts', module: 'web', lang: 'en' });
    channel.postMessage({ kind: 'languages', module: 'web' });
    await new Promise(resolve => setTimeout(resolve, 50));
    channel.close();
    expect(http.match(`${API}/translations/web/en`).length).toBe(0);
    http.expectOne(`${API}/languages/web`).flush({ data: [] });
  });
});
