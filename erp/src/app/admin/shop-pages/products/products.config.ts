/**
 * @file products.config.ts
 * @path src/app/admin/shop-pages/products/products.config.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Static-turned-dynamic configuration for shop product management.
 *
 * (Earlier bugfix-note 2026-09-07 for shop permissions granularization is unchanged
 * - see version history.)
 *
 * @refactor-note (2026-09-08) BACKLOG "vícejazyčná administrace, žádné hardcoded texty":
 * kompletní přepis na FACTORY FUNKCE. Žádná SQL migrace potřeba - `category_id`/
 * `supplier_id` jsou dynamická data (options: [] doplňuje komponenta po async
 * fetch), `is_active`/`is_featured` jsou booleany (řešeny centrálně přes
 * `shared.yes`/`shared.no`, ne přes tuhle config). `low_stock`/`is_featured`/
 * `is_active` FILTER options (`true`/`false` string hodnoty) jsou canonical -
 * `mapLabeledOptions()`-style přeložené páry.
 *
 * FUNKCIONALITA ZACHOVÁNA BEZE ZMĚNY: pořadí/klíče/permission stringy tlačítek,
 * struktura filtrů (včetně skrytých `type: 'hidden'` sort-only sloupců), struktura
 * formulářových polí - jediná změna je `label`/`header`/`placeholder`/
 * `errorMessage` text, teď za `i18n.getValue()`.
 */
import * as Core from '../../../shared/imports/core-providers';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';

const SECTION = 'shop-products';

export function createToolbarButtons(i18n: AdminLocalizationService): Core.Button[] {
  return [
    { action: 'toggleFilters', label: i18n.getValue(`${SECTION}.toolbar_filters`), icon: '', class: 'btn-filter', isActive: false },
    { action: 'handleCreateFormOpened', label: i18n.getValue(`${SECTION}.toolbar_create_record`), icon: '', class: 'btn-create', showIf: true, permission: 'shop-products-create' },
    { action: 'exportActiveTable', label: i18n.getValue(`${SECTION}.toolbar_export_data`), icon: '', class: 'btn-export', showIf: true },
    { action: 'triggerImport', label: i18n.getValue(`${SECTION}.toolbar_import_data`), icon: '', class: 'btn-neutral', showIf: true, permission: 'shop-products-create' },
    { action: 'openGraphBuilder', label: i18n.getValue(`${SECTION}.toolbar_generate_reports`), icon: '', class: 'btn-neutral', showIf: true, permission: 'shop-view-reports' },
    { action: 'toggleTrash', label: i18n.getValue(`${SECTION}.toolbar_show_trash`), icon: '', class: 'btn-trash', permission: 'view-deleted' },
  ];
}

