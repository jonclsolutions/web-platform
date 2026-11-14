/**
 * @file project-portal-admin.routes.ts
 * @path src/app/apps/project-portal/admin/project-portal-admin.routes.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Admin pages of the project portal, below `/admin/project-portal/` (inside
 *   AdminLayoutComponent, AuthGuard checks `data.permission` of every page): the projects, the
 *   project templates, the page of one project with its sub-pages and the portal log. Each page
 *   is loaded on its first visit.
 * @usage `adminRoutes` of PROJECT_PORTAL_APP (project-portal.app.ts); `help` = id of the page of the
 *   internal manual (api/app/Apps/ProjectPortal/Resources/knowledge-base).
 */

import { Routes } from '@angular/router';
import { PROJECT_PORTAL_AUDIT_LOG } from './portal-logs/portal-logs.config';

export const PROJECT_PORTAL_ADMIN_ROUTES: Routes = [
  { path: '', redirectTo: 'projects', pathMatch: 'full' },
  { path: 'projects', loadComponent: () => import('./projects/projects.component').then(m => m.ProjectsComponent), data: { help: 'projects', permission: 'web-projects-view' } },
  { path: 'projects/templates', loadComponent: () => import('./project-templates/project-templates.component').then(m => m.ProjectTemplatesComponent), data: { help: 'projects', permission: 'web-projects-view' } },
  // The project page has sub-pages (overview, conversations, …); one route keeps the page
  // (and its unsaved settings) alive while switching between them.
  { path: 'projects/:id', redirectTo: 'projects/:id/overview', pathMatch: 'full' },
  { path: 'projects/:id/:section', loadComponent: () => import('./project-detail/project-detail.component').then(m => m.ProjectDetailComponent), data: { help: 'projects', permission: 'web-projects-view' } },
  { path: 'logs', loadComponent: () => import('../../../admin/components/audit-log-page/audit-log-page.component').then(m => m.AuditLogPageComponent), data: { help: 'project-portal-logs', permission: 'project-portal-view-logs', auditLog: PROJECT_PORTAL_AUDIT_LOG } },
];
