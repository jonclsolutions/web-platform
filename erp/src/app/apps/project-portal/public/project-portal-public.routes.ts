/**
 * @file project-portal-public.routes.ts
 * @path src/app/apps/project-portal/public/project-portal-public.routes.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Public routes of the customer project portal: the order form of a sales lead
 *   link (/projects/order/:token, the former /order_form/:token redirects) and the portal of one
 *   project (/projects/:token - sign-in, then the project). Browser titles: area `project-portal`.
 * @usage `publicRoutes` of PROJECT_PORTAL_APP (project-portal.app.ts), composed by app.routes.ts.
 */

import { Routes } from '@angular/router';

export const PROJECT_PORTAL_PUBLIC_ROUTES: Routes = [
  {
    path: 'projects/order/:token',
    title: 'project-portal.order-form',
    loadComponent: () =>
      import('./order-form/order-form.component')
        .then(m => m.OrderFormComponent)
  },
  // Address of the order form before it moved into the portal (links already sent to clients).
  { path: 'order_form/:token', redirectTo: 'projects/order/:token' },
  {
    path: 'projects/:token',
    title: 'project-portal.portal',
    loadComponent: () =>
      import('./project-portal.component')
        .then(m => m.ProjectPortalComponent)
  },
];
