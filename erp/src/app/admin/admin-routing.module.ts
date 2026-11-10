/**
 * @file admin-routing.module.ts
 * @path src/app/admin/admin-routing.module.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Centralized routing configuration for the administrative module, separating Web, Core, and E-Shop interfaces with role-based access control.
 * @dependencies
 * - RouterModule: Core Angular routing service.
 * - AuthGuard: Authentication middleware ensuring restricted access to administrative routes.
 * - AdminLayoutComponent: Main wrapper layout for the admin section.
 */

import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminLayoutComponent } from './components/admin-layout/admin-layout.component';
import { DashboardComponent } from './web-pages/dashboard/dashboard.component';
import { UserRequestComponent } from './web-pages/user-request/user-request.component';
import { ADMIN_ERROR_PAGE_KEY, AuthGuard } from '../core/auth/guards/auth.guard';
import { sysadminGuard } from '../core/auth/guards/sysadmin.guard';
import { BusinessLogsComponent } from './web-pages/business-logs/business-logs.component';
import { SalesLeadsComponent } from './web-pages/sales-leads/sales-leads.component';
import { EditNewsComponent } from './web-pages/edit-news/edit-news.component';
import { EditWebsiteComponent } from './web-pages/edit-website/edit-website.component';
import { SalesOrdersComponent } from './web-pages/sales-orders/sales-orders.component';
import { SupportTicketsComponent } from './web-pages/support-tickets/support-tickets.component';
import { JobApplicationsComponent } from './web-pages/job-applications/job-applications.component';
import { KnowledgeBaseComponent } from './intranet/knowledge-base/knowledge-base.component';
import { KbArticleComponent } from './intranet/knowledge-base/kb-article/kb-article.component';
import { NewsComponent } from './intranet/knowledge-base/pages/news/news.component';
import { SupportFormComponent } from './intranet/knowledge-base/pages/support-form/support-form.component';
import { ProjectsComponent } from './web-pages/projects/projects.component';

// Core module components
import { CoreDashboardComponent } from './core-pages/dashboard/dashboard.component';
import { EditLegalComponent } from './core-pages/edit-legal/edit-legal.component';
import { PersonalInfoComponent } from './core-pages/personal-info/personal-info.component';
import { WebSettingsComponent } from './core-pages/web-settings/web-settings.component';
import { ExternalLinksComponent } from './core-pages/external-links/external-links.component';
import { EditRolesComponent } from './core-pages/edit-roles/edit-roles.component';
import { AdministratorsComponent } from './core-pages/administrators/administrators.component';
import { CoreLogsComponent } from './core-pages/logs/logs.component';
import { WelcomePageComponent } from './core-pages/welcome-page/welcome-page.component';
import { SecurityEventsComponent } from './core-pages/security-events/security-events.component';

// Shop module components
import { DashboardComponent as ShopDashboardComponent } from './shop-pages/dashboard/dashboard.component';
import { ProductsComponent } from './shop-pages/products/products.component';
import { CategoriesComponent } from './shop-pages/categories/categories.component';
import { OrdersComponent } from './shop-pages/orders/orders.component';
import { CustomersComponent } from './shop-pages/customers/customers.component';
import { CouponsComponent } from './shop-pages/coupons/coupons.component';
import { ShopLogsComponent } from './shop-pages/shop-logs/shop-logs.component';
import { ShippingMethodsComponent } from './shop-pages/shipping-methods/shipping-methods.component';
import { SuppliersComponent } from './shop-pages/suppliers/suppliers.component';
import { PaymentMethodsComponent } from './shop-pages/payment-methods/payment-methods.component';
import { EditEshopComponent } from './shop-pages/edit-eshop/edit-eshop.component';
import { ShopWelcomePageComponent } from './shop-pages/shop-welcome-page/shop-welcome-page.component';
import { WebWelcomePageComponent } from './web-pages/web-welcome-page/web-welcome-page.component';
import { AdminErrorPageComponent } from './error-pages/admin-error-page.component';
/**
 * @description Defines the navigation hierarchy and access permissions for the administration interface.
 * @usage Acts as the master route table for the admin module. Adding a page only needs a new
 *        route with `data: { permission: '<key>' }` (several keys separated by `|` mean "any of them")
 *        and `help: '<knowledge base page id>'` - the help button ("?", PageHelpComponent) in the
 *        page header opens that page of the knowledge base (api/resources/knowledge-base/structure.json).
 * @note Routes are grouped into Web, Core, and E-Shop segments, each under its own path prefix
 *       ('web/', 'core/', 'shop/') for a consistent, predictable URL structure.
 *       AuthGuard is registered twice on purpose: `canActivate` verifies the session when the
 *       layout is entered, `canActivateChild` checks `data.permission` of every page below it.
 *       A user without the permission is redirected to the first page they can open; the order
 *       of the routes below is therefore also the order of preference for that fallback.
 */
