/**
 * @file logs.config.ts
 * @path src/app/admin/core-pages/logs/logs.config.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Audit log of the core (core_logs): sign-in, accounts, roles and permissions, legal documents,
 *   settings and security monitoring.
 * @dependencies AuditLogPageConfig (admin/components/audit-log-page).
 */

import { AuditLogPageConfig } from '../../components/audit-log-page/audit-log-page.config';

/** @description Configuration of the log page (route data `auditLog`). */
export const CORE_AUDIT_LOG: AuditLogPageConfig = {
  endpoint: 'core/logs',
  section: 'core-logs',
  reportPermission: 'view-core',
  eventTypes: [
    'create', 'create_denied', 'update', 'update_denied', 'soft_delete', 'hard_delete', 'delete',
    'delete_denied', 'restore', 'restore_denied', 'force_delete_all', 'force_delete_all_denied',
    'sync_permissions', 'sync_permissions_denied', 'PasswordChanged', 'password_change_denied',
    'password_notification_rate_limited', 'login_success', 'delete_bulk', 'login_failed', 'logout',
    'export', 'error', 'security_retention_updated', 'security_event_triaged',
    'security_event_deleted', 'security_events_purged',
  ],
  modules: [
    'Auth', 'CoreRole', 'User', 'Legal', 'Core',
  ],
};
