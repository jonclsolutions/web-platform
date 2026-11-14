/**
 * @file app.routes.spec.ts
 * @path src/app/app.routes.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Route matching of the application route table (composed from the manifests of the
 *   applications, apps.registry.ts): known web / e-shop / project portal / maintenance / auth /
 *   admin URLs open their own page, only an UNKNOWN URL opens the
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
import { PUBLIC_AREA_DATA } from './public/public-area';
import { requiresApps } from '../testing/requires-apps';

/** Marker page: shows which route matched (its full path, or `404:<translation module of the
 *  public area>` for a 404 page - title `<area>.not-found`). */
@Component({ standalone: true, template: '{{ id }}' })
class MarkerComponent {
  readonly id: string;
  constructor(route: ActivatedRoute) {
    const chain = route.snapshot.pathFromRoot.map(s => s.routeConfig?.path).filter(p => p !== undefined && p !== '');
    const notFound = String(route.snapshot.routeConfig?.title ?? '').endsWith('.not-found');
    const area = [...route.snapshot.pathFromRoot].reverse().map(s => s.data?.[PUBLIC_AREA_DATA]).find(Boolean);
    this.id = notFound ? `404:${area?.translationModule}` : chain.join('/');
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
   *   '/auth/login', '/projects/abc', '/404', the legal pages '/tos', '/shop/tos', '/shop/privacy-policy'.
   * @output '' (home), 'services', 'jobs/:id', 'shop/catalog', 'shop/products/:slugOrId',
   *   'shop-maintenance', 'auth/login', 'projects/:token'; '/404' = the web 404 page; the legal pages
   *   in both layouts (the e-shop layout carries the public area of the e-shop).
   */
  it('opens known pages', async () => {
    requiresApps('web', 'shop', 'project-portal');
    expect(await open('/')).toBe('');
    expect(await open('/services')).toBe('services');
    expect(await open('/jobs/5')).toBe('jobs/:id');
    expect(await open('/shop')).toBe('shop/catalog');
    expect(await open('/shop/products/x')).toBe('shop/products/:slugOrId');
    expect(await open('/shop-maintenance')).toBe('shop-maintenance');
    expect(await open('/auth/login')).toBe('auth/login');
    expect(await open('/projects/abc')).toBe('projects/:token');
    expect(await open('/404')).toBe('404:web');
    expect(await open('/tos')).toBe('tos');
    expect(await open('/shop/tos')).toBe('shop/tos');
    expect(await open('/shop/privacy-policy')).toBe('shop/privacy-policy');
    const shop = routes.find(r => r.path === 'shop')!;
    expect(shop.data?.[PUBLIC_AREA_DATA]?.translationModule).toBe('shop');
  });

  /**
   * @description Unknown URLs open the 404 of their area; the admin keeps its own handling.
   * @input '/nothing', '/services/extra', '/a/b/c?x=1', '/shop/nothing', '/shop/products', '/shop/cart/x',
   *   '/admin/whatever'.
   * @output web 404 for the first three, e-shop 404 for the next three; admin marker (no public 404).
   */
  it('opens the 404 of the area only for unknown URLs', async () => {
    requiresApps('web', 'shop');
    expect(await open('/nothing')).toBe('404:web');
    expect(await open('/services/extra')).toBe('404:web');
    expect(await open('/a/b/c?x=1')).toBe('404:web');
    expect(await open('/shop/nothing')).toBe('404:shop');
    expect(await open('/shop/products')).toBe('404:shop');
    expect(await open('/shop/cart/x')).toBe('404:shop');
    expect(await open('/admin/whatever')).toBe('admin/**');
  });

  /**
   * @description The web catch-all comes after every other route (only the fallback of the core
   *   to the admin follows it, never reached while the web is installed) and the e-shop catch-all
   *   is the last child of the e-shop (a route after them would never be reached).
   * @input routes.
   * @output last route '**' → admin; before it '' (public area of the web) with one child '**'
   *   (web.not-found); last child of 'shop' = '**' (shop.not-found).
   */
  it('keeps the catch-all routes last', () => {
    requiresApps('web', 'shop');
    expect([routes[routes.length - 1].path, routes[routes.length - 1].redirectTo]).toEqual(['**', 'admin']);
    const last = routes[routes.length - 2];
    expect(last.path).toBe('');
    expect(last.data?.[PUBLIC_AREA_DATA]?.translationModule).toBe('web');
    expect(last.children!.map(r => [r.path, r.title])).toEqual([['**', 'web.not-found']]);
    const shop = routes.find(r => r.path === 'shop')!;
    const lastShop = shop.children![shop.children!.length - 1];
    expect([lastShop.path, lastShop.title]).toEqual(['**', 'shop.not-found']);
  });

  /**
   * @description Every lazy route of the table loads its component / module (catches a broken
   *   import path, e.g. after the 404 page moved to public/not-found).
   * @input Every loadComponent / loadChildren of the table (nested included).
   * @output Each resolves to a defined class.
   */
  it('loads every lazy page', async () => {
    requiresApps('web', 'shop', 'project-portal');
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
