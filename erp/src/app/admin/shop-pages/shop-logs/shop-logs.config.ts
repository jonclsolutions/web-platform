/**
 * @file shop-logs.config.ts
 * @path src/app/admin/shop-pages/shop-logs/shop-logs.config.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description i18n-aware configuration (buttons, table / filter / detail columns) of the
 *   read-only e-shop audit log. Every text comes from the admin translation section `shop-logs`.
 *
 * @bugfix-note (2026-09-07) BACKLOG "permission audit napříč shop stránkami":
 * `openGraphBuilder` opraven z `web-user-requests-view` (nesouvisející permission
 * z web sekce) na `shop-view-logs` - dedikovaná permission pro tuto stránku,
 * stejný princip jako `view-core` u core-pages/logs.
 * @refactor-note (2026-10-23) Localized (open finding #16): static constants with Czech texts
 *   replaced by `create*()` factory functions (same pattern as web business-logs).
 * @bugfix-note (2026-10-23) The module filter offered `shop-products`, `shop-orders`, … while the
 *   API writes the model names (`ShopProduct`, `ShopOrder`, …) and filters by exact match - the
 *   module filter never found anything. The event list also missed most real events (`delete`,
 *   `force_delete_all`, `import`, `payment`, `error`, maintenance) and offered `login` /
 *   `order_status_change`, which the shop log never writes. Both lists now mirror the
 *   `logAction(…, ShopLog::class, …)` calls of the API (app/Http/Controllers/Api/Shop).
 * @dependencies
 * - AdminLocalizationService: translated texts (`shop-logs.*`).
 */
import * as Core from '../../../shared/imports/core-providers';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';

const SECTION = 'shop-logs';

/** @description Event types written to `shop_logs.event_type` by the API. */
export const EVENT_TYPE_VALUES: string[] = [
  'create', 'update', 'delete', 'soft_delete', 'hard_delete', 'soft_delete_bulk', 'hard_delete_bulk',
  'restore', 'force_delete_all', 'import', 'payment', 'error',
  'maintenance_status_changed', 'unauthorized_maintenance_toggle_attempt',
];

/** @description Modules written to `shop_logs.module` by the API. */
export const MODULE_VALUES: string[] = [
  'ShopProduct', 'ShopCategory', 'ShopOrder', 'ShopOrder (Checkout)', 'ShopCustomer', 'ShopSupplier',
  'ShopCoupon', 'ShopShippingMethod', 'ShopPaymentMethod', 'Shop',
];

/** @description Translation key of each module (inside `shop-logs`). */
const MODULE_LABEL_KEYS: Record<string, string> = {
  ShopProduct: 'module_shop_product',
  ShopCategory: 'module_shop_category',
  ShopOrder: 'module_shop_order',
  'ShopOrder (Checkout)': 'module_shop_order_checkout',
  ShopCustomer: 'module_shop_customer',
  ShopSupplier: 'module_shop_supplier',
  ShopCoupon: 'module_shop_coupon',
  ShopShippingMethod: 'module_shop_shipping_method',
  ShopPaymentMethod: 'module_shop_payment_method',
  Shop: 'module_shop',
};

/**
 * @description Shortcut for a text of the `shop-logs` section.
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
export function createShopLogButtons(i18n: AdminLocalizationService): Core.TableButtons[] {
  return [
    { display_name: '', header_name: tr(i18n, 'btn_details'), isActive: true, type: 'info_button', action: 'details', icon: 'search' },
  ];
}

/**
 * @description Toolbar actions of the log page.
 * @param i18n Admin localization service.
 * @returns Filters, reports (shop-view-logs) and export.
 */
export function createShopLogToolbarButtons(i18n: AdminLocalizationService): Core.Button[] {
  return [
    { action: 'toggleFilters', label: tr(i18n, 'toolbar_filters'), icon: '', class: 'btn-filter', isActive: false },
    { action: 'openGraphBuilder', label: tr(i18n, 'toolbar_generate_reports'), icon: '', class: 'btn-neutral', showIf: true, permission: 'shop-view-logs' },
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
export function createShopLogTableColumns(i18n: AdminLocalizationService): Core.ColumnDefinition[] {
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
export function createShopLogFilterColumns(i18n: AdminLocalizationService): Core.FilterColumns[] {
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
export function createShopLogDetailsColumns(i18n: AdminLocalizationService): Core.ItemDetailsColumns[] {
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
