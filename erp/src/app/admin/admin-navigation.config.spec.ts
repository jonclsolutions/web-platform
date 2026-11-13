/**
 * @file admin-navigation.config.spec.ts
 * @path src/app/admin/admin-navigation.config.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Consistency of the admin navigation: every page of the sidebar of a module (CORE_NAV
 *   and the `nav` of every application of the registry) exists in the route table of the module and
 *   the route requires exactly the same permission (or the sysadmin guard for a role-only page),
 *   and every page route of the table is listed - so a tab / menu item never leads to a page the
 *   router refuses, and a renamed key cannot drift apart. The admin route table mounts every
 *   application below its id. A sub-page (a path with '/': the project page
 *   `projects/:id/:section`, the templates `projects/templates`) is no menu item - it requires the
 *   permission of its parent page.
 * @dependencies
 * - ADMIN_ROUTES (admin-routing.module.ts), admin-navigation.config, apps.registry.
 */

import { Route } from '@angular/router';

import { ADMIN_ROUTES } from './admin-routing.module';
import { CORE_MODULE, adminModules, navOf, pagesOf, tabPermissionOf } from './admin-navigation.config';
import { APPS } from '../apps/apps.registry';
import { sysadminGuard } from '../core/auth/guards/sysadmin.guard';

describe('admin navigation config', () => {
  /** Children of the admin layout route. */
  const layoutChildren = (): Route[] => ADMIN_ROUTES.find(route => route.path === '')!.children!;
  /** Page routes (with a component) of one module of the route table. */
  const routesOf = (module: string): Route[] =>
    (layoutChildren().find(route => route.path === module)?.children ?? []).filter(route => !!route.component || !!route.loadComponent);

  /**
   * @description The modules are the core and the applications of the registry; each has a tab
   *   permission and a sidebar; the admin mounts every application below its id.
   * @input adminModules(); the route table.
   * @output ['core', 'web', 'shop', 'project-portal']; tab permissions; a route `<id>` with the
   *   route table of the manifest for every application.
   */
  it('mounts the core and every application', () => {
    expect(adminModules()).toEqual([CORE_MODULE, ...APPS.map(app => app.id)]);
    expect(adminModules()).toEqual(['core', 'web', 'shop', 'project-portal']);
    expect(adminModules().map(tabPermissionOf)).toEqual(['view-core', 'view-web', 'view-eshop', 'view-project-portal']);
    for (const app of APPS) {
      const route = layoutChildren().find(r => r.path === app.id);
      expect(route?.children).withContext(app.id).toBe(app.adminRoutes);
      expect(navOf(app.id).length).withContext(`${app.id} sidebar`).toBeGreaterThan(0);
    }
    expect(tabPermissionOf('nope')).toBeNull();
    expect(navOf('nope')).toEqual([]);
  });

  /**
   * @description Every configured page is a route with the same permission; role-only pages use
   *   the sysadmin guard; a page open to every signed-in user (null) has no route permission;
   *   every page names its page of the manual (`data.help`).
   * @input The pages of every module; the route tables.
   * @output For each page: a route with that path, data.permission equal (none + sysadminGuard
   *   for a role-only page), data.help set.
   */
  it('requires the same permission as the routes', () => {
    for (const module of adminModules()) {
      for (const page of pagesOf(module)) {
        const route = routesOf(module).find(r => r.path === page.path);
        expect(route).withContext(`${module}/${page.path} route`).toBeDefined();
        expect(route!.data?.['help']).withContext(`${module}/${page.path} help`).toBeTruthy();
        if (page.sysadminOnly) {
          expect(route!.canActivate).withContext(`${module}/${page.path}`).toContain(sysadminGuard);
          expect(route!.data?.['permission']).withContext(`${module}/${page.path}`).toBeUndefined();
        } else {
          expect(route!.data?.['permission'] ?? null).withContext(`${module}/${page.path}`).toBe(page.permission);
        }
      }
    }
  });

  /**
   * @description Every page route of a table is in the sidebar exactly once; the section keys are
   *   unique over all modules; the core, the web and the e-shop start with their welcome page.
   * @input The route tables and sidebars of every module.
   * @output Sorted route paths = sorted sidebar paths (no duplicates); unique section keys; first
   *   page 'welcome-page' for core / web / shop.
   */
  it('lists every page route once, welcome page first', () => {
    for (const module of adminModules()) {
      const routePaths = routesOf(module).map(r => r.path!).filter(path => !path.includes('/')).sort();
      const pagePaths = pagesOf(module).map(p => p.path).sort();
      expect(pagePaths).withContext(module).toEqual(routePaths);
      expect(new Set(routePaths).size).withContext(`${module} duplicates`).toBe(routePaths.length);
    }
    const keys = adminModules().flatMap(module => navOf(module).map(group => group.key));
    expect(new Set(keys).size).toBe(keys.length);
    for (const module of ['core', 'web', 'shop']) {
      expect(pagesOf(module)[0].path).withContext(module).toBe('welcome-page');
    }
  });

  /**
   * @description A sub-page (path with '/') belongs to a listed page and requires the same
   *   permission (e.g. project-portal/projects/:id/:section = project-portal/projects).
   * @input Routes with '/' in the path of every module.
   * @output The parent path is a configured page with the same permission; the project sub-pages
   *   and the templates exist below the project portal.
   */
  it('protects detail sub-pages like their parent page', () => {
    const detailPaths: string[] = [];
    for (const module of adminModules()) {
      for (const route of routesOf(module).filter(r => r.path!.includes('/'))) {
        const parentPath = route.path!.split('/')[0];
        const parent = pagesOf(module).find(page => page.path === parentPath);
        expect(parent).withContext(`${module}/${route.path} parent`).toBeDefined();
        expect(route.data?.['permission'] ?? null).withContext(`${module}/${route.path}`).toBe(parent!.permission);
        detailPaths.push(`${module}/${route.path}`);
      }
    }
    expect(detailPaths).toContain('project-portal/projects/:id/:section');
    expect(detailPaths).toContain('project-portal/projects/templates');
  });

  /**
   * @description Every lazy page of the applications loads a component.
   * @input loadComponent of every page route of the applications.
   * @output A component class (function) for each.
   */
  it('loads every page of the applications', async () => {
    for (const app of APPS) {
      for (const route of routesOf(app.id)) {
        expect(typeof await (route.loadComponent as () => Promise<unknown>)()).withContext(`${app.id}/${route.path}`).toBe('function');
      }
    }
  });
});