export const ADMIN_ROUTES: Routes = [
  // 📘 INTERNAL MANUAL - own full-screen layout (no admin layout). MUST come before the admin
  // layout route below: its '**' child (404 page) would otherwise catch /admin/intranet/... first.
  {
    path: 'intranet',
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    children: [
      {
        path: 'knowledge-base',
        component: KnowledgeBaseComponent,
        children: [
          // Explicit components (real logic, not static text) - MUST
          // come before ':pageId', otherwise the router would catch them as the parameter.
          { path: 'support-form', component: SupportFormComponent },
          { path: 'news', component: NewsComponent },
          // Generic renderer of ALL other manual pages - the content comes from the API
          // (api/resources/knowledge-base/*.json; a new page needs no new route).
          { path: ':pageId', component: KbArticleComponent },
          { path: '', redirectTo: 'introductions', pathMatch: 'full' }
        ]
      }
    ]
  },
  {
    path: '',
    component: AdminLayoutComponent,
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    children: [
      { path: '', redirectTo: 'core/welcome-page', pathMatch: 'full' },

      // 🌍 WEB PAGES (website management interfaces)
      {
        path: 'web',
        children: [
          { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
          { path: 'dashboard', component: DashboardComponent, data: { help: 'web-dashboard', permission: 'web-view-dashboard' } },
          { path: 'user-request', component: UserRequestComponent, data: { help: 'user-request', permission: 'web-user-requests-view' } },
          { path: 'business-logs', component: BusinessLogsComponent, data: { help: 'web-business-logs', permission: 'web-view-web-logs' } },
          { path: 'sales-leads', component: SalesLeadsComponent, data: { help: 'sales-leads', permission: 'web-sales-leads-view' } },
          { path: 'edit-news', component: EditNewsComponent, data: { help: 'edit-news', permission: 'web-news-view' } },
          { path: 'edit-website', component: EditWebsiteComponent, data: { help: 'edit-website', permission: 'web-edit-website-view' } },
          { path: 'sales-orders', component: SalesOrdersComponent, data: { help: 'sales-orders', permission: 'web-sales-orders-view' } },
          { path: 'support-tickets', component: SupportTicketsComponent, data: { help: 'support-tickets', permission: 'web-support-tickets-view' } },
          { path: 'job-applications', component: JobApplicationsComponent, data: { help: 'job-applications', permission: 'web-job-applications-view' } },
          { path: 'projects', component: ProjectsComponent, data: { help: 'projects', permission: 'web-projects-view' } },
          { path: 'welcome-page', component: WebWelcomePageComponent, data: { help: 'web-welcome-page', permission: 'web-welcome-page-view' } },
         ]
      },

      // 🧩 CORE PAGES (system / shared across Web and E-shop)
      {
        path: 'core',
        children: [
          { path: '', redirectTo: 'welcome-page', pathMatch: 'full' },
          { path: 'dashboard', component: CoreDashboardComponent, data: { help: 'core-dashboard', permission: 'view-core' } },
          { path: 'welcome-page', component: WelcomePageComponent, data: { help: 'welcome-page', permission: 'core-view-welcome-page' } },
          { path: 'edit-legal', component: EditLegalComponent, data: { help: 'edit-legal', permission: 'core-legal-documents-view|core-legal-config-view' } },
          // Own account (password, 2FA) - every signed-in user, no permission (VT-13); the API lets
          // the own account through by `selfParam` (CheckPermission).
          { path: 'personal-info', component: PersonalInfoComponent, data: { help: 'personal-info' } },
          { path: 'web-settings', component: WebSettingsComponent, data: { help: 'web-settings', permission: 'core-legal-config-view' } },
          { path: 'external-links', component: ExternalLinksComponent, data: { help: 'external-links', permission: 'core-external-links-view' } },
          // Restricted to the 'sysadmin' role regardless of the permission system (see sysadminGuard).
          { path: 'edit-roles', component: EditRolesComponent, data: { help: 'edit-roles' }, canActivate: [sysadminGuard] },
          { path: 'administrators', component: AdministratorsComponent, data: { help: 'administrators', permission: 'core-administrators-view' } },
          // System audit log (core/logs).
          { path: 'logs', component: CoreLogsComponent, data: { help: 'core-logs', permission: 'view-core' } },
          { path: 'security-events', component: SecurityEventsComponent, data: { help: 'security-events', permission: 'core-security-view' } },
        ]
      },

      // 🛒 E-SHOP PAGES (e-commerce administrative interfaces)
      {
        path: 'shop',
        children: [
          { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
          { path: 'dashboard', component: ShopDashboardComponent, data: { help: 'shop-dashboard', permission: 'shop-view-dashboard' } },
          { path: 'products', component: ProductsComponent, data: { help: 'shop-products', permission: 'shop-products-view' } },
          { path: 'categories', component: CategoriesComponent, data: { help: 'shop-categories', permission: 'shop-categories-view' } },
          { path: 'orders', component: OrdersComponent, data: { help: 'shop-orders', permission: 'shop-orders-view' } },
          { path: 'customers', component: CustomersComponent, data: { help: 'shop-customers', permission: 'shop-customers-view' } },
          { path: 'shipping-methods', component: ShippingMethodsComponent, data: { help: 'shop-shipping-methods', permission: 'shop-shipping-methods-view' } },
          { path: 'payment-methods', component: PaymentMethodsComponent, data: { help: 'shop-payment-methods', permission: 'shop-payment-methods-view' } },
          { path: 'suppliers', component: SuppliersComponent, data: { help: 'shop-suppliers', permission: 'shop-suppliers-view' } },
          { path: 'coupons', component: CouponsComponent, data: { help: 'coupons', permission: 'shop-coupons-view' } },
          { path: 'logs', component: ShopLogsComponent, data: { help: 'shop-logs', permission: 'shop-view-logs' } },
          { path: 'edit-eshop', component: EditEshopComponent, data: { help: 'edit-eshop', permission: 'shop-edit-eshop-view' } },
          { path: 'welcome-page', component: ShopWelcomePageComponent, data: { help: 'shop-welcome-page', permission: 'shop-welcome-page-view' } }
        ]
      },

      // ⛔ ERROR PAGES of the admin (inside the layout, no permission needed - see AuthGuard).
      // 403: target of AuthGuard.denyAccess() for an existing page the user may not open.
      { path: 'forbidden', component: AdminErrorPageComponent, data: { [ADMIN_ERROR_PAGE_KEY]: 'forbidden' } },
      // 404: any /admin/... address no route above knows - MUST STAY THE LAST CHILD.
      { path: '**', component: AdminErrorPageComponent, data: { [ADMIN_ERROR_PAGE_KEY]: 'not-found' } }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(ADMIN_ROUTES)],
  exports: [RouterModule]
})
export class AdminRoutingModule { }