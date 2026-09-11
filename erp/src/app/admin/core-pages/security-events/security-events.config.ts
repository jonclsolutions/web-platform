/**
 * @file security-events.config.ts
 * @path src/app/admin/core-pages/security-events/security-events.config.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Statická-teď-dynamická konfigurace (tlačítka, sloupce tabulky/filtrů/
 * detailů, vysvětlující texty) pro stránku bezpečnostního monitoringu
 * (core_security_events).
 *
 * (Earlier refactor-note 2026-08-22 - EVENT_TYPE_INFO / buildEventExplanation() -
 * a bugfix-note 2026-09-07 pro openGraphBuilder permission jsou nahrazeny/rozšířeny
 * touhle verzí, viz níže.)
 *
 * @refactor-note (2026-09-08) BACKLOG "vícejazyčná administrace, žádné hardcoded
 * texty": kompletní přepis na FACTORY FUNKCE. Žádná SQL migrace - `event_type`/
 * `severity`/`status` jsou už anglické slugy. `status` hodnoty byly dřív DUPLICITNĚ
 * definované na třech místech (FORM_FIELDS, FILTER_COLUMNS, komponenta's
 * `statusOptions` pro triage modal) - sjednoceno do jedné `STATUS_VALUES`/
 * `STATUS_LABEL_KEYS` dvojice, ze které si všechna tři místa berou stejná data přes
 * `createStatusOptions(i18n)`.
 *
 * `EVENT_TYPE_INFO` (šablonované "co se stalo"/"doporučujeme" texty s placeholdery
 * `{route}`/`{ip}`/`{email}`/`{user_id}`/`{occurrences}`) přepsáno na
 * `createEventTypeInfo(i18n)` factory funkci - placeholdery ZŮSTÁVAJÍ doslovně
 * v přeloženém textu (nejsou to i18n proměnné, `buildEventExplanation()` je
 * nahrazuje AŽ za běhu konkrétními daty záznamu, stejně jako dřív).
 * `buildEventExplanation()` teď vyžaduje `i18n` parametr navíc.
 *
 * @bugfix-note (2026-09-08) `openGraphBuilder` permission (`web-user-requests-view`
 * -> `core-security-view`) byla opravena už v předchozí verzi - zachováno.
 */
import * as Core from '../../../shared/imports/core-providers';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';

const SECTION = 'security-events';

export const EVENT_TYPE_VALUES: string[] = [
  'captcha_failed', 'captcha_provider_error', 'throttle_exceeded', 'login_failed',
  'login_brute_force_suspected', 'login_2fa_invalid', 'login_2fa_exhausted',
  'login_2fa_resend_exhausted', 'refresh_token_invalid', 'scan_probe',
];

export const SEVERITY_VALUES: string[] = ['info', 'warning', 'critical'];

/** @description Sdíleno mezi FORM_FIELDS/FILTER_COLUMNS a `SecurityEventsComponent`'s triage modal select. */
export const STATUS_VALUES: string[] = ['new', 'reviewed', 'false_positive', 'confirmed_attack'];

