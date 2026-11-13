/**
 * @file apps.registry.ts
 * @path src/app/apps/apps.registry.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description The applications built into this frontend - the only place that lists them. The
 *   core reads their manifests here (public and admin routes, admin sidebar, tabs, translations);
 *   code of one application never imports another one - when it offers something of another
 *   application (a link, a button), it asks hasApp() first, so removing an application leaves no
 *   broken link behind.
 * @usage `hasApp('shop')` before showing a link to the e-shop; `APPS` / `appById()` in the core.
 * @note Removing an application = deleting its folder apps/<id> and its line here (and its
 *   manifest in api/config/apps.php).
 */

import type { AppId, AppManifest } from './app-manifest';
import { WEB_APP } from './web/web.app';
import { SHOP_APP } from './shop/shop.app';
import { PROJECT_PORTAL_APP } from './project-portal/project-portal.app';

export type { AppId, AppManifest } from './app-manifest';

/** Manifests of the installed applications, in the order of the admin and the routes. */
export const APPS: readonly AppManifest[] = [
  WEB_APP,
  SHOP_APP,
  PROJECT_PORTAL_APP,
];

/** Ids of the installed applications. */
export const INSTALLED_APPS: readonly AppId[] = APPS.map(app => app.id);

/**
 * @description Whether an application is part of this build.
 * @param id Application id.
 * @returns true when installed.
 */
export function hasApp(id: AppId): boolean {
  return INSTALLED_APPS.includes(id);
}

/**
 * @description Manifest of an installed application.
 * @param id Application id (any string - e.g. a URL segment).
 * @returns The manifest, or undefined when no such application is installed.
 */
export function appById(id: string): AppManifest | undefined {
  return APPS.find(app => app.id === id);
}
