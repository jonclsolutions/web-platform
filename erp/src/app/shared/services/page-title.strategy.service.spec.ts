/**
 * @file page-title.strategy.service.spec.ts
 * @path src/app/shared/services/page-title.strategy.service.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of PageTitleStrategy: the route title key is resolved from the
 *   page-title map loaded once from the API, by current language → Czech → any non-empty value →
 *   the original document title; the title follows language changes; a failed or malformed map
 *   falls back to the document title.
 * @dependencies
 * - PublicDataService spy, LocalizationService stub (language Subject), real Title service;
 *   buildTitle() spied to return the route's title key.
 */

import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot } from '@angular/router';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';

import { PageTitleStrategy } from './page-title.strategy.service';
import { PublicDataService } from './public-data.service';
import { LocalizationService } from './localization.service';

describe('PageTitleStrategy', () => {
  let strategy: PageTitleStrategy;
  let publicData: jasmine.SpyObj<PublicDataService>;
  let language$: BehaviorSubject<string>;
  let title: Title;
  let originalTitle: string;

  /** Navigates the strategy to a route whose title key is `key`. */
  const go = (key: string | undefined) => {
    (strategy.buildTitle as jasmine.Spy).and.returnValue(key);
    strategy.updateTitle({} as RouterStateSnapshot);
  };

  beforeEach(() => {
    originalTitle = document.title;
    document.title = 'RPSW';
    publicData = jasmine.createSpyObj('PublicDataService', ['get']);
    language$ = new BehaviorSubject('en');
    TestBed.configureTestingModule({
      providers: [
        { provide: PublicDataService, useValue: publicData },
        { provide: LocalizationService, useValue: { currentLanguage$: language$, getCurrentLanguage: () => language$.value } }
      ]
    });
    strategy = TestBed.inject(PageTitleStrategy);
    title = TestBed.inject(Title);
    spyOn(strategy, 'buildTitle');
  });
  afterEach(() => (document.title = originalTitle));

  /**
   * @description Title by language with fallbacks; loaded once; follows language switches.
   * @input Map {home: {en: 'Home', cz: 'Domů'}, faq: {cz: 'Dotazy'}, about: {en: '', de: 'Über'}};
   *        routes home (en), faq (en), about (en), unknown, none; language → cz on home.
   * @output 'Home', 'Dotazy', 'Über', 'RPSW', 'RPSW'; 'Domů'; one API request.
   */
  it('resolves titles by language with fallbacks', () => {
    publicData.get.and.returnValue(of({ home: { en: 'Home', cz: 'Domů' }, faq: { cz: 'Dotazy' }, about: { en: '', de: 'Über' }, bad: ['x'], empty: { en: '' } }) as any);
    go('home');
    expect(title.getTitle()).toBe('Home');
    go('faq');
    expect(title.getTitle()).toBe('Dotazy');
    go('about');
    expect(title.getTitle()).toBe('Über');
    go('bad');
    expect(title.getTitle()).toBe('RPSW');
    go('empty');
    expect(title.getTitle()).toBe('RPSW');
    go('unknown');
    expect(title.getTitle()).toBe('RPSW');
    go(undefined);
    expect(title.getTitle()).toBe('RPSW');

    go('home');
    language$.next('cz');
    expect(title.getTitle()).toBe('Domů');
    expect(publicData.get).toHaveBeenCalledOnceWith('public/legal/page-titles');
  });

  /**
   * @description Until the map arrives / when it fails / when it is not an object, the document
   *   title is used; the title is re-applied when the map arrives.
   * @input Pending request then the payload {home: {en: 'Home'}} (finding #6, was {titles}); failing request; titles as array.
   * @output 'RPSW' then 'Home'; 'RPSW'; 'RPSW'.
   */
  it('falls back to the document title without a usable map', () => {
    const response = new Subject<any>();
    publicData.get.and.returnValue(response as any);
    go('home');
    expect(title.getTitle()).toBe('RPSW');
    response.next({ home: { en: 'Home' } });
    expect(title.getTitle()).toBe('Home');

    for (const reply of [throwError(() => new Error('x')), of(['home']), of(null)]) {
      TestBed.resetTestingModule();
      document.title = 'RPSW';
      TestBed.configureTestingModule({
        providers: [
          { provide: PublicDataService, useValue: { get: () => reply } },
          { provide: LocalizationService, useValue: { currentLanguage$: language$, getCurrentLanguage: () => 'en' } }
        ]
      });
      strategy = TestBed.inject(PageTitleStrategy);
      title = TestBed.inject(Title);
      spyOn(strategy, 'buildTitle');
      go('home');
      expect(title.getTitle()).toBe('RPSW');
    }
  });
});
