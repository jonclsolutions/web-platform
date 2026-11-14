/**
 * @file __app__-logs.config.ts
 * @path src/app/apps/__app__/admin/__app__-logs.config.ts
 * @project JS web-platform
 * @author JS
 * @created __YEAR__
 * @description Audit log of the application "__NAME__" (__app_snake___logs): the event types and
 *   modules its API writes (labels `event_<value>` / `module_<value>` of the section
 *   `__app__-logs` of its admin texts).
 * @dependencies AuditLogPageConfig (admin/components/audit-log-page).
 */

import { AuditLogPageConfig } from '../../../admin/components/audit-log-page/audit-log-page.config';

/** @description Configuration of the log page (route data `auditLog`). */
export const __APP_CONST___AUDIT_LOG: AuditLogPageConfig = {
  endpoint: '__app__/logs',
  section: '__app__-logs',
  reportPermission: '__app__-view-logs',
  eventTypes: ['create', 'update', 'soft_delete', 'hard_delete', 'restore', 'export', 'error'],
  modules: ['__APP__'],
};
