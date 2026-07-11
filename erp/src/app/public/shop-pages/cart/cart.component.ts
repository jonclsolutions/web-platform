/**
 * @file cart.component.ts
 * @path src/app/public/shop-pages/cart/cart.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 */

import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, RouterLink } from '@angular/router';
import { BasePublicComponent } from '../../base-public.component';
import { CartService, CartItem } from '../components/services/cart.service';
import { AlertDialogService } from '../../../core/services/alert-dialog.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [FormsModule, RouterModule, RouterLink],
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CartComponent extends BasePublicComponent {

  protected readonly translationKey = 'cart';
  
  private router = inject(Router);
  private confirmDialogService = inject(ConfirmDialogService);
  private alertDialogService = inject(AlertDialogService);
  public cartService = inject(CartService);

  /**
   * @description Calculates the total price of all items in the cart excluding tax.
   */
  totalPriceWithoutTax(): number {
    const total = this.cartService.totalPrice();
    const tax = this.cartService.totalTax();
    return total - tax;
  }

  /**
   * @description Decrements the quantity of a specific cart item if it is above the minimum (1).
   */
  decreaseQuantity(itemId: string): void {
    const item = this.cartService.cartItems().find(i => i.id === itemId);
    if (item && Number(item.quantity) > 1) {
      this.cartService.updateItemQuantity(itemId, Number(item.quantity) - 1);
      this.cdr.markForCheck();
    }
  }

  /**
   * @description Increments the quantity of a specific cart item, respecting inventory limits.
   */
  increaseQuantity(itemId: string): void {
    const item = this.cartService.cartItems().find(i => i.id === itemId);
    
    if (!item) {
      console.error(`[DEBUG KOŠÍK] Položka s ID ${itemId} nebyla v košíku nalezena!`);
      return;
    }

    const aktualniMnozstvi = Number(item.quantity);
    const stropSkladu = Number(item.stock_quantity);

    if (aktualniMnozstvi >= stropSkladu) {
      return;
    }

    this.cartService.updateItemQuantity(itemId, aktualniMnozstvi + 1);
    this.cdr.markForCheck();
  }

  /**
   * @description Checks if the requested quantity for a product has reached its available stock.
   */
  isMaxStockReached(item: CartItem): boolean {
    if (!item) return false;
    return Number(item.quantity) >= Number(item.stock_quantity);
  }

  /**
   * @description Triggers a confirmation dialog before permanently removing an item from the cart.
   */
  removeItem(itemId: string): void {
    this.confirmDialogService.open(
      this.t?.confirm_remove_title || 'Odstranit z košíku', 
      this.t?.confirm_remove_text || 'Opravdu chcete odstranit tuto položku z košíku?'
    )
    .then(confirmed => {
      if (confirmed) {
        this.cartService.removeItem(itemId);
        this.cdr.markForCheck();
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
   */
  formatPrice(price: number): string {
    return new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2
    }).format(price);
  }
}