export function createProductButtons(i18n: AdminLocalizationService): Core.TableButtons[] {
  return [
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_details`), isActive: true, type: 'info_button', action: 'details', icon: 'search' },
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_edit`), isActive: true, type: 'neutral_button', action: 'edit', permission: 'shop-products-update', icon: 'edit' },
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_variants`), isActive: true, type: 'neutral_button', action: 'custom_prod_var', permission: 'shop-products-update', icon: 'settings' },
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_images`), isActive: true, type: 'neutral_button', action: 'custom_prod_img', permission: 'shop-products-update', icon: 'image' },
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_delete`), isActive: true, type: 'delete_button', action: 'delete', permission: 'shop-products-delete', icon: 'delete' },
  ];
}

/**
 * @description `category_id`/`supplier_id` mají `options: []` - komponenta je po
 * async `loadCategories()`/`loadSuppliers()` doplní přes `updateFormFieldsOptions()`.
 */
export function createProductFormFields(i18n: AdminLocalizationService): Core.InputDefinition[] {
  return [
    { column_name: 'name', label: i18n.getValue(`${SECTION}.field_name_label`), placeholder: i18n.getValue(`${SECTION}.field_name_placeholder`), type: 'text', required: true, errorMessage: i18n.getValue(`${SECTION}.field_name_error`), editable: true, show_in_edit: true, show_in_create: true },
    { column_name: 'sku', label: i18n.getValue(`${SECTION}.field_sku_label`), placeholder: i18n.getValue(`${SECTION}.field_sku_placeholder`), type: 'text', required: true, errorMessage: i18n.getValue(`${SECTION}.field_sku_error`), editable: true, show_in_edit: true, show_in_create: true },
    { column_name: 'category_id', label: i18n.getValue(`${SECTION}.field_category_label`), type: 'select', options: [], required: true, errorMessage: i18n.getValue(`${SECTION}.field_category_error`), editable: true, show_in_edit: true, show_in_create: true },
    { column_name: 'supplier_id', label: i18n.getValue(`${SECTION}.field_supplier_label`), type: 'select', options: [], required: false, editable: true, show_in_edit: true, show_in_create: true },
    { column_name: 'price_eur', label: i18n.getValue(`${SECTION}.field_price_label`), type: 'number', required: true, errorMessage: i18n.getValue(`${SECTION}.field_price_error`), editable: true, show_in_edit: true, show_in_create: true },
    { column_name: 'cost_price_eur', label: i18n.getValue(`${SECTION}.field_cost_price_label`), placeholder: i18n.getValue(`${SECTION}.field_cost_price_placeholder`), type: 'number', required: false, editable: true, show_in_edit: true, show_in_create: true },
    { column_name: 'stock_quantity', label: i18n.getValue(`${SECTION}.field_stock_label`), type: 'number', required: false, editable: true, show_in_edit: true, show_in_create: true },
    { column_name: 'description', label: i18n.getValue(`${SECTION}.field_description_label`), type: 'textarea', required: false, editable: true, show_in_edit: true, show_in_create: true },
    { column_name: 'is_active', label: i18n.getValue(`${SECTION}.field_is_active_label`), type: 'checkbox', editable: true, show_in_edit: true, show_in_create: true },
    { column_name: 'is_featured', label: i18n.getValue(`${SECTION}.field_is_featured_label`), type: 'checkbox', editable: true, show_in_edit: true, show_in_create: true },
  ];
}

export function createTrashProductColumns(i18n: AdminLocalizationService): Core.ColumnDefinition[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text' },
    { key: 'name', header: i18n.getValue(`${SECTION}.col_product`), type: 'text' },
    { key: 'sku', header: i18n.getValue(`${SECTION}.col_sku`), type: 'text' },
    { key: 'deleted_at', header: i18n.getValue(`${SECTION}.col_deleted`), type: 'date', format: 'short' },
  ];
}

/**
 * @description `category_id`/`supplier_id` mají `options: []` - doplní komponenta
 * (viz `createProductFormFields()` hlavička). Poslední pětice `type: 'hidden'` řádků
 * jsou sort-only sloupce beze změny funkce (FilterFormBuilderComponent je
 * nevykresluje, jen umožňují `canSort`).
 */
export function createFilterColumns(i18n: AdminLocalizationService): Core.FilterColumns[] {
  return [
    { key: 'search', header: i18n.getValue(`${SECTION}.filter_search_label`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_search_placeholder`), canSort: false },
    { key: 'category_id', header: i18n.getValue(`${SECTION}.field_category_label`), type: 'select', options: [], placeholder: i18n.getValue(`${SECTION}.filter_category_placeholder`), canSort: false },
    { key: 'supplier_id', header: i18n.getValue(`${SECTION}.field_supplier_label`), type: 'select', options: [], placeholder: i18n.getValue(`${SECTION}.filter_supplier_placeholder`), canSort: false },
    { key: 'price_from', header: i18n.getValue(`${SECTION}.filter_price_from_label`), type: 'number', placeholder: i18n.getValue(`${SECTION}.filter_price_from_placeholder`), canSort: false },
    { key: 'price_to', header: i18n.getValue(`${SECTION}.filter_price_to_label`), type: 'number', placeholder: i18n.getValue(`${SECTION}.filter_price_to_placeholder`), canSort: false },
    {
      key: 'low_stock',
      header: i18n.getValue(`${SECTION}.filter_low_stock_label`),
      type: 'select',
      options: [
        { value: 'true', label: i18n.getValue(`${SECTION}.filter_low_stock_only`) },
        { value: 'false', label: i18n.getValue(`${SECTION}.filter_low_stock_sufficient`) },
      ],
      placeholder: i18n.getValue(`${SECTION}.filter_low_stock_placeholder`),
      canSort: false,
    },
    {
      key: 'is_featured',
      header: i18n.getValue(`${SECTION}.filter_is_featured_label`),
      type: 'select',
      options: [
        { value: 'true', label: i18n.getValue(`${SECTION}.filter_is_featured_only`) },
        { value: 'false', label: i18n.getValue(`${SECTION}.filter_is_featured_regular`) },
      ],
      placeholder: i18n.getValue(`${SECTION}.filter_is_featured_placeholder`),
      canSort: false,
    },
    {
      key: 'is_active',
      header: i18n.getValue(`${SECTION}.filter_is_active_label`),
      type: 'select',
      options: [
        { value: 'true', label: i18n.getValue(`${SECTION}.filter_is_active_only`) },
        { value: 'false', label: i18n.getValue(`${SECTION}.filter_is_active_inactive_only`) },
      ],
      placeholder: i18n.getValue(`${SECTION}.filter_is_active_placeholder`),
      canSort: false,
    },
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'hidden', placeholder: '', canSort: true },
    { key: 'name', header: i18n.getValue(`${SECTION}.col_product`), type: 'hidden', placeholder: '', canSort: true },
    { key: 'sku', header: i18n.getValue(`${SECTION}.col_sku`), type: 'hidden', placeholder: '', canSort: true },
    { key: 'price_eur', header: i18n.getValue(`${SECTION}.col_price`), type: 'hidden', placeholder: '', canSort: true },
    { key: 'stock_quantity', header: i18n.getValue(`${SECTION}.col_stock`), type: 'hidden', placeholder: '', canSort: true },
  ];
}

