/**
 * @file logs.config.ts
 * @path src/app/admin/core-pages/logs/logs.config.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Static-turned-dynamic configuration (buttons, table/filter/detail
 * columns) for the Core system logs (audit trail) page. Read-only - no FORM_FIELDS,
 * no create/edit/delete buttons, since log entries are never created or edited
 * through the admin UI, only written internally by LogsActivity trait calls
 * throughout the backend.
 *
 * (Earlier bugfix-notes for module/event_type recalculation, security-audit event
 * types, and the openGraphBuilder permission fix are unchanged - see version
 * history.)
 *
 * @refactor-note (2026-09-08) BACKLOG "vícejazyčná administrace, žádné hardcoded texty":
 * kompletní přepis na FACTORY FUNKCE, stejný vzor jako `business-logs.config.ts`
 * (web). Žádná SQL migrace potřeba - `event_type`/`module` jsou stabilní anglické
 * slugy (`PasswordChanged` má nekonzistentní CamelCase oproti ostatním
 * snake_case hodnotám, ale pořád jde o anglický kód, ne český text - ponecháno
 * beze změny, přejmenování by vyžadovalo zásah do LogsActivity trait volání napříč
 * celým backendem, mimo rozsah i18n úkolu).
 */
import * as Core from '../../../shared/imports/core-providers';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';

const SECTION = 'core-logs';

export const EVENT_TYPE_VALUES: string[] = [
  'create', 'create_denied', 'update', 'update_denied', 'soft_delete', 'hard_delete',
  'delete', 'delete_denied', 'restore', 'restore_denied', 'force_delete_all',
  'force_delete_all_denied', 'sync_permissions', 'sync_permissions_denied',
  'PasswordChanged', 'password_change_denied', 'password_notification_rate_limited',
  'login_success', 'delete_bulk', 'login_failed', 'logout', 'export', 'error',
  'security_retention_updated', 'security_event_triaged', 'security_event_deleted',
  'security_events_purged',
];

export const MODULE_VALUES: string[] = ['Auth', 'CoreRole', 'User', 'Legal', 'Core'];

const EVENT_TYPE_LABEL_KEYS: Record<string, string> = {
  create: 'event_create',
  create_denied: 'event_create_denied',
  update: 'event_update',
  update_denied: 'event_update_denied',
  soft_delete: 'event_soft_delete',
  hard_delete: 'event_hard_delete',
  delete: 'event_delete',
  delete_denied: 'event_delete_denied',
  restore: 'event_restore',
  restore_denied: 'event_restore_denied',
  force_delete_all: 'event_force_delete_all',
  force_delete_all_denied: 'event_force_delete_all_denied',
  sync_permissions: 'event_sync_permissions',
  sync_permissions_denied: 'event_sync_permissions_denied',
  PasswordChanged: 'event_password_changed',
  password_change_denied: 'event_password_change_denied',
  password_notification_rate_limited: 'event_password_notification_rate_limited',
  login_success: 'event_login_success',
  delete_bulk: 'event_delete_bulk',
  login_failed: 'event_login_failed',
  logout: 'event_logout',
  export: 'event_export',
  error: 'event_error',
  security_retention_updated: 'event_security_retention_updated',
  security_event_triaged: 'event_security_event_triaged',
  security_event_deleted: 'event_security_event_deleted',
  security_events_purged: 'event_security_events_purged',
};

const MODULE_LABEL_KEYS: Record<string, string> = {
  Auth: 'module_auth',
  CoreRole: 'module_core_role',
  User: 'module_user',
  Legal: 'module_legal',
  Core: 'module_core',
};

function mapLabeledOptions(values: string[], labelKeys: Record<string, string>, i18n: AdminLocalizationService) {
  return values.map(v => ({ value: v, label: i18n.getValue(`${SECTION}.${labelKeys[v]}`) }));
}

