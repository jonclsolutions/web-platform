/**
 * @file admin-routing.module.ts
 * @path src/app/admin/admin-routing.module.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Centralized routing configuration for the administrative module, separating Web, Core, and E-Shop interfaces with role-based access control.
 * @dependencies
 * - RouterModule: Core Angular routing service.
 * - AuthGuard: Authentication middleware ensuring restricted access to administrative routes.
 * - AdminLayoutComponent: Main wrapper layout for the admin section.
 *
 * @refactor-note (2026) KNOWLEDGE BASE REFACTOR: `pages/introductions|security|contacts|
 * sales-rep` komponenty odstraněny - jejich obsah je teď statická data v
 * `kb-pages.data.ts`, vykreslovaná JEDNÍM generickým `KbArticleComponent` přes
 * `:pageId` route. `support-form` a `news` ZŮSTÁVAJÍ vlastní explicitní komponenty
 * (mají skutečnou logiku, ne statický text) - musí být v `children` PŘED `:pageId`,
 * jinak by je Angular router zachytil jako hodnotu parametru dřív, než by došel
 * k jejich explicitní route (router matchuje shora dolů).
 *
 * @bugfix-note (2026-10-05) PERMISSIONS OF CHILD PAGES WERE NEVER CHECKED: AuthGuard was
 * registered only as `canActivate` of the layout route. That hook receives the layout's own
 * route (no `data.permission`) and does not run again while the layout stays active, so every
 * page could be opened by typing its URL (the API still answered 403, so no data leaked).
 * Both top-level routes now also register `canActivateChild: [AuthGuard]`, which checks the
 * `data.permission` of each child page on every navigation.
 */

import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminLayoutComponent } from './components/admin-layout/admin-layout.component';
import { DashboardComponent } from './web-pages/dashboard/dashboard.component';
import { UserRequestComponent } from './web-pages/user-request/user-request.component';
import { AuthGuard } from '../core/auth/guards/auth.guard';
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

// Core module components (přesunuto z web-pages do core-pages skriptem create-core-pages.sh)
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
/**
 * @description Defines the navigation hierarchy and access permissions for the administration interface.
 * @usage Acts as the master route table for the admin module. Adding a page only needs a new
 *        route with `data: { permission: '<key>' }` (several keys separated by `|` mean "any of them").
 * @note Routes are grouped into Web, Core, and E-Shop segments, each under its own path prefix
 *       ('web/', 'core/', 'shop/') for a consistent, predictable URL structure.
 *       AuthGuard is registered twice on purpose: `canActivate` verifies the session when the
 *       layout is entered, `canActivateChild` checks `data.permission` of every page below it.
 *       A user without the permission is redirected to the first page they can open; the order
 *       of the routes below is therefore also the order of preference for that fallback.
 */
