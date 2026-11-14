/**
 * @file admin-routing.module.ts
 * @path src/app/admin/admin-routing.module.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Routing of the admin: the pages of the core (/admin/core/…) and of every installed
 *   application (/admin/<id>/…, the route tables of their manifests - apps.registry.ts), all inside
 *   AdminLayoutComponent with role-based access control.
 * @dependencies
 * - RouterModule: Core Angular routing service.
 * - AuthGuard: Authentication middleware ensuring restricted access to administrative routes.
 * - AdminLayoutComponent: Main wrapper layout for the admin section.
 */

import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminLayoutComponent } from './components/admin-layout/admin-layout.component';
import { ADMIN_ERROR_PAGE_KEY, AuthGuard } from '../core/auth/guards/auth.guard';
import { sysadminGuard } from '../core/auth/guards/sysadmin.guard';
import { KnowledgeBaseComponent } from './intranet/knowledge-base/knowledge-base.component';
import { KbArticleComponent } from './intranet/knowledge-base/kb-article/kb-article.component';

// Core module components
import { CoreDashboardComponent } from './core-pages/dashboard/dashboard.component';
import { EditLegalComponent } from './core-pages/edit-legal/edit-legal.component';
import { PersonalInfoComponent } from './core-pages/personal-info/personal-info.component';
import { CalendarComponent } from './core-pages/calendar/calendar.component';
import { SettingsComponent } from './core-pages/settings/settings.component';
import { ExternalLinksComponent } from './core-pages/external-links/external-links.component';
import { EditRolesComponent } from './core-pages/edit-roles/edit-roles.component';
import { AdministratorsComponent } from './core-pages/administrators/administrators.component';
import { AuditLogPageComponent } from './components/audit-log-page/audit-log-page.component';
import { CORE_AUDIT_LOG } from './core-pages/logs/logs.config';
import { WelcomePageComponent } from './core-pages/welcome-page/welcome-page.component';
import { SecurityEventsComponent } from './core-pages/security-events/security-events.component';

import { AdminErrorPageComponent } from './error-pages/admin-error-page.component';
import { AppsComponent } from './core-pages/apps/apps.component';
import { APPS } from '../apps/apps.registry';
/**
 * @description Defines the navigation hierarchy and access permissions for the administration interface.
 * @usage Acts as the master route table for the admin module. Adding a page only needs a new
 *        route with `data: { permission: '<key>' }` (several keys separated by `|` mean "any of them")
 *        and `help: '<knowledge base page id>'` - the help button ("?", PageHelpComponent) in the
 *        page header opens that page of the knowledge base (api/resources/knowledge-base/structure.json).
 * @note Routes are grouped into the core and the applications, each under its own path prefix
 *       ('core/', 'web/', 'shop/', 'project-portal/') for a consistent, predictable URL structure.
 *       AuthGuard is registered twice on purpose: `canActivate` verifies the session when the
 *       layout is entered, `canActivateChild` checks `data.permission` of every page below it.
 *       A user without the permission is redirected to the first page they can open; the order
 *       of the routes below is therefore also the order of preference for that fallback.
 */
export const ADMIN_ROUTES: Routes = [
  // 📘 INTERNAL MANUAL - own full-screen layout (no admin layout). MUST come before the admin
  // layout route below: its '**' child (404 page) would otherwise catch /admin/intranet/... first.
  {
    path: 'intranet',
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    children: [
      {
        path: 'knowledge-base',
        component: KnowledgeBaseComponent,
        children: [
          // Explicit components (real logic, not static text) - MUST
          // come before ':pageId', otherwise the router would catch them as the parameter.
          // Generic renderer of ALL other manual pages - the content comes from the API
          // (api/resources/knowledge-base/*.json; a new page needs no new route).
          { path: ':pageId', component: KbArticleComponent },
          { path: '', redirectTo: 'introductions', pathMatch: 'full' }
        ]
      }
    ]
  },
  {
    path: '',
    component: AdminLayoutComponent,
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    children: [
      { path: '', redirectTo: 'core/welcome-page', pathMatch: 'full' },

      // 🧩 CORE PAGES (system / shared by all applications)
      {
        path: 'core',
        children: [
          { path: '', redirectTo: 'welcome-page', pathMatch: 'full' },
          { path: 'dashboard', component: CoreDashboardComponent, data: { help: 'core-dashboard', permission: 'view-core' } },
          { path: 'welcome-page', component: WelcomePageComponent, data: { help: 'welcome-page', permission: 'core-view-welcome-page' } },
          { path: 'edit-legal', component: EditLegalComponent, data: { help: 'edit-legal', permission: 'core-legal-documents-view|core-legal-config-view' } },
          // Own account (password, 2FA) - every signed-in user, no permission (VT-13); the API lets
          // the own account through by `selfParam` (CheckPermission).
          { path: 'personal-info', component: PersonalInfoComponent, data: { help: 'personal-info' } },
          // Calendar: no page permission - the API returns only the items of the user's permissions.
          { path: 'calendar', component: CalendarComponent, data: { help: 'calendar' } },
          // Overview of the installed applications the user may open (no permission - the page
          // lists only the applications of the user's permissions).
          { path: 'apps', component: AppsComponent, data: { help: 'apps' } },
          { path: 'settings', component: SettingsComponent, data: { help: 'settings', permission: 'core-legal-config-view' } },
          { path: 'external-links', component: ExternalLinksComponent, data: { help: 'external-links', permission: 'core-external-links-view' } },
          // Restricted to the 'sysadmin' role regardless of the permission system (see sysadminGuard).
          { path: 'edit-roles', component: EditRolesComponent, data: { help: 'edit-roles' }, canActivate: [sysadminGuard] },
          { path: 'administrators', component: AdministratorsComponent, data: { help: 'administrators', permission: 'core-administrators-view' } },
          // System audit log (core/logs).
          { path: 'logs', component: AuditLogPageComponent, data: { help: 'core-logs', permission: 'view-core', auditLog: CORE_AUDIT_LOG } },
          { path: 'security-events', component: SecurityEventsComponent, data: { help: 'security-events', permission: 'core-security-view' } },
        ]
      },

      // 🧱 APPLICATIONS - the admin pages of every installed application below /admin/<id>/
      // (their manifests, apps.registry.ts; each page lazy-loaded). `data.app` = the application.
      ...APPS.map(app => ({ path: app.id, data: { app: app.id }, children: app.adminRoutes })),

      // ⛔ ERROR PAGES of the admin (inside the layout, no permission needed - see AuthGuard).
      // 403: target of AuthGuard.denyAccess() for an existing page the user may not open.
      { path: 'forbidden', component: AdminErrorPageComponent, data: { [ADMIN_ERROR_PAGE_KEY]: 'forbidden' } },
      // 404: any /admin/... address no route above knows - MUST STAY THE LAST CHILD.
      { path: '**', component: AdminErrorPageComponent, data: { [ADMIN_ERROR_PAGE_KEY]: 'not-found' } }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(ADMIN_ROUTES)],
  exports: [RouterModule]
})
export class AdminRoutingModule { }