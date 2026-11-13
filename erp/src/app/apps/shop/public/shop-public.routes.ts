/**
 * @file shop-public.routes.ts
 * @path src/app/apps/shop/public/shop-public.routes.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Public routes of the e-shop: catalogue, product detail, cart, checkout and the
 *   shared legal pages in the e-shop layout (/shop/...) with its own 404, and the maintenance page.
 * @usage `publicRoutes` of SHOP_APP (shop.app.ts), composed by app.routes.ts.
 */

import { Routes } from '@angular/router';
import { shopMaintenanceGuard } from './components/guards/shop-maintenance.guard';
import { publicNotFoundRoute } from '../../../public/not-found/public-not-found.config';

export const SHOP_PUBLIC_ROUTES: Routes = [
  {
    path: 'shop',
    loadComponent: () => import('./shop-layout/shop-layout.component').then(m => m.ShopLayoutComponent),
    children: [
      { path: '', redirectTo: 'catalog', pathMatch: 'full' },
      {
        path: 'catalog',
        title: 'shop.catalog',
        canActivate: [shopMaintenanceGuard],
        loadComponent: () => import('./catalog/catalog.component').then(m => m.CatalogComponent)
      },
      {
        path: 'products/:slugOrId',
        title: 'shop.product-detail',
        canActivate: [shopMaintenanceGuard],
        loadComponent: () => import('./product-detail/product-detail.component').then(m => m.ProductDetailComponent)
      },
      {
        path: 'cart',
        title: 'shop.cart',
        canActivate: [shopMaintenanceGuard],
        loadComponent: () => import('./cart/cart.component').then(m => m.CartComponent)
      },
      {
        path: 'checkout',
        title: 'shop.checkout',
        canActivate: [shopMaintenanceGuard],
        loadComponent: () => import('./checkout/checkout.component').then(m => m.CheckoutComponent)
      },
      // Legal pages shared with the web (public/legal), in the e-shop layout and translations.
      { path: 'tos', title: 'shop.tos', data: { translationModule: 'shop' }, loadComponent: () => import('../../../public/legal/tos/tos.component').then(m => m.TosComponent) },
      { path: 'privacy-policy', title: 'shop.privacy-policy', data: { translationModule: 'shop' }, loadComponent: () => import('../../../public/legal/privacy-policy/privacy-policy.component').then(m => m.PrivacyPolicyComponent) },
      // Unknown /shop/... URL - LAST child of the e-shop (404 in the e-shop layout and language).
      publicNotFoundRoute('shop', { canActivate: [shopMaintenanceGuard] })
    ]
  },
  {
    path: 'shop-maintenance',
    title: 'shop.shop-maintenance',
    loadComponent: () => import('./shop-maintenance/shop-maintenance.component').then(m => m.ShopMaintenanceComponent)
  },
];
