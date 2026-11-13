/**
 * @file web.app.ts
 * @path src/app/apps/web/web.app.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Manifest of the web application (public website, inquiries, leads, orders, job applications, texts of the web) - what the core needs to know about it (apps.registry.ts).
 * @dependencies AppManifest; its admin and public route tables.
 */

import type { AppManifest } from '../app-manifest';
import { WEB_ADMIN_ROUTES } from './admin/web-admin.routes';
import { WEB_PUBLIC_FALLBACK_ROUTES, WEB_PUBLIC_ROUTES } from './public/web-public.routes';

export const WEB_APP: AppManifest = {
  id: 'web',
  icon: 'globe',
  nameKey: 'module_web',
  descriptionKey: 'app_description_web',
  tabPermission: 'view-web',
  adminI18n: true,
  nav: [
    {
      key: 'web-welcome', labelKey: 'nav_group_overview',
      items: [
        { path: 'welcome-page', permission: 'web-welcome-page-view', labelKey: 'nav_welcome', icon: 'grid' },
      ],
    },
    {
      key: 'web-overview', labelKey: 'nav_group_overview',
      items: [
        { path: 'dashboard', permission: 'web-view-dashboard', labelKey: 'nav_dashboard', icon: 'grid' },
      ],
    },
    {
      key: 'web-business', labelKey: 'nav_group_business',
      items: [
        { path: 'user-request', permission: 'web-user-requests-view', labelKey: 'nav_user_request', icon: 'file-text' },
        { path: 'sales-leads', permission: 'web-sales-leads-view', labelKey: 'nav_sales_leads', icon: 'user-check' },
        { path: 'sales-orders', permission: 'web-sales-orders-view', labelKey: 'nav_sales_orders', icon: 'box' },
      ],
    },
    {
      key: 'web-content', labelKey: 'nav_group_content',
      items: [
        { path: 'edit-website', permission: 'web-edit-website-view', labelKey: 'nav_edit_website', icon: 'code' },
      ],
    },
    {
      key: 'web-people', labelKey: 'nav_group_people',
      items: [
        { path: 'job-applications', permission: 'web-job-applications-view', labelKey: 'nav_job_applications', icon: 'users' },
      ],
    },
    {
      key: 'web-system', labelKey: 'nav_group_system',
      items: [
        { path: 'business-logs', permission: 'web-view-web-logs', labelKey: 'nav_business_logs', icon: 'file-list' },
      ],
    },
  ],
  adminRoutes: WEB_ADMIN_ROUTES,
  publicRoutes: WEB_PUBLIC_ROUTES,
  publicFallbackRoutes: WEB_PUBLIC_FALLBACK_ROUTES,
};
