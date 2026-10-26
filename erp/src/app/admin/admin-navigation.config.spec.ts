/**
 * @file admin-navigation.config.spec.ts
 * @path src/app/admin/admin-navigation.config.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026-10-27
 * @description Consistency of the admin navigation (bugfix 2026-10-27): every page of
 *   ADMIN_MODULE_PAGES exists in the admin route table and the route requires exactly the same
 *   permission (or the sysadmin guard for a role-only page), and every page route of the table is
 *   listed - so a tab / menu item never leads to a page the router refuses, and a renamed key
 *   (`shop-manage-products` → `shop-products-view`) cannot drift apart again. Each module starts
 *   with its welcome page.
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
    (ADMIN_ROUTES[0].children!.find(route => route.path === module)!.children ?? []).filter(route => !!route.component);

  /**
   * @description Every configured page is a route with the same permission; role-only pages use
   *   the sysadmin guard.
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
          expect(route!.data?.['permission']).withContext(`${module}/${page.path}`).toBe(page.permission);
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
      const routePaths = routesOf(module).map(r => r.path!).sort();
      const pagePaths = ADMIN_MODULE_PAGES[module].map(p => p.path).sort();
      expect(pagePaths).withContext(module).toEqual(routePaths);
      expect(new Set(routePaths).size).withContext(`${module} duplicates`).toBe(routePaths.length);
      expect(ADMIN_MODULE_PAGES[module][0].path).withContext(module).toBe('welcome-page');
    }
  });
});
