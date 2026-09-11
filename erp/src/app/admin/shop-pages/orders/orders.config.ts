/**
 * @file orders.config.ts
 * @path src/app/admin/shop-pages/orders/orders.config.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Static-turned-dynamic configuration for shop order management.
 *
 * (Earlier bugfix-note 2026-09-07 for shop permissions granularization is unchanged
 * - see version history.)
 *
 * @refactor-note (2026-09-09) BACKLOG "vícejazyčná administrace, žádné hardcoded texty":
 * kompletní přepis na FACTORY FUNKCE. Žádná SQL migrace potřeba - `status`/
 * `payment_status` jsou už anglické slugy, matchují backendový `in:...` seznam v
 * Store/UpdateShopOrderRequest 1:1.
 *
 * @bugfix-note (2026-09-09) DVA reálné bugy odhalené při i18n převodu:
 * 1) `PAYMENT_STATUS_OPTIONS` neobsahoval hodnotu `unpaid`, přestože
 *    `OrdersComponent.handleCreateFormOpened()` novou objednávku touto hodnotou
 *    inicializuje (a backend `in:...` seznam ji má) - select pro platbu u nové
 *    objednávky tak ukazoval prázdnou/nevalidní volbu. Doplněno.
 * 2) `ORDER_TAB_BUTTONS` export s `permission: 'view-deleted'` na koš tabu byl
 *    MRTVÝ KÓD - `OrdersComponent` místo něj používala vlastní lokální
 *    `orderTabButtons` pole BEZ permission kontroly, takže koš byl viditelný
 *    úplně všem uživatelům bez ohledu na oprávnění. Sjednoceno na jeden zdroj
 *    (`createOrderTabButtons()`), permission kontrola aplikována v komponentě
 *    stejně jako u `toolbarButtons`.
 */
import * as Core from '../../../shared/imports/core-providers';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';

const SECTION = 'shop-orders';

export const STATUS_VALUES: string[] = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'canceled', 'returned'];

/** @bugfix-note (2026-09-09) `unpaid` doplněn - viz hlavička souboru. */
export const PAYMENT_STATUS_VALUES: string[] = ['pending', 'paid', 'failed', 'refunded', 'cod', 'unpaid'];

const STATUS_LABEL_KEYS: Record<string, string> = {
  pending: 'status_pending',
  confirmed: 'status_confirmed',
  processing: 'status_processing',
  shipped: 'status_shipped',
  delivered: 'status_delivered',
  canceled: 'status_canceled',
  returned: 'status_returned',
};

const PAYMENT_STATUS_LABEL_KEYS: Record<string, string> = {
  pending: 'payment_status_pending',
  paid: 'payment_status_paid',
  failed: 'payment_status_failed',
  refunded: 'payment_status_refunded',
  cod: 'payment_status_cod',
  unpaid: 'payment_status_unpaid',
};

function mapLabeledOptions(values: string[], labelKeys: Record<string, string>, i18n: AdminLocalizationService) {
  return values.map(v => ({ value: v, label: i18n.getValue(`${SECTION}.${labelKeys[v]}`) }));
}

export function createStatusOptions(i18n: AdminLocalizationService) {
  return mapLabeledOptions(STATUS_VALUES, STATUS_LABEL_KEYS, i18n);
}

export function createPaymentStatusOptions(i18n: AdminLocalizationService) {
  return mapLabeledOptions(PAYMENT_STATUS_VALUES, PAYMENT_STATUS_LABEL_KEYS, i18n);
}

export function createToolbarButtons(i18n: AdminLocalizationService): Core.Button[] {
  return [
    { action: 'toggleFilters', label: i18n.getValue(`${SECTION}.toolbar_filters`), icon: '', class: 'btn-filter', isActive: false },
    { action: 'handleCreateFormOpened', label: i18n.getValue(`${SECTION}.toolbar_create_record`), icon: '', class: 'btn-create', showIf: true, permission: 'shop-orders-create' },
    { action: 'openGraphBuilder', label: i18n.getValue(`${SECTION}.toolbar_generate_reports`), icon: '', class: 'btn-neutral', showIf: true, permission: 'shop-view-reports' },
    { action: 'exportActiveTable', label: i18n.getValue(`${SECTION}.toolbar_export_data`), icon: '', class: 'btn-export', showIf: true },
    { action: 'triggerImport', label: i18n.getValue(`${SECTION}.toolbar_import_data`), icon: '', class: 'btn-neutral', showIf: true, permission: 'shop-orders-create' },
  ];
}

export function createOrderButtons(i18n: AdminLocalizationService): Core.TableButtons[] {
  return [
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_details`), isActive: true, type: 'info_button', action: 'details', icon: 'search' },
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_edit`), isActive: true, type: 'neutral_button', action: 'edit', permission: 'shop-orders-update', icon: 'edit' },
    { display_name: '', header_name: i18n.getValue(`${SECTION}.btn_delete`), isActive: true, type: 'delete_button', action: 'delete', permission: 'shop-orders-delete', icon: 'delete' },
  ];
}

export function createOrderColumns(i18n: AdminLocalizationService): Core.ColumnDefinition[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text' },
    { key: 'order_number', header: i18n.getValue(`${SECTION}.col_order_number`), type: 'text' },
    { key: 'customer.full_name', header: i18n.getValue(`${SECTION}.col_customer`), type: 'text' },
    { key: 'status_label', header: i18n.getValue(`${SECTION}.col_status`), type: 'text' },
    { key: 'payment_status_label', header: i18n.getValue(`${SECTION}.col_payment`), type: 'text' },
    { key: 'final_amount', header: i18n.getValue(`${SECTION}.col_total`), type: 'currency' },
    { key: 'created_at', header: i18n.getValue(`${SECTION}.col_created`), type: 'date', format: 'short' },
  ];
}

