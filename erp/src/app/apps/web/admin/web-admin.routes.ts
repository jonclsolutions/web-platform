/**
 * @file web-admin.routes.ts
 * @path src/app/apps/web/admin/web-admin.routes.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Admin pages of the web application, below `/admin/web/` (inside AdminLayoutComponent,
 *   AuthGuard checks `data.permission` of every page). Each page is loaded on its first visit.
 * @usage `adminRoutes` of WEB_APP (web.app.ts); `help` = id of the page of the internal manual
 *   (api/app/Apps/Web/Resources/knowledge-base).
 */

import { Routes } from '@angular/router';
import { WEB_AUDIT_LOG } from './web-logs/web-logs.config';

export const WEB_ADMIN_ROUTES: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent), data: { help: 'web-dashboard', permission: 'web-view-dashboard' } },
  { path: 'user-request', loadComponent: () => import('./user-request/user-request.component').then(m => m.UserRequestComponent), data: { help: 'user-request', permission: 'web-user-requests-view' } },
  { path: 'logs', loadComponent: () => import('../../../admin/components/audit-log-page/audit-log-page.component').then(m => m.AuditLogPageComponent), data: { help: 'web-logs', permission: 'web-view-web-logs', auditLog: WEB_AUDIT_LOG } },
  { path: 'edit-website', loadComponent: () => import('./edit-website/edit-website.component').then(m => m.EditWebsiteComponent), data: { help: 'edit-website', permission: 'web-edit-website-view' } },
  { path: 'job-applications', loadComponent: () => import('./job-applications/job-applications.component').then(m => m.JobApplicationsComponent), data: { help: 'job-applications', permission: 'web-job-applications-view' } },
  { path: 'welcome-page', loadComponent: () => import('./web-welcome-page/web-welcome-page.component').then(m => m.WebWelcomePageComponent), data: { help: 'web-welcome-page', permission: 'web-welcome-page-view' } },
];
