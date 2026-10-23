/**
 * @file checkout.component.spec.ts
 * @path src/app/public/shop-pages/checkout/checkout.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of CheckoutComponent: empty cart redirect, shipping / payment methods with the
 *   first preselected, field validation with translated messages, the order summary (coupon
 *   percent / fixed / capped, shipping, VAT groups), coupon validation, order creation (payload,
 *   success, 422 field and stock errors, generic errors) and the incomplete-form warning.
 * @dependencies
 * - createPublicPageContext (module shop); ShopPublicService and AlertDialogService spies; real CartService.
 */

import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { CheckoutComponent } from './checkout.component';
import { CartService } from '../components/services/cart.service';
import { ShopPublicService } from '../components/services/public-data.service';
import { AlertDialogService } from '../../../core/services/alert-dialog.service';
import { createPublicPageContext } from '../../../../testing/public-test-helpers';

describe('CheckoutComponent', () => {
  let fixture: ComponentFixture<CheckoutComponent>;
  let page: CheckoutComponent;
  let shop: jasmine.SpyObj<ShopPublicService>;
  let alert: jasmine.SpyObj<AlertDialogService>;
  let cart: CartService;
  let router: Router;
  const errors = {
    email_required: 'E-mail required', email_invalid: 'E-mail invalid', phone_required: 'Phone required',
    first_name_required: 'First name required', first_name_digits: 'No digits', last_name_required: 'Last name required',
    last_name_digits: 'No digits (last)', address_required: 'Address required', address_too_long: 'Address too long',
    city_required: 'City required', city_too_long: 'City too long', postal_code_required: 'ZIP required',
    postal_code_too_long: 'ZIP too long', postal_code_invalid: 'ZIP invalid', shipping_required: 'Shipping required',
    payment_required: 'Payment required', terms_required: 'Terms required'
  };
  const checkout = {
    errors, coupon_applied: 'Coupon {code} applied', coupon_error: 'Coupon error: {message}', coupon_invalid: 'Invalid code',
    alerts: { form_incomplete_title: 'Incomplete', form_incomplete_message: 'Fill in', stock_title: 'Stock', error_title: 'Error', order_failed_message: 'Order failed' }
  };

  /** Creates the page; `items` = true puts a 121 EUR (21 % VAT) mug ×1 and a 110 EUR (10 %) book ×1 in the cart. */
  function create(items = true): void {
    localStorage.removeItem('shop_cart');
    shop = jasmine.createSpyObj('ShopPublicService', ['getShippingMethods', 'getPaymentMethods', 'validateCoupon', 'createOrder']);
    shop.getShippingMethods.and.returnValue(of({ data: [{ id: 3, name: 'PPL', base_price: 5 }, { id: 4, name: 'Pickup', base_price: 0 }] }));
    shop.getPaymentMethods.and.returnValue(of([{ id: 7, name: 'Card' }]));
    alert = jasmine.createSpyObj('AlertDialogService', ['open']);
    const ctx = createPublicPageContext({ translations: { checkout } });
    TestBed.configureTestingModule({
      imports: [CheckoutComponent],
      providers: [...ctx.providers, { provide: ShopPublicService, useValue: shop }, { provide: AlertDialogService, useValue: alert }]
    });
    cart = TestBed.inject(CartService);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    if (items) {
      cart.addItem({ id: 1, name: 'Mug', slug: 'mug', stock_quantity: 5, prices: { price_eur_with_vat: 121, vat_rate: 21 } }, null, 1);
      cart.addItem({ id: 2, name: 'Book', slug: 'book', stock_quantity: 5, prices: { price_eur_with_vat: 110, vat_rate: 10 } }, null, 1);
    }
    fixture = TestBed.createComponent(CheckoutComponent);
    page = fixture.componentInstance;
    fixture.detectChanges();
  }

  /** Fills a complete, valid form. */
  const fill = () => Object.assign(page.formData, {
    email: 'eva@x.cz', firstName: 'Eva', lastName: 'Nová', phone: '777', address: 'Main 1', city: 'Praha', postalCode: '110 00', agreeToTerms: true
  });
  afterEach(() => localStorage.removeItem('shop_cart'));

  /**
   * @description Empty cart → back to the cart page without loading methods.
   * @input Empty cart.
   * @output navigate(['/cart']); no method requests.
   */
  it('sends an empty cart back to the cart page', fakeAsync(() => {
    create(false);
    expect(router.navigate).toHaveBeenCalledWith(['/cart']);
    expect(shop.getShippingMethods).not.toHaveBeenCalled();
    discardPeriodicTasks();
  }));

  /**
   * @description Methods loaded (paginated or plain); first ones preselected with the shipping
   *   price; switching shipping updates the price; load errors logged.
   * @input Default answers; selectShippingMethod(4); selectShippingMethod(99); failing loads.
   * @output shipping 3 / price 5, payment 7; price 0; unknown → 0; console.error ×2.
   */
  it('loads and preselects shipping and payment', fakeAsync(() => {
    create();
    expect([page.formData.shippingMethodId, page.selectedShippingPrice(), page.formData.paymentMethodId]).toEqual([3, 5, 7]);
    page.selectShippingMethod(4);
    expect(page.selectedShippingPrice()).toBe(0);
    page.selectShippingMethod(99);
    expect(page.selectedShippingPrice()).toBe(0);

    spyOn(console, 'error');
    shop.getShippingMethods.and.returnValue(throwError(() => new Error('x')));
    shop.getPaymentMethods.and.returnValue(of([]));
    page.loadShippingMethods();
    page.loadPaymentMethods();
    shop.getPaymentMethods.and.returnValue(throwError(() => new Error('x')));
    page.loadPaymentMethods();
    expect(console.error).toHaveBeenCalledTimes(2);
    discardPeriodicTasks();
  }));

  /**
   * @description Every validation rule gives its translated message; valid values clear it.
   * @input Each field empty / wrong / too long, then valid.
   * @output The matching messages of `checkout.errors`, then ''.
   */
  it('validates every field', fakeAsync(() => {
    create();
    const check = (field: string, value: any, expected: string) => {
      (page.formData as any)[field] = value;
      page.validateField(field);
      expect(page.errors[field]).withContext(`${field}=${value}`).toBe(expected);
    };
    check('email', '', errors.email_required); check('email', 'x@y', errors.email_invalid); check('email', 'x@y.cz', '');
    check('phone', '', errors.phone_required); check('phone', '777', '');
    check('firstName', '', errors.first_name_required); check('firstName', 'Eva2', errors.first_name_digits); check('firstName', 'Eva', '');
    check('lastName', '', errors.last_name_required); check('lastName', 'N0vá', errors.last_name_digits); check('lastName', 'Nová', '');
    check('address', '', errors.address_required); check('address', 'a'.repeat(256), errors.address_too_long); check('address', 'Main 1', '');
    check('city', '', errors.city_required); check('city', 'c'.repeat(101), errors.city_too_long); check('city', 'Praha', '');
    check('postalCode', '', errors.postal_code_required); check('postalCode', '12345678901', errors.postal_code_too_long);
    check('postalCode', 'ABC', errors.postal_code_invalid); check('postalCode', '11000', ''); check('postalCode', '110 00', '');
    check('shippingMethodId', null, errors.shipping_required); check('shippingMethodId', 3, '');
    check('paymentMethodId', null, errors.payment_required); check('paymentMethodId', 7, '');
    check('agreeToTerms', false, errors.terms_required); check('agreeToTerms', true, '');
    page.validateField('unknown');

    expect(page.isFormValid()).toBeTrue();
    page.formData.email = 'bad';
    expect(page.isFormValid()).toBeFalse();
    discardPeriodicTasks();
  }));

  /**
   * @description Summary: products 231, VAT groups 21 % / 10 %, shipping; percent coupon spread
   *   over the lines; fixed coupon; coupon larger than the products is capped.
   * @input No coupon; 10 % coupon; 50 EUR fixed; 500 EUR fixed.
   * @output final 236; VAT 21 + 10; discount 23.1 → final 212.9; 50 → 186; 231 → final 5 (shipping only).
   */
  it('computes the order summary with coupons and VAT', fakeAsync(() => {
    create();
    let s = page.orderSummary();
    expect([s.productsTotal, s.shippingAmount, s.finalAmount]).toEqual([231, 5, 236]);
    expect(s.vatGroups.map(g => [g.rate, +g.amount.toFixed(2), +g.baseAmount.toFixed(2)])).toEqual([[10, 10, 100], [21, 21, 100]]);
    expect(+s.baseAmount.toFixed(2)).toBe(200);

    page.appliedCoupon.set({ code: 'P10', discount_type: 'percent', discount_value: 10 });
    s = page.orderSummary();
    expect(+s.discountAmount.toFixed(2)).toBe(23.1);
    expect(+s.finalAmount.toFixed(2)).toBe(212.9);
    expect(+s.vatGroups[1].amount.toFixed(2)).toBe(18.9);

    page.appliedCoupon.set({ code: 'F50', discount_type: 'fixed', discount_value: 50 });
    expect(page.orderSummary().finalAmount).toBe(186);
    page.appliedCoupon.set({ code: 'BIG', discount_type: 'fixed', discount_value: 500 });
    expect([page.orderSummary().discountAmount, page.orderSummary().finalAmount]).toEqual([231, 5]);
    page.appliedCoupon.set({ code: 'ZERO', discount_type: 'percent' });
    expect(page.orderSummary().discountAmount).toBe(0);
    discardPeriodicTasks();
  }));

  /**
   * @description Coupon: empty ignored; valid → applied + message; invalid → error message with
   *   the API text or the translated fallback, coupon removed.
   * @input ''; 'SAVE' ok; error with message; error without.
   * @output No request; 'Coupon SAVE applied'; 'Coupon error: Expired'; 'Coupon error: Invalid code'.
   */
  it('validates coupons', fakeAsync(() => {
    create();
    page.couponCode = '  ';
    page.applyCoupon();
    expect(shop.validateCoupon).not.toHaveBeenCalled();

    page.couponCode = 'SAVE';
    shop.validateCoupon.and.returnValue(of({ coupon: { code: 'SAVE', discount_type: 'percent', discount_value: 5 } }));
    page.applyCoupon();
    expect(shop.validateCoupon).toHaveBeenCalledWith('SAVE', 231);
    expect(page.couponStatus()).toBe('Coupon SAVE applied');
    expect(page.appliedCoupon().code).toBe('SAVE');

    shop.validateCoupon.and.returnValue(throwError(() => ({ error: { message: 'Expired' } })));
    page.applyCoupon();
    expect(page.couponStatus()).toBe('Coupon error: Expired');
    expect(page.appliedCoupon()).toBeNull();
    shop.validateCoupon.and.returnValue(throwError(() => ({})));
    page.applyCoupon();
    expect(page.couponStatus()).toBe('Coupon error: Invalid code');
    discardPeriodicTasks();
  }));

  /**
   * @description Order: incomplete form → warning, no request; complete → payload (EUR prices,
   *   VAT, coupon code, final amount), success clears the cart and shows step 5; finish → shop.
   * @input Empty form; filled form + coupon 'P10'; finishCheckout().
   * @output alert warning; createOrder payload; orderNumber 'O-1', cart empty, step 5; navigate(['/shop']).
   */
  it('creates the order', fakeAsync(() => {
    create();
    page.simulatePayment();
    expect(alert.open).toHaveBeenCalledWith('Incomplete', 'Fill in', 'warning');
    expect(shop.createOrder).not.toHaveBeenCalled();

    fill();
    page.appliedCoupon.set({ code: 'P10', discount_type: 'percent', discount_value: 10 });
    shop.createOrder.and.returnValue(of({ order_number: 'O-1' }));
    page.simulatePayment();
    const payload = shop.createOrder.calls.mostRecent().args[0];
    expect(payload).toEqual(jasmine.objectContaining({
      email: 'eva@x.cz', first_name: 'Eva', last_name: 'Nová', postal_code: '110 00', country: 'Czechia',
      payment_method_id: 7, shipping_method_id: 3, coupon_code: 'P10', currency: 'EUR', company: null, notes: null
    }));
    expect(+payload.total_amount.toFixed(2)).toBe(212.9);
    expect(payload.items).toEqual([
      { product_id: 1, product_variant_id: null, quantity: 1, unit_price: 121, vat_rate: 21 },
      { product_id: 2, product_variant_id: null, quantity: 1, unit_price: 110, vat_rate: 10 }
    ]);
    expect([page.orderNumber(), page.currentStep(), page.isProcessing(), cart.cartCount()]).toEqual(['O-1', 5, false, 0]);

    page.finishCheckout();
    expect(router.navigate).toHaveBeenCalledWith(['/shop']);
    discardPeriodicTasks();
  }));

  /**
   * @description Order errors: 422 field errors mapped to the form (snake → camel, unknown
   *   ignored), stock errors as alert; other errors alert the API message or the fallback.
   * @input 422 {first_name, unknown_field, items.0.quantity}; 500 with message; 500 without.
   * @output errors.firstName set; stock alert; 'Error' alerts 'Down' / 'Order failed'; processing stops.
   */
  it('reports order errors', fakeAsync(() => {
    create();
    fill();
    spyOn(console, 'error');
    shop.createOrder.and.returnValue(throwError(() => ({ status: 422, error: { errors: {
      first_name: ['Too short'], unknown_field: ['x'], 'items.0.quantity': ['Only 1 left']
    } } })));
    page.simulatePayment();
    expect(page.errors['firstName']).toBe('Too short');
    expect(alert.open).toHaveBeenCalledWith('Stock', 'Only 1 left', 'danger');
    expect(page.isProcessing()).toBeFalse();

    shop.createOrder.and.returnValue(throwError(() => ({ status: 500, error: { message: 'Down' } })));
    page.errors['firstName'] = '';
    page.simulatePayment();
    expect(alert.open).toHaveBeenCalledWith('Error', 'Down', 'danger');
    shop.createOrder.and.returnValue(throwError(() => ({ status: 422, error: {} })));
    page.simulatePayment();
    expect(alert.open).toHaveBeenCalledWith('Error', 'Order failed', 'danger');
    expect(page.currentStep()).toBe(1);
    expect(page.formatPrice(5).replace(/\s/g, ' ')).toBe('5,00 €');
    discardPeriodicTasks();
  }));
});