export function createProductColumns(i18n: AdminLocalizationService): Core.ColumnDefinition[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text' },
    { key: 'name', header: i18n.getValue(`${SECTION}.col_product`), type: 'text' },
    { key: 'sku', header: i18n.getValue(`${SECTION}.col_sku`), type: 'text' },
    { key: 'category_name', header: i18n.getValue(`${SECTION}.field_category_label`), type: 'text' },
    { key: 'price_eur', header: i18n.getValue(`${SECTION}.col_price`), type: 'currency', currencyCode: 'EUR' },
    { key: 'stock_quantity', header: i18n.getValue(`${SECTION}.col_stock`), type: 'text' },
    { key: 'is_active', header: i18n.getValue(`${SECTION}.field_is_active_label`), type: 'boolean' },
  ];
}

export function createProductDetailsColumns(i18n: AdminLocalizationService): Core.ItemDetailsColumns[] {
  return [
    { key: 'id', displayName: i18n.getValue(`${SECTION}.details_id`), type: 'text' },
    { key: 'name', displayName: i18n.getValue(`${SECTION}.details_name`), type: 'text' },
    { key: 'slug', displayName: i18n.getValue(`${SECTION}.details_slug`), type: 'text' },
    { key: 'sku', displayName: i18n.getValue(`${SECTION}.details_sku`), type: 'text' },
    { key: 'category_name', displayName: i18n.getValue(`${SECTION}.field_category_label`), type: 'text', chartable: true },
    { key: 'supplier_name', displayName: i18n.getValue(`${SECTION}.field_supplier_label`), type: 'text', chartable: true },
    { key: 'price_eur', displayName: i18n.getValue(`${SECTION}.details_price`), type: 'text' },
    { key: 'stock_quantity', displayName: i18n.getValue(`${SECTION}.details_total_stock`), type: 'text' },
    { key: 'description', displayName: i18n.getValue(`${SECTION}.details_description`), type: 'text' },
    { key: 'is_active', displayName: i18n.getValue(`${SECTION}.details_is_active`), type: 'boolean', chartable: true, chartPossibleValues: ['1', '0'] },
    { key: 'is_featured', displayName: i18n.getValue(`${SECTION}.details_is_featured`), type: 'boolean', chartable: true, chartPossibleValues: ['1', '0'] },
    { key: 'created_at', displayName: i18n.getValue(`${SECTION}.details_created`), type: 'date', format: 'medium' },
    { key: 'updated_at', displayName: i18n.getValue(`${SECTION}.details_updated`), type: 'date', format: 'medium' },
  ];
}