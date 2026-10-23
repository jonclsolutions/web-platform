/**
 * @file coupons.config.ts
 * @path src/app/admin/shop-pages/coupons/coupons.config.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description i18n-aware configuration (buttons, form fields, table / filter / detail columns)
 *   of the shop coupons page. Every text comes from the admin translation section `shop-coupons`.
 *
 * @bugfix-note (2026-09-07) BACKLOG "granularizace shop permissions": nahrazeno
 * nesouvisející `shop-view-reports` (a chybějící permission na Edit/Smazat/Přidat/
 * Import) NOVOU dedikovanou sadou `shop-coupons-view/-create/-update/-delete` -
 * viz migrace 002_shop_permissions_granularization.sql a api.php stejné datum.
 * `openGraphBuilder` zůstává na `shop-view-reports` (grafy/reporty jsou napříč
 * celým e-shopem sdílená permission, ne resource-specific).
 * @refactor-note (2026-10-23) The page was not localized (open finding #16): the static
 *   `COUPON_*` constants with hardcoded Czech texts were replaced by `create*()` factory functions
 *   (same pattern as the other shop pages). The values (`percent` / `fixed`, `all` / `products` /
 *   `categories`, `1` / `0`) are unchanged; the filter now shows translated labels instead of the
 *   raw slugs, and the fixed discount says EUR instead of "Kč" (the shop currency is EUR).
 * @dependencies
 * - AdminLocalizationService: translated texts (`shop-coupons.*`, `shared.yes` / `shared.no`).
 */
import * as Core from '../../../shared/imports/core-providers';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';

const SECTION = 'shop-coupons';

/** @description Discount types stored by the API (`shop_coupons.discount_type`). */
export const DISCOUNT_TYPE_VALUES: string[] = ['percent', 'fixed'];

/** @description Scopes stored by the API (`shop_coupons.applies_to`). */
export const APPLIES_TO_VALUES: string[] = ['all', 'products', 'categories'];

/**
 * @description Shortcut for a text of the `shop-coupons` section.
 * @param i18n Admin localization service.
 * @param key Key inside the section.
 * @returns Translated text.
 */
function tr(i18n: AdminLocalizationService, key: string): string {
  return i18n.getValue(`${SECTION}.${key}`);
}

/**
 * @description Maps stored values to select options with translated labels (`<prefix>_<value>`).
 * @param values Stored values.
 * @param prefix Key prefix in the section.
 * @param i18n Admin localization service.
 * @returns Options `{ value, label }`.
 */
function labeledOptions(values: string[], prefix: string, i18n: AdminLocalizationService): { value: string; label: string }[] {
  return values.map(v => ({ value: v, label: tr(i18n, `${prefix}_${v}`) }));
}

/**
 * @description Row buttons of the coupons table.
 * @param i18n Admin localization service.
 * @returns Details / edit / delete buttons (edit and delete permission-gated).
 */
export function createCouponButtons(i18n: AdminLocalizationService): Core.TableButtons[] {
  return [
    { display_name: '', header_name: tr(i18n, 'btn_details'), isActive: true, type: 'info_button', action: 'details', icon: 'search' },
    { display_name: '', header_name: tr(i18n, 'btn_edit'), isActive: true, type: 'neutral_button', action: 'edit', permission: 'shop-coupons-update', icon: 'edit' },
    { display_name: '', header_name: tr(i18n, 'btn_delete'), isActive: true, type: 'delete_button', action: 'delete', permission: 'shop-coupons-delete', icon: 'delete' },
  ];
}

/**
 * @description Toolbar actions of the coupons page.
 * @param i18n Admin localization service.
 * @returns Filters, create, export, import, reports and trash actions.
 */
export function createCouponToolbarButtons(i18n: AdminLocalizationService): Core.Button[] {
  return [
    { action: 'toggleFilters', label: tr(i18n, 'toolbar_filters'), icon: '', class: 'btn-filter', isActive: false },
    { action: 'handleCreateFormOpened', label: tr(i18n, 'toolbar_add_record'), icon: '', class: 'btn-create', showIf: true, permission: 'shop-coupons-create' },
    { action: 'exportActiveTable', label: tr(i18n, 'toolbar_export_data'), icon: '', class: 'btn-export', showIf: true },
    { action: 'triggerImport', label: tr(i18n, 'toolbar_import_data'), icon: '', class: 'btn-neutral', showIf: true, permission: 'shop-coupons-create' },
    { action: 'openGraphBuilder', label: tr(i18n, 'toolbar_generate_reports'), icon: '', class: 'btn-neutral', showIf: true, permission: 'shop-view-reports' },
    { action: 'toggleTable', label: tr(i18n, 'toolbar_show_trash'), icon: '', class: 'btn-trash', permission: 'view-deleted' },
  ];
}

/**
 * @description Create / edit form of a coupon.
 * @param i18n Admin localization service.
 * @returns Form field definitions.
 */
