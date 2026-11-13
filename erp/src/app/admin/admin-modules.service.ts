/**
 * @file admin-modules.service.ts
 * @path src/app/admin/admin-modules.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Which modules of the admin (the core and the installed applications) and which of
 *   their pages the signed-in user may open - one rule for the header tabs, the application
 *   switcher, the sidebar and the page "Applications". Same rule as the AuthGuard: the sysadmin
 *   opens everything, a role-only page needs the sysadmin role, a page without a permission is open
 *   to everybody, otherwise one of the keys (`a|b`).
 * @dependencies AuthService (role), PermissionService (keys), admin-navigation.config, apps.registry.
 */

import { Injectable } from '@angular/core';
import { AuthService } from '../core/auth/auth.service';
import { PermissionService } from '../core/auth/services/permission.service';
import { SYSADMIN_ROLE_NAME } from '../core/auth/guards/auth.guard';
import { AdminModule, AdminNavGroup, AdminNavItem, navOf, pagesOf, tabPermissionOf } from './admin-navigation.config';
import { APPS, AppManifest } from '../apps/apps.registry';

@Injectable({ providedIn: 'root' })
export class AdminModulesService {
  constructor(
    private authService: AuthService,
    private permissionService: PermissionService,
  ) {}

  /** @description Whether the signed-in user has the sysadmin role. */
  isSysadmin(): boolean {
    return this.authService.getUserRole() === SYSADMIN_ROLE_NAME;
  }

  /**
   * @description Whether the user holds at least one of the keys (each may itself be `a|b`).
   * @param keys Permission keys.
   */
  hasAnyPermission(keys: string[]): boolean {
    return keys.some(key => key.split('|').some(single => this.permissionService.hasPermission(single.trim())));
  }

  /**
   * @description Whether the user may open a page of the sidebar.
   * @param item The page.
   */
  canOpen(item: AdminNavItem): boolean {
    if (this.isSysadmin()) return true;
    if (item.sysadminOnly) return false;
    return item.permission === null || this.hasAnyPermission([item.permission]);
  }

  /**
   * @description Whether a section of the sidebar has at least one page the user may open.
   * @param group The section.
   */
  isGroupVisible(group: AdminNavGroup): boolean {
    return group.items.some(item => this.canOpen(item));
  }

  /**
   * @description First page of a module the user may open (sidebar order).
   * @param module 'core' or an application id.
   * @returns The page, or null when there is none.
   */
  firstPage(module: AdminModule): AdminNavItem | null {
    return pagesOf(module).find(item => this.canOpen(item)) ?? null;
  }

  /**
   * @description Whether the user may open a module at all: the tab permission (`view-core`,
   *   `view-web`, …) AND at least one page - so a tab never opens an empty sidebar or an "Access
   *   denied" page. Sysadmin: always.
   * @param module 'core' or an application id.
   */
  isAvailable(module: AdminModule): boolean {
    if (this.isSysadmin()) return navOf(module).length > 0;
    const tab = tabPermissionOf(module);
    return tab !== null && this.permissionService.hasPermission(tab) && this.firstPage(module) !== null;
  }

  /**
   * @description URL of the landing page of a module for the user.
   * @param module 'core' or an application id.
   * @returns `/admin/<module>/<first page>`, or null when the user may open none.
   */
  landingUrl(module: AdminModule): string | null {
    const page = this.firstPage(module);
    return page ? `/admin/${module}/${page.path}` : null;
  }

  /** @description Installed applications the user may open (registry order). */
  availableApps(): AppManifest[] {
    return APPS.filter(app => this.isAvailable(app.id));
  }
}
