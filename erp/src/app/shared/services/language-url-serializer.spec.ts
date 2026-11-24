/**
 * @file language-url-serializer.spec.ts
 * @path src/app/shared/services/language-url-serializer.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit and router tests of the language in the public URLs (LanguageUrlSerializer +
 *   LanguageRoutingService): parse / serialize, the address bar after navigations (prefix added,
 *   old URL without a language rewritten, unknown language replaced, admin untouched), a switch
 *   (new history entry, links re-written) with Back returning the previous language, and
 *   `<html lang>`.
 * @dependencies Real Router with the serializer, provideLocationMocks (SpyLocation),
 *   LocalizationService stub (cz / en, useUrlLanguage refuses unknown codes).
 */

import { Component } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { DefaultUrlSerializer, Router, RouterLink, UrlSerializer, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { LanguageUrlSerializer } from './language-url-serializer';
import { LanguageRoutingService } from './language-routing.service';
import { LocalizationService } from './localization.service';

/** Routed dummy page with one link (its href shows the serialized URL). */
@Component({ standalone: true, imports: [RouterLink], template: '<a routerLink="/faq">FAQ</a>' })
class PageComponent {}

/** LocalizationService stub: languages cz / en, the current one in a subject. */
function localizationStub(initial = 'cz') {
  const language$ = new BehaviorSubject<string>(initial);
  return {
    language$,
    currentLanguage$: language$.asObservable(),
    getCurrentLanguage: () => language$.value,
    useUrlLanguage: jasmine.createSpy('useUrlLanguage').and.callFake((code: string) => {
      if (!['cz', 'en'].includes(code)) return false;
      language$.next(code);
      return true;
    }),
    setLanguage: jasmine.createSpy('setLanguage').and.callFake((code: string) => language$.next(code)),
  };
}

describe('LanguageUrlSerializer', () => {
  let localization: ReturnType<typeof localizationStub>;
  let router: Router;
  let location: Location;
  const originalLang = document.documentElement.lang;
  afterEach(() => { document.documentElement.lang = originalLang; });

  /** Router with the language serializer and two public routes + an admin route. */
  function setup(initial = 'cz') {
    localization = localizationStub(initial);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: PageComponent },
          { path: 'faq', component: PageComponent },
          { path: 'shop/cart', component: PageComponent },
          { path: 'admin/web', component: PageComponent },
        ]),
        provideLocationMocks(),
        { provide: UrlSerializer, useClass: LanguageUrlSerializer },
        { provide: LocalizationService, useValue: localization },
      ],
    });
    router = TestBed.inject(Router);
    location = TestBed.inject(Location);
  }

  /**
   * @description Parsing drops the prefix and remembers its language for the tree (no side
   *   effect - the router also parses the address only to compare it); serializing adds the
   *   current language to public URLs only.
   * @input parse '/en/shop/cart?x=1'; serialize trees of /faq (cz, then en), /, /admin/web.
   * @output tree '/shop/cart?x=1', languageOf 'en', no useUrlLanguage; '/cs/faq', '/en/faq',
   *   '/en', '/admin/web'.
   */
  it('removes the prefix when parsing and adds it when serializing', () => {
    setup();
    const serializer = TestBed.inject(UrlSerializer) as LanguageUrlSerializer;
    const tree = serializer.parse('/en/shop/cart?x=1');
    expect(new DefaultUrlSerializer().serialize(tree)).toBe('/shop/cart?x=1');
    expect(serializer.languageOf(tree)).toBe('en');
    expect(serializer.languageOf(serializer.parse('/faq'))).toBeNull();
    expect(localization.useUrlLanguage).not.toHaveBeenCalled();
    expect(serializer.serialize(serializer.parse('/faq'))).toBe('/cs/faq');
    localization.language$.next('en');
    expect(serializer.serialize(serializer.parse('/faq'))).toBe('/en/faq');
    expect(serializer.serialize(serializer.parse('/'))).toBe('/en');
    expect(serializer.serialize(serializer.parse('/admin/web'))).toBe('/admin/web');
  });

  /**
   * @description Address bar: a prefixed URL stays and its language becomes current; an old URL
   *   without a language gets the current one; an unknown language is replaced by the current
   *   one; admin URLs stay bare; links render with the prefix.
   * @input navigate '/en/faq'; '/cs/faq'; '/shop/cart'; '/fr/faq'; '/admin/web'.
   * @output '/en/faq' (current en); '/cs/faq' + link href '/cs/faq'; '/cs/shop/cart'; '/cs/faq';
   *   '/admin/web'.
   */
  it('writes the language into the address bar', fakeAsync(() => {
    setup();
    TestBed.inject(LanguageRoutingService).init();
    const fixture = TestBed.createComponent(PageComponent);
    router.navigateByUrl('/en/faq');
    tick();
    expect(location.path()).toBe('/en/faq');
    expect(localization.getCurrentLanguage()).toBe('en');

    router.navigateByUrl('/cs/faq');
    tick();
    fixture.detectChanges();
    expect(location.path()).toBe('/cs/faq');
    expect(fixture.nativeElement.querySelector('a').getAttribute('href')).toBe('/cs/faq');

    router.navigateByUrl('/shop/cart');
    tick();
    expect(location.path()).toBe('/cs/shop/cart');

    router.navigateByUrl('/fr/faq');
    tick();
    expect(location.path()).toBe('/cs/faq');

    router.navigateByUrl('/admin/web');
    tick();
    expect(location.path()).toBe('/admin/web');
  }));

  /**
   * @description A switch remembers the language and shows the same page under the new URL in a
   *   new history entry; Back returns to the previous URL and switches the language back;
   *   `<html lang>` follows on public pages.
   * @input on '/cs/faq': switchTo('en'); then Back; switchTo('cz') on the current language.
   * @output setLanguage('en'), path '/en/faq', html lang 'en'; after Back path '/cs/faq', current
   *   'cz', html lang 'cs'; no navigation for the same language.
   */
  it('switches the language with the URL and follows the Back button', fakeAsync(() => {
    setup();
    const routing = TestBed.inject(LanguageRoutingService);
    routing.init();
    router.initialNavigation(); // listens to the Back button, as in the application
    tick();
    router.navigateByUrl('/cs/faq');
    tick();
    expect(document.documentElement.lang).toBe('cs');

    routing.switchTo('en');
    tick();
    expect(localization.setLanguage).toHaveBeenCalledWith('en');
    expect(location.path()).toBe('/en/faq');
    expect(routing.currentPath()).toBe('/faq');
    expect(document.documentElement.lang).toBe('en');

    location.back();
    tick();
    expect(location.path()).toBe('/cs/faq');
    expect(localization.getCurrentLanguage()).toBe('cz');
    expect(document.documentElement.lang).toBe('cs');

    const navigate = spyOn(router, 'navigateByUrl').and.callThrough();
    routing.switchTo('cz');
    tick();
    expect(navigate).not.toHaveBeenCalled();
  }));
});
