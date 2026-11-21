/**
 * @file js-creator-logs.config.ts
 * @path src/app/apps/js-creator/admin/js-creator-logs.config.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Audit log of the application "JS Creator" (js_creator_logs): the event types and
 *   modules its API writes (labels `event_<value>` / `module_<value>` of the section
 *   `js-creator-logs` of its admin texts). The rows name only ids, never the content of a
 *   workspace.
 * @dependencies AuditLogPageConfig (admin/components/audit-log-page).
 */

import { AuditLogPageConfig } from '../../../admin/components/audit-log-page/audit-log-page.config';

/** @description Configuration of the log page (route data `auditLog`). */
export const JS_CREATOR_AUDIT_LOG: AuditLogPageConfig = {
  endpoint: 'js-creator/logs',
  section: 'js-creator-logs',
  reportPermission: 'js-creator-view-logs',
  eventTypes: ['create', 'update', 'soft_delete', 'hard_delete', 'restore', 'force_delete_all', 'error'],
  modules: ['Folder', 'Asset', 'Font', 'Settings', 'Quota'],
};
