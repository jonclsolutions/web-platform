/**
 * @file admin-navigation.config.ts
 * @path src/app/admin/admin-navigation.config.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026-10-27
 * @description One list of the admin pages per module (Web / Core / E-shop) with the permission
 *   each page needs - the same keys as the sidebar, the welcome-page cards and the API
 *   (`permission:` middleware). AdminLayoutComponent uses it to decide whether a module tab is
 *   shown at all (only when the user may open at least one page of the module) and which page a
 *   click on the tab opens (the first page the user may open, in this order). The admin routes
 *   must require the same keys - `admin-navigation.config.spec.ts` compares them with the route
 *   table, so a renamed permission cannot silently show a page the router then refuses.
 * @note Order = order of the sidebar; the welcome page comes first (landing page of the tab).
 */

/** The three modules of the admin header. */
export type AdminModule = 'web' | 'core' | 'shop';

/** One page of a module. */
export interface AdminNavPage {
  /** Route path below `/admin/<module>/`. */
  path: string;
  /** Required permission (`a|b` = any of them); null for a page guarded by role only. */
  permission: string | null;
  /** Page open to the sysadmin role only (no permission key - see sysadminGuard). */
  sysadminOnly?: boolean;
}

/**
 * Permission that switches the whole tab of a module on ("[recommended: always on] show the …
 * tab"). The tab is shown only with this permission AND at least one page of the module.
 */
export const ADMIN_MODULE_TAB_PERMISSION: Record<AdminModule, string> = {
  web: 'view-web',
  core: 'view-core',
  shop: 'view-eshop',
};

/** Pages of every module, in sidebar order. */
export const ADMIN_MODULE_PAGES: Record<AdminModule, AdminNavPage[]> = {
  web: [
    { path: 'welcome-page', permission: 'web-welcome-page-view' },
    { path: 'dashboard', permission: 'web-view-dashboard' },
    { path: 'user-request', permission: 'web-user-requests-view' },
    { path: 'sales-leads', permission: 'web-sales-leads-view' },
    { path: 'sales-orders', permission: 'web-sales-orders-view' },
    { path: 'projects', permission: 'web-projects-view' },
    { path: 'edit-website', permission: 'web-edit-website-view' },
    { path: 'edit-news', permission: 'web-news-view' },
    { path: 'job-applications', permission: 'web-job-applications-view' },
    { path: 'support-tickets', permission: 'web-support-tickets-view' },
    { path: 'business-logs', permission: 'web-view-web-logs' },
  ],
  core: [
    { path: 'welcome-page', permission: 'core-view-welcome-page' },
    { path: 'dashboard', permission: 'view-core' },
    { path: 'edit-legal', permission: 'core-legal-documents-view|core-legal-config-view' },
    { path: 'web-settings', permission: 'core-legal-config-view' },
    { path: 'external-links', permission: 'core-external-links-view' },
    { path: 'administrators', permission: 'core-administrators-view' },
    { path: 'edit-roles', permission: null, sysadminOnly: true },
    { path: 'personal-info', permission: 'web-view-personal-info' },
    { path: 'logs', permission: 'view-core' },
    { path: 'security-events', permission: 'core-security-view' },
  ],
  shop: [
    { path: 'welcome-page', permission: 'shop-welcome-page-view' },
    { path: 'dashboard', permission: 'shop-view-dashboard' },
    { path: 'products', permission: 'shop-products-view' },
    { path: 'categories', permission: 'shop-categories-view' },
    { path: 'suppliers', permission: 'shop-suppliers-view' },
    { path: 'orders', permission: 'shop-orders-view' },
    { path: 'coupons', permission: 'shop-coupons-view' },
    { path: 'customers', permission: 'shop-customers-view' },
    { path: 'shipping-methods', permission: 'shop-shipping-methods-view' },
    { path: 'payment-methods', permission: 'shop-payment-methods-view' },
    { path: 'edit-eshop', permission: 'shop-edit-eshop-view' },
    { path: 'logs', permission: 'shop-view-logs' },
  ],
};
