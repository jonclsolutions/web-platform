/**
 * @file audit-log-page.config.ts
 * @path src/app/admin/components/audit-log-page/audit-log-page.config.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Configuration of the read-only audit log page (AuditLogPageComponent) shared by
 *   the core and every application: what a log page differs in (endpoint, translation section,
 *   report permission, the event types and modules its API writes) and the builders of its
 *   buttons and columns. The labels of the columns, filters and toolbar are the same for every log
 *   (core translation section `audit-log`); the page section holds only the table header and the
 *   labels of its event types (`event_<value>`) and modules (`module_<value>`).
 * @usage Route `{ path: 'logs', loadComponent: () => import('…/audit-log-page.component')…,
 *   data: { help, permission, auditLog: SHOP_AUDIT_LOG } }`.
 * @dependencies AdminLocalizationService (texts).
 */

import * as Core from '../../../shared/imports/core-providers';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';

/** @description Route data key of the configuration. */
export const AUDIT_LOG_ROUTE_DATA = 'auditLog';

/** @description Translation section of the labels shared by every log page. */
export const AUDIT_LOG_SECTION = 'audit-log';

/** @description What one log page differs in. */
export interface AuditLogPageConfig {
  /** API endpoint of the log (`core/logs`, `shop/logs`, …). */
  endpoint: string;
  /** Translation section of the page: `table_header`, `event_<value>`, `module_<value>`. */
  section: string;
  /** Permission of the report (graph) action. */
  reportPermission: string;
  /** Event types written to the log by the API (filter, chart). */
  eventTypes: string[];
  /** Modules written to the log by the API (filter, chart). */
  modules: string[];
}

/**
 * @description Translation key of a stored value: prefix + the value in snake case
 *   ('PasswordChanged' → 'event_password_changed', 'ShopOrder (Checkout)' →
 *   'module_shop_order_checkout', 'Translation:web' → 'module_translation_web').
 * @param prefix 'event_' or 'module_'.
 * @param value Value stored by the API.
 * @returns Key inside the page section.
 */
export function auditLogLabelKey(prefix: 'event_' | 'module_', value: string): string {
  const snake = value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
  return prefix + snake;
}

/**
 * @description Text shared by every log page.
 * @param i18n Admin localization service.
 * @param key Key inside `audit-log`.
 */
function shared(i18n: AdminLocalizationService, key: string): string {
  return i18n.getValue(`${AUDIT_LOG_SECTION}.${key}`);
}

/**
 * @description Options of a select filter with the labels of the page section.
 * @param config Page configuration.
 * @param prefix 'event_' or 'module_'.
 * @param values Stored values.
 * @param i18n Admin localization service.
 */
function options(config: AuditLogPageConfig, prefix: 'event_' | 'module_', values: string[], i18n: AdminLocalizationService): { value: string; label: string }[] {
  return values.map(value => ({ value, label: i18n.getValue(`${config.section}.${auditLogLabelKey(prefix, value)}`) }));
}

/**
 * @description Row buttons (the log is read-only: details only).
 * @param i18n Admin localization service.
 */
export function createAuditLogButtons(i18n: AdminLocalizationService): Core.TableButtons[] {
  return [
    { display_name: '', header_name: shared(i18n, 'btn_details'), isActive: true, type: 'info_button', action: 'details', icon: 'search' },
  ];
}

/**
 * @description Toolbar: filters, reports (report permission of the page), export.
 * @param config Page configuration.
 * @param i18n Admin localization service.
 */
export function createAuditLogToolbarButtons(config: AuditLogPageConfig, i18n: AdminLocalizationService): Core.Button[] {
  return [
    { action: 'toggleFilters', label: shared(i18n, 'toolbar_filters'), icon: '', class: 'btn-filter', isActive: false },
    { action: 'openGraphBuilder', label: shared(i18n, 'toolbar_generate_reports'), icon: '', class: 'btn-neutral', showIf: true, permission: config.reportPermission },
    { action: 'exportActiveTable', label: shared(i18n, 'toolbar_export_data'), icon: '', class: 'btn-export', showIf: true },
  ];
}

/**
 * @description Columns of the log table.
 * @param i18n Admin localization service.
 */
export function createAuditLogTableColumns(i18n: AdminLocalizationService): Core.ColumnDefinition[] {
  return [
    { key: 'id', header: shared(i18n, 'col_id'), type: 'text' },
    { key: 'created_at', header: shared(i18n, 'col_time'), type: 'date', format: 'short' },
    { key: 'user_plain', header: shared(i18n, 'col_user'), type: 'text' },
    { key: 'event_type', header: shared(i18n, 'col_action'), type: 'text' },
    { key: 'module', header: shared(i18n, 'col_module'), type: 'text' },
    { key: 'description', header: shared(i18n, 'col_description'), type: 'text' },
    { key: 'origin', header: shared(i18n, 'col_ip'), type: 'text' },
  ];
}

/**
 * @description Filter panel: event type and module with the labels of the page.
 * @param config Page configuration.
 * @param i18n Admin localization service.
 */
export function createAuditLogFilterColumns(config: AuditLogPageConfig, i18n: AdminLocalizationService): Core.FilterColumns[] {
  return [
    { key: 'id', header: shared(i18n, 'col_id'), type: 'text', placeholder: shared(i18n, 'filter_id_placeholder'), canSort: true },
    { key: 'user_plain', header: shared(i18n, 'col_user'), type: 'text', placeholder: shared(i18n, 'filter_user_placeholder'), canSort: true },
    {
      key: 'event_type', header: shared(i18n, 'filter_event_label'), type: 'select',
      options: options(config, 'event_', config.eventTypes, i18n), placeholder: shared(i18n, 'filter_event_placeholder'), canSort: true,
    },
    {
      key: 'module', header: shared(i18n, 'col_module'), type: 'select',
      options: options(config, 'module_', config.modules, i18n), placeholder: shared(i18n, 'filter_module_placeholder'), canSort: true,
    },
    { key: 'origin', header: shared(i18n, 'col_ip'), type: 'text', placeholder: shared(i18n, 'filter_ip_placeholder'), canSort: true },
  ];
}

/**
 * @description Detail / chart columns of a log entry (event type and module chartable).
 * @param config Page configuration.
 * @param i18n Admin localization service.
 */
export function createAuditLogDetailsColumns(config: AuditLogPageConfig, i18n: AdminLocalizationService): Core.ItemDetailsColumns[] {
  return [
    { key: 'id', displayName: shared(i18n, 'details_id'), type: 'text' },
    { key: 'created_at', displayName: shared(i18n, 'details_time'), type: 'date', format: 'medium' },
    { key: 'origin', displayName: shared(i18n, 'details_ip'), type: 'text' },
    { key: 'event_type', displayName: shared(i18n, 'details_event_type'), type: 'text', chartable: true, chartPossibleValues: config.eventTypes },
    { key: 'module', displayName: shared(i18n, 'details_module'), type: 'text', chartable: true, chartPossibleValues: config.modules },
    { key: 'description', displayName: shared(i18n, 'details_description'), type: 'text' },
    { key: 'affected_entity_type', displayName: shared(i18n, 'details_entity_type'), type: 'text' },
    { key: 'affected_entity_id', displayName: shared(i18n, 'details_entity_id'), type: 'text' },
    { key: 'user_id_plain', displayName: shared(i18n, 'details_user_id'), type: 'text' },
    { key: 'user_plain', displayName: shared(i18n, 'details_user'), type: 'text' },
    { key: 'context_data', displayName: shared(i18n, 'details_context_data'), type: 'text' },
  ];
}
