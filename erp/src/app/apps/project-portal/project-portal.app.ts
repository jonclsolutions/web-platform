/**
 * @file project-portal.app.ts
 * @path src/app/apps/project-portal/project-portal.app.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Manifest of the customer project portal (sales leads, orders with the public order form, projects, their client portal, templates, settings, the portal log) - what the core needs to know about it (apps.registry.ts).
 * @dependencies AppManifest; its admin and public route tables.
 */

import type { AppManifest } from '../app-manifest';
import { PROJECT_PORTAL_ADMIN_ROUTES } from './admin/project-portal-admin.routes';
import { PROJECT_PORTAL_PUBLIC_ROUTES } from './public/project-portal-public.routes';

export const PROJECT_PORTAL_APP: AppManifest = {
  id: 'project-portal',
  icon: 'folder',
  color: 'rose',
  nameKey: 'module_project-portal',
  descriptionKey: 'app_description_project_portal',
  tabPermission: 'view-project-portal',
  adminI18n: true,
  nav: [
    {
      key: 'project-portal-business', labelKey: 'nav_group_business',
      items: [
        { path: 'sales-leads', permission: 'project-portal-sales-leads-view', labelKey: 'nav_sales_leads', icon: 'user-check' },
        { path: 'sales-orders', permission: 'project-portal-sales-orders-view', labelKey: 'nav_sales_orders', icon: 'box' },
      ],
    },
    {
      key: 'project-portal-projects', labelKey: 'nav_group_projects',
      items: [
        { path: 'projects', permission: 'web-projects-view', labelKey: 'nav_projects', icon: 'folder' },
      ],
    },
    {
      key: 'project-portal-system', labelKey: 'nav_group_system',
      items: [
        { path: 'settings', permission: 'project-portal-settings-view', labelKey: 'nav_project_portal_settings', icon: 'globe-settings' },
        { path: 'logs', permission: 'project-portal-view-logs', labelKey: 'nav_project_portal_logs', icon: 'file-lines' },
      ],
    },
  ],
  adminRoutes: PROJECT_PORTAL_ADMIN_ROUTES,
  publicRoutes: PROJECT_PORTAL_PUBLIC_ROUTES,
};
