/**
 * @file project-portal.app.ts
 * @path src/app/apps/project-portal/project-portal.app.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Manifest of the customer project portal (projects, their client portal, templates, the portal log) - what the core needs to know about it (apps.registry.ts).
 * @dependencies AppManifest; its admin and public route tables.
 */

import type { AppManifest } from '../app-manifest';
import { PROJECT_PORTAL_ADMIN_ROUTES } from './admin/project-portal-admin.routes';
import { PROJECT_PORTAL_PUBLIC_ROUTES } from './public/project-portal-public.routes';

export const PROJECT_PORTAL_APP: AppManifest = {
  id: 'project-portal',
  icon: 'folder',
  nameKey: 'module_project-portal',
  descriptionKey: 'app_description_project_portal',
  tabPermission: 'view-project-portal',
  adminI18n: true,
  nav: [
    {
      key: 'project-portal-projects', labelKey: 'nav_group_projects',
      items: [
        { path: 'projects', permission: 'web-projects-view', labelKey: 'nav_projects', icon: 'folder' },
      ],
    },
    {
      key: 'project-portal-system', labelKey: 'nav_group_system',
      items: [
        { path: 'logs', permission: 'project-portal-view-logs', labelKey: 'nav_project_portal_logs', icon: 'file-lines' },
      ],
    },
  ],
  adminRoutes: PROJECT_PORTAL_ADMIN_ROUTES,
  publicRoutes: PROJECT_PORTAL_PUBLIC_ROUTES,
};
