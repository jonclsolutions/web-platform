import { Injectable, signal, computed, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';

export interface CartItem {
  id: string; // uuid: productId_variantId
  product_id: number;
  product_variant_id: number | null;
  product_name: string;
  variant_name: string | null;
  product_slug: string;
  product_image?: string;
  quantity: number;
  unit_price: number; // 🛡️ Vždy drží striktně EUR cenu s DPH
  total_price: number; // 🛡️ unit_price * quantity
  vat_rate: number;
  stock_quantity: number;
  reservedAt: number;
  // 🛡️ Uchováme kompletní cenový objekt z DB pro pozdější verifikaci
  prices?: {
    price_eur_with_vat: number;
    price_eur_without_vat: number;
    vat_rate: number;
    [key: string]: any;
  };
}

export interface Cart {
  items: CartItem[];
  expiresAt: number;
  createdAt: number;
}

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private readonly CART_STORAGE_KEY = 'shop_cart';
  private readonly RESERVATION_TIME = 15 * 60 * 1000; // 15 minut

  private cartSignal = signal<Cart>({
    items: [],
    expiresAt: 0,
    createdAt: Date.now()
  });

  private timerSignal = signal<number>(0);
  private isExpiredSignal = signal<boolean>(false);
  
  private expiredNotificationPending = false;

  cartItems = computed(() => this.cartSignal().items);
  cartCount = computed(() => this.cartItems().length);
  totalQuantity = computed(() => 
    this.cartItems().reduce((sum, item) => sum + item.quantity, 0)
  );
  subtotal = computed(() => 
    this.cartItems().reduce((sum, item) => sum + item.total_price, 0)
  );
  totalTax = computed(() => {
    return this.cartItems().reduce((sum, item) => {
      const priceWithoutTax = item.total_price / (1 + (item.vat_rate / 100));
      return sum + (item.total_price - priceWithoutTax);
    }, 0);
  });
  totalPrice = computed(() => this.subtotal());
  timeRemaining = computed(() => this.timerSignal());
  isExpired = computed(() => this.isExpiredSignal());

  private timerInterval: any;

  constructor(private http: HttpClient) {
    this.loadCart();
    this.startTimer();

    effect(() => {
      const cart = this.cartSignal();
      this.saveCart(cart);
    });
  }

  private loadCart(): void {
    const stored = localStorage.getItem(this.CART_STORAGE_KEY);
    if (stored) {
      try {
        const cart: Cart = JSON.parse(stored);
        const now = Date.now();

        if (now > cart.expiresAt) {
          this.cartSignal.set(cart);
          this.isExpiredSignal.set(true);
          this.expiredNotificationPending = false; 
        } else {
          this.cartSignal.set(cart);
        }
      } catch (e) {
        console.error('Chyba při načítání košíku:', e);
      }
    }
  }

  private saveCart(cart: Cart): void {
    localStorage.setItem(this.CART_STORAGE_KEY, JSON.stringify(cart));
  }

  addItem(product: any, variant: any | null, quantity: number = 1): void {
    const itemId = this.generateItemId(product.id, variant?.id);
    const existingItem = this.cartItems().find(i => i.id === itemId);

    const activePrices = variant ? variant.prices : product.prices;
    // Fix TS4111 pomocí závorkové notace
    const unitPrice = activePrices ? activePrices['price_eur_with_vat'] : 0;
    const vatRate = activePrices ? activePrices['vat_rate'] : (variant?.vat_rate || product.vat_rate || 21);
    
    if (unitPrice <= 0) {
      console.error('⚠️ Detekována kritická chyba! Nelze vložit produkt s nulovou nebo chybějící EUR cenou.', { product, variant });
      alert('Omlouváme se, ale tento produkt momentálně nelze vložit do košíku (chyba nacenění).');
      return;
    }

    const variantName = variant ? variant.variant_name : null;
    const stockQuantity = variant ? (variant.stock_quantity ?? 2) : (product.stock_quantity ?? 2);
    
    console.log(`[KOŠÍK SERVICE] Zabezpečené přidání v EUR: ${product.name}, Cena: ${unitPrice} €`);

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
        reservedAt: Date.now(),
        prices: activePrices
      };

      const cart = this.cartSignal();
      this.cartSignal.set({
        ...cart,
        items: [...cart.items, newItem],
        expiresAt: Date.now() + this.RESERVATION_TIME
      });
    }

    this.resetTimer();
  }

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

    this.cartSignal.set({
      ...cart,
      items: updatedItems,
      expiresAt: Date.now() + this.RESERVATION_TIME
    });

    this.resetTimer();
  }

  removeItem(itemId: string): void {
    const cart = this.cartSignal();
    const updatedItems = cart.items.filter(item => item.id !== itemId);
    
    this.cartSignal.set({
      ...cart,
      items: updatedItems,
      expiresAt: updatedItems.length > 0 ? Date.now() + this.RESERVATION_TIME : 0
    });

    this.resetTimer();
  }

  clear(): void {
    this.cartSignal.set({
      items: [],
      expiresAt: 0,
      createdAt: Date.now()
    });
    localStorage.removeItem(this.CART_STORAGE_KEY);
    this.isExpiredSignal.set(false);
    this.timerSignal.set(0);
  }

  private startTimer(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      const now = Date.now();
      const cart = this.cartSignal();
      
      if (cart.items.length === 0 || cart.expiresAt === 0) {
        this.timerSignal.set(0);
        return;
      }

      const remaining = Math.max(0, Math.floor((cart.expiresAt - now) / 1000));
      this.timerSignal.set(remaining);

      if (remaining <= 0 && cart.items.length > 0) {
        this.expiredNotificationPending = true;
        this.isExpiredSignal.set(true);
      }
    }, 1000);
  }

  private resetTimer(): void {
    const cart = this.cartSignal();
    if (cart.items.length === 0) {
      this.cartSignal.set({ ...cart, expiresAt: 0 });
      this.timerSignal.set(0);
      return;
    }
    this.cartSignal.set({
      ...cart,
      expiresAt: Date.now() + this.RESERVATION_TIME
    });
    this.isExpiredSignal.set(false);
  }

  private generateItemId(productId: number, variantId: number | null): string {
    return `${productId}_${variantId || 'novariant'}`;
  }

  createOrder(
    email: string, firstName: string, lastName: string, phone: string,
    company: string | null, address: string, city: string, postalCode: string,
    country: string, paymentMethodId: number, shippingMethodId: number,
    couponCode: string | null = null, notes: string | null = null
  ): Observable<any> {
    const cart = this.cartSignal();
    const orderData = {
      email, first_name: firstName, last_name: lastName, phone, company, address, city,
      postal_code: postalCode, country, payment_method_id: paymentMethodId,
      shipping_method_id: shippingMethodId, coupon_code: couponCode, notes,
      currency: 'EUR',
      items: cart.items.map(item => ({
        product_id: item.product_id,
        product_variant_id: item.product_variant_id,
        quantity: item.quantity,
        unit_price: item.prices ? item.prices['price_eur_with_vat'] : item.unit_price,
        vat_rate: item.prices ? item.prices['vat_rate'] : item.vat_rate
      }))
    };
    return this.http.post(`${environment.base_api_url}/shop/checkout/create-order`, orderData);
  }

  simulatePayment(orderId: number): Observable<any> {
    return this.http.post(`${environment.base_api_url}/shop/checkout/simulate-payment`, { order_id: orderId });
  }
}