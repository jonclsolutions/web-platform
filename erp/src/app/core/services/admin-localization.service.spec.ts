/**
 * @file admin-localization.service.spec.ts
 * @path src/app/core/services/admin-localization.service.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of AdminLocalizationService: initial language from localStorage,
 *   loading of the admin JSON (failure → empty object), language switching, key lookup with the
 *   fallback text, merged sections and the date locale.
 * @dependencies
 * - HttpTestingController; real localStorage (key 'rpsw_admin_language' cleared around tests).
 */

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AdminLocalizationService } from './admin-localization.service';

const KEY = 'rpsw_admin_language';

describe('AdminLocalizationService', () => {
  let http: HttpTestingController;

  /** Creates the service (constructor already requests the stored language). */
  function create(): AdminLocalizationService {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(AdminLocalizationService);
  }

  beforeEach(() => localStorage.removeItem(KEY));
  afterEach(() => {
    http.verify();
    localStorage.removeItem(KEY);
  });

  /**
   * @description Before loading every key gives the fallback; after loading nested string keys
   *   resolve, non-string / missing ones give the fallback.
   * @input Default language; JSON {a: {b: 'Text', n: 5}}.
   * @output Request assets/i18n/admin/cz/cz.json; 'Cannot load text' before; 'Text'; fallback for a.n, a.x.y, a.
   */
  it('loads the default language and resolves keys', () => {
    const service = create();
    expect(service.getValue('a.b')).toBe('Cannot load text');
    expect(service.getMergedSection('a')).toEqual({});

    http.expectOne('assets/i18n/admin/cz/cz.json').flush({ a: { b: 'Text', n: 5 } });
    expect(service.getValue('a.b')).toBe('Text');
    expect(service.getValue('a.n')).toBe('Cannot load text');
    expect(service.getValue('a.x.y')).toBe('Cannot load text');
    expect(service.getValue('a')).toBe('Cannot load text');
    expect(service.getCurrentLanguage()).toBe('cz');
    expect(service.getDateLocale()).toBe('cs-CZ');
  });

  /**
   * @description Stored language is used; setLanguage stores, emits and loads the new file; a
   *   failed load is logged and leaves an empty dictionary; unknown language → 'en-US' locale.
   * @input localStorage 'en'; setLanguage('de') with HTTP 404.
   * @output en.json requested, locale en-US; 'de' stored + emitted, translations {} + console.error.
   */
  it('uses the stored language and switches languages', () => {
    localStorage.setItem(KEY, 'en');
    const service = create();
    http.expectOne('assets/i18n/admin/en/en.json').flush({});
    expect(service.getDateLocale()).toBe('en-US');

    const emitted: string[] = [];
    service.currentLanguage$.subscribe(l => emitted.push(l));
    spyOn(console, 'error');
    service.setLanguage('de');
    http.expectOne('assets/i18n/admin/de/de.json').flush('no', { status: 404, statusText: 'Not Found' });

    expect(localStorage.getItem(KEY)).toBe('de');
    expect(emitted).toEqual(['en', 'de']);
    expect(console.error).toHaveBeenCalled();
    let latest: any;
    service.translations$.subscribe(t => (latest = t));
    expect(latest).toEqual({});
    expect(service.getDateLocale()).toBe('en-US');
  });

  /**
   * @description getMergedSection = shared keys overridden by the section's own keys; a missing
   *   section or non-object values give only the shared part / nothing.
   * @input {shared: {ok: 'OK', save: 'Save'}, users: {save: 'Store'}, bad: 'x'}.
   * @output users → {ok, save: 'Store'}; bad / '' → shared only; without shared → {}.
   */
  it('merges a section over the shared texts', () => {
    const service = create();
    http.expectOne('assets/i18n/admin/cz/cz.json').flush({ shared: { ok: 'OK', save: 'Save' }, users: { save: 'Store' }, bad: 'x' });

    expect(service.getMergedSection('users')).toEqual({ ok: 'OK', save: 'Store' });
    expect(service.getMergedSection('bad')).toEqual({ ok: 'OK', save: 'Save' });
    expect(service.getMergedSection('')).toEqual({ ok: 'OK', save: 'Save' });

    service.setLanguage('en');
    http.expectOne('assets/i18n/admin/en/en.json').flush({ users: { a: 'A' } });
    expect(service.getMergedSection('users')).toEqual({ a: 'A' });
  });
});
