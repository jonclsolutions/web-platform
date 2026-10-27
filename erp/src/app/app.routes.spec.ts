/**
 * @file app.routes.spec.ts
 * @path src/app/app.routes.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026-10-27
 * @description Route matching of the application route table (404 pages, 2026-10-27): known web /
 *   e-shop / maintenance / auth / admin URLs open their own page, only an UNKNOWN URL opens the
 *   404 page of its area - `/shop/<unknown>` the e-shop 404, any other unknown URL the web 404 -
 *   and `/admin/...` never reaches a public 404.
 * @dependencies
 * - The real `routes` table, cloned with every component / lazy component replaced by a marker
 *   component, guards removed and the lazy admin module replaced by one marker route (the matching
 *   itself is the router's, unchanged).
 */

import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Route, Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { routes } from './app.routes';

/** Marker page: shows which route matched (its full path + the 404 area). */
@Component({ standalone: true, template: '{{ id }}' })
class MarkerComponent {
  readonly id: string;
  constructor(route: ActivatedRoute) {
    const chain = route.snapshot.pathFromRoot.map(s => s.routeConfig?.path).filter(p => p !== undefined && p !== '');
    const area = route.snapshot.data['publicNotFoundArea'];
    this.id = area ? `404:${area}` : chain.join('/');
  }
}


/**
 * @description Copies the route table: pages → MarkerComponent, guards dropped, the lazy admin
 *   module → one admin marker with a catch-all child.
 * @param table Routes to copy.
 */
function cloneRoutes(table: Route[]): Route[] {
  return table.map(route => {
    const copy: Route = { ...route };
    delete copy.canActivate;
    delete copy.canActivateChild;
    if (copy.loadChildren) {
      delete copy.loadChildren;
      copy.children = [{ path: '**', component: MarkerComponent, data: { admin: true } }];
    }
    if (copy.children) {
      copy.children = cloneRoutes(copy.children);
      if (copy.loadComponent || copy.component) {
        delete copy.loadComponent;
        delete copy.component;
      }
    } else if (copy.loadComponent || copy.component) {
      delete copy.loadComponent;
      copy.component = MarkerComponent;
    }
    return copy;
  });
}

describe('app routes', () => {
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(cloneRoutes(routes))] });
    harness = await RouterTestingHarness.create();
  });

  /** Navigates and returns the marker text of the matched page. */
  const open = async (url: string) => {
    await harness.navigateByUrl(url);
    return harness.routeNativeElement?.textContent?.trim() ?? '';
  };

  /**
   * @description Known URLs open their own page, never a 404.
   * @input '/', '/services', '/jobs/5', '/shop' (redirect), '/shop/products/x', '/shop-maintenance',
   *   '/auth/login', '/projects/abc', '/404'.
   * @output '' (home), 'services', 'jobs/:id', 'shop/catalog', 'shop/products/:slugOrId',
   *   'shop-maintenance', 'auth/login', 'projects/:token'; '/404' = the web 404 page.
   */
  it('opens known pages', async () => {
    expect(await open('/')).toBe('');
    expect(await open('/services')).toBe('services');
    expect(await open('/jobs/5')).toBe('jobs/:id');
    expect(await open('/shop')).toBe('shop/catalog');
    expect(await open('/shop/products/x')).toBe('shop/products/:slugOrId');
    expect(await open('/shop-maintenance')).toBe('shop-maintenance');
    expect(await open('/auth/login')).toBe('auth/login');
    expect(await open('/projects/abc')).toBe('projects/:token');
    expect(await open('/404')).toBe('404:web');
  });

  /**
   * @description Unknown URLs open the 404 of their area; the admin keeps its own handling.
   * @input '/nothing', '/services/extra', '/a/b/c?x=1', '/shop/nothing', '/shop/products', '/shop/cart/x',
   *   '/admin/whatever'.
   * @output web 404 for the first three, e-shop 404 for the next three; admin marker (no public 404).
   */
  it('opens the 404 of the area only for unknown URLs', async () => {
    expect(await open('/nothing')).toBe('404:web');
    expect(await open('/services/extra')).toBe('404:web');
    expect(await open('/a/b/c?x=1')).toBe('404:web');
    expect(await open('/shop/nothing')).toBe('404:shop');
    expect(await open('/shop/products')).toBe('404:shop');
    expect(await open('/shop/cart/x')).toBe('404:shop');
    expect(await open('/admin/whatever')).toBe('admin/**');
  });

  /**
   * @description The web catch-all is the very last route and the e-shop catch-all the last child
   *   of the e-shop (a route after them would never be reached).
   * @input routes.
   * @output last route '' with one child '**' (area web); last child of 'shop' = '**' (area shop).
   */
  it('keeps the catch-all routes last', () => {
    const last = routes[routes.length - 1];
    expect(last.path).toBe('');
    expect(last.children!.map(r => [r.path, r.data?.['publicNotFoundArea']])).toEqual([['**', 'web']]);
    const shop = routes.find(r => r.path === 'shop')!;
    const lastShop = shop.children![shop.children!.length - 1];
    expect([lastShop.path, lastShop.data?.['publicNotFoundArea']]).toEqual(['**', 'shop']);
  });

  /**
   * @description Every lazy route of the table loads its component / module (catches a broken
   *   import path, e.g. after the 404 page moved to public/not-found).
   * @input Every loadComponent / loadChildren of the table (nested included).
   * @output Each resolves to a defined class.
   */
  it('loads every lazy page', async () => {
    const loaders: Array<() => unknown> = [];
    const collect = (table: Route[]) => table.forEach(route => {
      if (route.loadComponent) loaders.push(route.loadComponent as () => unknown);
      if (route.loadChildren) loaders.push(route.loadChildren as () => unknown);
      if (route.children) collect(route.children);
    });
    collect(routes);
    expect(loaders.length).toBeGreaterThan(20);
    for (const load of loaders) {
      expect(typeof await load()).toBe('function');
    }
  });
});
