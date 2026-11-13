/**
 * @file project-portal-localization.service.spec.ts
 * @path src/app/apps/project-portal/public/project-portal-localization.service.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of ProjectPortalLocalizationService: stored language, loading of the
 *   portal JSON (failure → empty dictionary), language switching and the flat key lookup with
 *   its fallback text.
 * @dependencies
 * - HttpTestingController; real localStorage ('jsw_project_portal_language' cleared around tests).
 */

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ProjectPortalLocalizationService } from './project-portal-localization.service';

const KEY = 'jsw_project_portal_language';

describe('ProjectPortalLocalizationService', () => {
  let http: HttpTestingController;

  /** Creates the service (requests the stored language in the constructor). */
  function create(): ProjectPortalLocalizationService {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(ProjectPortalLocalizationService);
  }

  beforeEach(() => localStorage.removeItem(KEY));
  afterEach(() => {
    http.verify();
    localStorage.removeItem(KEY);
  });

  /**
   * @description Default language cz; fallback text before / for missing or non-string keys.
   * @input cz.json {login_title: 'Přihlášení', nested: {a: 1}}.
   * @output 'Cannot load text' before; 'Přihlášení'; fallback for nested / missing.
   */
  it('loads the default language and resolves keys', () => {
    const service = create();
    expect(service.getValue('login_title')).toBe('Cannot load text');
    http.expectOne('assets/i18n/apps/project-portal/public/i18n/cz.json').flush({ login_title: 'Přihlášení', nested: { a: 1 } });
    expect(service.getValue('login_title')).toBe('Přihlášení');
    expect(service.getValue('nested')).toBe('Cannot load text');
    expect(service.getValue('missing')).toBe('Cannot load text');
    expect(service.getCurrentLanguage()).toBe('cz');
    expect(service.availableLanguages.map(l => l.code)).toEqual(['cz', 'en']);
  });

  /**
   * @description Stored language used; setLanguage stores + emits + loads; a failed load is logged.
   * @input localStorage 'en'; setLanguage('de') → 404.
   * @output en.json requested; 'de' stored and emitted; {} + console.error.
   */
  it('switches and remembers the language', () => {
    localStorage.setItem(KEY, 'en');
    const service = create();
    http.expectOne('assets/i18n/apps/project-portal/public/i18n/en.json').flush({ a: 'A' });
    const languages: string[] = [];
    service.currentLanguage$.subscribe(l => languages.push(l));

    spyOn(console, 'error');
    service.setLanguage('de');
    http.expectOne('assets/i18n/apps/project-portal/public/i18n/de.json').flush('x', { status: 404, statusText: 'Not Found' });
    expect(localStorage.getItem(KEY)).toBe('de');
    expect(languages).toEqual(['en', 'de']);
    expect(console.error).toHaveBeenCalled();
    expect(service.getValue('a')).toBe('Cannot load text');
  });
});
