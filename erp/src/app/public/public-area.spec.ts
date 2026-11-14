/**
 * @file public-area.spec.ts
 * @path src/app/public/public-area.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of public-area.ts: a shared public page reads the area of the
 *   application from its own route or the nearest parent (the layout); the area of a URL; the
 *   home page of an area.
 * @dependencies public-area, Angular TestBed (ActivatedRoute stub)
 */

import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';

import { PUBLIC_AREA_DATA, PublicArea, publicAreaHome, publicAreaOfUrl, routePublicArea } from './public-area';

describe('routePublicArea', () => {
  const SHOP: PublicArea = { translationModule: 'shop', path: 'shop', theme: 'light' };
  const WEB: PublicArea = { translationModule: 'web', path: '', theme: 'dark' };

  const areaFor = (snapshot: unknown) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: snapshot === null ? [] : [{ provide: ActivatedRoute, useValue: { snapshot } }],
    });
    return TestBed.runInInjectionContext(() => routePublicArea());
  };

  /**
   * @description The area of the route itself wins; otherwise the nearest parent; none at all
   *   (or no route) = null.
   * @input own area; area only on the parent of the parent; no area; no ActivatedRoute
   * @output SHOP; WEB; null; null
   */
  it('reads the nearest area of the route', () => {
    expect(areaFor({ data: { [PUBLIC_AREA_DATA]: SHOP }, parent: { data: { [PUBLIC_AREA_DATA]: WEB }, parent: null } })).toEqual(SHOP);
    expect(areaFor({ data: {}, parent: { data: {}, parent: { data: { [PUBLIC_AREA_DATA]: WEB }, parent: null } } })).toEqual(WEB);
    expect(areaFor({ data: {}, parent: null })).toBeNull();
    expect(areaFor(null)).toBeNull();
  });

  /**
   * @description The area of a URL is the one with the longest matching path; the root area
   *   takes every other URL; no areas = null. The home page is `/<path>`.
   * @input '/shop/cart?x=1', '/shopping', '/', '/shop' with [WEB, SHOP]; '/x' with []
   * @output SHOP, WEB, WEB, SHOP; null; '/' and '/shop'
   */
  it('finds the area of a URL and its home page', () => {
    expect(publicAreaOfUrl('/shop/cart?x=1', [WEB, SHOP])).toEqual(SHOP);
    expect(publicAreaOfUrl('/shopping', [WEB, SHOP])).toEqual(WEB);
    expect(publicAreaOfUrl('/', [WEB, SHOP])).toEqual(WEB);
    expect(publicAreaOfUrl('/shop', [SHOP])).toEqual(SHOP);
    expect(publicAreaOfUrl('/x', [])).toBeNull();
    expect([publicAreaHome(WEB), publicAreaHome(SHOP)]).toEqual(['/', '/shop']);
  });
});
