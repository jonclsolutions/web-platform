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
 * @refactor-note (2026) Přidána `welcome-page` jako samostatná stránka dostupná z menu
 *      (odkaz "Vítejte"). Výchozí post-login přistávací stránka je od refactoru (2026-2)
 *      `core/dashboard`, ne `welcome-page` - viz redirect '' -> 'core/dashboard' níže
 *      a login.component.ts.
 * @refactor-note (2026-2) Vyčleněna nová sekce `core` (systémové/sdílené stránky napříč
 *      Web a E-shop): GDPR/TOS, osobní informace, firemní údaje, externí odkazy, správa
 *      rolí, správa účtů, welcome-page - přesunuty z `web-pages` do `core-pages` beze
 *      změny permission klíčů (přejmenování řešeno v samostatném tasku). Nové
 *      `core/dashboard` a `core/logs` jsou zatím placeholder stránky chráněné novou
 *      permission `view-core` (nutno ručně doplnit do core_permissions v DB).
 *      `business-logs` zůstává i nadále dostupná ve `web` sekci beze změny - core/logs
 *      je samostatná, dočasně na stejná data napojená stránka, ne přesun.
 * @refactor-note (2026-3) Web stránky sjednoceny pod prefix `web/...` (dřív byly na
 *      kořenové úrovni `/admin/xxx`), stejně jako `core/...` a `shop/...` - konzistentní
 *      URL struktura napříč všemi třemi sekcemi. Zároveň doplněna chybějící route
 *      `web/edit-website` (existoval jen odkaz v menu, route v modulu chyběla).
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
import { IntroductionsComponent } from './intranet/knowledge-base/pages/introductions/introductions.component';
import { SalesRepComponent } from './intranet/knowledge-base/pages/sales-rep/sales-rep.component';
import { NewsComponent } from './intranet/knowledge-base/pages/news/news.component';
import { SecurityComponent } from './intranet/knowledge-base/pages/security/security.component';
import { ContactsComponent } from './intranet/knowledge-base/pages/contacts/contacts.component';
import { SupportFormComponent } from './intranet/knowledge-base/pages/support-form/support-form.component';

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

/**
 * @description Defines the navigation hierarchy and access permissions for the administration interface.
 * @usage Acts as the master route table for the admin module, protected by AuthGuard to prevent unauthenticated access.
 * @note Routes are grouped into Web, Core, and E-Shop segments, each under its own path prefix
 *       ('web/', 'core/', 'shop/') for a consistent, predictable URL structure.
 */
const routes: Routes = [
  {
    path: '',
    component: AdminLayoutComponent,
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'core/dashboard', pathMatch: 'full' },

      // 🌍 WEB STRÁNKY (Core website management interfaces)
      {
        path: 'web',
        children: [
          { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
          { path: 'dashboard', component: DashboardComponent, data: { permission: 'web-view-dashboard' } },
          { path: 'user-request', component: UserRequestComponent, data: { permission: 'web-view-user-requests' } },
          { path: 'business-logs', component: BusinessLogsComponent, data: { permission: 'web-view-web-logs' } },
          { path: 'sales-leads', component: SalesLeadsComponent, data: { permission: 'web-view-sales-leads' } },
          { path: 'edit-news', component: EditNewsComponent, data: { permission: 'web-view-news' } },
          { path: 'edit-website', component: EditWebsiteComponent, data: { permission: 'web-view-edit-website' } },
          { path: 'sales-orders', component: SalesOrdersComponent, data: { permission: 'web-view-sales-orders' } },
          { path: 'support-tickets', component: SupportTicketsComponent, data: { permission: 'web-view-support-tickets' } },
          { path: 'job-applications', component: JobApplicationsComponent, data: { permission: 'web-view-job-applications' } },
        ]
      },

      // 🧩 CORE STRÁNKY (systémové/sdílené napříč Web a E-shop)
      {
        path: 'core',
        children: [
          { path: '', redirectTo: 'welcome-page', pathMatch: 'full' },
          { path: 'dashboard', component: CoreDashboardComponent, data: { permission: 'view-core' } },
          { path: 'welcome-page', component: WelcomePageComponent, data: { permission: 'core-view-welcome-page' } },
          { path: 'edit-legal', component: EditLegalComponent, data: { permission: 'web-edit-legal' } },
          { path: 'personal-info', component: PersonalInfoComponent, data: { permission: 'web-view-personal-info' } },
          { path: 'web-settings', component: WebSettingsComponent, data: { permission: 'web-view-web-settings' } },
          { path: 'external-links', component: ExternalLinksComponent, data: { permission: 'web-manage-external-links' } },
          // Nezávisle na permission systému natvrdo omezeno na roli 'sysadmin' (viz sysadminGuard).
          { path: 'edit-roles', component: EditRolesComponent, canActivate: [sysadminGuard] },
          { path: 'administrators', component: AdministratorsComponent, data: { permission: 'web-manage-administrators' } },
          // Placeholder - dočasně čte ze stejného zdroje jako web/business-logs, viz poznámka v logs.component.ts.
          { path: 'logs', component: CoreLogsComponent, data: { permission: 'view-core' } },
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
          { path: 'edit-eshop', component: EditEshopComponent, data: { permission: 'shop-view-edit-eshop' } }
        ] 
      }
    ]
  },
  {
    path: 'intranet',
    canActivate: [AuthGuard],
    children: [
      {
        path: 'knowledge-base',
        component: KnowledgeBaseComponent,
        children: [
          { path: 'introductions', component: IntroductionsComponent },
          { path: 'sales-rep', component: SalesRepComponent },
          { path: 'news', component: NewsComponent },
          { path: 'security', component: SecurityComponent },
          { path: 'contacts', component: ContactsComponent },
          { path: 'support-form', component: SupportFormComponent },
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