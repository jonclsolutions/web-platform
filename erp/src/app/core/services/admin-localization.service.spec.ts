/**
 * @file admin-localization.service.spec.ts
 * @path src/app/core/services/admin-localization.service.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of AdminLocalizationService: initial language from localStorage,
 *   loading of the admin JSON with the texts of the applications (core failure → empty object,
 *   application failure → core texts only), language switching, key lookup with the fallback text,
 *   merged sections and the date locale.
 * @dependencies
 * - HttpTestingController; real localStorage (key 'jsw_admin_language' cleared around tests).
 */

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AdminLocalizationService } from './admin-localization.service';
import { APPS } from '../../apps/apps.registry';

const KEY = 'jsw_admin_language';

describe('AdminLocalizationService', () => {
  let http: HttpTestingController;

  /** Creates the service (constructor already requests the stored language). */
  function create(): AdminLocalizationService {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(AdminLocalizationService);
  }

  /** Answers the requests of the admin texts of every application of the registry. */
  function flushApps(code: string, texts: Record<string, any> = {}): void {
    for (const app of APPS.filter(a => a.adminI18n)) {
      http.expectOne(`assets/i18n/apps/${app.id}/admin/i18n/${code}.json`).flush(texts[app.id] ?? {});
    }
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
    flushApps('cz');
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
    flushApps('en');
    expect(service.getDateLocale()).toBe('en-US');

    const emitted: string[] = [];
    service.currentLanguage$.subscribe(l => emitted.push(l));
    spyOn(console, 'error');
    service.setLanguage('de');
    http.expectOne('assets/i18n/admin/de/de.json').flush('no', { status: 404, statusText: 'Not Found' });
    flushApps('de');

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
    flushApps('cz');

    expect(service.getMergedSection('users')).toEqual({ ok: 'OK', save: 'Store' });
    expect(service.getMergedSection('bad')).toEqual({ ok: 'OK', save: 'Save' });
    expect(service.getMergedSection('')).toEqual({ ok: 'OK', save: 'Save' });

    service.setLanguage('en');
    http.expectOne('assets/i18n/admin/en/en.json').flush({ users: { a: 'A' } });
    flushApps('en');
    expect(service.getMergedSection('users')).toEqual({ a: 'A' });
  });

  /**
   * @description The texts of the applications are merged into the core texts: own sections are
   *   added, keys of a shared section are added to it; a failed file of an application leaves the
   *   rest.
   * @input core {admin-layout: {module_core}}; web {admin-layout: {module_web}, sales-orders: {x}};
   *   shop file 404.
   * @output admin-layout has both keys; sales-orders.x; console.error for the shop.
   */
  it('merges the texts of the applications', () => {
    const service = create();
    spyOn(console, 'error');
    http.expectOne('assets/i18n/admin/cz/cz.json').flush({ 'admin-layout': { module_core: 'Core' } });
    http.expectOne('assets/i18n/apps/web/admin/i18n/cz.json').flush({ 'admin-layout': { module_web: 'Web' }, 'sales-orders': { x: 'X' } });
    http.expectOne('assets/i18n/apps/shop/admin/i18n/cz.json').flush('no', { status: 404, statusText: 'Not Found' });
    for (const app of APPS.filter(a => a.adminI18n && a.id !== 'web' && a.id !== 'shop')) {
      http.expectOne(`assets/i18n/apps/${app.id}/admin/i18n/cz.json`).flush({});
    }

    expect(service.getValue('admin-layout.module_core')).toBe('Core');
    expect(service.getValue('admin-layout.module_web')).toBe('Web');
    expect(service.getValue('sales-orders.x')).toBe('X');
    expect(console.error).toHaveBeenCalled();
  });
});