export function createTrashOrderColumns(i18n: AdminLocalizationService): Core.ColumnDefinition[] {
  return [
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'text' },
    { key: 'order_number', header: i18n.getValue(`${SECTION}.col_order_number`), type: 'text' },
    { key: 'customer.full_name', header: i18n.getValue(`${SECTION}.col_customer`), type: 'text' },
    { key: 'deleted_at', header: i18n.getValue(`${SECTION}.col_deleted`), type: 'date', format: 'short' },
  ];
}

export function createFilterColumns(i18n: AdminLocalizationService): Core.FilterColumns[] {
  return [
    { key: 'search', header: i18n.getValue(`${SECTION}.filter_search_label`), type: 'text', placeholder: i18n.getValue(`${SECTION}.filter_search_placeholder`), canSort: false },
    { key: 'status', header: i18n.getValue(`${SECTION}.filter_order_status_label`), type: 'select', options: createStatusOptions(i18n), placeholder: i18n.getValue(`${SECTION}.filter_order_status_placeholder`), canSort: true },
    { key: 'payment_status', header: i18n.getValue(`${SECTION}.filter_payment_status_label`), type: 'select', options: createPaymentStatusOptions(i18n), placeholder: i18n.getValue(`${SECTION}.filter_payment_status_placeholder`), canSort: true },
    { key: 'amount_from', header: i18n.getValue(`${SECTION}.filter_amount_from_label`), type: 'number', placeholder: i18n.getValue(`${SECTION}.filter_amount_from_placeholder`), canSort: false },
    { key: 'amount_to', header: i18n.getValue(`${SECTION}.filter_amount_to_label`), type: 'number', placeholder: i18n.getValue(`${SECTION}.filter_amount_to_placeholder`), canSort: false },
    { key: 'id', header: i18n.getValue(`${SECTION}.col_id`), type: 'number', canSort: true, placeholder: i18n.getValue(`${SECTION}.filter_id_placeholder`) },
    { key: 'order_number', header: i18n.getValue(`${SECTION}.col_order_number`), type: 'text', canSort: true, placeholder: i18n.getValue(`${SECTION}.filter_order_number_placeholder`) },
    { key: 'final_amount', header: i18n.getValue(`${SECTION}.filter_final_amount_label`), type: 'number', canSort: true, placeholder: i18n.getValue(`${SECTION}.filter_final_amount_placeholder`) },
    { key: 'created_at', header: i18n.getValue(`${SECTION}.filter_created_at_label`), type: 'date', canSort: true, placeholder: '' },
  ];
}

export function createOrderDetailsColumns(i18n: AdminLocalizationService): Core.ItemDetailsColumns[] {
  return [
    { key: 'id', displayName: i18n.getValue(`${SECTION}.details_id`), type: 'text' },
    { key: 'order_number', displayName: i18n.getValue(`${SECTION}.col_order_number`), type: 'text' },
    { key: 'customer.full_name', displayName: i18n.getValue(`${SECTION}.col_customer`), type: 'text' },
    { key: 'customer.email', displayName: i18n.getValue(`${SECTION}.details_email`), type: 'text' },
    { key: 'customer.phone', displayName: i18n.getValue(`${SECTION}.details_phone`), type: 'text' },
    { key: 'status_label', displayName: i18n.getValue(`${SECTION}.filter_order_status_label`), type: 'text', chartable: true, chartPossibleValues: STATUS_VALUES },
    { key: 'payment_status_label', displayName: i18n.getValue(`${SECTION}.filter_payment_status_label`), type: 'text', chartable: true, chartPossibleValues: PAYMENT_STATUS_VALUES },
    { key: 'total_amount', displayName: i18n.getValue(`${SECTION}.details_goods_amount`), type: 'text' },
    { key: 'shipping_amount', displayName: i18n.getValue(`${SECTION}.details_shipping`), type: 'text' },
    { key: 'discount_amount', displayName: i18n.getValue(`${SECTION}.details_discount`), type: 'text' },
    { key: 'final_amount', displayName: i18n.getValue(`${SECTION}.details_final_total`), type: 'text' },
    { key: 'created_at', displayName: i18n.getValue(`${SECTION}.details_created`), type: 'date', format: 'medium' },
    { key: 'paid_at', displayName: i18n.getValue(`${SECTION}.details_paid_at`), type: 'date', format: 'medium' },
    { key: 'shipped_at', displayName: i18n.getValue(`${SECTION}.details_shipped_at`), type: 'date', format: 'medium' },
  ];
}

/**
 * @bugfix-note (2026-09-09) Toto je teď JEDINÝ zdroj tab tlačítek - komponenta
 * dřív měla vlastní duplicitní lokální pole bez permission kontroly na koš tabu,
 * viz hlavička souboru.
 */
export function createOrderTabButtons(i18n: AdminLocalizationService): Core.Button[] {
  return [
    { action: 'all', label: i18n.getValue(`${SECTION}.tab_all`), icon: '📦', class: 'btn-filter', isActive: true },
    { action: 'pending_tasks', label: i18n.getValue(`${SECTION}.tab_pending_tasks`), icon: '⏳', class: 'btn-filter', isActive: false },
    { action: 'trash', label: i18n.getValue(`${SECTION}.tab_trash`), icon: '🗑️', isActive: false, class: 'btn-trash', permission: 'view-deleted' },
  ];
}