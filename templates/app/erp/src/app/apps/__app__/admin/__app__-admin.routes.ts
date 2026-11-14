/**
 * @file __app__-admin.routes.ts
 * @path src/app/apps/__app__/admin/__app__-admin.routes.ts
 * @project JS web-platform
 * @author JS
 * @created __YEAR__
 * @description Admin pages of the application "__NAME__", below `/admin/__app__/` (inside
 *   AdminLayoutComponent, AuthGuard checks `data.permission` of every page). Each page is loaded
 *   on its first visit; every page has its manual page (`data.help`) and a sidebar item.
 * @usage `adminRoutes` of __APP_CONST___APP; `help` = id of a page of the internal manual
 *   (api/app/Apps/__APP__/Resources/knowledge-base).
 */

import { Routes } from '@angular/router';
import { __APP_CONST___AUDIT_LOG } from './__app__-logs.config';

export const __APP_CONST___ADMIN_ROUTES: Routes = [
  { path: '', redirectTo: 'logs', pathMatch: 'full' },
  { path: 'logs', loadComponent: () => import('../../../admin/components/audit-log-page/audit-log-page.component').then(m => m.AuditLogPageComponent), data: { help: '__app__-logs', permission: '__app__-view-logs', auditLog: __APP_CONST___AUDIT_LOG } },
];
