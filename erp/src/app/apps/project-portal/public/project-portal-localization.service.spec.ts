/**
 * @file project-portal-localization.service.spec.ts
 * @path src/app/apps/project-portal/public/project-portal-localization.service.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of ProjectPortalLocalizationService: the portal texts follow the
 *   language of the public pages (URL / choice), a language without portal texts shows English,
 *   loading of the portal JSON (failure → empty dictionary), switching through the URL
 *   (LanguageRoutingService) and the flat key lookup with its fallback text.
 * @dependencies HttpTestingController; LocalizationService stub (current language subject);
 *   LanguageRoutingService stub (switchTo spy).
 */

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BehaviorSubject } from 'rxjs';

import { ProjectPortalLocalizationService } from './project-portal-localization.service';
import { LocalizationService } from '../../../shared/services/localization.service';
import { LanguageRoutingService } from '../../../shared/services/language-routing.service';

const JSON_URL = (code: string) => `assets/i18n/apps/project-portal/public/i18n/${code}.json`;

describe('ProjectPortalLocalizationService', () => {
  let http: HttpTestingController;
  let language$: BehaviorSubject<string>;
  let routing: { switchTo: jasmine.Spy };

  /** Creates the service with the public language `initial` (requests its JSON at once). */
  function create(initial = 'cz'): ProjectPortalLocalizationService {
    language$ = new BehaviorSubject<string>(initial);
    routing = { switchTo: jasmine.createSpy('switchTo') };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        { provide: LocalizationService, useValue: { currentLanguage$: language$.asObservable(), getCurrentLanguage: () => language$.value } },
        { provide: LanguageRoutingService, useValue: routing },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(ProjectPortalLocalizationService);
  }

  afterEach(() => http.verify());

  /**
   * @description The public language cz loads the Czech portal texts; fallback text before /
   *   for missing or non-string keys.
   * @input public language cz; cz.json {login_title: 'Přihlášení', nested: {a: 1}}.
   * @output 'Cannot load text' before; 'Přihlášení'; fallback for nested / missing; current 'cz'.
   */
  it('loads the texts of the public language and resolves keys', () => {
    const service = create('cz');
    expect(service.getValue('login_title')).toBe('Cannot load text');
    http.expectOne(JSON_URL('cz')).flush({ login_title: 'Přihlášení', nested: { a: 1 } });
    expect(service.getValue('login_title')).toBe('Přihlášení');
    expect(service.getValue('nested')).toBe('Cannot load text');
    expect(service.getValue('missing')).toBe('Cannot load text');
    expect(service.getCurrentLanguage()).toBe('cz');
    expect(service.availableLanguages.map(l => l.code)).toEqual(['cz', 'en']);
  });

  /**
   * @description A change of the public language (URL, switcher) reloads the portal texts; a
   *   language without portal texts shows English; a failed load is logged and empties the texts.
   * @input public cz → en; → de (no portal texts); en.json 404 on a later reload.
   * @output en.json requested, current 'en'; 'de' keeps 'en' (no request); error → {} + console.error.
   */
  it('follows the public language with an English fallback', () => {
    const service = create('cz');
    http.expectOne(JSON_URL('cz')).flush({ a: 'CZ' });
    const languages: string[] = [];
    service.currentLanguage$.subscribe(l => languages.push(l));

    language$.next('en');
    http.expectOne(JSON_URL('en')).flush({ a: 'EN' });
    expect(service.getValue('a')).toBe('EN');

    language$.next('de');
    http.expectNone(JSON_URL('de'));
    expect(service.getCurrentLanguage()).toBe('en');
    expect(languages).toEqual(['cz', 'en']);

    spyOn(console, 'error');
    language$.next('cz');
    http.expectOne(JSON_URL('cz')).flush('x', { status: 404, statusText: 'Not Found' });
    expect(console.error).toHaveBeenCalled();
    expect(service.getValue('a')).toBe('Cannot load text');
  });

  /**
   * @description A switch in the portal goes through the URL of the public pages.
   * @input setLanguage('en').
   * @output LanguageRoutingService.switchTo('en'); nothing loaded until the public language changes.
   */
  it('switches the language through the URL', () => {
    const service = create('cz');
    http.expectOne(JSON_URL('cz')).flush({});
    service.setLanguage('en');
    expect(routing.switchTo).toHaveBeenCalledOnceWith('en');
    http.expectNone(JSON_URL('en'));
  });
});
