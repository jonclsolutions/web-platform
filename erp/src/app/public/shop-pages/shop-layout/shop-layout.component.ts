/**
 * @file shop-layout.component.ts
 * @path src/app/shop/shop-layout/shop-layout.component.ts
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Provides the structural wrapper for the e-shop section, incorporating the global header and footer components with an outlet for nested routes.
 * @dependencies
 * - RouterOutlet: Enables dynamic rendering of nested shop pages (catalog, product detail, checkout).
 * - ShopHeaderComponent: Persistent navigation bar for the shop module.
 * - ShopFooterComponent: Persistent footer for the shop module.
 */

import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ShopFooterComponent } from '../components/shop-footer/shop-footer.component';
import { ShopHeaderComponent } from '../components/shop-header/shop-header.component';
/**
 * @description Master layout component for the shop module.
 * @usage Acts as the main container for all shop-related views, ensuring header and footer are consistent across navigation.
 * @note This layout is typically associated with the main shop route in the application routing configuration.
 */
@Component({
  selector: 'app-shop-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    ShopHeaderComponent,
    ShopFooterComponent
],
  templateUrl: './shop-layout.component.html',
  styleUrls: ['./shop-layout.component.css']
})
export class ShopLayoutComponent {
  // Main layout component; manages the visual scaffolding for the e-shop.
}