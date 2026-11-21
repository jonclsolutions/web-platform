/**
 * @file checkout.component.spec.ts
 * @path src/app/apps/shop/public/checkout/checkout.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of CheckoutComponent: empty cart redirect, shipping / payment methods with the
 *   first preselected, field validation with translated messages, the order summary (coupon
 *   percent / fixed / capped, shipping, VAT groups), coupon validation, order creation (payload,
 *   success, 422 field and stock errors, generic errors), the invisible captcha of the order
 *   (token + honeypot sent, guard refusals translated) and the incomplete-form warning.
 * @dependencies
 * - createPublicPageContext (module shop, TurnstileService stub); ShopPublicService and AlertDialogService
 *   spies; real CartService.
 */

import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { CheckoutComponent } from './checkout.component';
import { CartService } from '../components/services/cart.service';
import { ShopPublicService } from '../components/services/public-data.service';
import { AlertDialogService } from '../../../../core/services/alert-dialog.service';
import { CaptchaUnavailableError } from '../../../../shared/utils/public-form-errors';
import { PublicPageContext, createPublicPageContext } from '../../../../../testing/public-test-helpers';

describe('CheckoutComponent', () => {
  let fixture: ComponentFixture<CheckoutComponent>;
  let page: CheckoutComponent;
  let shop: jasmine.SpyObj<ShopPublicService>;
  let alert: jasmine.SpyObj<AlertDialogService>;
  let cart: CartService;
  let router: Router;
  let ctx: PublicPageContext;
  const errors = {
    email_required: 'E-mail required', email_invalid: 'E-mail invalid', phone_required: 'Phone required',
    first_name_required: 'First name required', first_name_digits: 'No digits', last_name_required: 'Last name required',
    last_name_digits: 'No digits (last)', address_required: 'Address required', address_too_long: 'Address too long',
    city_required: 'City required', city_too_long: 'City too long', postal_code_required: 'ZIP required',
    postal_code_too_long: 'ZIP too long', postal_code_invalid: 'ZIP invalid', shipping_required: 'Shipping required',
    payment_required: 'Payment required', terms_required: 'Terms required', invalid_value: 'Check this value',
    company_required: 'Company required', ico_required: 'ICO required', ico_invalid: 'ICO invalid', dic_invalid: 'DIC invalid',
    notes_too_long: 'Note too long', country_required: 'Country required'
  };
  const checkout = {
    errors, coupon_applied: 'Coupon {code} applied', coupon_error: 'Coupon error: {message}', coupon_invalid: 'Invalid code', coupon_too_many: 'Slow down',
    alerts: { form_incomplete_title: 'Incomplete', form_incomplete_message: 'Fill in', stock_title: 'Stock', error_title: 'Error', order_failed_message: 'Order failed',
      stock_message: 'Not in stock', order_rejected_message: 'Order rejected', too_many_requests: 'Too many', price_invalid_message: 'No price: {product}',
      captcha_failed: 'Robot?', email_limit: 'Enough for this address' }
  };

  /**
   * Creates the page; `items` = true puts a 121 EUR (21 % VAT) mug ×1 and a 110 EUR (10 %) book ×1 in the cart;
   * `methods` = the shipping methods of the API (default: two without countries = everywhere).
   */
  function create(items = true, methods: any[] = [{ id: 3, name: 'PPL', base_price: 5 }, { id: 4, name: 'Pickup', base_price: 0 }]): void {
    localStorage.removeItem('shop_cart');
    shop = jasmine.createSpyObj('ShopPublicService', ['getShippingMethods', 'getPaymentMethods', 'validateCoupon', 'createOrder']);
    shop.getShippingMethods.and.returnValue(of(methods));
    shop.getPaymentMethods.and.returnValue(of([{ id: 7, name: 'Card' }]));
    alert = jasmine.createSpyObj('AlertDialogService', ['open']);
    ctx = createPublicPageContext({ translations: { checkout } });
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
  /** Completes the background captcha check - its token goes with the next order. */
  const solve = () => ctx.turnstile.render.calls.mostRecent().args[1]('captcha-token');
  afterEach(() => localStorage.removeItem('shop_cart'));

  /**
   * @description Buying on a company (U-03) and the note: the company fields are checked only
   *   with the switch on (name + IČO required, DIČ with a country prefix, spaces ignored), sent
   *   normalised; switching off clears their errors and sends nothing; a too long note is refused.
   * @input switch on with empty fields; ICO "12 34", DIČ "1234"; valid ACME / " 123 456 78" /
   *   "cz 12345678" + note; order sent; switch off.
   * @output company / ICO required; DIČ invalid; payload is_company, ACME, 12345678, CZ12345678,
   *   the note; after switching off no errors, isFormValid() true; note of 1001 chars refused.
   */
  it('handles buying on a company and the note', fakeAsync(() => {
    create();
    fill();
    page.formData.isCompany = true;
    expect(page.isFormValid()).toBeFalse();
    ['company', 'ico', 'dic'].forEach(f => page.validateField(f));
    expect([page.errors['company'], page.errors['ico'], page.errors['dic']]).toEqual(['Company required', 'ICO required', '']);
    page.formData.ico = '12 34';
    page.formData.dic = '1234';
    page.validateField('ico');
    page.validateField('dic');
    expect([page.errors['ico'], page.errors['dic']]).toEqual(['', 'DIC invalid']);

    Object.assign(page.formData, { company: ' ACME ', ico: ' 123 456 78', dic: 'cz 12345678', notes: ' Ring twice ' });
    shop.createOrder.and.returnValue(of({ order_number: 'O-2' }));
    solve();
    page.simulatePayment();
    expect(shop.createOrder.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({
      is_company: true, company: 'ACME', ico: '12345678', dic: 'CZ12345678', notes: 'Ring twice'
    }));

    page.formData.isCompany = false;
    page.errors['ico'] = 'ICO required';
    page.toggleCompany();
    expect(page.errors['ico']).toBe('');
    page.formData.notes = 'x'.repeat(1001);
    page.validateField('notes');
    expect(page.errors['notes']).toBe('Note too long');
    discardPeriodicTasks();
  }));

  /**
   * @description Delivery countries (U-02): the countries of the active shipping methods (a
   *   method without countries delivers everywhere), Czechia preselected when served; a change
   *   of the country offers only its methods and keeps / replaces the chosen one; postal codes
   *   checked by the country; no country with a method → nothing chosen.
   * @input Methods PPL (CZ, SK) 5 €, DHL (DE, AT) 9 €; select DE; postal "1010" in DE / CZ;
   *   select SK; methods without any country served.
   * @output countries AT, CZ, DE, SK; CZ + PPL; DE → DHL 9 €, visible [DHL]; 1010 valid in DE,
   *   invalid in CZ; SK → PPL; Czech names sorted ("Česko" …); none → country '' + error.
   */
  it('offers the delivery countries of the shipping methods', fakeAsync(() => {
    create(true, [{ id: 3, name: 'PPL', base_price: 5, countries: ['CZ', 'SK'] }, { id: 8, name: 'DHL', base_price: 9, countries: ['DE', 'AT'] }]);
    expect(page.deliveryCountries()).toEqual(['AT', 'CZ', 'DE', 'SK']);
    expect([page.formData.country, page.formData.shippingMethodId]).toEqual(['CZ', 3]);
    expect(page.countryChoices().map(c => c.code)).toEqual(['CZ', 'DE', 'AT', 'SK']); // Česko, Německo, Rakousko, Slovensko

    page.selectCountry('DE');
    expect([page.formData.shippingMethodId, page.selectedShippingPrice()]).toEqual([8, 9]);
    expect(page.visibleShippingMethods().map(m => m.id)).toEqual([8]);
    page.formData.postalCode = '1010';
    page.validateField('postalCode');
    expect(page.errors['postalCode']).toBe('');
    page.selectCountry('CZ');
    expect(page.errors['postalCode']).toBe('ZIP invalid');

    page.selectCountry('SK');
    expect(page.formData.shippingMethodId).toBe(3);

    shop.getShippingMethods.and.returnValue(of([]));
    page.loadShippingMethods();
    expect([page.formData.country, page.formData.shippingMethodId, page.errors['country']]).toEqual(['', null, 'Country required']);
    discardPeriodicTasks();
  }));

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
   * @description Coupon: empty ignored; valid → applied + message; invalid → translated error (never
   *   the English API text, finding #53), 429 → slow-down text; coupon removed.
   * @input ''; 'SAVE' ok; error with API message; error without; 429.
   * @output No request; 'Coupon SAVE applied'; 'Coupon error: Invalid code' twice; 'Coupon error: Slow down'.
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
    expect(page.couponStatus()).toBe('Coupon error: Invalid code');
    expect(page.appliedCoupon()).toBeNull();
    shop.validateCoupon.and.returnValue(throwError(() => ({})));
    page.applyCoupon();
    expect(page.couponStatus()).toBe('Coupon error: Invalid code');
    shop.validateCoupon.and.returnValue(throwError(() => ({ status: 429 })));
    page.applyCoupon();
    expect(page.couponStatus()).toBe('Coupon error: Slow down');
    discardPeriodicTasks();
  }));

  /**
   * @description Order: incomplete form → warning, no request; complete → payload (EUR prices,
   *   VAT, coupon code, final amount, language of the storefront for the confirmation e-mail),
   *   success clears the cart and shows step 5; finish → shop.
   * @input Empty form; filled form + coupon 'P10'; finishCheckout().
   * @output alert warning; createOrder payload (with captcha_token + empty honeypot website and the
   *   consent with the terms, stored by the API with the order); orderNumber
   *   'O-1', cart empty, step 5; navigate(['/shop']).
   */
  it('creates the order', fakeAsync(() => {
    create();
    page.simulatePayment();
    expect(alert.open).toHaveBeenCalledWith('Incomplete', 'Fill in', 'warning');
    expect(shop.createOrder).not.toHaveBeenCalled();

    fill();
    page.appliedCoupon.set({ code: 'P10', discount_type: 'percent', discount_value: 10 });
    shop.createOrder.and.returnValue(of({ order_number: 'O-1' }));
    solve();
    page.simulatePayment();
    const payload = shop.createOrder.calls.mostRecent().args[0];
    expect(payload).toEqual(jasmine.objectContaining({
      email: 'eva@x.cz', first_name: 'Eva', last_name: 'Nová', postal_code: '110 00', country: 'CZ',
      payment_method_id: 7, shipping_method_id: 3, coupon_code: 'P10', currency: 'EUR', company: null, notes: null,
      lang: 'cz', captcha_token: 'captcha-token', website: '', terms_accepted: true, is_company: false, ico: null, dic: null
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
   * @description Order errors are shown with translated texts, never the English API messages
   *   (finding #53): 422 field errors mark the field (snake → camel, unknown ignored), stock errors
   *   alert the stock text; 422 without field errors → rejected; 429 → too many; others → failed.
   * @input 422 {first_name, unknown_field, items.0.quantity}; 500 with message; 422 {}; 429.
   * @output errors.firstName 'Check this value'; alert Stock / 'Not in stock'; 'Order failed'; 'Order rejected';
   *   'Too many'; processing stops; price in the current language.
   */
  it('reports order errors', fakeAsync(() => {
    create();
    fill();
    spyOn(console, 'error');
    shop.createOrder.and.returnValue(throwError(() => ({ status: 422, error: { errors: {
      first_name: ['Too short'], unknown_field: ['x'], 'items.0.quantity': ['Only 1 left']
    } } })));
    solve();
    page.simulatePayment();
    expect(page.errors['firstName']).toBe('Check this value');
    expect(alert.open).toHaveBeenCalledWith('Stock', 'Not in stock', 'danger');
    expect(page.isProcessing()).toBeFalse();

    shop.createOrder.and.returnValue(throwError(() => ({ status: 500, error: { message: 'Down' } })));
    page.errors['firstName'] = '';
    solve();
    page.simulatePayment();
    expect(alert.open).toHaveBeenCalledWith('Error', 'Order failed', 'danger');
    shop.createOrder.and.returnValue(throwError(() => ({ status: 422, error: {} })));
    solve();
    page.simulatePayment();
    expect(alert.open).toHaveBeenCalledWith('Error', 'Order rejected', 'danger');
    shop.createOrder.and.returnValue(throwError(() => ({ status: 429, error: {} })));
    solve();
    page.simulatePayment();
    expect(alert.open).toHaveBeenCalledWith('Error', 'Too many', 'danger');
    expect(page.currentStep()).toBe(1);
    expect(page.formatPrice(5).replace(/\s/g, ' ')).toBe('5,00 €');
    discardPeriodicTasks();
  }));

  /**
   * @description SECURITY (SA-05): the order waits for the invisible captcha and is sent with its
   *   token; the refusals of the guard (422 captcha_required, 429 error_code RECIPIENT_LIMIT) show
   *   their translated texts and reset the widget (a token is single-use); a captcha that cannot be
   *   loaded stops the order without a request.
   * @input Filled form; simulatePayment() before the token, then the token; refusals 422 captcha /
   *        429 quota; nextToken() failing with CaptchaUnavailableError (script blocked).
   * @output No request until solved, then one; 'Robot?' and 'Enough for this address' (danger),
   *   reset('widget-1') ×2; the failed captcha → 'Robot?', no request, not processing.
   */
  it('sends the order with the captcha and reports its refusals', fakeAsync(() => {
    create();
    tick();
    fill();
    spyOn(console, 'error');
    shop.createOrder.and.returnValue(throwError(() => ({ status: 422, error: { captcha_required: true } })));
    page.simulatePayment();
    expect(shop.createOrder).not.toHaveBeenCalled();
    solve();
    expect(shop.createOrder).toHaveBeenCalledTimes(1);
    expect(alert.open).toHaveBeenCalledWith('Error', 'Robot?', 'danger');

    shop.createOrder.and.returnValue(throwError(() => ({ status: 429, error: { error_code: 'RECIPIENT_LIMIT', retry_after: 60 } })));
    solve();
    page.simulatePayment();
    expect(alert.open).toHaveBeenCalledWith('Error', 'Enough for this address', 'danger');
    expect(ctx.turnstile.reset).toHaveBeenCalledTimes(2);
    expect(ctx.turnstile.reset).toHaveBeenCalledWith('widget-1');

    spyOn(page.captcha, 'nextToken').and.returnValue(throwError(() => new CaptchaUnavailableError()));
    shop.createOrder.calls.reset();
    page.simulatePayment();
    expect(shop.createOrder).not.toHaveBeenCalled();
    expect(alert.open.calls.mostRecent().args).toEqual(['Error', 'Robot?', 'danger']);
    expect(page.isProcessing()).toBeFalse();
    discardPeriodicTasks();
  }));

  /**
   * @description A cart line without a valid EUR price stops the order with a translated alert
   *   (was an uncaught Czech exception, finding #44); nothing is sent.
   * @input Cart line Mug with price 0; valid form; simulatePayment().
   * @output alert ('Error', 'No price: Mug', 'danger'); no createOrder; not processing.
   */
  it('refuses a cart line without price', fakeAsync(() => {
    create();
    fill();
    (cart as any).cartSignal.update((c: any) => ({ ...c, items: c.items.map((i: any) => i.product_id === 1 ? { ...i, unit_price: 0, prices: { price_eur_with_vat: 0 } } : i) }));
    page.simulatePayment();
    expect(alert.open).toHaveBeenCalledWith('Error', 'No price: Mug', 'danger');
    expect(shop.createOrder).not.toHaveBeenCalled();
    expect(page.isProcessing()).toBeFalse();
    discardPeriodicTasks();
  }));
});
