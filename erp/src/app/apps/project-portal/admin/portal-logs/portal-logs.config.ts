/**
 * @file portal-logs.config.ts
 * @path src/app/apps/project-portal/admin/portal-logs/portal-logs.config.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description i18n-aware configuration (buttons, table / filter / detail columns) of the
 *   read-only audit log of the project portal (project_portal_logs: admin changes of projects and
 *   the activity of the clients in the portal). Every text comes from the admin translation section `project-portal-logs`.
 *
 * @dependencies
 * - AdminLocalizationService: translated texts (`project-portal-logs.*`).
 */
import * as Core from '../../../../shared/imports/core-providers';
import { AdminLocalizationService } from '../../../../core/services/admin-localization.service';

const SECTION = 'project-portal-logs';

/** @description Event types written to `project_portal_logs.event_type` by the API. */
export const EVENT_TYPE_VALUES: string[] = [
  'create', 'update', 'soft_delete', 'hard_delete', 'soft_delete_bulk', 'hard_delete_bulk',
  'restore', 'force_delete_all', 'error', 'checkpoint_status', 'checkpoint_order',
  'template_create', 'template_update', 'template_delete', 'template_apply', 'account_create',
  'account_update', 'account_delete', 'account_password_reset', 'account_invite',
  'approval_create', 'approval_update', 'approval_reopen', 'approval_cancel', 'approval_delete',
  'update_create', 'update_update', 'update_delete', 'thread_assign', 'thread_close',
  'thread_reopen', 'portal_login', 'portal_logout', 'portal_code_sent', 'portal_account_settings',
  'portal_thread_create', 'portal_thread_status', 'portal_approval_decision',
  'attachment_download', 'generate_report', 'export_csv', 'export_xlsx', 'export_json',
  'export_txt',
];

/** @description Modules written to `project_portal_logs.module` by the API. */
export const MODULE_VALUES: string[] = [
  'Project', 'ProjectCheckpoint', 'ProjectTemplate', 'ProjectAccount', 'ProjectApproval',
  'ProjectUpdate', 'ProjectThread', 'ProjectPortal',
];

/** @description Translation key of each module (inside `project-portal-logs`). */
const MODULE_LABEL_KEYS: Record<string, string> = {
  Project: 'module_project',
  ProjectCheckpoint: 'module_project_checkpoint',
  ProjectTemplate: 'module_project_template',
  ProjectAccount: 'module_project_account',
  ProjectApproval: 'module_project_approval',
  ProjectUpdate: 'module_project_update',
  ProjectThread: 'module_project_thread',
  ProjectPortal: 'module_project_portal',
};

/**
 * @description Shortcut for a text of the `project-portal-logs` section.
 * @param i18n Admin localization service.
 * @param key Key inside the section.
 * @returns Translated text.
 */
function tr(i18n: AdminLocalizationService, key: string): string {
  return i18n.getValue(`${SECTION}.${key}`);
}

/**
 * @description Row buttons (the log is read-only: details only).
 * @param i18n Admin localization service.
 * @returns The details button.
 */
export function createPortalLogButtons(i18n: AdminLocalizationService): Core.TableButtons[] {
  return [
    { display_name: '', header_name: tr(i18n, 'btn_details'), isActive: true, type: 'info_button', action: 'details', icon: 'search' },
  ];
}

/**
 * @description Toolbar actions of the log page.
 * @param i18n Admin localization service.
 * @returns Filters, reports (project-portal-view-logs) and export.
 */
export function createPortalLogToolbarButtons(i18n: AdminLocalizationService): Core.Button[] {
  return [
    { action: 'toggleFilters', label: tr(i18n, 'toolbar_filters'), icon: '', class: 'btn-filter', isActive: false },
    { action: 'openGraphBuilder', label: tr(i18n, 'toolbar_generate_reports'), icon: '', class: 'btn-neutral', showIf: true, permission: 'project-portal-view-logs' },
    { action: 'exportActiveTable', label: tr(i18n, 'toolbar_export_data'), icon: '', class: 'btn-export', showIf: true },
  ];
}

