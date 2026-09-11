/**
 * @file payment-methods.config.ts
 * @path src/app/admin/shop-pages/payment-methods/payment-methods.config.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Static-turned-dynamic configuration for shop payment method management.
 *
 * (Earlier bugfix-note 2026-09-07 for shop permissions granularization is unchanged
 * - see version history. `PAYMENT_TOOLBAR_BUTTONS` NEMÁ "Přidat záznam" - platební
 * metody vznikají výhradně seedem/migrací, admin je jen edituje.)
 *
 * @refactor-note (2026-09-09) BACKLOG "vícejazyčná administrace, žádné hardcoded texty":
 * kompletní přepis na FACTORY FUNKCE. Žádná SQL migrace potřeba:
 * - `variable_symbol_type` (`order_number`/`phone_number`/`none`) - už anglické slugy.
 * - `provider` (`manual`/`stripe`/`paypal`) - už anglické slugy, jen READ-ONLY (v
 *   `filterColumns`/`detailsColumns`, ne ve `formFields` - sloupec se needituje).
 * - `is_active` - boolean-jako-select, řešeno přes centrální `shared.yes`/`shared.no`.
 */
import * as Core from '../../../shared/imports/core-providers';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';

const SECTION = 'shop-payment-methods';

export const VARIABLE_SYMBOL_TYPE_VALUES: string[] = ['order_number', 'phone_number', 'none'];
export const PROVIDER_VALUES: string[] = ['manual', 'stripe', 'paypal'];

const VARIABLE_SYMBOL_TYPE_LABEL_KEYS: Record<string, string> = {
  order_number: 'vs_type_order_number',
  phone_number: 'vs_type_phone_number',
  none: 'vs_type_none',
};

const PROVIDER_LABEL_KEYS: Record<string, string> = {
  manual: 'provider_manual',
  stripe: 'provider_stripe',
  paypal: 'provider_paypal',
};

function mapLabeledOptions(values: string[], labelKeys: Record<string, string>, i18n: AdminLocalizationService) {
  return values.map(v => ({ value: v, label: i18n.getValue(`${SECTION}.${labelKeys[v]}`) }));
}

function yesNoOptions(i18n: AdminLocalizationService) {
  return [
    { value: '1', label: i18n.getValue('shared.yes') },
    { value: '0', label: i18n.getValue('shared.no') },
  ];
}

export function createPaymentButtons(i18n: AdminLocalizationService): Core.TableButtons[] {
  return [
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_details`), isActive: true, type: 'info_button', action: 'details', icon: 'search' },
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_edit`), isActive: true, type: 'neutral_button', action: 'edit', permission: 'shop-payment-methods-update', icon: 'edit' },
  ];
}

export function createPaymentToolbarButtons(i18n: AdminLocalizationService): Core.Button[] {
  return [
    { action: 'toggleFilters', label: i18n.getValue(`${SECTION}.toolbar_filters`), icon: '', class: 'btn-filter', isActive: false },
    { action: 'openGraphBuilder', label: i18n.getValue(`${SECTION}.toolbar_generate_reports`), icon: '', class: 'btn-neutral', showIf: true, permission: 'shop-view-reports' },
    { action: 'exportActiveTable', label: i18n.getValue(`${SECTION}.toolbar_export_data`), icon: '', class: 'btn-export', showIf: true },
  ];
}

/**
 * @description VŠECHNA pole `show_in_create: false` - platební metody vznikají
 * výhradně seedem/migrací, admin je jen edituje (žádné "Přidat" tlačítko/handler
 * v komponentě) - viz hlavička souboru.
 */