const routes: Routes = [
  {
    path: '',
    component: AdminLayoutComponent,
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    children: [
      { path: '', redirectTo: 'core/welcome-page', pathMatch: 'full' },

      // 🌍 WEB STRÁNKY (Core website management interfaces)
      {
        path: 'web',
        children: [
          { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
          { path: 'dashboard', component: DashboardComponent, data: { permission: 'web-view-dashboard' } },
          { path: 'dashboard', component: DashboardComponent, data: { permission: 'web-view-dashboard' } },
          { path: 'user-request', component: UserRequestComponent, data: { permission: 'web-user-requests-view' } },
          { path: 'business-logs', component: BusinessLogsComponent, data: { permission: 'web-view-web-logs' } },
          { path: 'sales-leads', component: SalesLeadsComponent, data: { permission: 'web-sales-leads-view' } },
          { path: 'edit-news', component: EditNewsComponent, data: { permission: 'web-news-view' } },
          { path: 'edit-website', component: EditWebsiteComponent, data: { permission: 'web-view-edit-website' } },
          { path: 'sales-orders', component: SalesOrdersComponent, data: { permission: 'web-sales-orders-view' } },
          { path: 'support-tickets', component: SupportTicketsComponent, data: { permission: 'web-support-tickets-view' } },
          { path: 'job-applications', component: JobApplicationsComponent, data: { permission: 'web-job-applications-view' } },
          { path: 'projects', component: ProjectsComponent, data: { permission: 'web-projects-view' } },
          { path: 'welcome-page', component: WebWelcomePageComponent, data: { permission: 'web-welcome-page-view' } },
         ]
      },

      // 🧩 CORE STRÁNKY (systémové/sdílené napříč Web a E-shop)
      {
        path: 'core',
        children: [
          { path: '', redirectTo: 'welcome-page', pathMatch: 'full' },
          { path: 'dashboard', component: CoreDashboardComponent, data: { permission: 'view-core' } },
          { path: 'welcome-page', component: WelcomePageComponent, data: { permission: 'core-view-welcome-page' } },
          { path: 'edit-legal', component: EditLegalComponent, data: { permission: 'core-legal-documents-view|core-legal-config-view' } },
          { path: 'personal-info', component: PersonalInfoComponent, data: { permission: 'web-view-personal-info' } },
          { path: 'web-settings', component: WebSettingsComponent, data: { permission: 'core-legal-config-view' } },
          { path: 'external-links', component: ExternalLinksComponent, data: { permission: 'core-external-links-view' } },
          // Nezávisle na permission systému natvrdo omezeno na roli 'sysadmin' (viz sysadminGuard).
          { path: 'edit-roles', component: EditRolesComponent, canActivate: [sysadminGuard] },
          { path: 'administrators', component: AdministratorsComponent, data: { permission: 'core-administrators-view' } },
          // Placeholder - dočasně čte ze stejného zdroje jako web/business-logs, viz poznámka v logs.component.ts.
          { path: 'logs', component: CoreLogsComponent, data: { permission: 'view-core' } },
          { path: 'security-events', component: SecurityEventsComponent, data: { permission: 'core-security-view' } },
        ]
      },

      // 🛒 E-SHOP STRÁNKY (E-commerce administrative interfaces)
      {
        path: 'shop',
        children: [
          { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
          { path: 'dashboard', component: ShopDashboardComponent, data: { permission: 'shop-view-dashboard' } },
          { path: 'products', component: ProductsComponent, data: { permission: 'shop-manage-products' } },
          { path: 'categories', component: CategoriesComponent, data: { permission: 'shop-manage-categories' } },
          { path: 'orders', component: OrdersComponent, data: { permission: 'shop-view-orders' } },
          { path: 'customers', component: CustomersComponent, data: { permission: 'shop-manage-customers' } },
          { path: 'shipping-methods', component: ShippingMethodsComponent, data: { permission: 'shop-manage-shipping-methods' } },
          { path: 'payment-methods', component: PaymentMethodsComponent, data: { permission: 'shop-manage-payment-methods' } },
          { path: 'suppliers', component: SuppliersComponent, data: { permission: 'shop-manage-suppliers' } },
          { path: 'coupons', component: CouponsComponent, data: { permission: 'shop-view-reports' } },
          { path: 'logs', component: ShopLogsComponent, data: { permission: 'shop-view-logs' } },
          { path: 'edit-eshop', component: EditEshopComponent, data: { permission: 'shop-view-edit-eshop' } },
          { path: 'welcome-page', component: ShopWelcomePageComponent, data: { permission: 'shop-welcome-page-view' } }
        ]
      }
    ]
  },
  {
    path: 'intranet',
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    children: [
      {
        path: 'knowledge-base',
        component: KnowledgeBaseComponent,
        children: [
          // Vlastní explicitní komponenty (reálná logika, ne statický text) - MUSÍ
          // být před ':pageId', jinak by je router zachytil jako parametr.
          { path: 'support-form', component: SupportFormComponent },
          { path: 'news', component: NewsComponent },
          // Generický renderer pro VŠECHNY ostatní stránky manuálu - viz
          // kb-pages.data.ts pro přidání nové stránky (žádná nová route potřeba).
          { path: ':pageId', component: KbArticleComponent },
          { path: '', redirectTo: 'introductions', pathMatch: 'full' }
        ]
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule { }