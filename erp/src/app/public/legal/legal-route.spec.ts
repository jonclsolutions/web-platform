/**
 * @file legal-route.spec.ts
 * @path src/app/public/legal/legal-route.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of routeTranslationModule(): the shared legal pages read the
 *   translations of the application whose layout shows them.
 * @dependencies legal-route, Angular TestBed (ActivatedRoute stub)
 */

import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';

import { routeTranslationModule } from './legal-route';

describe('routeTranslationModule', () => {
  const moduleFor = (data: Record<string, unknown> | null) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: data === null ? [] : [{ provide: ActivatedRoute, useValue: { snapshot: { data } } }],
    });
    return TestBed.runInInjectionContext(() => routeTranslationModule());
  };

  /**
   * @description The e-shop route data selects the shop translations; anything else the web.
   * @input data { translationModule: 'shop' }; {}; { translationModule: 'other' }; no ActivatedRoute
   * @output 'shop'; 'web'; 'web'; 'web'
   */
  it('follows the route data', () => {
    expect(moduleFor({ translationModule: 'shop' })).toBe('shop');
    expect(moduleFor({})).toBe('web');
    expect(moduleFor({ translationModule: 'other' })).toBe('web');
    expect(moduleFor(null)).toBe('web');
  });
});
