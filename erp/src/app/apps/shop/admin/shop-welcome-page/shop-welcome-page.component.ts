/**
 * @file shop-welcome-page.component.ts
 * @path src/app/apps/shop/admin/shop-welcome-page/shop-welcome-page.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Welcome / landing page of the "E-shop" module - seen by a user with the
 * `shop-welcome-page-view` permission after switching to the Shop module in the header. Same
 * role as `WebWelcomePageComponent` for the Web module - a purely informational landing page
 * (products, orders, payments, shipping, suppliers), WITHOUT personal data of the user. The
 * cards are gated by the same permission keys as the left menu of `AdminLayoutComponent`.
 * @dependencies
 * - HasPermissionDirective: Gates the visibility of the cards (`*appHasPermission`).
 * - AdminLocalizationService: Static i18n of the admin UI - manual injection.
 */

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';
import { AdminLocalizationService } from '../../../../core/services/admin-localization.service';
import { PageHelpComponent } from '../../../../admin/components/page-help/page-help.component';

/** @description One quick link of a card - `icon` is a key rendered through @switch in the template (shared SVGs in the same visual language as the admin-layout menu). */
interface QuickLinkCard {
  icon: string;
  titleKey: string;
  descKey: string;
  route: string;
  permission: string;
}

@Component({
  selector: 'app-shop-welcome-page',
  standalone: true,
  imports: [CommonModule, RouterModule, HasPermissionDirective, PageHelpComponent],
  templateUrl: './shop-welcome-page.component.html',
  styleUrls: ['../../../../admin/shared-styles/welcome-page.css', '../../../../admin/shared-styles/welcome-links.css'],
})
export class ShopWelcomePageComponent {
  public readonly i18n = inject(AdminLocalizationService);

  public get strings(): any { return this.i18n.getMergedSection('shop-welcome-page'); }

  /**
   * @description Quick links to the key pages of the Shop module, in the order of the left menu
   * (see admin-layout.component.html, sections "Catalog" / "Transactions" / "Customers" /
   * "Logistics" / "Web content" / "System"). The permission keys match the menu 1:1.
   */
  readonly quickLinks: QuickLinkCard[] = [
    { icon: 'products', titleKey: 'card_products_title', descKey: 'card_products_desc', route: '/admin/shop/products', permission: 'shop-products-view' },
    { icon: 'categories', titleKey: 'card_categories_title', descKey: 'card_categories_desc', route: '/admin/shop/categories', permission: 'shop-categories-view' },
    { icon: 'orders', titleKey: 'card_orders_title', descKey: 'card_orders_desc', route: '/admin/shop/orders', permission: 'shop-orders-view' },
    { icon: 'customers', titleKey: 'card_customers_title', descKey: 'card_customers_desc', route: '/admin/shop/customers', permission: 'shop-customers-view' },
    { icon: 'shipping', titleKey: 'card_shipping_title', descKey: 'card_shipping_desc', route: '/admin/shop/shipping-methods', permission: 'shop-shipping-methods-view' },
    { icon: 'payment', titleKey: 'card_payment_title', descKey: 'card_payment_desc', route: '/admin/shop/payment-methods', permission: 'shop-payment-methods-view' },
    { icon: 'suppliers', titleKey: 'card_suppliers_title', descKey: 'card_suppliers_desc', route: '/admin/shop/suppliers', permission: 'shop-suppliers-view' },
    { icon: 'coupons', titleKey: 'card_coupons_title', descKey: 'card_coupons_desc', route: '/admin/shop/coupons', permission: 'shop-coupons-view' },
    { icon: 'edit-eshop', titleKey: 'card_edit_eshop_title', descKey: 'card_edit_eshop_desc', route: '/admin/shop/edit-eshop', permission: 'shop-edit-eshop-view' },
    { icon: 'logs', titleKey: 'card_logs_title', descKey: 'card_logs_desc', route: '/admin/shop/logs', permission: 'shop-view-logs' },
  ];

  t(key: string): string {
    return this.i18n.getValue(`shop-welcome-page.${key}`);
  }
}