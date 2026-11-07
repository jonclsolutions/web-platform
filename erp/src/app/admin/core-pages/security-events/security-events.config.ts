/**
 * @file security-events.config.ts
 * @path src/app/admin/core-pages/security-events/security-events.config.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Configuration (buttons, table / filter / detail columns, explanation texts) of
 * the security monitoring page (core_security_events).
 * @note `createEventTypeInfo(i18n)` builds the templated "what happened" / "we recommend" texts
 * with the placeholders `{route}` / `{ip}` / `{email}` / `{user_id}` / `{occurrences}`. The
 * placeholders STAY literally in the translated text (they are not i18n variables -
 * `buildEventExplanation()` replaces them at runtime with the data of the record).
 */
import * as Core from '../../../shared/imports/core-providers';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';
import { mapLabeledOptions } from '../../components/builders/labeled-options';

const SECTION = 'security-events';

export const EVENT_TYPE_VALUES: string[] = [
  'login_captcha_failed', 'login_captcha_service_error', 'form_captcha_failed',
  'form_captcha_service_error', 'form_honeypot', 'throttle_exceeded', 'login_failed',
  'login_brute_force_suspected', 'login_2fa_invalid', 'login_2fa_exhausted',
  'login_2fa_resend_exhausted', 'refresh_token_invalid', 'scan_probe', 'csp_violation',
  'refresh_token_reuse',
];

export const SEVERITY_VALUES: string[] = ['info', 'warning', 'critical'];

/** @description Shared by FORM_FIELDS / FILTER_COLUMNS and the triage modal select of `SecurityEventsComponent`. */
export const STATUS_VALUES: string[] = ['new', 'reviewed', 'false_positive', 'confirmed_attack'];

const EVENT_TYPE_LABEL_KEYS: Record<string, string> = {
  login_captcha_failed: 'event_login_captcha_failed',
  login_captcha_service_error: 'event_login_captcha_service_error',
  form_captcha_failed: 'event_form_captcha_failed',
  form_captcha_service_error: 'event_form_captcha_service_error',
  form_honeypot: 'event_form_honeypot',
  throttle_exceeded: 'event_throttle_exceeded',
  login_failed: 'event_login_failed',
  login_brute_force_suspected: 'event_login_brute_force_suspected',
  login_2fa_invalid: 'event_login_2fa_invalid',
  login_2fa_exhausted: 'event_login_2fa_exhausted',
  login_2fa_resend_exhausted: 'event_login_2fa_resend_exhausted',
  refresh_token_invalid: 'event_refresh_token_invalid',
  scan_probe: 'event_scan_probe',
  csp_violation: 'event_csp_violation',
  refresh_token_reuse: 'event_refresh_token_reuse',
};

const SEVERITY_LABEL_KEYS: Record<string, string> = {
  info: 'severity_info',
  warning: 'severity_warning',
  critical: 'severity_critical',
};

const STATUS_LABEL_KEYS: Record<string, string> = {
  new: 'status_new',
  reviewed: 'status_reviewed',
  false_positive: 'status_false_positive',
  confirmed_attack: 'status_confirmed_attack',
};

