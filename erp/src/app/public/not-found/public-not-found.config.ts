/**
 * @file public-not-found.config.ts
 * @path src/app/public/not-found/public-not-found.config.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026-10-27
 * @description The public "page not found" (404) is ONE component shared by every public area
 *   (web, e-shop, …). Each area only says which translations it reads, where the "back" button
 *   leads and which look it uses; the route of the area gets a catch-all `**` route built by
 *   `publicNotFoundRoute()`, placed LAST among the area's routes so it matches only a URL no other
 *   route knows. Adding a new public module = one entry in PUBLIC_NOT_FOUND_AREAS + one
 *   `publicNotFoundRoute('<area>')` as the last child of its layout (app.routes.ts) + a
 *   `not_found` section in its translations + a `<area>.not-found` row in `legal_page_titles`.
 * @note The admin has its own 404 / 403 pages (admin/error-pages) - a URL below `/admin` never
 *   reaches these routes.
 */

import { Route } from '@angular/router';

/** Public areas with their own 404 variant. */
export type PublicNotFoundArea = 'web' | 'shop';

/** How the 404 page looks and behaves in one area. */
export interface PublicNotFoundAreaConfig {
  /** Translation module the texts come from (section `not_found`: header, text, button). */
  translationModule: 'web' | 'shop';
  /** Where the button leads (home page of the area). */
  homeLink: string;
}

/** Route data key carrying the area (read by NotFoundComponent). */
export const PUBLIC_NOT_FOUND_AREA_KEY = 'publicNotFoundArea';

/** Every public area with a 404 page. */
export const PUBLIC_NOT_FOUND_AREAS: Record<PublicNotFoundArea, PublicNotFoundAreaConfig> = {
  web: { translationModule: 'web', homeLink: '/' },
  shop: { translationModule: 'shop', homeLink: '/shop' },
};

/**
 * @description Builds the catch-all 404 route of a public area.
 * @param area Area of the layout the route is placed in.
 * @param extra More route options (e.g. the maintenance guard of the area).
 * @returns `{ path: '**', title: '<area>.not-found', data: { publicNotFoundArea }, loadComponent }`.
 * @note Must be the LAST route of its children list - the router takes the first match.
 */
export function publicNotFoundRoute(area: PublicNotFoundArea, extra: Partial<Route> = {}): Route {
  return {
    path: '**',
    title: `${area}.not-found`,
    data: { [PUBLIC_NOT_FOUND_AREA_KEY]: area },
    loadComponent: () => import('./not-found.component').then(m => m.NotFoundComponent),
    ...extra,
  };
}