const EVENT_TYPE_LABEL_KEYS: Record<string, string> = {
  captcha_failed: 'event_captcha_failed',
  captcha_provider_error: 'event_captcha_provider_error',
  throttle_exceeded: 'event_throttle_exceeded',
  login_failed: 'event_login_failed',
  login_brute_force_suspected: 'event_login_brute_force_suspected',
  login_2fa_invalid: 'event_login_2fa_invalid',
  login_2fa_exhausted: 'event_login_2fa_exhausted',
  login_2fa_resend_exhausted: 'event_login_2fa_resend_exhausted',
  refresh_token_invalid: 'event_refresh_token_invalid',
  scan_probe: 'event_scan_probe',
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

function mapLabeledOptions(values: string[], labelKeys: Record<string, string>, i18n: AdminLocalizationService) {
  return values.map(v => ({ value: v, label: i18n.getValue(`${SECTION}.${labelKeys[v]}`) }));
}

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
 * @description Mapování technických hodnot na přeložený text pro sloupce
 * `event_type`/`severity`/`status` v tabulce i exportu - `TableBuilderComponent`
 * tohle mapování aplikuje automaticky podle `column_name`.
 */
export function createFormFields(i18n: AdminLocalizationService): Core.InputDefinition[] {
  return [
    { column_name: 'event_type', type: 'select', options: mapLabeledOptions(EVENT_TYPE_VALUES, EVENT_TYPE_LABEL_KEYS, i18n) } as unknown as Core.InputDefinition,
    { column_name: 'severity', type: 'select', options: mapLabeledOptions(SEVERITY_VALUES, SEVERITY_LABEL_KEYS, i18n) } as unknown as Core.InputDefinition,
    { column_name: 'status', type: 'select', options: mapLabeledOptions(STATUS_VALUES, STATUS_LABEL_KEYS, i18n) } as unknown as Core.InputDefinition,
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
    { key: 'event_type', header: i18n.getValue(`${SECTION}.col_event_type`), type: 'select', options: mapLabeledOptions(EVENT_TYPE_VALUES, EVENT_TYPE_LABEL_KEYS, i18n), placeholder: i18n.getValue(`${SECTION}.filter_event_type_placeholder`), canSort: true },
    { key: 'severity', header: i18n.getValue(`${SECTION}.col_severity`), type: 'select', options: mapLabeledOptions(SEVERITY_VALUES, SEVERITY_LABEL_KEYS, i18n), placeholder: i18n.getValue(`${SECTION}.filter_severity_placeholder`), canSort: true },
    { key: 'status', header: i18n.getValue(`${SECTION}.col_status`), type: 'select', options: mapLabeledOptions(STATUS_VALUES, STATUS_LABEL_KEYS, i18n), placeholder: i18n.getValue(`${SECTION}.filter_status_placeholder`), canSort: true },
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
 * @description `{value,label}` páry pro triage modal select v komponentě (dřív
 * hardcoded `readonly statusOptions` pole) - stejná `STATUS_VALUES`/`STATUS_LABEL_KEYS`
 * dvojice jako FORM_FIELDS/FILTER_COLUMNS.
 */
export function createStatusOptions(i18n: AdminLocalizationService) {
  return mapLabeledOptions(STATUS_VALUES, STATUS_LABEL_KEYS, i18n);
}

/**
 * @description Jedno vysvětlení pro daný `event_type` - "co se stalo" a "co
 * doporučujeme" jsou ŠABLONY s placeholdery (`{route}`, `{ip}`, `{email}`,
 * `{user_id}`, `{occurrences}`), které `buildEventExplanation()` nahradí konkrétními
 * daty daného záznamu. Placeholdery ZŮSTÁVAJÍ doslovně v přeloženém textu - nejsou to
 * i18n proměnné, ale runtime substituce.
 */
interface EventTypeInfo {
  label: string;
  whatHappened: string;
  recommendation: string;
}

/**
 * @description Sestaví `EVENT_TYPE_INFO` mapu ze `event-explanations` i18n klíčů -
 * jedna položka na `event_type`, plus fallback pro neznámý typ.
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

/** @description Fallback pro typ eventu, který zatím nemá vlastní vysvětlení. */
export function createFallbackEventInfo(i18n: AdminLocalizationService): EventTypeInfo {
  return {
    label: i18n.getValue(`${SECTION}.explain_fallback_label`),
    whatHappened: i18n.getValue(`${SECTION}.explain_fallback_what`),
    recommendation: i18n.getValue(`${SECTION}.explain_fallback_recommendation`),
  };
}

/**
 * @description Sestaví konkrétní vysvětlení pro daný záznam - dosadí skutečná data
 * (IP, route, e-mail, ID uživatele, počet výskytů) do šablony. E-mail se čte z
 * `context_data.email` (ukládá ho jen `AuthController` u login eventů, u ostatních
 * typů chybí - placeholder `{email}` se pak nahradí obecným textem).
 * @param item Řádek `core_security_events` (tvar `CoreSecurityEventResource`).
 * @param i18n Potřebný pro sestavení event-type-info mapy a fallback textu -
 *   viz refactor-note (2026-09-08) v hlavičce souboru.
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