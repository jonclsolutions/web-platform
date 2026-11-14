/**
 * @file portal-logs.config.ts
 * @path src/app/apps/project-portal/admin/portal-logs/portal-logs.config.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Audit log of the project portal (project_portal_logs): projects and their content in the
 *   admin, the activity of the clients in the portal.
 * @dependencies AuditLogPageConfig (admin/components/audit-log-page).
 */

import { AuditLogPageConfig } from '../../../../admin/components/audit-log-page/audit-log-page.config';

/** @description Configuration of the log page (route data `auditLog`). */
export const PROJECT_PORTAL_AUDIT_LOG: AuditLogPageConfig = {
  endpoint: 'project-portal/logs',
  section: 'project-portal-logs',
  reportPermission: 'project-portal-view-logs',
  eventTypes: [
    'create', 'update', 'soft_delete', 'hard_delete', 'soft_delete_bulk', 'hard_delete_bulk',
    'restore', 'force_delete_all', 'error', 'export', 'import', 'generate_link', 'checkpoint_status', 'checkpoint_order',
    'template_create', 'template_update', 'template_delete', 'template_apply', 'account_create',
    'account_update', 'account_delete', 'account_password_reset', 'account_invite',
    'approval_create', 'approval_update', 'approval_reopen', 'approval_cancel', 'approval_delete',
    'update_create', 'update_update', 'update_delete', 'thread_assign', 'thread_close',
    'thread_reopen', 'portal_login', 'portal_logout', 'portal_code_sent',
    'portal_account_settings', 'portal_thread_create', 'portal_thread_status',
    'portal_approval_decision', 'attachment_download', 'generate_report', 'export_csv',
    'export_xlsx', 'export_json', 'export_txt',
  ],
  modules: [
    'SalesLead', 'SalesOrder', 'ProjectPortalSetting', 'Project', 'ProjectCheckpoint', 'ProjectTemplate', 'ProjectAccount', 'ProjectApproval',
    'ProjectUpdate', 'ProjectThread', 'ProjectPortal',
  ],
};
