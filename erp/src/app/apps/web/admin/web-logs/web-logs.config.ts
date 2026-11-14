/**
 * @file web-logs.config.ts
 * @path src/app/apps/web/admin/web-logs/web-logs.config.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Audit log of the web application (web_logs): inquiries, job applications and
 *   the texts of the website.
 * @dependencies AuditLogPageConfig (admin/components/audit-log-page).
 */

import { AuditLogPageConfig } from '../../../../admin/components/audit-log-page/audit-log-page.config';

/** @description Configuration of the log page (route data `auditLog`). */
export const WEB_AUDIT_LOG: AuditLogPageConfig = {
  endpoint: 'web/logs',
  section: 'web-logs',
  reportPermission: 'web-view-web-logs',
  eventTypes: [
    'create', 'update', 'delete', 'soft_delete', 'hard_delete', 'restore', 'force_delete_all',
    'export', 'error', 'delete_bulk', 'maintenance_status_changed',
    'unauthorized_maintenance_toggle_attempt',
  ],
  modules: [
    'WebJobApplication', 'WebRawRequestCommission', 'Web',
    'Translation:web',
  ],
};
