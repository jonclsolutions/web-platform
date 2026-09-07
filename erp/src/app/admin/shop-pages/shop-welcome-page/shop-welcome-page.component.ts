/**
 * @file shop-welcome-page.component.ts
 * @path src/app/admin/shop-pages/shop-welcome-page/shop-welcome-page.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Uvítací/rozcestníková stránka modulu "E-shop" - vidí ji uživatel s
 * oprávněním `shop-welcome-page-view` po přepnutí na modul Shop v headeru. Stejná
 * role jako `WebWelcomePageComponent` pro modul Web - čistě informační rozcestník
 * (kompletní správa e-shopu: produkty, objednávky, platby, doprava, dodavatelé),
 * BEZ osobních údajů uživatele. Karty gatované permission klíči 1:1 shodnými s
 * levým menu `AdminLayoutComponent`.
 * @dependencies
 * - HasPermissionDirective: Gatuje viditelnost jednotlivých karet (`*appHasPermission`).
 * - AdminLocalizationService: Statické i18n admin UI - ruční injection.
 */

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';

/** @description Jeden rychlý odkaz na kartě - `icon` je klíč vykreslený přes @switch v šabloně (sdílené SVG se stejným vizuálním jazykem jako admin-layout menu). */
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
  imports: [CommonModule, RouterModule, HasPermissionDirective],
  templateUrl: './shop-welcome-page.component.html',
  styleUrl: './shop-welcome-page.component.css',
})
export class ShopWelcomePageComponent {
  public readonly i18n = inject(AdminLocalizationService);

  public get strings(): any { return this.i18n.getMergedSection('shop-welcome-page'); }

  /**
   * @description Rychlé odkazy na klíčové stránky modulu Shop, v pořadí odpovídajícím
   * levému menu (viz admin-layout.component.html, sekce "Katalog"/"Transakce"/
   * "Zákazníci"/"Logistika"/"Obsah webu"/"Systém"). Permission klíče jsou 1:1 shodné
   * s těmi v menu.
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