/**
 * @file app-manifest.ts
 * @path src/app/apps/app-manifest.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Shape of the manifest of one application of the frontend - everything the core
 *   (routing, admin layout, the "Applications" page) needs to know about it. The core never
 *   imports a file of an application; it reads the manifests listed in apps.registry.ts.
 * @usage `export const WEB_APP: AppManifest = { id: 'web', … }` in apps/<app>/<app>.app.ts and
 *   one line in apps.registry.ts.
 * @dependencies admin-navigation.config (types of the sidebar), AdminIconComponent (icon names).
 */

import type { Routes } from '@angular/router';
import type { AdminNavGroup } from '../admin/admin-navigation.config';
import type { AdminIconName } from '../admin/components/admin-icon/admin-icon.component';

/** Ids of the applications (the same as the API registry, config/apps.php). */
export type AppId = 'web' | 'shop' | 'project-portal';

/** Manifest of one application. */
export interface AppManifest {
  /** Id - also the URL segment of its admin (`/admin/<id>/…`) and of its admin i18n folder. */
  id: AppId;
  /** Icon of the tab / switcher / application card. */
  icon: AdminIconName;
  /** Key of the name in the admin i18n section `admin-layout`. */
  nameKey: string;
  /** Key of the short description (application card) in `admin-layout`. */
  descriptionKey: string;
  /** Permission that shows the application in the admin at all. */
  tabPermission: string;
  /** Sidebar of its admin; the first page the user may open is its landing page. */
  nav: AdminNavGroup[];
  /** Routes below `/admin/<id>/` (pages lazy-loaded with `loadComponent`, `data.permission` + `data.help`). */
  adminRoutes: Routes;
  /** Top-level public routes (placed before the admin routes). */
  publicRoutes?: Routes;
  /** Public catch-all routes - placed after every other route (e.g. the 404 of the public web). */
  publicFallbackRoutes?: Routes;
  /** The admin has its own translations (apps/<id>/admin/i18n/{lang}.json). */
  adminI18n?: boolean;
}
