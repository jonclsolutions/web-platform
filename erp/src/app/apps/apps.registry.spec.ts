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

describe('apps.registry', () => {
  /**
   * @description Every application of this build is installed and known by hasApp() / appById().
   * @input INSTALLED_APPS; hasApp / appById of each id and of an unknown one.
   * @output ['web', 'shop', 'project-portal']; true / the manifest for each; undefined for 'nope'.
   */
  it('lists the installed applications', () => {
    expect([...INSTALLED_APPS]).toEqual(['web', 'shop', 'project-portal']);
    expect(INSTALLED_APPS.every(id => hasApp(id))).toBeTrue();
    expect(APPS.every(app => appById(app.id) === app)).toBeTrue();
    expect(appById('nope')).toBeUndefined();
  });

  /**
   * @description Every manifest names its tab permission, icon, name / description keys, a sidebar
   *   and its admin pages, and has its own admin texts; the ids are unique.
   * @input APPS.
   * @output Tab permissions view-web / view-eshop / view-project-portal; name key module_<id>;
   *   non-empty sidebar and admin routes with the default redirect first; public routes; adminI18n.
   */
  it('describes every application', () => {
    expect(APPS.map(app => app.tabPermission)).toEqual(['view-web', 'view-eshop', 'view-project-portal']);
    expect(new Set(APPS.map(app => app.id)).size).toBe(APPS.length);
    for (const app of APPS) {
      expect(app.nameKey).withContext(app.id).toBe(`module_${app.id}`);
      expect(app.descriptionKey).withContext(app.id).toMatch(/^app_description_/);
      expect(app.icon).withContext(app.id).toBeTruthy();
      expect(app.nav.length).withContext(app.id).toBeGreaterThan(0);
      expect(app.adminRoutes[0]).withContext(app.id).toEqual(jasmine.objectContaining({ path: '', pathMatch: 'full' }));
      expect(app.publicRoutes?.length).withContext(app.id).toBeGreaterThan(0);
      expect(app.adminI18n).withContext(app.id).toBeTrue();
    }
    expect(appById('web')!.publicFallbackRoutes?.length).toBe(1);
  });
});
