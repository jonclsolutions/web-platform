/**
 * @file language-url.spec.ts
 * @path src/app/shared/utils/language-url.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the language prefix of the public URLs: code mapping (cs ↔ cz, `cz`
 *   accepted in the URL), splitting (query / fragment kept, root, no prefix, regions), stripping,
 *   which URLs carry a language (not /admin, /auth) and adding the prefix (root without a
 *   trailing slash).
 * @dependencies none
 */

import {
  isLocalizedPath, languageOfUrlCode, splitLanguagePrefix, stripLanguagePrefix, urlCodeOfLanguage, withLanguagePrefix
} from './language-url';

describe('language-url', () => {
  /**
   * @description Czech is `cs` in the URL and `cz` in the translations; `cz` in a URL is accepted;
   *   other codes are the same, lower case.
   * @input cz, EN, de; cs, CZ, En, pt-BR.
   * @output cs, en, de; cz, cz, en, pt-br.
   */
  it('maps the language codes between the URL and the translations', () => {
    expect(['cz', 'EN', 'de'].map(urlCodeOfLanguage)).toEqual(['cs', 'en', 'de']);
    expect(['cs', 'CZ', 'En', 'pt-BR'].map(languageOfUrlCode)).toEqual(['cz', 'cz', 'en', 'pt-br']);
  });

  /**
   * @description The first segment is the language when it looks like one; the rest keeps its
   *   query and fragment; a URL without a prefix is returned whole.
   * @input /cs/services?x=1#a; /en; /cs?x=1; cs/shop/cart; /services; /404; /projects/order/t; /pt-br/faq.
   * @output cz + /services?x=1#a; en + /; cz + /?x=1; cz + /shop/cart; null + /services; null + /404;
   *   null + /projects/order/t; pt-br + /faq.
   */
  it('splits the language prefix off a URL', () => {
    expect(splitLanguagePrefix('/cs/services?x=1#a')).toEqual({ language: 'cz', path: '/services?x=1#a' });
    expect(splitLanguagePrefix('/en')).toEqual({ language: 'en', path: '/' });
    expect(splitLanguagePrefix('/cs?x=1')).toEqual({ language: 'cz', path: '/?x=1' });
    expect(splitLanguagePrefix('cs/shop/cart')).toEqual({ language: 'cz', path: '/shop/cart' });
    expect(splitLanguagePrefix('/services')).toEqual({ language: null, path: '/services' });
    expect(splitLanguagePrefix('/404')).toEqual({ language: null, path: '/404' });
    expect(splitLanguagePrefix('/projects/order/t')).toEqual({ language: null, path: '/projects/order/t' });
    expect(splitLanguagePrefix('/pt-br/faq')).toEqual({ language: 'pt-br', path: '/faq' });
    expect(stripLanguagePrefix('/en/maintenance?return=%2Fen')).toBe('/maintenance?return=%2Fen');
  });

  /**
   * @description Admin and sign-in URLs carry no language; every other URL does.
   * @input /admin/web, /auth/login, /, /services, /shop, /administrace.
   * @output false, false, true, true, true, true.
   */
  it('knows which URLs carry a language', () => {
    expect(['/admin/web', '/auth/login', '/', '/services', '/shop', '/administrace'].map(isLocalizedPath))
      .toEqual([false, false, true, true, true, true]);
  });

  /**
   * @description The prefix goes before public URLs only; the root has no trailing slash.
   * @input (/services, cz), (/, en), (/?x=1, cz), (/#top, en), (shop/cart, en), (/admin/web, cz), (/faq, '').
   * @output /cs/services, /en, /cs?x=1, /en#top, /en/shop/cart, /admin/web, /faq.
   */
  it('adds the prefix to public URLs only', () => {
    expect(withLanguagePrefix('/services', 'cz')).toBe('/cs/services');
    expect(withLanguagePrefix('/', 'en')).toBe('/en');
    expect(withLanguagePrefix('/?x=1', 'cz')).toBe('/cs?x=1');
    expect(withLanguagePrefix('/#top', 'en')).toBe('/en#top');
    expect(withLanguagePrefix('shop/cart', 'en')).toBe('/en/shop/cart');
    expect(withLanguagePrefix('/admin/web', 'cz')).toBe('/admin/web');
    expect(withLanguagePrefix('/faq', '')).toBe('/faq');
  });
});
