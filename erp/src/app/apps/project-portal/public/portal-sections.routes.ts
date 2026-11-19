/**
 * @file portal-sections.routes.ts
 * @path src/app/apps/project-portal/public/portal-sections.routes.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Child routes of the portal of one project (/projects/:token/<section>), shown in
 *   PortalLayoutComponent: one component per section of the left menu, all from
 *   sections/portal-sections.ts (one lazy chunk - the sections switch without a delay). /projects/:token
 *   opens the section named by `?section=` (links of the e-mails, the sign-in keeps it) or the
 *   overview; an unknown section opens the overview.
 * @note A new section = a value of PortalSection (portal.models.ts), a route here, an icon and a
 *   menu item in the layout, texts `tab_<section>`.
 * @usage `children` of the route projects/:token (project-portal-public.routes.ts).
 * @dependencies portal.models (sections)
 */

import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { isPortalSection } from './portal.models';

/**
 * @description /projects/:token → /projects/:token/<?section= or overview>; the other query
 *   parameters (e.g. the one-time `access` link) stay.
 */
export const openRequestedSection: CanActivateFn = (route) => {
  const { section, ...queryParams } = route.queryParams;
  const token = route.parent?.paramMap.get('token') ?? '';
  return inject(Router).createUrlTree(['/projects', token, isPortalSection(section) ? section : 'overview'], { queryParams });
};

export const PORTAL_SECTION_ROUTES: Routes = [
  { path: '', pathMatch: 'full', canActivate: [openRequestedSection], children: [] },
  { path: 'overview', loadComponent: () => import('./sections/portal-sections').then(m => m.PortalOverviewComponent) },
  { path: 'checkpoints', loadComponent: () => import('./sections/portal-sections').then(m => m.PortalCheckpointsComponent) },
  { path: 'threads', loadComponent: () => import('./sections/portal-sections').then(m => m.PortalThreadsComponent) },
  { path: 'approvals', loadComponent: () => import('./sections/portal-sections').then(m => m.PortalApprovalsComponent) },
  { path: 'updates', loadComponent: () => import('./sections/portal-sections').then(m => m.PortalUpdatesComponent) },
  { path: 'files', loadComponent: () => import('./sections/portal-sections').then(m => m.PortalFilesComponent) },
  { path: 'contacts', loadComponent: () => import('./sections/portal-sections').then(m => m.PortalContactsComponent) },
  { path: 'account', loadComponent: () => import('./sections/portal-sections').then(m => m.PortalAccountComponent) },
  { path: 'help', loadComponent: () => import('./sections/portal-sections').then(m => m.PortalHelpComponent) },
  { path: '**', redirectTo: 'overview' },
];
