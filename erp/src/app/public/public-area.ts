/**
 * @file public-area.ts
 * @path src/app/public/public-area.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Public area of a page - which application shows it. Each public application puts
 *   it into the route data of its layout (`data: { publicArea: { … } }`); the shared public pages
 *   of the core (legal documents, 404, cookie bar) and BasePublicComponent read it, so the core
 *   never names an application: the translations of the area, its home page and the look (dark /
 *   light) of the shared pages. The manifest of the application names the same area
 *   (`publicArea`), so the bootstrap loads the texts of the area of the first URL before the
 *   first render.
 * @usage `{ path: 'shop', data: { [PUBLIC_AREA_DATA]: SHOP_PUBLIC_AREA }, loadComponent: … }`;
 *   `routePublicArea()` in a field initializer of a component.
 * @dependencies ActivatedRoute
 */

import { inject } from '@angular/core';
import { ActivatedRoute, ActivatedRouteSnapshot } from '@angular/router';

/** @description Route data key of the area. */
export const PUBLIC_AREA_DATA = 'publicArea';

/** @description Public area of an application. */
export interface PublicArea {
  /** Translation module of its texts (`translations/<module>/<lang>`). */
  translationModule: string;
  /** URL prefix of the area without slashes ('' = the root, 'shop' = /shop/…) - its home page
   *  is `/<path>`. */
  path: string;
  /** Look of the shared pages: dark (with the illustration of the 404) or light. */
  theme: 'dark' | 'light';
}

/**
 * @description The area of the current route: the nearest `publicArea` from the route up to the
 *   root (a page inside a layout reads the data of the layout) - call in an injection context.
 * @returns The area, or null outside every public area.
 */
export function routePublicArea(): PublicArea | null {
  let snapshot: ActivatedRouteSnapshot | null = inject(ActivatedRoute, { optional: true })?.snapshot ?? null;
  while (snapshot) {
    const area = snapshot.data?.[PUBLIC_AREA_DATA];
    if (area) return area as PublicArea;
    snapshot = snapshot.parent;
  }
  return null;
}

/**
 * @description Home page of an area.
 * @param area The area.
 * @returns `/<path>`.
 */
export function publicAreaHome(area: PublicArea): string {
  return `/${area.path}`;
}

/**
 * @description Area of a URL: the area with the longest path the URL starts with (a path ''
 *   matches every URL).
 * @param url Path of the URL (e.g. `/shop/cart?x=1`).
 * @param areas Areas of the installed applications.
 * @returns The area, or null (no area matches, e.g. no public application).
 */
export function publicAreaOfUrl(url: string, areas: PublicArea[]): PublicArea | null {
  const first = url.replace(/^\/+/, '').split(/[/?#]/)[0];
  return [...areas]
    .sort((a, b) => b.path.length - a.path.length)
    .find(area => area.path === '' || area.path === first) ?? null;
}
