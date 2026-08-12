/**
 * @file app.routes.ts
 * @path src/app/app.routes.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Central routing configuration for the application, managing lazy-loaded modules and route guards.
 * @dependencies
 * - shopMaintenanceGuard: Validates e-shop availability status.
 * - webMaintenanceGuard: Validates public web availability status.
 * - LoginComponent: Handles administrative authentication.
 * - AdminRoutingModule: Loads the protected administrative section.
 *
 * @refactor-note (2026-08) Přidán `webMaintenanceGuard` jako `canActivateChild` na
 * kořenovou '' routu (WebLayoutComponent) - blokuje CELÝ veřejný web najednou, na rozdíl
 * od `shopMaintenanceGuard`, který je duplikovaný per-child uvnitř 'shop' skupiny. Nová
 * routa 'web-maintenance' mimo AuthGuard i webMaintenanceGuard (jinak by se sama
 * zablokovala - ochranu proti smyčce navíc řeší i guard samotný, viz jeho komentář).
 */

import { Routes } from '@angular/router';
import { LoginComponent } from './admin/auth/login/login.component';
import { shopMaintenanceGuard } from './public/shop-pages/components/guards/shop-maintenance.guard';
import { webMaintenanceGuard } from './public/web-pages/components/guards/web-maintenance.guard';
/**
 * @description Main application routing configuration.
 * @usage Imported by the root application module/app config.
 * @note All public and shop pages use lazy loading to ensure optimal bundle size and performance.
 *   The root path ('') and '/home' both resolve directly to HomeComponent (no redirectTo) so the
 *   browser address bar keeps showing the clean domain root (e.g. www.rpsw.cz) instead of being
 *   rewritten to /home. Both URLs remain independently accessible as aliases for the same view.
 */
export const routes: Routes = [
  // --- 1. MAIN WEB ---
  {
    path: '',
    canActivateChild: [webMaintenanceGuard],
    loadComponent: () => import('./public/web-pages/web-layout/web-layout.component').then(m => m.WebLayoutComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./public/web-pages/home/home.component').then(m => m.HomeComponent)
      },
      {
        path: 'home',
        loadComponent: () => import('./public/web-pages/home/home.component').then(m => m.HomeComponent)
      },
      { path: 'services', loadComponent: () => import('./public/web-pages/services/services.component').then(m => m.ServicesComponent) },
      { path: 'contact', loadComponent: () => import('./public/web-pages/contact/contact.component').then(m => m.ContactComponent) },
      { path: 'tos', loadComponent: () => import('./public/web-pages/tos/tos.component').then(m => m.TosComponent) },
      { path: 'privacy-policy', loadComponent: () => import('./public/web-pages/privacy-policy/privacy-policy.component').then(m => m.PrivacyPolicyComponent) },
      { path: 'references', loadComponent: () => import('./public/web-pages/references/references.component').then(m => m.ReferencesComponent) },
      { path: 'faq', loadComponent: () => import('./public/web-pages/faq/faq.component').then(m => m.FaqComponent) },
      { path: 'cookies-policy', loadComponent: () => import('./public/web-pages/cookies-policy/cookies-policy.component').then(m => m.CookiesPolicyComponent) },
      { path: 'about-us', loadComponent: () => import('./public/web-pages/about-us/about-us.component').then(m => m.AboutUsComponent) },
      { path: 'jobs', loadComponent: () => import('./public/web-pages/jobs/jobs-list/jobs-list.component').then(m => m.JobsListComponent) },
      { path: 'jobs/:id', loadComponent: () => import('./public/web-pages/jobs/job-item/job-item.component').then(m => m.JobItemComponent) },
      { path: 'order_form/:token', loadComponent: () => import('./public/web-pages/order-form/order-form.component').then(m => m.OrderFormComponent) },
    ]
  },

  // --- 2. E-SHOP SECTION ---
  {
    path: 'shop',
    loadComponent: () => import('./public/shop-pages/shop-layout/shop-layout.component').then(m => m.ShopLayoutComponent),
    children: [
      { path: '', redirectTo: 'catalog', pathMatch: 'full' },
      {
        path: 'catalog',
        canActivate: [shopMaintenanceGuard],
        loadComponent: () => import('./public/shop-pages/catalog/catalog.component').then(m => m.CatalogComponent)
      },
      {
        path: 'products/:slugOrId',
        canActivate: [shopMaintenanceGuard],
        loadComponent: () => import('./public/shop-pages/product-detail/product-detail.component').then(m => m.ProductDetailComponent)
      },
      {
        path: 'cart',
        canActivate: [shopMaintenanceGuard],
        loadComponent: () => import('./public/shop-pages/cart/cart.component').then(m => m.CartComponent)
      },
      {
        path: 'checkout',
        canActivate: [shopMaintenanceGuard],
        loadComponent: () => import('./public/shop-pages/checkout/checkout.component').then(m => m.CheckoutComponent)
      }
    ]
  },

  // --- 3. MAINTENANCE PAGES ---
  {
    path: 'shop-maintenance',
    loadComponent: () => import('./public/shop-pages/shop-maintenance/shop-maintenance.component').then(m => m.ShopMaintenanceComponent)
  },
  {
    path: 'web-maintenance',
    loadComponent: () => import('./public/web-pages/web-maintenance/web-maintenance.component').then(m => m.WebMaintenanceComponent)
  },

  // --- 4. ADMIN & AUTH ---
  { path: 'auth/login', component: LoginComponent },
  {
    // Veřejná stránka mimo AdminLayoutComponent i AuthGuard - cílová stránka odkazu z e-mailu.
    path: 'auth/reset-password',
    loadComponent: () =>
      import('./admin/auth/reset-password/reset-password.component')
        .then(m => m.ResetPasswordComponent)
  },
  { path: 'admin', loadChildren: () => import('./admin/admin-routing.module').then(m => m.AdminRoutingModule) },

  // --- 5. ERROR PAGES ---
  { path: '404', loadComponent: () => import('./public/web-pages/not-found/not-found.component').then(m => m.NotFoundComponent) }
];