/**
 * @file shop-admin.routes.ts
 * @path src/app/apps/shop/admin/shop-admin.routes.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Admin pages of the e-shop, below `/admin/shop/` (inside AdminLayoutComponent,
 *   AuthGuard checks `data.permission` of every page). Each page is loaded on its first visit.
 * @usage `adminRoutes` of SHOP_APP (shop.app.ts); `help` = id of the page of the internal manual
 *   (api/app/Apps/Shop/Resources/knowledge-base).
 */

import { Routes } from '@angular/router';

export const SHOP_ADMIN_ROUTES: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent), data: { help: 'shop-dashboard', permission: 'shop-view-dashboard' } },
  { path: 'products', loadComponent: () => import('./products/products.component').then(m => m.ProductsComponent), data: { help: 'shop-products', permission: 'shop-products-view' } },
  { path: 'categories', loadComponent: () => import('./categories/categories.component').then(m => m.CategoriesComponent), data: { help: 'shop-categories', permission: 'shop-categories-view' } },
  { path: 'orders', loadComponent: () => import('./orders/orders.component').then(m => m.OrdersComponent), data: { help: 'shop-orders', permission: 'shop-orders-view' } },
  { path: 'customers', loadComponent: () => import('./customers/customers.component').then(m => m.CustomersComponent), data: { help: 'shop-customers', permission: 'shop-customers-view' } },
  { path: 'shipping-methods', loadComponent: () => import('./shipping-methods/shipping-methods.component').then(m => m.ShippingMethodsComponent), data: { help: 'shop-shipping-methods', permission: 'shop-shipping-methods-view' } },
  { path: 'payment-methods', loadComponent: () => import('./payment-methods/payment-methods.component').then(m => m.PaymentMethodsComponent), data: { help: 'shop-payment-methods', permission: 'shop-payment-methods-view' } },
  { path: 'suppliers', loadComponent: () => import('./suppliers/suppliers.component').then(m => m.SuppliersComponent), data: { help: 'shop-suppliers', permission: 'shop-suppliers-view' } },
  { path: 'coupons', loadComponent: () => import('./coupons/coupons.component').then(m => m.CouponsComponent), data: { help: 'coupons', permission: 'shop-coupons-view' } },
  { path: 'logs', loadComponent: () => import('./shop-logs/shop-logs.component').then(m => m.ShopLogsComponent), data: { help: 'shop-logs', permission: 'shop-view-logs' } },
  { path: 'edit-eshop', loadComponent: () => import('./edit-eshop/edit-eshop.component').then(m => m.EditEshopComponent), data: { help: 'edit-eshop', permission: 'shop-edit-eshop-view' } },
  { path: 'welcome-page', loadComponent: () => import('./shop-welcome-page/shop-welcome-page.component').then(m => m.ShopWelcomePageComponent), data: { help: 'shop-welcome-page', permission: 'shop-welcome-page-view' } },
];