export function createPaymentFormFields(i18n: AdminLocalizationService): Core.InputDefinition[] {
  return [
    {
      column_name: 'name',
      label: i18n.getValue(`${SECTION}.field_name_label`),
      placeholder: i18n.getValue(`${SECTION}.field_name_placeholder`),
      type: 'text',
      required: true,
      editable: true, show_in_edit: true, show_in_create: false,
    },
    {
      column_name: 'price',
      label: i18n.getValue(`${SECTION}.field_price_label`),
      type: 'number',
      required: true,
      editable: true, show_in_edit: true, show_in_create: false,
    },
    {
      column_name: 'bank_account_number',
      label: i18n.getValue(`${SECTION}.field_bank_account_number_label`),
      placeholder: '123456789',
      type: 'text',
      required: false,
      editable: true, show_in_edit: true, show_in_create: false,
    },
    {
      column_name: 'bank_account_code',
      label: i18n.getValue(`${SECTION}.field_bank_account_code_label`),
      placeholder: '0100',
      type: 'text',
      required: false,
      editable: true, show_in_edit: true, show_in_create: false,
    },
    {
      column_name: 'variable_symbol_type',
      label: i18n.getValue(`${SECTION}.field_variable_symbol_type_label`),
      type: 'select',
      options: mapLabeledOptions(VARIABLE_SYMBOL_TYPE_VALUES, VARIABLE_SYMBOL_TYPE_LABEL_KEYS, i18n),
      required: true,
      editable: true, show_in_edit: true, show_in_create: false,
    },
    {
      column_name: 'sort_order',
      label: i18n.getValue(`${SECTION}.field_sort_order_label`),
      type: 'number',
      required: false,
      editable: true, show_in_edit: true, show_in_create: false,
    },
    {
      column_name: 'is_active',
      label: i18n.getValue(`${SECTION}.field_is_active_label`),
      type: 'select',
      options: yesNoOptions(i18n),
      required: true,
      editable: true, show_in_edit: true, show_in_create: false,
    },
    {
      column_name: 'config',
      label: i18n.getValue(`${SECTION}.field_config_label`),
      placeholder: '{"sandbox_public_key": "...", "production_secret": "..."}',
      type: 'textarea',
      required: false,
      editable: true, show_in_edit: true, show_in_create: false,
    },
    {
      column_name: 'description',
      label: i18n.getValue(`${SECTION}.field_description_label`),
      type: 'textarea',
      required: false,
      editable: true, show_in_edit: true, show_in_create: false,
    },
  ];
}

export function createPaymentColumns(i18n: AdminLocalizationService): Core.ColumnDefinition[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text' },
    { key: 'name', header: i18n.getValue(`${SECTION}.col_name`), type: 'text' },
    { key: 'code', header: i18n.getValue(`${SECTION}.col_code`), type: 'text' },
    { key: 'provider', header: i18n.getValue(`${SECTION}.col_provider`), type: 'text' },
    { key: 'price', header: i18n.getValue(`${SECTION}.col_price`), type: 'currency' },
    { key: 'sort_order', header: i18n.getValue(`${SECTION}.field_sort_order_label`), type: 'text' },
    { key: 'is_active', header: i18n.getValue(`${SECTION}.field_is_active_label`), type: 'boolean' },
  ];
}

export function createPaymentFilterColumns(i18n: AdminLocalizationService): Core.FilterColumns[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_id_placeholder`), canSort: true },
    { key: 'name', header: i18n.getValue(`${SECTION}.col_name`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_name_placeholder`), canSort: true },
    { key: 'provider', header: i18n.getValue(`${SECTION}.col_provider`), type: 'select', options: mapLabeledOptions(PROVIDER_VALUES, PROVIDER_LABEL_KEYS, i18n), placeholder: i18n.getValue(`${SECTION}.filter_provider_placeholder`), canSort: true },
  ];
}

export function createPaymentDetailsColumns(i18n: AdminLocalizationService): Core.ItemDetailsColumns[] {
  return [
    { key: 'id', displayName: i18n.getValue(`${SECTION}.details_id`), type: 'text' },
    { key: 'name', displayName: i18n.getValue(`${SECTION}.field_name_label`), type: 'text' },
    { key: 'code', displayName: i18n.getValue(`${SECTION}.col_code`), type: 'text' },
    { key: 'price', displayName: i18n.getValue(`${SECTION}.col_price`), type: 'currency' },
    { key: 'provider', displayName: i18n.getValue(`${SECTION}.col_provider`), type: 'text', chartable: true, chartPossibleValues: PROVIDER_VALUES },
    { key: 'bank_account_number', displayName: i18n.getValue(`${SECTION}.field_bank_account_number_label`), type: 'text' },
    { key: 'bank_account_code', displayName: i18n.getValue(`${SECTION}.field_bank_account_code_label`), type: 'text' },
    {
      key: 'variable_symbol_type', displayName: i18n.getValue(`${SECTION}.details_vs_type`), type: 'text',
      chartable: true, chartPossibleValues: VARIABLE_SYMBOL_TYPE_VALUES,
    },
    { key: 'is_active', displayName: i18n.getValue(`${SECTION}.field_is_active_label`), type: 'boolean', chartable: true, chartPossibleValues: ['1', '0'] },
    { key: 'sort_order', displayName: i18n.getValue(`${SECTION}.field_sort_order_label`), type: 'text' },
    { key: 'config', displayName: i18n.getValue(`${SECTION}.details_config`), type: 'text' },
    { key: 'description', displayName: i18n.getValue(`${SECTION}.field_description_label`), type: 'text' },
    { key: 'created_at', displayName: i18n.getValue(`${SECTION}.details_created`), type: 'date', format: 'medium' },
  ];
}