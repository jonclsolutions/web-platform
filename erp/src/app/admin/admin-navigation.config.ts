/**
 * @file admin-navigation.config.ts
 * @path src/app/admin/admin-navigation.config.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Navigation of the admin as data: the sidebar of the core (CORE_NAV) and, through
 *   the registry, the sidebars of the applications (`nav` of their manifests). Every page lists the
 *   permission it needs - the same keys as the routes (`data.permission`) and the API
 *   (`permission:` middleware). AdminLayoutComponent builds the sidebar from it, shows the tab of a
 *   module (core / an application) only when the user may open at least one page of it, and a
 *   click on the tab opens the first such page (in this order). `admin-navigation.config.spec.ts`
 *   compares the pages with the route tables, so a renamed permission cannot silently show a page
 *   the router then refuses.
 * @note Order = order of the sidebar; the first page is the landing page of the module.
 * @dependencies apps.registry (manifests of the installed applications), AdminIconComponent (icon names).
 */

import { AdminIconName } from './components/admin-icon/admin-icon.component';
import { APPS, appById } from '../apps/apps.registry';

/** Id of the core module of the admin. */
export const CORE_MODULE = 'core';

/** A module of the admin: the core or the id of an installed application. */
export type AdminModule = string;

/** One page of the sidebar. */
export interface AdminNavItem {
  /** Route path below `/admin/<module>/`. */
  path: string;
  /** Required permission (`a|b` = any of them); null = no permission - with `sysadminOnly` the sysadmin role only, otherwise every signed-in user. */
  permission: string | null;
  /** Page open to the sysadmin role only (no permission key - see sysadminGuard). */
  sysadminOnly?: boolean;
  /** Key of the label in the admin i18n section `admin-layout`. */
  labelKey: string;
  /** Key of the tooltip in `admin-layout` (default: the label). */
  titleKey?: string;
  /** Icon of the item. */
  icon: AdminIconName;
}

/** One section of the sidebar. */
export interface AdminNavGroup {
  /** Unique key - the collapsed state is remembered under it (e.g. 'web-business'). */
  key: string;
  /** Key of the heading in the admin i18n section `admin-layout`. */
  labelKey: string;
  /** Pages of the section. */
  items: AdminNavItem[];
}

/**
 * Permission that switches the core tab on ("[recommended: always on] show the … tab"); the
 * applications have theirs in the manifest (`tabPermission`).
 */
export const CORE_TAB_PERMISSION = 'view-core';

/** Sidebar of the core, in order. */
export const CORE_NAV: AdminNavGroup[] = [
  {
    key: 'core-overview', labelKey: 'nav_group_overview',
    items: [
      { path: 'welcome-page', permission: 'core-view-welcome-page', labelKey: 'nav_welcome', icon: 'home' },
      { path: 'dashboard', permission: 'view-core', labelKey: 'nav_dashboard', titleKey: 'nav_core_dashboard', icon: 'home' },
      { path: 'calendar', permission: null, labelKey: 'nav_calendar', icon: 'calendar' },
      { path: 'apps', permission: null, labelKey: 'nav_apps', icon: 'layers' },
    ],
  },
  {
    key: 'core-legal', labelKey: 'nav_group_legal',
    items: [
      { path: 'edit-legal', permission: 'core-legal-documents-view|core-legal-config-view', labelKey: 'nav_gdpr', icon: 'shield' },
      { path: 'web-settings', permission: 'core-legal-config-view', labelKey: 'nav_company_info', icon: 'globe-settings' },
      { path: 'external-links', permission: 'core-external-links-view', labelKey: 'nav_external_links', icon: 'external-link' },
    ],
  },
  {
    key: 'core-users', labelKey: 'nav_group_users',
    items: [
      { path: 'administrators', permission: 'core-administrators-view', labelKey: 'nav_administrators', icon: 'lock' },
      { path: 'edit-roles', permission: null, sysadminOnly: true, labelKey: 'nav_edit_roles_text', titleKey: 'nav_edit_roles_title', icon: 'shield-check' },
      { path: 'personal-info', permission: null, labelKey: 'nav_personal_info', icon: 'user' },
    ],
  },
  {
    key: 'core-system', labelKey: 'nav_group_system',
    items: [
      { path: 'logs', permission: 'view-core', labelKey: 'nav_core_logs', icon: 'file-list' },
      { path: 'security-events', permission: 'core-security-view', labelKey: 'nav_security_events', icon: 'shield' },
    ],
  },
];

/**
 * @description Sidebar of a module.
 * @param module 'core' or an application id.
 * @returns The sections (empty for an unknown module).
 */
export function navOf(module: AdminModule): AdminNavGroup[] {
  return module === CORE_MODULE ? CORE_NAV : (appById(module)?.nav ?? []);
}

/**
 * @description Pages of a module in sidebar order.
 * @param module 'core' or an application id.
 */
export function pagesOf(module: AdminModule): AdminNavItem[] {
  return navOf(module).flatMap(group => group.items);
}

/**
 * @description Tab permission of a module.
 * @param module 'core' or an application id.
 * @returns The key, or null for an unknown module.
 */
export function tabPermissionOf(module: AdminModule): string | null {
  return module === CORE_MODULE ? CORE_TAB_PERMISSION : (appById(module)?.tabPermission ?? null);
}

/** Modules of the admin: the core first, then the installed applications (registry order). */
export function adminModules(): AdminModule[] {
  return [CORE_MODULE, ...APPS.map(app => app.id)];
}