export function createCouponFormFields(i18n: AdminLocalizationService): Core.InputDefinition[] {
  const editable = { editable: true, show_in_edit: true, show_in_create: true };
  return [
    {
      column_name: 'code', label: tr(i18n, 'field_code_label'), placeholder: tr(i18n, 'field_code_placeholder'),
      type: 'text', required: true, pattern: '^[a-zA-Z0-9_-]{3,50}$', errorMessage: tr(i18n, 'field_code_error'), ...editable,
    },
    {
      column_name: 'discount_type', label: tr(i18n, 'field_discount_type_label'), type: 'select',
      options: labeledOptions(DISCOUNT_TYPE_VALUES, 'discount_type', i18n), required: true, ...editable,
    },
    {
      column_name: 'discount_value', label: tr(i18n, 'field_discount_value_label'),
      placeholder: tr(i18n, 'field_discount_value_placeholder'), type: 'number', required: true, ...editable,
    },
    { column_name: 'min_order_amount', label: tr(i18n, 'field_min_order_amount_label'), placeholder: '0', type: 'number', required: false, ...editable },
    {
      column_name: 'max_usage', label: tr(i18n, 'field_max_usage_label'), placeholder: tr(i18n, 'field_max_usage_placeholder'),
      type: 'number', required: false, ...editable,
    },
    {
      column_name: 'applies_to', label: tr(i18n, 'field_applies_to_label'), type: 'select',
      options: labeledOptions(APPLIES_TO_VALUES, 'applies_to', i18n), required: true, ...editable,
    },
    { column_name: 'valid_from', label: tr(i18n, 'field_valid_from_label'), type: 'date', required: false, ...editable },
    { column_name: 'valid_until', label: tr(i18n, 'field_valid_until_label'), type: 'date', required: false, ...editable },
    {
      column_name: 'is_active', label: tr(i18n, 'field_is_active_label'), type: 'select',
      options: [{ value: '1', label: i18n.getValue('shared.yes') }, { value: '0', label: i18n.getValue('shared.no') }],
      required: true, ...editable,
    },
    {
      column_name: 'description', label: tr(i18n, 'field_description_label'), placeholder: tr(i18n, 'field_description_placeholder'),
      type: 'textarea', required: false, ...editable,
    },
  ];
}

/**
 * @description Columns of the active coupons table.
 * @param i18n Admin localization service.
 * @returns Column definitions.
 */
export function createCouponColumns(i18n: AdminLocalizationService): Core.ColumnDefinition[] {
  return [
    { key: 'id', header: tr(i18n, 'col_id'), type: 'text' },
    { key: 'code', header: tr(i18n, 'col_code'), type: 'text' },
    { key: 'discount_type', header: tr(i18n, 'col_type'), type: 'text' },
    { key: 'discount_value', header: tr(i18n, 'col_discount'), type: 'text' },
    { key: 'usage_count', header: tr(i18n, 'col_usage_count'), type: 'text' },
    { key: 'is_active', header: tr(i18n, 'col_is_active'), type: 'boolean' },
    { key: 'valid_until', header: tr(i18n, 'col_valid_until'), type: 'date', format: 'short' },
  ];
}

/**
 * @description Columns of the coupons trash table.
 * @param i18n Admin localization service.
 * @returns Column definitions.
 */
export function createCouponTrashColumns(i18n: AdminLocalizationService): Core.ColumnDefinition[] {
  return [
    { key: 'id', header: tr(i18n, 'col_id'), type: 'text' },
    { key: 'code', header: tr(i18n, 'col_code'), type: 'text' },
    { key: 'deleted_at', header: tr(i18n, 'col_deleted_at'), type: 'date', format: 'short' },
  ];
}

/**
 * @description Filter panel of the coupons page.
 * @param i18n Admin localization service.
 * @returns Filter definitions (discount type with translated labels).
 */
export function createCouponFilterColumns(i18n: AdminLocalizationService): Core.FilterColumns[] {
  return [
    { key: 'id', header: tr(i18n, 'col_id'), type: 'text', placeholder: tr(i18n, 'filter_id_placeholder'), canSort: true },
    { key: 'code', header: tr(i18n, 'col_code'), type: 'text', placeholder: tr(i18n, 'filter_code_placeholder'), canSort: true },
    {
      key: 'discount_type', header: tr(i18n, 'col_type'), type: 'select',
      options: labeledOptions(DISCOUNT_TYPE_VALUES, 'discount_type', i18n), placeholder: tr(i18n, 'filter_type_placeholder'), canSort: true,
    },
  ];
}

/**
 * @description Detail / import / chart columns of a coupon.
 * @param i18n Admin localization service.
 * @returns Detail column definitions (discount type, scope and active flag chartable).
 */
export function createCouponDetailsColumns(i18n: AdminLocalizationService): Core.ItemDetailsColumns[] {
  return [
    { key: 'id', displayName: tr(i18n, 'details_id'), type: 'text', importable: true },
    { key: 'code', displayName: tr(i18n, 'details_code'), type: 'text', importable: true },
    { key: 'description', displayName: tr(i18n, 'details_description'), type: 'text', importable: true },
    { key: 'discount_type', displayName: tr(i18n, 'details_discount_type'), type: 'text', importable: true, chartable: true, chartPossibleValues: DISCOUNT_TYPE_VALUES },
    { key: 'discount_value', displayName: tr(i18n, 'details_discount_value'), type: 'text', importable: true },
    { key: 'max_usage', displayName: tr(i18n, 'details_max_usage'), type: 'text', importable: true },
    { key: 'usage_count', displayName: tr(i18n, 'details_usage_count'), type: 'text', importable: true },
    { key: 'min_order_amount', displayName: tr(i18n, 'details_min_order_amount'), type: 'text', importable: true },
    { key: 'applies_to', displayName: tr(i18n, 'details_applies_to'), type: 'text', importable: true, chartable: true, chartPossibleValues: APPLIES_TO_VALUES },
    { key: 'valid_from', displayName: tr(i18n, 'details_valid_from'), type: 'date', format: 'medium', importable: true },
    { key: 'valid_until', displayName: tr(i18n, 'details_valid_until'), type: 'date', format: 'medium', importable: true },
    { key: 'is_active', displayName: tr(i18n, 'details_is_active'), type: 'text', importable: true, chartable: true, chartPossibleValues: ['1', '0'] },
    { key: 'created_at', displayName: tr(i18n, 'details_created_at'), type: 'date', format: 'medium' },
  ];
}
