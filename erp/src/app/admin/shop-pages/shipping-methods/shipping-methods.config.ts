/**
 * @file shipping-methods.config.ts
 * @path src/app/admin/shop-pages/shipping-methods/shipping-methods.config.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Static-turned-dynamic configuration for shop shipping method management.
 *
 * (Earlier bugfix-note 2026-09-07 for shop permissions granularization is unchanged
 * - see version history.)
 *
 * @refactor-note (2026-09-09) BACKLOG "vícejazyčná administrace, žádné hardcoded texty":
 * kompletní přepis na FACTORY FUNKCE. `shipping_type` je enum se třemi hodnotami
 * (`address`/`pickup_point`/`store`) - už anglické slugy, matchují backendový
 * `shipping_type` sloupec 1:1, žádná SQL migrace potřeba. `allows_cod`/
 * `requires_pickup_point`/`is_active` jsou boolean-jako-select, řešeny přes
 * centrální `shared.yes`/`shared.no` - stejný mechanismus jako `shop-suppliers`/
 * `shop-customers`.
 */
import * as Core from '../../../shared/imports/core-providers';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';

const SECTION = 'shop-shipping-methods';

export const SHIPPING_TYPE_VALUES: string[] = ['address', 'pickup_point', 'store'];

const SHIPPING_TYPE_LABEL_KEYS: Record<string, string> = {
  address: 'shipping_type_address',
  pickup_point: 'shipping_type_pickup_point',
  store: 'shipping_type_store',
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

export function createShippingButtons(i18n: AdminLocalizationService): Core.TableButtons[] {
  return [
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_details`), isActive: true, type: 'info_button', action: 'details', icon: 'search' },
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_edit`), isActive: true, type: 'neutral_button', action: 'edit', permission: 'shop-shipping-methods-update', icon: 'edit' },
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_delete`), isActive: true, type: 'delete_button', action: 'delete', permission: 'shop-shipping-methods-delete', icon: 'delete' },
  ];
}

export function createShippingToolbarButtons(i18n: AdminLocalizationService): Core.Button[] {
  return [
    { action: 'toggleFilters', label: i18n.getValue(`${SECTION}.toolbar_filters`), icon: '', class: 'btn-filter', isActive: false },
    { action: 'handleCreateFormOpened', label: i18n.getValue(`${SECTION}.toolbar_create_record`), icon: '', class: 'btn-create', showIf: true, permission: 'shop-shipping-methods-create' },
    { action: 'exportActiveTable', label: i18n.getValue(`${SECTION}.toolbar_export_data`), icon: '', class: 'btn-export', showIf: true },
    { action: 'triggerImport', label: i18n.getValue(`${SECTION}.toolbar_import_data`), icon: '', class: 'btn-neutral', showIf: true, permission: 'shop-shipping-methods-create' },
    { action: 'openGraphBuilder', label: i18n.getValue(`${SECTION}.toolbar_generate_reports`), icon: '', class: 'btn-neutral', showIf: true, permission: 'shop-view-reports' },
    { action: 'toggleTable', label: i18n.getValue(`${SECTION}.toolbar_show_trash`), icon: '', class: 'btn-trash', permission: 'view-deleted' },
  ];
}

export function createShippingFormFields(i18n: AdminLocalizationService): Core.InputDefinition[] {
  return [
    {
      column_name: 'code',
      label: i18n.getValue(`${SECTION}.field_code_label`),
      placeholder: i18n.getValue(`${SECTION}.field_code_placeholder`),
      type: 'text',
      required: true,
      pattern: '^[a-z0-9_-]{3,50}$',
      errorMessage: i18n.getValue(`${SECTION}.field_code_error`),
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'name',
      label: i18n.getValue(`${SECTION}.field_name_label`),
      placeholder: i18n.getValue(`${SECTION}.field_name_placeholder`),
      type: 'text',
      required: true,
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'shipping_type',
      label: i18n.getValue(`${SECTION}.field_shipping_type_label`),
      type: 'select',
      options: mapLabeledOptions(SHIPPING_TYPE_VALUES, SHIPPING_TYPE_LABEL_KEYS, i18n),
      required: true,
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'base_price',
      label: i18n.getValue(`${SECTION}.field_base_price_label`),
      type: 'number',
      required: true,
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'allows_cod',
      label: i18n.getValue(`${SECTION}.field_allows_cod_label`),
      type: 'select',
      options: yesNoOptions(i18n),
      required: true,
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'cod_price',
      label: i18n.getValue(`${SECTION}.field_cod_price_label`),
      placeholder: '0',
      type: 'number',
      required: false,
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'free_shipping_threshold',
      label: i18n.getValue(`${SECTION}.field_free_shipping_threshold_label`),
      placeholder: i18n.getValue(`${SECTION}.field_free_shipping_threshold_placeholder`),
      type: 'number',
      required: false,
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'max_weight',
      label: i18n.getValue(`${SECTION}.field_max_weight_label`),
      type: 'number',
      required: false,
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'requires_pickup_point',
      label: i18n.getValue(`${SECTION}.field_requires_pickup_point_label`),
      type: 'select',
      options: [
        { value: '1', label: i18n.getValue(`${SECTION}.requires_pickup_point_yes`) },
        { value: '0', label: i18n.getValue('shared.no') },
      ],
      required: true,
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'delivery_days_min',
      label: i18n.getValue(`${SECTION}.field_delivery_days_min_label`),
      type: 'number',
      required: false,
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'delivery_days_max',
      label: i18n.getValue(`${SECTION}.field_delivery_days_max_label`),
      type: 'number',
      required: false,
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'tracking_url',
      label: i18n.getValue(`${SECTION}.field_tracking_url_label`),
      placeholder: 'https://.../track?id={T}',
      type: 'text',
      required: false,
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'sort_order',
      label: i18n.getValue(`${SECTION}.field_sort_order_label`),
      type: 'number',
      required: true,
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'is_active',
      label: i18n.getValue(`${SECTION}.field_is_active_label`),
      type: 'select',
      options: yesNoOptions(i18n),
      required: true,
      editable: true, show_in_edit: true, show_in_create: true,
    },
    {
      column_name: 'description',
      label: i18n.getValue(`${SECTION}.field_description_label`),
      type: 'textarea',
      required: false,
      editable: true, show_in_edit: true, show_in_create: true,
    },
  ];
}

export function createShippingColumns(i18n: AdminLocalizationService): Core.ColumnDefinition[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text' },
    { key: 'name', header: i18n.getValue(`${SECTION}.col_name`), type: 'text' },
    { key: 'shipping_type', header: i18n.getValue(`${SECTION}.col_type`), type: 'text' },
    { key: 'base_price', header: i18n.getValue(`${SECTION}.col_price`), type: 'text' },
    { key: 'is_active', header: i18n.getValue(`${SECTION}.field_is_active_label`), type: 'boolean' },
    { key: 'sort_order', header: i18n.getValue(`${SECTION}.field_sort_order_label`), type: 'text' },
  ];
}

export function createShippingTrashColumns(i18n: AdminLocalizationService): Core.ColumnDefinition[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text' },
    { key: 'name', header: i18n.getValue(`${SECTION}.col_name`), type: 'text' },
    { key: 'deleted_at', header: i18n.getValue(`${SECTION}.col_deleted`), type: 'date', format: 'short' },
  ];
}

export function createShippingFilterColumns(i18n: AdminLocalizationService): Core.FilterColumns[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_id_placeholder`), canSort: true },
    { key: 'name', header: i18n.getValue(`${SECTION}.col_name`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_name_placeholder`), canSort: true },
    { key: 'shipping_type', header: i18n.getValue(`${SECTION}.col_type`), type: 'select', options: mapLabeledOptions(SHIPPING_TYPE_VALUES, SHIPPING_TYPE_LABEL_KEYS, i18n), placeholder: i18n.getValue(`${SECTION}.filter_type_placeholder`), canSort: true },
  ];
}

export function createShippingDetailsColumns(i18n: AdminLocalizationService): Core.ItemDetailsColumns[] {
  return [
    { key: 'id', displayName: i18n.getValue(`${SECTION}.details_id`), type: 'text' },
    { key: 'code', displayName: i18n.getValue(`${SECTION}.details_code`), type: 'text', importable: true },
    { key: 'name', displayName: i18n.getValue(`${SECTION}.field_name_label`), type: 'text', importable: true },
    { key: 'description', displayName: i18n.getValue(`${SECTION}.field_description_label`), type: 'text', importable: true },
    { key: 'shipping_type', displayName: i18n.getValue(`${SECTION}.field_shipping_type_label`), type: 'text', importable: true, chartable: true, chartPossibleValues: SHIPPING_TYPE_VALUES },
    { key: 'base_price', displayName: i18n.getValue(`${SECTION}.details_base_price`), type: 'text', importable: true },
    { key: 'allows_cod', displayName: i18n.getValue(`${SECTION}.details_allows_cod`), type: 'boolean', importable: true, chartable: true, chartPossibleValues: ['1', '0'] },
    { key: 'cod_price', displayName: i18n.getValue(`${SECTION}.details_cod_price`), type: 'text', importable: true },
    { key: 'free_shipping_threshold', displayName: i18n.getValue(`${SECTION}.details_free_from`), type: 'text', importable: true },
    { key: 'max_weight', displayName: i18n.getValue(`${SECTION}.field_max_weight_label`), type: 'text', importable: true },
    { key: 'requires_pickup_point', displayName: i18n.getValue(`${SECTION}.details_requires_pickup`), type: 'boolean', importable: true, chartable: true, chartPossibleValues: ['1', '0'] },
    { key: 'delivery_days_min', displayName: i18n.getValue(`${SECTION}.details_min_days`), type: 'text', importable: true },
    { key: 'delivery_days_max', displayName: i18n.getValue(`${SECTION}.details_max_days`), type: 'text', importable: true },
    { key: 'tracking_url', displayName: i18n.getValue(`${SECTION}.details_tracking_url`), type: 'text', importable: true },
    { key: 'is_active', displayName: i18n.getValue(`${SECTION}.field_is_active_label`), type: 'boolean', importable: true, chartable: true, chartPossibleValues: ['1', '0'] },
    { key: 'created_at', displayName: i18n.getValue(`${SECTION}.details_created`), type: 'date', format: 'medium', importable: true },
  ];
}