/**
 * @file public-not-found.config.ts
 * @path src/app/public/not-found/public-not-found.config.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description The public "page not found" (404) is ONE component shared by every public
 *   application. Each application gives its layout route the public area (public-area.ts:
 *   translations, home page, look) and places a catch-all `**` route built by
 *   `publicNotFoundRoute()` LAST among the children of its layout, so it matches only a URL no
 *   other route knows. A new public application = the area in the data of its layout + one
 *   `publicNotFoundRoute('<area>')` + a `not_found` section in its translations + a
 *   `<area>.not-found` row in `legal_page_titles`.
 * @note The admin has its own 404 / 403 pages (admin/error-pages) - a URL below `/admin` never
 *   reaches these routes.
 */

import { Route } from '@angular/router';

/**
 * @description Builds the catch-all 404 route of a public area.
 * @param area Page title area of the application (`<area>.not-found`).
 * @param extra More route options (e.g. the maintenance guard of the area).
 * @returns `{ path: '**', title: '<area>.not-found', loadComponent }`.
 * @note Must be the LAST route of its children list - the router takes the first match.
 */
export function publicNotFoundRoute(area: string, extra: Partial<Route> = {}): Route {
  return {
    path: '**',
    title: `${area}.not-found`,
    loadComponent: () => import('./not-found.component').then(m => m.NotFoundComponent),
    ...extra,
  };
}
