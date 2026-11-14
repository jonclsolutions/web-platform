/**
 * @file apps.registry.spec.ts
 * @path src/app/apps/apps.registry.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the application registry of the frontend: the installed applications,
 *   hasApp() / appById() and the shape of every manifest (id = admin URL segment, tab permission,
 *   sidebar, admin and public routes, names in the admin texts).
 * @dependencies apps.registry
 */

import { APPS, appById, hasApp, INSTALLED_APPS } from './apps.registry';
import { requiresApps } from '../../testing/requires-apps';

describe('apps.registry', () => {
  /**
   * @description Every application of this build is installed and known by hasApp() / appById().
   * @input INSTALLED_APPS; hasApp / appById of each id and of an unknown one.
   * @output The ids of APPS in order; true / the manifest for each; false / undefined for 'nope'.
   */
  it('lists the installed applications', () => {
    expect([...INSTALLED_APPS]).toEqual(APPS.map(app => app.id));
    expect(INSTALLED_APPS.every(id => hasApp(id))).toBeTrue();
    expect(APPS.every(app => appById(app.id) === app)).toBeTrue();
    expect(hasApp('nope' as never)).toBeFalse();
    expect(appById('nope')).toBeUndefined();
  });

  /**
   * @description Every manifest names its tab permission, icon, colour, name / description keys,
   *   a sidebar and its admin pages, and has its own admin texts; the ids and tab permissions are
   *   unique; a public area matches its public routes.
   * @input APPS.
   * @output Name key module_<id>; tab permission view-…; non-empty sidebar and admin routes with
   *   the default redirect first; adminI18n; a manifest with a public area has public routes.
   */
  it('describes every application', () => {
    expect(new Set(APPS.map(app => app.id)).size).toBe(APPS.length);
    expect(new Set(APPS.map(app => app.tabPermission)).size).toBe(APPS.length);
    for (const app of APPS) {
      expect(app.nameKey).withContext(app.id).toBe(`module_${app.id}`);
      expect(app.descriptionKey).withContext(app.id).toMatch(/^app_description_/);
      expect(app.tabPermission).withContext(app.id).toMatch(/^view-/);
      expect(app.icon).withContext(app.id).toBeTruthy();
      expect(app.color).withContext(app.id).toBeTruthy();
      expect(app.nav.length).withContext(app.id).toBeGreaterThan(0);
      expect(app.adminRoutes[0]).withContext(app.id).toEqual(jasmine.objectContaining({ path: '', pathMatch: 'full' }));
      expect(app.adminI18n).withContext(app.id).toBeTrue();
      if (app.publicArea) {
        expect(app.publicRoutes?.length).withContext(app.id).toBeGreaterThan(0);
      }
    }
  });

  /**
   * @description The applications of this repository keep their tab permissions and areas.
   * @input Manifests of the web, the e-shop and the project portal.
   * @output view-web / view-eshop / view-project-portal; the web catch-all; areas '' and 'shop'.
   */
  it('describes the applications of this repository', () => {
    requiresApps('web', 'shop', 'project-portal');
    expect(['web', 'shop', 'project-portal'].map(id => appById(id)!.tabPermission)).toEqual(['view-web', 'view-eshop', 'view-project-portal']);
    expect(appById('web')!.publicFallbackRoutes?.length).toBe(1);
    expect([appById('web')!.publicArea?.path, appById('shop')!.publicArea?.path]).toEqual(['', 'shop']);
  });
});
