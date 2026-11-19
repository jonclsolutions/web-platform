/**
 * @file portal-sections.ts
 * @path src/app/apps/project-portal/public/sections/portal-sections.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description The section components of the project portal in one module: every child route
 *   loads its component from here, so the bundler puts all sections into ONE lazy chunk - it is
 *   loaded with the first section and the client then switches sections without a delay.
 * @usage `loadComponent: () => import('./sections/portal-sections').then(m => m.PortalFilesComponent)`
 *   (portal-sections.routes.ts).
 */

export { PortalOverviewComponent } from './overview/portal-overview.component';
export { PortalCheckpointsComponent } from './checkpoints/portal-checkpoints.component';
export { PortalThreadsComponent } from './threads/portal-threads.component';
export { PortalApprovalsComponent } from './approvals/portal-approvals.component';
export { PortalUpdatesComponent } from './updates/portal-updates.component';
export { PortalFilesComponent } from './files/portal-files.component';
export { PortalContactsComponent } from './contacts/portal-contacts.component';
export { PortalAccountComponent } from './account/portal-account.component';
export { PortalHelpComponent } from './help/portal-help.component';
