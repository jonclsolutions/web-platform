/**
 * @file project-portal-public.routes.ts
 * @path src/app/apps/project-portal/public/project-portal-public.routes.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Public routes of the customer project portal: the order form of a sales lead
 *   link (/projects/order/:token, the former /order_form/:token redirects), the sign-in of one
 *   project (/projects/login/:token) and the portal of one project (/projects/:token) - all
 *   closed by the maintenance guard while the portal is switched off - and the maintenance page
 *   (/projects/maintenance). The portal route has a session resolver: without a valid session it
 *   redirects to the sign-in. Browser titles: area `project-portal`.
 * @note Literal paths (maintenance, order/:token, login/:token) must stay BEFORE projects/:token.
 * @usage `publicRoutes` of PROJECT_PORTAL_APP (project-portal.app.ts), composed by app.routes.ts.
 */

import { Routes } from '@angular/router';
import { projectPortalMaintenanceGuard } from './maintenance/portal-maintenance';
import { projectPortalSessionResolver } from './project-portal-session.resolver';

export const PROJECT_PORTAL_PUBLIC_ROUTES: Routes = [
  // Shown while the portal is switched off (guard below, 503 of a portal request).
  {
    path: 'projects/maintenance',
    title: 'project-portal.maintenance',
    loadComponent: () =>
      import('./maintenance/portal-maintenance.component')
        .then(m => m.PortalMaintenanceComponent)
  },
  {
    path: 'projects/order/:token',
    title: 'project-portal.order-form',
    canActivate: [projectPortalMaintenanceGuard],
    loadComponent: () =>
      import('./order-form/order-form.component')
        .then(m => m.OrderFormComponent)
  },
  // Sign-in of one project.
  {
    path: 'projects/login/:token',
    title: 'project-portal.login',
    canActivate: [projectPortalMaintenanceGuard],
    loadComponent: () =>
      import('./portal-login/portal-login.component')
        .then(m => m.PortalLoginComponent)
  },
  // Address of the order form before it moved into the portal (links already sent to clients).
  { path: 'order_form/:token', redirectTo: 'projects/order/:token' },
  {
    path: 'projects/:token',
    title: 'project-portal.portal',
    canActivate: [projectPortalMaintenanceGuard],
    resolve: { project: projectPortalSessionResolver },
    loadComponent: () =>
      import('./project-portal.component')
        .then(m => m.ProjectPortalComponent)
  },
];