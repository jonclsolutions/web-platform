/**
 * @file cart.service.spec.ts
 * @path src/app/public/shop-pages/components/services/cart.service.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of CartService: adding products / variants (EUR price with VAT
 *   required, image fallbacks, stock cap, merge of the same item), quantity changes, removal,
 *   totals incl. VAT, persistence in localStorage (restored, broken JSON ignored), clear, the
 *   15 min reservation timestamp and the payment simulation request.
 * @note The reservation countdown (`timerSignal` / `isExpiredSignal`) is private and read by
 *   nobody - see open finding "cart reservation timer is not used"; it is checked through the
 *   private signals only to pin the current behaviour.
 * @dependencies
 * - HttpTestingController; real localStorage ('shop_cart' cleared around tests); fakeAsync for
 *   the 1 s interval and the effect that saves the cart.
 */

import { TestBed, discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { CartService } from './cart.service';
import { environment } from '../../../../../environments/environment';

describe('CartService', () => {
  let service: CartService;
  const prices = (withVat: number, vat = 21) => ({ price_eur_with_vat: withVat, price_eur_without_vat: withVat / (1 + vat / 100), vat_rate: vat });
  const product = (over: any = {}) => ({ id: 1, name: 'Mug', slug: 'mug', stock_quantity: 5, prices: prices(12.1), images: [], ...over });

  /** Creates the service (reads the stored cart) and flushes the save effect. */
  function create(): CartService {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const s = TestBed.inject(CartService);
    TestBed.tick();
    return s;
  }
  const stored = () => JSON.parse(localStorage.getItem('shop_cart')!);

  beforeEach(() => localStorage.removeItem('shop_cart'));
  afterEach(() => localStorage.removeItem('shop_cart'));

  /**
   * @description New product: price / VAT from the product, image fallbacks (primary → first →
   *   placeholder), quantity capped by stock, totals and the reservation timestamp; saved.
   * @input addItem(mug, null, 7) with stock 5 and a primary image; product without images.
   * @output quantity 5, total 60.5, image of the primary, id '1_novariant'; placeholder; stored items.
   */
  it('adds products with price, image and stock cap', fakeAsync(() => {
    service = create();
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 0, 1));
    service.addItem(product({ images: [{ url: 'a.jpg' }, { url: 'p.jpg', is_primary: true }] }), null, 7);
    const item = service.cartItems()[0];
    expect([item.id, item.quantity, item.total_price, item.product_image, item.vat_rate]).toEqual(['1_novariant', 5, 60.5, 'p.jpg', 21]);
    expect((service as any).cartSignal().expiresAt).toBe(Date.now() + 15 * 60 * 1000);

    service.addItem(product({ id: 2, images: [{ url: 'first.jpg' }] }), null);
    service.addItem(product({ id: 3, images: undefined, stock_quantity: undefined }), null);
    expect(service.cartItems().map(i => i.product_image)).toEqual(['p.jpg', 'first.jpg', 'assets/images/placeholder-product.png']);
    expect(service.cartItems()[2].stock_quantity).toBe(2);
    expect(service.cartCount()).toBe(3);
    expect(service.totalQuantity()).toBe(7);
    TestBed.tick();
    expect(stored().items.length).toBe(3);
    jasmine.clock().uninstall();
    discardPeriodicTasks();
  }));

  /**
   * @description Variants use their own price, VAT, stock and image; the same item added again
   *   is merged (capped by stock); a missing / zero price is refused.
   * @input Variant 9 (price 24.2, VAT 10, stock 3, image); add it twice (2 + 2); product without prices.
   * @output id '1_9', unit 24.2, vat 10, image v.jpg, quantity 3 (cap); refused + console.error.
   */
  it('handles variants, merging and missing prices', fakeAsync(() => {
    service = create();
    const variant = { id: 9, variant_name: 'Blue', stock_quantity: 3, prices: prices(24.2, 10), images: [{ url: 'v.jpg' }] };
    service.addItem(product(), variant, 2);
    service.addItem(product(), variant, 2);
    const item = service.cartItems()[0];
    expect([item.id, item.unit_price, item.vat_rate, item.product_image, item.variant_name, item.quantity]).toEqual(['1_9', 24.2, 10, 'v.jpg', 'Blue', 3]);
    expect(service.cartCount()).toBe(1);

    spyOn(console, 'error');
    service.addItem(product({ id: 5, prices: null }), null);
    service.addItem(product({ id: 6 }), { id: 1, prices: { price_eur_with_vat: 0, vat_rate: 21 } });
    expect(service.cartCount()).toBe(1);
    expect(console.error).toHaveBeenCalledTimes(2);
    discardPeriodicTasks();
  }));

  /**
   * @description Quantity update (capped by stock), 0 removes, remove the last item resets the
   *   expiry; totals and VAT.
   * @input 2 items (12.10 VAT 21 ×2, 11 VAT 10 ×1); update to 9; update to 0; remove the last.
   * @output subtotal 35.2; tax 4.2 + 1; capped at 5; item removed; empty cart expiresAt 0.
   */
  it('updates quantities, removes items and computes totals', fakeAsync(() => {
    service = create();
    service.addItem(product(), null, 2);
    service.addItem(product({ id: 2, prices: prices(11, 10) }), null, 1);
    expect(service.subtotal()).toBeCloseTo(35.2, 5);
    expect(service.totalPrice()).toBeCloseTo(35.2, 5);
    expect(service.totalTax()).toBeCloseTo(4.2 + 1, 5);

    service.updateItemQuantity('1_novariant', 9);
    expect(service.cartItems()[0].quantity).toBe(5);
    expect(service.cartItems()[0].total_price).toBeCloseTo(60.5, 5);
    service.updateItemQuantity('1_novariant', 0);
    expect(service.cartItems().map(i => i.id)).toEqual(['2_novariant']);
    service.updateItemQuantity('missing', 3);
    service.removeItem('2_novariant');
    expect(service.cartCount()).toBe(0);
    expect((service as any).cartSignal().expiresAt).toBe(0);
    discardPeriodicTasks();
  }));

  /**
   * @description The stored cart is restored (also an expired one, flagged expired); broken JSON
   *   is logged and ignored; clear() empties memory and storage.
   * @input Stored valid cart; stored expired cart; '{broken'; clear().
   * @output Items restored, not expired; expired flag; empty + console.error; storage removed.
   */
  it('restores, ignores broken data and clears the cart', fakeAsync(() => {
    const item = { id: '1_novariant', quantity: 1, total_price: 10, vat_rate: 21, unit_price: 10, stock_quantity: 3 };
    localStorage.setItem('shop_cart', JSON.stringify({ items: [item], expiresAt: Date.now() + 60000, createdAt: 1 }));
    service = create();
    expect(service.cartCount()).toBe(1);
    expect((service as any).isExpiredSignal()).toBeFalse();
    discardPeriodicTasks();

    TestBed.resetTestingModule();
    localStorage.setItem('shop_cart', JSON.stringify({ items: [item], expiresAt: Date.now() - 1, createdAt: 1 }));
    service = create();
    expect((service as any).isExpiredSignal()).toBeTrue();
    service.clear();
    expect(service.cartCount()).toBe(0);
    expect(localStorage.getItem('shop_cart')).not.toContain('1_novariant');
    discardPeriodicTasks();

    TestBed.resetTestingModule();
    spyOn(console, 'error');
    localStorage.setItem('shop_cart', '{broken');
    service = create();
    expect(service.cartCount()).toBe(0);
    expect(console.error).toHaveBeenCalled();
    discardPeriodicTasks();
  }));

  /**
   * @description Countdown: 0 for an empty cart, remaining seconds otherwise, expired at 0.
   * @input Empty → tick 1 s; item added → tick 1 s; expiresAt in the past → tick 1 s.
   * @output 0; ~899; 0 + expired.
   */
  it('counts down the reservation', fakeAsync(() => {
    service = create();
    tick(1000);
    expect((service as any).timerSignal()).toBe(0);
    service.addItem(product(), null);
    tick(1000);
    expect((service as any).timerSignal()).toBeGreaterThan(890);
    (service as any).cartSignal.update((c: any) => ({ ...c, expiresAt: Date.now() - 1000 }));
    tick(1000);
    expect((service as any).timerSignal()).toBe(0);
    expect((service as any).isExpiredSignal()).toBeTrue();
    discardPeriodicTasks();
  }));

  /**
   * @description Payment simulation posts the order id to the checkout endpoint.
   * @input simulatePayment(7).
   * @output POST …/shop/checkout/simulate-payment {order_id: 7}.
   */
  it('requests the payment simulation', fakeAsync(() => {
    service = create();
    service.simulatePayment(7).subscribe();
    const req = TestBed.inject(HttpTestingController).expectOne(`${environment.base_api_url}/shop/checkout/simulate-payment`);
    expect(req.request.body).toEqual({ order_id: 7 });
    req.flush({});
    discardPeriodicTasks();
  }));
});