export function createButtons(i18n: AdminLocalizationService): Core.TableButtons[] {
  return [
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_details`), isActive: true, type: 'info_button', action: 'details', icon: 'search' },
  ];
}

export function createToolbarButtons(i18n: AdminLocalizationService): Core.Button[] {
  return [
    { action: 'toggleFilters', label: i18n.getValue(`${SECTION}.toolbar_filters`), icon: '', class: 'btn-filter', isActive: false },
    { action: 'openGraphBuilder', label: i18n.getValue(`${SECTION}.toolbar_generate_reports`), icon: '', class: 'btn-neutral', showIf: true, permission: 'view-core' },
    { action: 'exportActiveTable', label: i18n.getValue(`${SECTION}.toolbar_export_data`), icon: '', class: 'btn-export', showIf: true },
  ];
}

export const FORM_FIELDS: Core.InputDefinition[] = [];

export function createTableColumns(i18n: AdminLocalizationService): Core.ColumnDefinition[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text' },
    { key: 'created_at', header: i18n.getValue(`${SECTION}.col_time`), type: 'date', format: 'short' },
    { key: 'user_plain', header: i18n.getValue(`${SECTION}.col_user`), type: 'text' },
    { key: 'event_type', header: i18n.getValue(`${SECTION}.col_action`), type: 'text' },
    { key: 'module', header: i18n.getValue(`${SECTION}.col_module`), type: 'text' },
    { key: 'description', header: i18n.getValue(`${SECTION}.col_description`), type: 'text' },
    { key: 'origin', header: i18n.getValue(`${SECTION}.col_ip`), type: 'text' },
  ];
}

export function createFilterColumns(i18n: AdminLocalizationService): Core.FilterColumns[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_id_placeholder`), canSort: true },
    { key: 'user_plain', header: i18n.getValue(`${SECTION}.col_user`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_user_placeholder`), canSort: true },
    { key: 'event_type', header: i18n.getValue(`${SECTION}.filter_event_label`), type: 'select', options: mapLabeledOptions(EVENT_TYPE_VALUES, EVENT_TYPE_LABEL_KEYS, i18n), placeholder: i18n.getValue(`${SECTION}.filter_event_placeholder`), canSort: true },
    { key: 'module', header: i18n.getValue(`${SECTION}.col_module`), type: 'select', options: mapLabeledOptions(MODULE_VALUES, MODULE_LABEL_KEYS, i18n), placeholder: i18n.getValue(`${SECTION}.filter_module_placeholder`), canSort: true },
    { key: 'origin', header: i18n.getValue(`${SECTION}.col_ip`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_ip_placeholder`), canSort: true },
  ];
}

export function createDetailsColumns(i18n: AdminLocalizationService): Core.ItemDetailsColumns[] {
  return [
    { key: 'id', displayName: i18n.getValue(`${SECTION}.details_id`), type: 'text' },
    { key: 'created_at', displayName: i18n.getValue(`${SECTION}.details_time`), type: 'date', format: 'medium' },
    { key: 'origin', displayName: i18n.getValue(`${SECTION}.details_ip`), type: 'text' },
    { key: 'event_type', displayName: i18n.getValue(`${SECTION}.details_event_type`), type: 'text', chartable: true, chartPossibleValues: EVENT_TYPE_VALUES },
    { key: 'module', displayName: i18n.getValue(`${SECTION}.details_module`), type: 'text', chartable: true, chartPossibleValues: MODULE_VALUES },
    { key: 'description', displayName: i18n.getValue(`${SECTION}.details_description`), type: 'text' },
    { key: 'affected_entity_type', displayName: i18n.getValue(`${SECTION}.details_entity_type`), type: 'text' },
    { key: 'affected_entity_id', displayName: i18n.getValue(`${SECTION}.details_entity_id`), type: 'text' },
    { key: 'user_id_plain', displayName: i18n.getValue(`${SECTION}.details_user_id`), type: 'text' },
    { key: 'user_plain', displayName: i18n.getValue(`${SECTION}.details_user`), type: 'text' },
    { key: 'context_data', displayName: i18n.getValue(`${SECTION}.details_context_data`), type: 'text' },
  ];
}