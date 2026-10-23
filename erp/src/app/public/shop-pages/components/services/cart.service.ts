/**
 * @file cart.service.ts
 * @path src/app/public/shop-pages/components/services/cart.service.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Manages the e-shop shopping cart state: item persistence (LocalStorage), quantities
 *   limited by the shown stock, totals and tax.
 * @dependencies
 * - Angular Core: For signals, computed properties, and effects to handle reactive state.
 * - HttpClient: For communicating with the checkout API endpoints.
 * - environment: Provides API configuration URLs.
 * @refactor-note (2026-10-21) Removed unused code (no reference in TS, templates or
 *   string literals): `timeRemaining`, `isExpired`, `createOrder`, expiredNotificationPending (write-only flag).
 * @refactor-note (2026-10-23) Removed the "15-minute reservation" (open finding #42): the backend
 *   reserves no stock (availability is checked when the order is placed), the private
 *   `timerSignal` / `isExpiredSignal` were read by nobody, a 1-second interval ran forever and an
 *   "expired" cart was kept as is anyway. Gone: RESERVATION_TIME, the timer, `expiresAt` of the cart
 *   and `reservedAt` of the items (old stored carts still load - the fields are ignored).
 */

import { Injectable, signal, computed, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';

/** Data structure for individual items within the shopping cart */
export interface CartItem {
  id: string; // Unique identifier: productId_variantId
  product_id: number;
  product_variant_id: number | null;
  product_name: string;
  variant_name: string | null;
  product_slug: string;
  product_image?: string;
  quantity: number;
  unit_price: number; // Strictly enforces EUR price with VAT
  total_price: number; // Derived as unit_price * quantity
  vat_rate: number;
  stock_quantity: number;
  /** Full database pricing object used for server-side verification */
  prices?: {
    price_eur_with_vat: number;
    price_eur_without_vat: number;
    vat_rate: number;
    [key: string]: any;
  };
}

/** Root interface for the entire cart state */
export interface Cart {
  items: CartItem[];
  createdAt: number;
}

/**
 * @description Service for handling global cart operations.
 * @usage Provides a single source of truth for the cart state accessible by multiple components.
 * @note Utilizes Signals for reactive UI updates and persists state via LocalStorage. No stock
 *   reservation - the checkout checks availability.
 */
@Injectable({
  providedIn: 'root'
})
export class CartService {
  private readonly CART_STORAGE_KEY = 'shop_cart';

  private cartSignal = signal<Cart>({
    items: [],
    createdAt: Date.now()
  });

  cartItems = computed(() => this.cartSignal().items);
  cartCount = computed(() => this.cartItems().length);
  
  /** Sum of all quantities in the cart */
  totalQuantity = computed(() => 
    this.cartItems().reduce((sum, item) => sum + item.quantity, 0)
  );

  /** Sum of all item total prices */
  subtotal = computed(() => 
    this.cartItems().reduce((sum, item) => sum + item.total_price, 0)
  );

  /** Tax calculation based on item vat_rate */
  totalTax = computed(() => {
    return this.cartItems().reduce((sum, item) => {
      const priceWithoutTax = item.total_price / (1 + (item.vat_rate / 100));
      return sum + (item.total_price - priceWithoutTax);
    }, 0);
  });

  totalPrice = computed(() => this.subtotal());

  constructor(private http: HttpClient) {
    this.loadCart();

    effect(() => {
      const cart = this.cartSignal();
      this.saveCart(cart);
    });
  }

  /**
   * @description Attempts to load the cart from LocalStorage on initialization.
   * @note Carts stored by older versions (with `expiresAt` / `reservedAt`) load the same way.
   */
  private loadCart(): void {
    const stored = localStorage.getItem(this.CART_STORAGE_KEY);
    if (stored) {
      try {
        const cart = JSON.parse(stored);
        this.cartSignal.set({ items: Array.isArray(cart?.items) ? cart.items : [], createdAt: cart?.createdAt ?? Date.now() });
      } catch (e) {
        console.error('Error loading cart from storage:', e);
      }
    }
  }

  private saveCart(cart: Cart): void {
    localStorage.setItem(this.CART_STORAGE_KEY, JSON.stringify(cart));
  }

  /**
   * @description Adds a product to the cart or increments quantity if already present.
   * @param product The base product object.
   * @param variant Optional specific variant selected.
   * @param quantity Quantity to add.
   */
  addItem(product: any, variant: any | null, quantity: number = 1): void {
    const itemId = this.generateItemId(product.id, variant?.id);
    const existingItem = this.cartItems().find(i => i.id === itemId);

    const activePrices = variant ? variant.prices : product.prices;
    const unitPrice = activePrices ? activePrices['price_eur_with_vat'] : 0;
    const vatRate = activePrices ? activePrices['vat_rate'] : (variant?.vat_rate || product.vat_rate || 21);
    
    if (unitPrice <= 0) {
      console.error('Critical Error: Product cannot be added without a valid EUR price.', { product, variant });
      return;
    }

    const variantName = variant ? variant.variant_name : null;
    const stockQuantity = variant ? (variant.stock_quantity ?? 2) : (product.stock_quantity ?? 2);
    
    const productImage = variant?.images?.[0]?.url || 
                         product.images?.find((img: any) => img.is_primary)?.url || 
                         product.images?.[0]?.url || 
                         'assets/images/placeholder-product.png';

    if (existingItem) {
      this.updateItemQuantity(itemId, existingItem.quantity + quantity);
    } else {
      const finalQty = Math.min(quantity, stockQuantity);

      const newItem: CartItem = {
        id: itemId,
        product_id: product.id,
        product_variant_id: variant?.id || null,
        product_name: product.name,
        variant_name: variantName,
        product_image: productImage,
        quantity: finalQty,
        product_slug: product.slug,
        unit_price: unitPrice,
        total_price: unitPrice * finalQty,
        vat_rate: vatRate,
        stock_quantity: stockQuantity,
        prices: activePrices
      };

      const cart = this.cartSignal();
      this.cartSignal.set({ ...cart, items: [...cart.items, newItem] });
    }
  }

  /**
   * @description Updates quantity for an existing cart item and adjusts total_price.
   * @param itemId Unique cart identifier.
   * @param quantity New requested quantity.
   */
  updateItemQuantity(itemId: string, quantity: number): void {
    if (quantity <= 0) {
      this.removeItem(itemId);
      return;
    }

    const cart = this.cartSignal();
    const updatedItems = cart.items.map(item => {
      if (item.id === itemId) {
        const finalQty = Math.min(quantity, item.stock_quantity);
        return {
          ...item,
          quantity: finalQty,
          total_price: item.unit_price * finalQty
        };
      }
      return item;
    });

    this.cartSignal.set({ ...cart, items: updatedItems });
  }

  /**
   * @description Removes an item from the cart.
   * @param itemId Unique cart identifier.
   */
  removeItem(itemId: string): void {
    const cart = this.cartSignal();
    this.cartSignal.set({ ...cart, items: cart.items.filter(item => item.id !== itemId) });
  }

  /**
   * @description Wipes cart state and storage.
   */
  clear(): void {
    this.cartSignal.set({
      items: [],
      createdAt: Date.now()
    });
    localStorage.removeItem(this.CART_STORAGE_KEY);
  }

  private generateItemId(productId: number, variantId: number | null): string {
    return `${productId}_${variantId || 'novariant'}`;
  }

  simulatePayment(orderId: number): Observable<any> {
    return this.http.post(`${environment.base_api_url}/shop/checkout/simulate-payment`, { order_id: orderId });
  }
}