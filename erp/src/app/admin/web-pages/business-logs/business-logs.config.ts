/**
 * @file business-logs.config.ts
 * @path src/app/admin/web-pages/business-logs/business-logs.config.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Static-turned-dynamic configuration (buttons, table/filter/detail
 * columns) for the Web business logs (audit trail) page. Read-only - no FORM_FIELDS,
 * no create/edit/delete buttons, since log entries are never created or edited through
 * the admin UI, only written internally by LogsActivity trait calls throughout the
 * backend.
 *
 * @refactor-note (2026-09-08) BACKLOG "vícejazyčná administrace, žádné hardcoded texty":
 * kompletní přepis na FACTORY FUNKCE, stejný vzor jako ostatní web-pages stránky.
 * `event_type`/`module` NEVYŽADOVALY žádnou SQL migraci - byly to od začátku anglické
 * slugy (`create`/`update`/..., `WebNews`/`WebJobApplication`/...), ne český text.
 * Jen přidán `mapLabeledOptions()` mechanismus, ať se ve filtru/detailu zobrazí
 * přeložený popisek místo syrového technického slugu/PascalCase názvu třídy.
 */
import * as Core from '../../../shared/imports/core-providers';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';

const SECTION = 'business-logs';

export const EVENT_TYPE_VALUES: string[] = [
  'create', 'update', 'delete', 'soft_delete', 'hard_delete', 'restore',
  'force_delete_all', 'export', 'error', 'delete_bulk', 'generate_link',
  'maintenance_status_changed', 'unauthorized_maintenance_toggle_attempt',
];

export const MODULE_VALUES: string[] = [
  'WebNews', 'WebJobApplication', 'WebSalesLead', 'WebSalesOrder',
  'WebSupportTicket', 'WebRawRequestCommission', 'Web', 'Translation:web',
];

const EVENT_TYPE_LABEL_KEYS: Record<string, string> = {
  create: 'event_create',
  update: 'event_update',
  delete: 'event_delete',
  soft_delete: 'event_soft_delete',
  hard_delete: 'event_hard_delete',
  restore: 'event_restore',
  force_delete_all: 'event_force_delete_all',
  export: 'event_export',
  error: 'event_error',
  delete_bulk: 'event_delete_bulk',
  generate_link: 'event_generate_link',
  maintenance_status_changed: 'event_maintenance_status_changed',
  unauthorized_maintenance_toggle_attempt: 'event_unauthorized_maintenance_toggle_attempt',
};

const MODULE_LABEL_KEYS: Record<string, string> = {
  WebNews: 'module_web_news',
  WebJobApplication: 'module_web_job_application',
  WebSalesLead: 'module_web_sales_lead',
  WebSalesOrder: 'module_web_sales_order',
  WebSupportTicket: 'module_web_support_ticket',
  WebRawRequestCommission: 'module_web_raw_request_commission',
  Web: 'module_web',
  'Translation:web': 'module_translation_web',
};

function mapLabeledOptions(values: string[], labelKeys: Record<string, string>, i18n: AdminLocalizationService) {
  return values.map(v => ({ value: v, label: i18n.getValue(`${SECTION}.${labelKeys[v]}`) }));
}

export function createBusinessLogButtons(i18n: AdminLocalizationService): Core.TableButtons[] {
  return [
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_details`), isActive: true, type: 'info_button', action: 'details', icon: 'search' },
  ];
}

export function createBusinessLogToolbarButtons(i18n: AdminLocalizationService): Core.Button[] {
  return [
    { action: 'toggleFilters', label: i18n.getValue(`${SECTION}.toolbar_filters`), icon: '', class: 'btn-filter', isActive: false },
    { action: 'openGraphBuilder', label: i18n.getValue(`${SECTION}.toolbar_generate_reports`), icon: '', class: 'btn-neutral', showIf: true, permission: 'web-view-web-logs' },
    { action: 'exportActiveTable', label: i18n.getValue(`${SECTION}.toolbar_export_data`), icon: '', class: 'btn-export', showIf: true },
  ];
}

export const FORM_FIELDS: Core.InputDefinition[] = [];

export function createBusinessLogTableColumns(i18n: AdminLocalizationService): Core.ColumnDefinition[] {
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

export function createBusinessLogFilterColumns(i18n: AdminLocalizationService): Core.FilterColumns[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_id_placeholder`), canSort: true },
    { key: 'user_plain', header: i18n.getValue(`${SECTION}.col_user`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_user_placeholder`), canSort: true },
    { key: 'event_type', header: i18n.getValue(`${SECTION}.filter_event_label`), type: 'select', options: mapLabeledOptions(EVENT_TYPE_VALUES, EVENT_TYPE_LABEL_KEYS, i18n), placeholder: i18n.getValue(`${SECTION}.filter_event_placeholder`), canSort: true },
    { key: 'module', header: i18n.getValue(`${SECTION}.col_module`), type: 'select', options: mapLabeledOptions(MODULE_VALUES, MODULE_LABEL_KEYS, i18n), placeholder: i18n.getValue(`${SECTION}.filter_module_placeholder`), canSort: true },
    { key: 'origin', header: i18n.getValue(`${SECTION}.col_ip`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_ip_placeholder`), canSort: true },
  ];
}

export function createBusinessLogDetailsColumns(i18n: AdminLocalizationService): Core.ItemDetailsColumns[] {
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