export function createButtons(i18n: AdminLocalizationService): Core.TableButtons[] {
  return [
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_details`), isActive: true, type: 'info_button', action: 'details', icon: 'search' },
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_triage`), isActive: true, type: 'edit_button', action: 'edit', permission: 'core-security-update', icon: 'edit' },
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_delete`), isActive: true, type: 'delete_button', action: 'delete', permission: 'core-security-delete', icon: 'delete' },
  ];
}

export function createToolbarButtons(i18n: AdminLocalizationService): Core.Button[] {
  return [
    { action: 'toggleFilters', label: i18n.getValue(`${SECTION}.toolbar_filters`), icon: '', class: 'btn-filter', isActive: false },
    { action: 'openGraphBuilder', label: i18n.getValue(`${SECTION}.toolbar_generate_reports`), icon: '', class: 'btn-neutral', showIf: true, permission: 'core-security-view' },
    { action: 'exportActiveTable', label: i18n.getValue(`${SECTION}.toolbar_export_data`), icon: '', class: 'btn-export', showIf: true },
  ];
}

/**
 * @description Mapping of the technical values to translated text for the
 * `event_type` / `severity` / `status` columns in the table and the export -
 * `TableBuilderComponent` applies it automatically by `column_name`.
 */
export function createFormFields(i18n: AdminLocalizationService): Core.InputDefinition[] {
  return [
    { column_name: 'event_type', type: 'select', options: mapLabeledOptions(SECTION, EVENT_TYPE_VALUES, EVENT_TYPE_LABEL_KEYS, i18n) } as unknown as Core.InputDefinition,
    { column_name: 'severity', type: 'select', options: mapLabeledOptions(SECTION, SEVERITY_VALUES, SEVERITY_LABEL_KEYS, i18n) } as unknown as Core.InputDefinition,
    { column_name: 'status', type: 'select', options: mapLabeledOptions(SECTION, STATUS_VALUES, STATUS_LABEL_KEYS, i18n) } as unknown as Core.InputDefinition,
  ];
}

export function createTableColumns(i18n: AdminLocalizationService): Core.ColumnDefinition[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text' },
    { key: 'last_seen_at', header: i18n.getValue(`${SECTION}.col_last_seen`), type: 'date', format: 'short' },
    { key: 'event_type', header: i18n.getValue(`${SECTION}.col_event_type`), type: 'text' },
    { key: 'severity', header: i18n.getValue(`${SECTION}.col_severity`), type: 'text' },
    { key: 'ip_address', header: i18n.getValue(`${SECTION}.col_ip`), type: 'text' },
    { key: 'occurrences', header: i18n.getValue(`${SECTION}.col_occurrences`), type: 'number' },
    { key: 'status', header: i18n.getValue(`${SECTION}.col_status`), type: 'text' },
  ];
}

export function createFilterColumns(i18n: AdminLocalizationService): Core.FilterColumns[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_id_placeholder`), canSort: true },
    { key: 'event_type', header: i18n.getValue(`${SECTION}.col_event_type`), type: 'select', options: mapLabeledOptions(SECTION, EVENT_TYPE_VALUES, EVENT_TYPE_LABEL_KEYS, i18n), placeholder: i18n.getValue(`${SECTION}.filter_event_type_placeholder`), canSort: true },
    { key: 'severity', header: i18n.getValue(`${SECTION}.col_severity`), type: 'select', options: mapLabeledOptions(SECTION, SEVERITY_VALUES, SEVERITY_LABEL_KEYS, i18n), placeholder: i18n.getValue(`${SECTION}.filter_severity_placeholder`), canSort: true },
    { key: 'status', header: i18n.getValue(`${SECTION}.col_status`), type: 'select', options: mapLabeledOptions(SECTION, STATUS_VALUES, STATUS_LABEL_KEYS, i18n), placeholder: i18n.getValue(`${SECTION}.filter_status_placeholder`), canSort: true },
    { key: 'ip_address', header: i18n.getValue(`${SECTION}.col_ip`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_ip_placeholder`), canSort: true },
  ];
}

export function createDetailsColumns(i18n: AdminLocalizationService): Core.ItemDetailsColumns[] {
  return [
    { key: 'id', displayName: i18n.getValue(`${SECTION}.details_id`), type: 'text' },
    { key: 'event_type', displayName: i18n.getValue(`${SECTION}.details_event_type`), type: 'text', chartable: true, chartPossibleValues: EVENT_TYPE_VALUES },
    { key: 'severity', displayName: i18n.getValue(`${SECTION}.details_severity`), type: 'text', chartable: true, chartPossibleValues: SEVERITY_VALUES },
    { key: 'ip_address', displayName: i18n.getValue(`${SECTION}.details_ip`), type: 'text' },
    { key: 'user_agent', displayName: i18n.getValue(`${SECTION}.details_user_agent`), type: 'text' },
    { key: 'route', displayName: i18n.getValue(`${SECTION}.details_route`), type: 'text' },
    { key: 'method', displayName: i18n.getValue(`${SECTION}.details_method`), type: 'text' },
    { key: 'user_id', displayName: i18n.getValue(`${SECTION}.details_user_id`), type: 'text' },
    { key: 'occurrences', displayName: i18n.getValue(`${SECTION}.details_occurrences`), type: 'text' },
    { key: 'status', displayName: i18n.getValue(`${SECTION}.details_status`), type: 'text', chartable: true, chartPossibleValues: STATUS_VALUES },
    { key: 'notes', displayName: i18n.getValue(`${SECTION}.details_notes`), type: 'text' },
    { key: 'context_data', displayName: i18n.getValue(`${SECTION}.details_context_data`), type: 'text' },
    { key: 'first_seen_at', displayName: i18n.getValue(`${SECTION}.details_first_seen`), type: 'date', format: 'medium' },
    { key: 'last_seen_at', displayName: i18n.getValue(`${SECTION}.details_last_seen`), type: 'date', format: 'medium' },
  ];
}

/**
 * @description `{value,label}` pairs of the triage modal select of the component - the same
 * `STATUS_VALUES` / `STATUS_LABEL_KEYS` pair as FORM_FIELDS / FILTER_COLUMNS.
 */
export function createStatusOptions(i18n: AdminLocalizationService) {
  return mapLabeledOptions(SECTION, STATUS_VALUES, STATUS_LABEL_KEYS, i18n);
}

/**
 * @description One explanation of an `event_type` - "what happened" and "what we recommend" are
 * TEMPLATES with placeholders (`{route}`, `{ip}`, `{email}`, `{user_id}`, `{occurrences}`) that
 * `buildEventExplanation()` replaces with the data of the record. The placeholders STAY
 * literally in the translated text - runtime substitution, not i18n variables.
 */
interface EventTypeInfo {
  label: string;
  whatHappened: string;
  recommendation: string;
}

/**
 * @description Builds the `EVENT_TYPE_INFO` map from the `event-explanations` i18n keys - one
 * item per `event_type`, plus a fallback for an unknown type.
 */
export function createEventTypeInfo(i18n: AdminLocalizationService): Record<string, EventTypeInfo> {
  const result: Record<string, EventTypeInfo> = {};
  for (const type of EVENT_TYPE_VALUES) {
    result[type] = {
      label: i18n.getValue(`${SECTION}.${EVENT_TYPE_LABEL_KEYS[type]}`),
      whatHappened: i18n.getValue(`${SECTION}.explain_${type}_what`),
      recommendation: i18n.getValue(`${SECTION}.explain_${type}_recommendation`),
    };
  }
  return result;
}

/** @description Fallback for an event type without its own explanation yet. */
export function createFallbackEventInfo(i18n: AdminLocalizationService): EventTypeInfo {
  return {
    label: i18n.getValue(`${SECTION}.explain_fallback_label`),
    whatHappened: i18n.getValue(`${SECTION}.explain_fallback_what`),
    recommendation: i18n.getValue(`${SECTION}.explain_fallback_recommendation`),
  };
}

/**
 * @description Builds the explanation of a specific record - fills the real data (IP, route,
 * e-mail, user ID, occurrence count) into the template. The e-mail is read from
 * `context_data.email` (stored only by `AuthController` for login events, missing for other
 * types - the `{email}` placeholder is then replaced by a generic text).
 * @param item Row of `core_security_events` (shape of `CoreSecurityEventResource`).
 * @param i18n Needed for building the event-type-info map and the fallback text.
 */
export function buildEventExplanation(item: any, i18n: AdminLocalizationService): EventTypeInfo {
  const eventTypeInfo = createEventTypeInfo(i18n);
  const info = eventTypeInfo[item?.event_type] ?? createFallbackEventInfo(i18n);
  const email = item?.context_data?.email ?? i18n.getValue(`${SECTION}.explain_unknown_account`);
  const replacements: Record<string, string> = {
    '{route}': item?.route ?? i18n.getValue(`${SECTION}.explain_unknown_endpoint`),
    '{ip}': item?.ip_address ?? i18n.getValue(`${SECTION}.explain_unknown_ip`),
    '{email}': email,
    '{user_id}': item?.user_id != null ? String(item.user_id) : i18n.getValue(`${SECTION}.explain_unknown`),
    '{occurrences}': item?.occurrences != null ? String(item.occurrences) : '?',
  };

  const fill = (template: string): string =>
    Object.entries(replacements).reduce((text, [key, value]) => text.split(key).join(value), template);

  return {
    label: info.label,
    whatHappened: fill(info.whatHappened),
    recommendation: fill(info.recommendation),
  };
}