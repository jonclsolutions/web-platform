/**
 * @file cart.component.ts
 * @path src/app/shop/cart/cart.component.ts
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Manages the user's shopping cart interface, including item quantity adjustments, removal, and checkout navigation.
 * @dependencies
 * - CartService: Handles business logic for cart state management.
 * - ConfirmDialogService: Orchestrates user confirmation for removing items.
 * - AlertDialogService: Provides feedback for application-level alerts.
 * - Angular Router: Manages navigation to the checkout page.
 */

import { Component } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { RouterModule, Router, RouterLink } from '@angular/router';

// Služby košíku
import { CartService, CartItem } from '../components/services/cart.service';

// Přímé importy dialogových služeb
import { AlertDialogService } from '../../../core/services/alert-dialog.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';

/**
 * @description Component for managing the shopping cart view.
 * @usage Enables users to review cart items, modify quantities within stock limits, remove items, and proceed to checkout.
 * @note Integrates with CartService to ensure reactive updates to the UI when cart state changes.
 */
@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [FormsModule, RouterModule, RouterLink],
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.css']
})
export class CartComponent {

  constructor(
    public cartService: CartService,
    private router: Router,
    private confirmDialogService: ConfirmDialogService,
    private alertDialogService: AlertDialogService
  ) {}

  /**
   * @description Calculates the total price of all items in the cart excluding tax.
   * @returns The total sum minus the calculated tax.
   */
  totalPriceWithoutTax(): number {
    const total = this.cartService.totalPrice();
    const tax = this.cartService.totalTax();
    return total - tax;
  }

  /**
   * @description Decrements the quantity of a specific cart item if it is above the minimum (1).
   * @param itemId The unique identifier of the product.
   */
  decreaseQuantity(itemId: string): void {
    const item = this.cartService.cartItems().find(i => i.id === itemId);
    if (item && Number(item.quantity) > 1) {
      this.cartService.updateItemQuantity(itemId, Number(item.quantity) - 1);
    }
  }

  /**
   * @description Increments the quantity of a specific cart item, respecting inventory limits.
   * @param itemId The unique identifier of the product.
   * @note Logs debugging information if the item is not found or if the stock limit is reached.
   */
  increaseQuantity(itemId: string): void {
    const item = this.cartService.cartItems().find(i => i.id === itemId);
    
    if (!item) {
      console.error(`[DEBUG KOŠÍK] Položka s ID ${itemId} nebyla v košíku nalezena!`);
      return;
    }

    const aktualniMnozstvi = Number(item.quantity);
    const stropSkladu = Number(item.stock_quantity);

    console.log('=== POKUS O NAVÝŠENÍ MNOŽSTVÍ ===');
    console.log(`Produkt: ${item.product_name}`);
    console.log(`Aktuální množství (jako číslo): ${aktualniMnozstvi}`);
    console.log(`Skladový strop (jako číslo): ${stropSkladu}`);

    if (aktualniMnozstvi >= stropSkladu) {
      console.warn(`[STOPKA] Limit byl dosažen! Služba CartService už nebude volána.`);
      return;
    }

    const noveMnozstvi = aktualniMnozstvi + 1;
    this.cartService.updateItemQuantity(itemId, noveMnozstvi);
  }

  /**
   * @description Checks if the requested quantity for a product has reached its available stock.
   * @param item The cart item to evaluate.
   * @returns True if stock limit is met or exceeded, otherwise false.
   */
  isMaxStockReached(item: CartItem): boolean {
    if (!item) return false;
    
    const aktualniMnozstvi = Number(item.quantity);
    const stropSkladu = Number(item.stock_quantity);
    
    return aktualniMnozstvi >= stropSkladu;
  }

  /**
   * @description Triggers a confirmation dialog before permanently removing an item from the cart.
   * @param itemId The unique identifier of the product.
   */
  removeItem(itemId: string): void {
    this.confirmDialogService.open(
      'Odstranit z košíku', 
      'Opravdu chcete odstranit tuto položku z košíku?'
    )
    .then(confirmed => {
      if (confirmed) {
        this.cartService.removeItem(itemId);
      }
    })
    .catch(() => {});
  }

  /**
   * @description Navigates the user to the checkout process.
   */
  proceedToCheckout(): void {
    this.router.navigate(['/shop/checkout']);
  }

  /**
   * @description Formats a numeric price into a localized EUR currency string.
   * @param price The numeric price to format.
   * @returns Formatted currency string.
   */
  formatPrice(price: number): string {
    return new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2
    }).format(price);
  }
}