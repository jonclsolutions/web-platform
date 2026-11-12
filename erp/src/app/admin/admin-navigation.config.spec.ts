/**
 * @file admin-navigation.config.spec.ts
 * @path src/app/admin/admin-navigation.config.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Consistency of the admin navigation (bugfix 2026-10-27): every page of
 *   ADMIN_MODULE_PAGES exists in the admin route table and the route requires exactly the same
 *   permission (or the sysadmin guard for a role-only page), and every page route of the table is
 *   listed - so a tab / menu item never leads to a page the router refuses, and a renamed key
 *   (`shop-manage-products` → `shop-products-view`) cannot drift apart again. Each module starts
 *   with its welcome page. A sub-page (a path with '/': the project page `projects/:id/:section`,
 *   the templates `projects/templates`) is no menu item - it requires the permission of its parent page.
 * @dependencies
 * - ADMIN_ROUTES (admin-routing.module.ts), ADMIN_MODULE_PAGES (admin-navigation.config.ts).
 */

import { Route } from '@angular/router';

import { ADMIN_ROUTES } from './admin-routing.module';
import { ADMIN_MODULE_PAGES, AdminModule } from './admin-navigation.config';
import { sysadminGuard } from '../core/auth/guards/sysadmin.guard';

describe('admin navigation config', () => {
  const modules: AdminModule[] = ['web', 'core', 'shop'];
  /** Page routes (with a component) of one module of the route table. */
  const routesOf = (module: AdminModule): Route[] =>
    (ADMIN_ROUTES.find(route => route.path === '')!.children!.find(route => route.path === module)!.children ?? []).filter(route => !!route.component);

  /**
   * @description Every configured page is a route with the same permission; role-only pages use
   *   the sysadmin guard; a page open to every signed-in user (null) has no route permission.
   * @input ADMIN_MODULE_PAGES of web / core / shop; the route table.
   * @output For each page: a route with that path, data.permission equal (none + sysadminGuard
   *   for a role-only page).
   */
  it('requires the same permission as the routes', () => {
    for (const module of modules) {
      for (const page of ADMIN_MODULE_PAGES[module]) {
        const route = routesOf(module).find(r => r.path === page.path);
        expect(route).withContext(`${module}/${page.path} route`).toBeDefined();
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
   * @description Every page route of the table is in the config exactly once; each module starts
   *   with the welcome page.
   * @input The route table of web / core / shop.
   * @output Sorted route paths = sorted config paths (no duplicates); first config page 'welcome-page'.
   */
  it('lists every page route once, welcome page first', () => {
    for (const module of modules) {
      const routePaths = routesOf(module).map(r => r.path!).filter(path => !path.includes('/')).sort();
      const pagePaths = ADMIN_MODULE_PAGES[module].map(p => p.path).sort();
      expect(pagePaths).withContext(module).toEqual(routePaths);
      expect(new Set(routePaths).size).withContext(`${module} duplicates`).toBe(routePaths.length);
      expect(ADMIN_MODULE_PAGES[module][0].path).withContext(module).toBe('welcome-page');
    }
  });

  /**
   * @description A sub-page (path with '/') belongs to a listed page and requires the same
   *   permission (e.g. web/projects/:id/:section and web/projects/templates = web/projects).
   * @input Routes with '/' in the path of web / core / shop.
   * @output The parent path is a configured page with the same permission; the project sub-pages
   *   and the templates exist.
   */
  it('protects detail sub-pages like their parent page', () => {
    const detailPaths: string[] = [];
    for (const module of modules) {
      for (const route of routesOf(module).filter(r => r.path!.includes('/'))) {
        const parentPath = route.path!.split('/')[0];
        const parent = ADMIN_MODULE_PAGES[module].find(page => page.path === parentPath);
        expect(parent).withContext(`${module}/${route.path} parent`).toBeDefined();
        expect(route.data?.['permission'] ?? null).withContext(`${module}/${route.path}`).toBe(parent!.permission);
        detailPaths.push(`${module}/${route.path}`);
      }
    }
    expect(detailPaths).toContain('web/projects/:id/:section');
    expect(detailPaths).toContain('web/projects/templates');
  });
});
