/**
 * @file shop-logs.config.ts
 * @path src/app/apps/shop/admin/shop-logs/shop-logs.config.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Audit log of the e-shop (shop_logs): catalogue, orders, payments, customers, coupons,
 *   shipping and payment methods, texts of the e-shop.
 * @dependencies AuditLogPageConfig (admin/components/audit-log-page).
 */

import { AuditLogPageConfig } from '../../../../admin/components/audit-log-page/audit-log-page.config';

/** @description Configuration of the log page (route data `auditLog`). */
export const SHOP_AUDIT_LOG: AuditLogPageConfig = {
  endpoint: 'shop/logs',
  section: 'shop-logs',
  reportPermission: 'shop-view-logs',
  eventTypes: [
    'create', 'update', 'delete', 'soft_delete', 'hard_delete', 'soft_delete_bulk',
    'hard_delete_bulk', 'restore', 'force_delete_all', 'import', 'payment', 'error',
    'maintenance_status_changed', 'unauthorized_maintenance_toggle_attempt',
  ],
  modules: [
    'ShopProduct', 'ShopCategory', 'ShopOrder', 'ShopOrder (Checkout)', 'ShopCustomer',
    'ShopSupplier', 'ShopCoupon', 'ShopShippingMethod', 'ShopPaymentMethod', 'Shop',
  ],
};
