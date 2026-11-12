/**
 * @file app.routes.ts
 * @path src/app/app.routes.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Central routing configuration for the application, managing lazy-loaded modules and route guards.
 * @dependencies
 * - shopMaintenanceGuard: Validates e-shop availability status.
 * - webMaintenanceGuard: Validates public web availability status.
 * - LoginComponent: Handles administrative authentication.
 * - AdminRoutingModule: Loads the protected administrative section.
 */

import { Routes } from '@angular/router';
import { LoginComponent } from './admin/auth/login/login.component';
import { shopMaintenanceGuard } from './public/shop-pages/components/guards/shop-maintenance.guard';
import { webMaintenanceGuard } from './public/web-pages/components/guards/web-maintenance.guard';
import { publicNotFoundRoute } from './public/not-found/public-not-found.config';
/**
 * @description Main application routing configuration.
 * @usage Imported by the root application module/app config.
 * @note All public and shop pages use lazy loading to ensure optimal bundle size and performance.
 *   The root path ('') and '/home' both resolve directly to HomeComponent (no redirectTo) so the
 *   browser address bar keeps showing the clean domain root (e.g. www.example.com) instead of being
 *   rewritten to /home. Both URLs remain independently accessible as aliases for the same view.
 *   `title` values are page keys for PageTitleStrategy, not display texts.
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
        title: 'web.home',
        loadComponent: () => import('./public/web-pages/home/home.component').then(m => m.HomeComponent)
      },
      {
        path: 'home',
        title: 'web.home',
        loadComponent: () => import('./public/web-pages/home/home.component').then(m => m.HomeComponent)
      },
      { path: 'services', title: 'web.services', loadComponent: () => import('./public/web-pages/services/services.component').then(m => m.ServicesComponent) },
      { path: 'contact', title: 'web.contact', loadComponent: () => import('./public/web-pages/contact/contact.component').then(m => m.ContactComponent) },
      { path: 'tos', title: 'web.tos', loadComponent: () => import('./public/legal/tos/tos.component').then(m => m.TosComponent) },
      { path: 'privacy-policy', title: 'web.privacy-policy', loadComponent: () => import('./public/legal/privacy-policy/privacy-policy.component').then(m => m.PrivacyPolicyComponent) },
      { path: 'references', title: 'web.references', loadComponent: () => import('./public/web-pages/references/references.component').then(m => m.ReferencesComponent) },
      { path: 'faq', title: 'web.faq', loadComponent: () => import('./public/web-pages/faq/faq.component').then(m => m.FaqComponent) },
      { path: 'knowledge-base', title: 'web.knowledge-base', loadComponent: () => import('./public/web-pages/knowledge-base/knowledge-base.component').then(m => m.KnowledgeBaseComponent) },
      { path: 'cookies-policy', title: 'web.cookies-policy', loadComponent: () => import('./public/legal/cookies-policy/cookies-policy.component').then(m => m.CookiesPolicyComponent) },
      { path: 'about-us', title: 'web.about-us', loadComponent: () => import('./public/web-pages/about-us/about-us.component').then(m => m.AboutUsComponent) },
      { path: 'jobs', title: 'web.jobs', loadComponent: () => import('./public/web-pages/jobs/jobs-list/jobs-list.component').then(m => m.JobsListComponent) },
      { path: 'jobs/:id', title: 'web.job-detail', loadComponent: () => import('./public/web-pages/jobs/job-item/job-item.component').then(m => m.JobItemComponent) },
      { path: 'order_form/:token', title: 'web.order-form', loadComponent: () => import('./public/web-pages/order-form/order-form.component').then(m => m.OrderFormComponent) },
      // Known address of the web 404 page (e.g. for links); unknown URLs use the catch-all at the end.
      { ...publicNotFoundRoute('web'), path: '404' },
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
        title: 'shop.catalog',
        canActivate: [shopMaintenanceGuard],
        loadComponent: () => import('./public/shop-pages/catalog/catalog.component').then(m => m.CatalogComponent)
      },
      {
        path: 'products/:slugOrId',
        title: 'shop.product-detail',
        canActivate: [shopMaintenanceGuard],
        loadComponent: () => import('./public/shop-pages/product-detail/product-detail.component').then(m => m.ProductDetailComponent)
      },
      {
        path: 'cart',
        title: 'shop.cart',
        canActivate: [shopMaintenanceGuard],
        loadComponent: () => import('./public/shop-pages/cart/cart.component').then(m => m.CartComponent)
      },
      {
        path: 'checkout',
        title: 'shop.checkout',
        canActivate: [shopMaintenanceGuard],
        loadComponent: () => import('./public/shop-pages/checkout/checkout.component').then(m => m.CheckoutComponent)
      },
      // Legal pages shared with the web (public/legal), in the e-shop layout and translations.
      { path: 'tos', title: 'shop.tos', data: { translationModule: 'shop' }, loadComponent: () => import('./public/legal/tos/tos.component').then(m => m.TosComponent) },
      { path: 'privacy-policy', title: 'shop.privacy-policy', data: { translationModule: 'shop' }, loadComponent: () => import('./public/legal/privacy-policy/privacy-policy.component').then(m => m.PrivacyPolicyComponent) },
      // Unknown /shop/... URL - LAST child of the e-shop (404 in the e-shop layout and language).
      publicNotFoundRoute('shop', { canActivate: [shopMaintenanceGuard] })
    ]
  },

  // --- 3. MAINTENANCE PAGES ---
  {
    path: 'shop-maintenance',
    title: 'shop.shop-maintenance',
    loadComponent: () => import('./public/shop-pages/shop-maintenance/shop-maintenance.component').then(m => m.ShopMaintenanceComponent)
  },
  {
    path: 'web-maintenance',
    title: 'web.web-maintenance',
    loadComponent: () => import('./public/web-pages/web-maintenance/web-maintenance.component').then(m => m.WebMaintenanceComponent)
  },
  {
    path: 'projects/:token',
    title: 'web.project-portal',
    loadComponent: () =>
      import('./public/web-pages/project-portal/project-portal.component')
        .then(m => m.ProjectPortalComponent)
  },

  // --- 4. ADMIN & AUTH ---
  { path: 'auth/login', title: 'admin.panel', component: LoginComponent },
  {
    // Public page outside AdminLayoutComponent and AuthGuard - target of the link in the e-mail.
    path: 'auth/reset-password',
    title: 'admin.panel',
    loadComponent: () =>
      import('./admin/auth/reset-password/reset-password.component')
        .then(m => m.ResetPasswordComponent)
  },
  {
    // Public page outside AdminLayoutComponent and AuthGuard - target of the link in
    // AccountActivationMail (account created by an admin, waiting for the password).
    path: 'auth/activate-account/:token',
    title: 'admin.panel',
    loadComponent: () =>
      import('./admin/auth/activate-account/activate-account.component')
        .then(m => m.ActivateAccountComponent)
  },
  { path: 'admin', title: 'admin.panel', loadChildren: () => import('./admin/admin-routing.module').then(m => m.AdminRoutingModule) },

  // --- 5. 404 OF THE PUBLIC WEB - MUST STAY THE LAST ROUTE ---
  // Any URL no route above knows: the web 404 inside the web layout (same maintenance guard as
  // the web). Reached only after every other route failed to match.
  {
    path: '',
    canActivateChild: [webMaintenanceGuard],
    loadComponent: () => import('./public/web-pages/web-layout/web-layout.component').then(m => m.WebLayoutComponent),
    children: [publicNotFoundRoute('web')]
  }
];