/** @description The log has no form (entries are written by the API only). */
export const FORM_FIELDS: Core.InputDefinition[] = [];

/**
 * @description Columns of the log table.
 * @param i18n Admin localization service.
 * @returns Column definitions.
 */
export function createPortalLogTableColumns(i18n: AdminLocalizationService): Core.ColumnDefinition[] {
  return [
    { key: 'id', header: tr(i18n, 'col_id'), type: 'text' },
    { key: 'created_at', header: tr(i18n, 'col_time'), type: 'date', format: 'short' },
    { key: 'user_plain', header: tr(i18n, 'col_user'), type: 'text' },
    { key: 'event_type', header: tr(i18n, 'col_action'), type: 'text' },
    { key: 'module', header: tr(i18n, 'col_module'), type: 'text' },
    { key: 'description', header: tr(i18n, 'col_description'), type: 'text' },
    { key: 'origin', header: tr(i18n, 'col_ip'), type: 'text' },
  ];
}

/**
 * @description Filter panel of the log (event / module with translated labels, real API values).
 * @param i18n Admin localization service.
 * @returns Filter definitions.
 */
export function createPortalLogFilterColumns(i18n: AdminLocalizationService): Core.FilterColumns[] {
  return [
    { key: 'id', header: tr(i18n, 'col_id'), type: 'text', placeholder: tr(i18n, 'filter_id_placeholder'), canSort: true },
    { key: 'user_plain', header: tr(i18n, 'col_user'), type: 'text', placeholder: tr(i18n, 'filter_user_placeholder'), canSort: true },
    {
      key: 'event_type', header: tr(i18n, 'filter_event_label'), type: 'select',
      options: EVENT_TYPE_VALUES.map(v => ({ value: v, label: tr(i18n, `event_${v}`) })),
      placeholder: tr(i18n, 'filter_event_placeholder'), canSort: true,
    },
    {
      key: 'module', header: tr(i18n, 'col_module'), type: 'select',
      options: MODULE_VALUES.map(v => ({ value: v, label: tr(i18n, MODULE_LABEL_KEYS[v]) })),
      placeholder: tr(i18n, 'filter_module_placeholder'), canSort: true,
    },
    { key: 'origin', header: tr(i18n, 'col_ip'), type: 'text', placeholder: tr(i18n, 'filter_ip_placeholder'), canSort: true },
  ];
}

/**
 * @description Detail / chart columns of a log entry.
 * @param i18n Admin localization service.
 * @returns Detail column definitions (event type and module chartable).
 */
export function createPortalLogDetailsColumns(i18n: AdminLocalizationService): Core.ItemDetailsColumns[] {
  return [
    { key: 'id', displayName: tr(i18n, 'details_id'), type: 'text' },
    { key: 'created_at', displayName: tr(i18n, 'details_time'), type: 'date', format: 'medium' },
    { key: 'origin', displayName: tr(i18n, 'details_ip'), type: 'text' },
    { key: 'event_type', displayName: tr(i18n, 'details_event_type'), type: 'text', chartable: true, chartPossibleValues: EVENT_TYPE_VALUES },
    { key: 'module', displayName: tr(i18n, 'details_module'), type: 'text', chartable: true, chartPossibleValues: MODULE_VALUES },
    { key: 'description', displayName: tr(i18n, 'details_description'), type: 'text' },
    { key: 'affected_entity_type', displayName: tr(i18n, 'details_entity_type'), type: 'text' },
    { key: 'affected_entity_id', displayName: tr(i18n, 'details_entity_id'), type: 'text' },
    { key: 'user_id_plain', displayName: tr(i18n, 'details_user_id'), type: 'text' },
    { key: 'user_plain', displayName: tr(i18n, 'details_user'), type: 'text' },
    { key: 'context_data', displayName: tr(i18n, 'details_context_data'), type: 'text' },
  ];
}
