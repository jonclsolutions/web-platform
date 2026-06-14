import { Component } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { RouterModule, Router, RouterLink } from '@angular/router';

// Služby košíku
import { CartService, CartItem } from '../components/services/cart.service';

// Přímé importy dialogových služeb
import { AlertDialogService } from '../../../core/services/alert-dialog.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';

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

  // Výpočet celkové ceny bez DPH
  totalPriceWithoutTax(): number {
    const total = this.cartService.totalPrice();
    const tax = this.cartService.totalTax();
    return total - tax;
  }

  decreaseQuantity(itemId: string): void {
    const item = this.cartService.cartItems().find(i => i.id === itemId);
    if (item && Number(item.quantity) > 1) {
      this.cartService.updateItemQuantity(itemId, Number(item.quantity) - 1);
    }
  }

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

  isMaxStockReached(item: CartItem): boolean {
    if (!item) return false;
    
    const aktualniMnozstvi = Number(item.quantity);
    const stropSkladu = Number(item.stock_quantity);
    
    return aktualniMnozstvi >= stropSkladu;
  }

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

  proceedToCheckout(): void {
    this.router.navigate(['/shop/checkout']);
  }

  // 🛠️ UPRAVENO: Formátování na EUR
  formatPrice(price: number): string {
    return new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2
    }).format(price);
  }
}