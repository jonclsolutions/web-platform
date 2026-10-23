/**
 * @file public-data.service.spec.ts
 * @path src/app/public/shop-pages/components/services/public-data.service.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of ShopPublicService (storefront API): query building for products,
 *   the no_pagination lists, product detail, coupon validation, order creation and the
 *   translated error messages (network, 404, 422 with / without API message, 500, other).
 * @refactor-note (2026-10-23) Real spec - the previous file was a copy of the EntityCrud spec
 *   and was removed.
 * @dependencies
 * - HttpTestingController; LocalizationService stub (getText returns the key).
 */

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ShopPublicService } from './public-data.service';
import { LocalizationService } from '../../../../shared/services/localization.service';
import { environment } from '../../../../../environments/environment';

const API = `${environment.base_api_url}/shop/public`;

describe('ShopPublicService', () => {
  let service: ShopPublicService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: LocalizationService, useValue: { getText: (k: string) => k === 'api_errors.network' ? 'Network: {message}' : k } }]
    });
    service = TestBed.inject(ShopPublicService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  /**
   * @description Product list sends only non-empty filters; lists use no_pagination; detail,
   *   coupon and order go to their endpoints.
   * @input getProducts({page 2, search '', category_id null, x undefined, sort 'price'}); lists; detail 'mug'; coupon; order.
   * @output ?page=2&sort=price; ?no_pagination=true ×3; /products/mug; POST coupons/validate {code, order_amount}; POST create-order.
   */
  it('calls the storefront endpoints', () => {
    service.getProducts({ page: 2, search: '', category_id: null, x: undefined, sort: 'price' }).subscribe();
    http.expectOne(`${API}/products?page=2&sort=price`).flush({ data: [] });
    service.getProducts().subscribe();
    http.expectOne(`${API}/products`).flush({ data: [] });

    service.getCategories().subscribe();
    service.getShippingMethods().subscribe();
    service.getPaymentMethods().subscribe();
    for (const list of ['categories', 'shipping-methods', 'payment-methods']) {
      http.expectOne(`${API}/${list}?no_pagination=true`).flush([]);
    }

    let detail: any;
    service.getProductDetail('mug').subscribe(d => (detail = d));
    http.expectOne(`${API}/products/mug`).flush({ id: 1 });
    expect(detail).toEqual({ id: 1 });

    service.validateCoupon('SAVE', 100).subscribe();
    const coupon = http.expectOne(`${API}/coupons/validate`);
    expect(coupon.request.body).toEqual({ code: 'SAVE', order_amount: 100 });
    coupon.flush({});
    service.createOrder({ a: 1 }).subscribe();
    const order = http.expectOne(`${environment.base_api_url}/shop/checkout/create-order`);
    expect(order.request.method).toBe('POST');
    order.flush({});
  });

  /**
   * @description Errors become an Error with a translated message.
   * @input Network ErrorEvent; 404; 422 with message; 422 without; 429; 500; 403.
   * @output 'Network: offline'; 'api_errors.not_found'; 'api_errors.quantity_unavailable' twice (the English API
   *   message is not shown, finding #53); 'api_errors.too_many_requests'; 'api_errors.server'; 'api_errors.generic'.
   */
  it('maps errors to translated messages', () => {
    spyOn(console, 'error');
    const message = (flush: (req: any) => void) => {
      let msg = '';
      service.getProductDetail(1).subscribe({ error: (e: Error) => (msg = e.message) });
      flush(http.expectOne(`${API}/products/1`));
      return msg;
    };
    expect(message(r => r.error(new ErrorEvent('error', { message: 'offline' })))).toBe('Network: offline');
    expect(message(r => r.flush({}, { status: 404, statusText: 'x' }))).toBe('api_errors.not_found');
    expect(message(r => r.flush({ message: 'Out of stock' }, { status: 422, statusText: 'x' }))).toBe('api_errors.quantity_unavailable');
    expect(message(r => r.flush({}, { status: 429, statusText: 'x' }))).toBe('api_errors.too_many_requests');
    expect(message(r => r.flush({}, { status: 422, statusText: 'x' }))).toBe('api_errors.quantity_unavailable');
    expect(message(r => r.flush({}, { status: 500, statusText: 'x' }))).toBe('api_errors.server');
    expect(message(r => r.flush({}, { status: 403, statusText: 'x' }))).toBe('api_errors.generic');
  });
});
