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

export const WEB_ADMIN_ROUTES: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent), data: { help: 'web-dashboard', permission: 'web-view-dashboard' } },
  { path: 'user-request', loadComponent: () => import('./user-request/user-request.component').then(m => m.UserRequestComponent), data: { help: 'user-request', permission: 'web-user-requests-view' } },
  { path: 'business-logs', loadComponent: () => import('./business-logs/business-logs.component').then(m => m.BusinessLogsComponent), data: { help: 'web-business-logs', permission: 'web-view-web-logs' } },
  { path: 'sales-leads', loadComponent: () => import('./sales-leads/sales-leads.component').then(m => m.SalesLeadsComponent), data: { help: 'sales-leads', permission: 'web-sales-leads-view' } },
  { path: 'edit-website', loadComponent: () => import('./edit-website/edit-website.component').then(m => m.EditWebsiteComponent), data: { help: 'edit-website', permission: 'web-edit-website-view' } },
  { path: 'sales-orders', loadComponent: () => import('./sales-orders/sales-orders.component').then(m => m.SalesOrdersComponent), data: { help: 'sales-orders', permission: 'web-sales-orders-view' } },
  { path: 'job-applications', loadComponent: () => import('./job-applications/job-applications.component').then(m => m.JobApplicationsComponent), data: { help: 'job-applications', permission: 'web-job-applications-view' } },
  { path: 'welcome-page', loadComponent: () => import('./web-welcome-page/web-welcome-page.component').then(m => m.WebWelcomePageComponent), data: { help: 'web-welcome-page', permission: 'web-welcome-page-view' } },
];
