/**
 * @file admin-routing.module.ts
 * @path src/app/admin/admin-routing.module.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Centralized routing configuration for the administrative module, separating Web, E-Shop, and Intranet interfaces with role-based access control.
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
import { AuthGuard } from '../core/auth/guards/auth.guard';
import { sysadminGuard } from '../core/auth/guards/sysadmin.guard';
import { AdministratorsComponent } from './web-pages/administrators/administrators.component';
import { BusinessLogsComponent } from './web-pages/business-logs/business-logs.component';
import { PersonalInfoComponent } from './web-pages/personal-info/personal-info.component';
import { EditWebsiteComponent } from './web-pages/edit-website/edit-website.component';
import { KnowledgeBaseComponent } from './intranet/knowledge-base/knowledge-base.component';
import { IntroductionsComponent } from './intranet/knowledge-base/pages/introductions/introductions.component';
import { SalesRepComponent } from './intranet/knowledge-base/pages/sales-rep/sales-rep.component';
import { SalesLeadsComponent } from './web-pages/sales-leads/sales-leads.component';
import { NewsComponent } from './intranet/knowledge-base/pages/news/news.component';
import { SecurityComponent } from './intranet/knowledge-base/pages/security/security.component';
import { ContactsComponent } from './intranet/knowledge-base/pages/contacts/contacts.component';
import { EditNewsComponent } from './web-pages/edit-news/edit-news.component';
import { SalesOrdersComponent } from './web-pages/sales-orders/sales-orders.component';
import { SupportFormComponent } from './intranet/knowledge-base/pages/support-form/support-form.component';
import { SupportTicketsComponent } from './web-pages/support-tickets/support-tickets.component';
import { JobApplicationsComponent } from './web-pages/job-applications/job-applications.component';
import { EditRolesComponent } from './web-pages/edit-roles/edit-roles.component';

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
import { EditLegalComponent } from './web-pages/edit-legal/edit-legal.component';
import { WebSettingsComponent } from './web-pages/web-settings/web-settings.component';
import { EditEshopComponent } from './shop-pages/edit-eshop/edit-eshop.component';

/**
 * @description Defines the navigation hierarchy and access permissions for the administration interface.
 * @usage Acts as the master route table for the admin module, protected by AuthGuard to prevent unauthenticated access.
 * @note Routes are grouped into Web, E-Shop, and Intranet segments for maintainability and clear logical separation.
 */
const routes: Routes = [
  {
    path: '',
    component: AdminLayoutComponent,
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      
      // 🌍 WEB STRÁNKY (Core website management interfaces)
      { path: 'dashboard', component: DashboardComponent, data: { permission: 'web-view-dashboard' } },
      { path: 'user-request', component: UserRequestComponent, data: { permission: 'web-view-user-requests' } },
      { path: 'administrators', component: AdministratorsComponent, data: { permission: 'web-manage-administrators' } },
      { path: 'business-logs', component: BusinessLogsComponent, data: { permission: 'web-view-web-logs' } },
      { path: 'personal-info', component: PersonalInfoComponent, data: { permission: 'web-view-personal-info' } },
      { path: 'edit-website', component: EditWebsiteComponent, data: { permission: 'web-view-edit-website' } },
      { path: 'sales-leads', component: SalesLeadsComponent, data: { permission: 'web-view-sales-leads' } },
      { path: 'edit-news', component: EditNewsComponent, data: { permission: 'web-view-news' } },
      { path: 'sales-orders', component: SalesOrdersComponent, data: { permission: 'web-view-sales-orders' } },
      { path: 'support-tickets', component: SupportTicketsComponent, data: { permission: 'web-view-support-tickets' } },
      { path: 'job-applications', component: JobApplicationsComponent, data: { permission: 'web-view-job-applications' } },
      { path: 'edit-legal', component: EditLegalComponent, data: { permission: 'web-edit-legal' } },
      { path: 'web-settings', component: WebSettingsComponent, data: { permission: 'web-view-web-settings' } },

      // 🔒 Správa rolí a oprávnění - natvrdo omezeno na roli 'sysadmin' (viz sysadminGuard),
      // nezávisle na permission systému, aby zůstala vždy pod výhradní kontrolou sysadmina.
      { path: 'edit-roles', component: EditRolesComponent, canActivate: [sysadminGuard] },

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