/**
 * @file project-portal-public.routes.ts
 * @path src/app/apps/project-portal/public/project-portal-public.routes.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Public route of the customer project portal: the portal of one project
 *   (/projects/:token - sign-in, then the project).
 * @usage `publicRoutes` of PROJECT_PORTAL_APP (project-portal.app.ts), composed by app.routes.ts.
 */

import { Routes } from '@angular/router';

export const PROJECT_PORTAL_PUBLIC_ROUTES: Routes = [
  {
    path: 'projects/:token',
    title: 'web.project-portal',
    loadComponent: () =>
      import('./project-portal.component')
        .then(m => m.ProjectPortalComponent)
  },
];
