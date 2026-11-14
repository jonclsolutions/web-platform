/**
 * @file shop.app.ts
 * @path src/app/apps/shop/shop.app.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Manifest of the e-shop (public shop and checkout, catalogue, orders, customers, coupons, shipping and payment) - what the core needs to know about it (apps.registry.ts).
 * @dependencies AppManifest; its admin and public route tables.
 */

import type { AppManifest } from '../app-manifest';
import { SHOP_ADMIN_ROUTES } from './admin/shop-admin.routes';
import { SHOP_PUBLIC_ROUTES, SHOP_PUBLIC_AREA } from './public/shop-public.routes';

export const SHOP_APP: AppManifest = {
  id: 'shop',
  icon: 'cart',
  color: 'emerald',
  nameKey: 'module_shop',
  descriptionKey: 'app_description_shop',
  tabPermission: 'view-eshop',
  adminI18n: true,
  nav: [
    {
      key: 'shop-overview', labelKey: 'nav_group_overview',
      items: [
        { path: 'welcome-page', permission: 'shop-welcome-page-view', labelKey: 'nav_welcome', icon: 'home' },
        { path: 'dashboard', permission: 'shop-view-dashboard', labelKey: 'nav_shop_dashboard', icon: 'bar-chart' },
      ],
    },
    {
      key: 'shop-catalog', labelKey: 'nav_group_catalog',
      items: [
        { path: 'products', permission: 'shop-products-view', labelKey: 'nav_products', icon: 'shopping-bag' },
        { path: 'categories', permission: 'shop-categories-view', labelKey: 'nav_categories', icon: 'folder' },
        { path: 'suppliers', permission: 'shop-suppliers-view', labelKey: 'nav_suppliers', icon: 'briefcase' },
      ],
    },
    {
      key: 'shop-transactions', labelKey: 'nav_group_transactions',
      items: [
        { path: 'orders', permission: 'shop-orders-view', labelKey: 'nav_orders', icon: 'credit-card' },
        { path: 'coupons', permission: 'shop-coupons-view', labelKey: 'nav_coupons', icon: 'check-square' },
      ],
    },
    {
      key: 'shop-customers', labelKey: 'nav_group_customers',
      items: [
        { path: 'customers', permission: 'shop-customers-view', labelKey: 'nav_customers', icon: 'users' },
      ],
    },
    {
      key: 'shop-logistics', labelKey: 'nav_group_logistics',
      items: [
        { path: 'shipping-methods', permission: 'shop-shipping-methods-view', labelKey: 'nav_shipping_methods', icon: 'truck' },
        { path: 'payment-methods', permission: 'shop-payment-methods-view', labelKey: 'nav_payment_methods', icon: 'dollar' },
      ],
    },
    {
      key: 'shop-content', labelKey: 'nav_group_content',
      items: [
        { path: 'edit-eshop', permission: 'shop-edit-eshop-view', labelKey: 'nav_edit_eshop_text', titleKey: 'nav_edit_eshop_title', icon: 'code' },
      ],
    },
    {
      key: 'shop-system', labelKey: 'nav_group_system',
      items: [
        { path: 'logs', permission: 'shop-view-logs', labelKey: 'nav_shop_logs', icon: 'file-lines' },
      ],
    },
  ],
  adminRoutes: SHOP_ADMIN_ROUTES,
  publicArea: SHOP_PUBLIC_AREA,
  publicRoutes: SHOP_PUBLIC_ROUTES,
};
