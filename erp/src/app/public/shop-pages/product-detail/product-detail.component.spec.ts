/**
 * @file product-detail.component.spec.ts
 * @path src/app/public/shop-pages/product-detail/product-detail.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of ProductDetailComponent: product loaded by the route slug, images (variant /
 *   primary / first / placeholder), variants with own price and stock, quantity limits, adding to
 *   the cart (unavailable / over-stock alerts, "added" flash) and the in-cart state.
 * @dependencies
 * - createPublicPageContext; ShopPublicService spy; real CartService; ActivatedRoute paramMap Subject; AlertDialogService spied.
 */

import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, ParamMap } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';

import { ProductDetailComponent } from './product-detail.component';
import { ShopPublicService } from '../components/services/public-data.service';
import { CartService } from '../components/services/cart.service';
import { AlertDialogService } from '../../../core/services/alert-dialog.service';
import { createPublicPageContext } from '../../../../testing/public-test-helpers';

describe('ProductDetailComponent', () => {
  let fixture: ComponentFixture<ProductDetailComponent>;
  let page: ProductDetailComponent;
  let shop: jasmine.SpyObj<ShopPublicService>;
  let params$: BehaviorSubject<ParamMap>;
  let cart: CartService;
  const t = { errors: { unavailable: 'Sold out', max_stock: 'Max {count}', alert_title: 'Cannot add' } };
  const simple = { id: 1, name: 'Mug', slug: 'mug', stock_quantity: 2, prices: { price_eur_with_vat: 12.1, price_eur_without_vat: 10, vat_rate: 21 },
    images: [{ url: 'a.jpg' }, { url: 'p.jpg', is_primary: true }, { url: 'v.jpg', variant_id: 9 }] };
  const withVariants = { ...simple, id: 2, variants: [
    { id: 9, variant_name: 'Blue', stock_quantity: 0, prices: { price_eur_with_vat: 20, price_eur_without_vat: 16.5 }, images: [{ url: 'v.jpg' }] },
    { id: 10, variant_name: 'Red', stock_quantity: 5, prices: { price_eur_with_vat: 22 }, images: [] }
  ] };

  /** Creates the page; the route starts with slug 'mug'. */
  function create(detail: any = simple): void {
    localStorage.removeItem('shop_cart');
    shop = jasmine.createSpyObj('ShopPublicService', ['getProductDetail']);
    shop.getProductDetail.and.callFake(() => (typeof detail === 'function' ? detail() : of(detail)));
    params$ = new BehaviorSubject(convertToParamMap({ slugOrId: 'mug' }));
    const ctx = createPublicPageContext({ translations: { product_detail: t } });
    TestBed.configureTestingModule({
      imports: [ProductDetailComponent],
      providers: [...ctx.providers, { provide: ShopPublicService, useValue: shop }, { provide: ActivatedRoute, useValue: { paramMap: params$ } }]
    });
    cart = TestBed.inject(CartService);
    fixture = TestBed.createComponent(ProductDetailComponent);
    page = fixture.componentInstance;
    fixture.detectChanges();
  }
  afterEach(() => localStorage.removeItem('shop_cart'));

  /**
   * @description Simple product: primary image active, general images without variant images,
   *   prices, stock; a route without slug is ignored; detail of another slug on change.
   * @input slug 'mug'; paramMap without slug; slug 'cup'.
   * @output activeImage p.jpg; generalImages a, p; 12.1 / 10; stock 2; second request 'cup'.
   */
  it('loads a simple product', fakeAsync(() => {
    create();
    expect(shop.getProductDetail).toHaveBeenCalledWith('mug');
    expect(page.activeImage()).toBe('p.jpg');
    expect(page.generalImages().map((i: any) => i.url)).toEqual(['a.jpg', 'p.jpg']);
    expect([page.currentPrice(), page.priceWithoutVat(), page.currentStock(), page.isAvailable()]).toEqual([12.1, 10, 2, true]);
    expect(page.isLoading()).toBeFalse();
    page.setActiveImage('a.jpg');
    expect(page.activeImage()).toBe('a.jpg');

    params$.next(convertToParamMap({}));
    params$.next(convertToParamMap({ slugOrId: 'cup' }));
    expect(shop.getProductDetail.calls.allArgs()).toEqual([['mug'], ['cup']]);
    discardPeriodicTasks();
  }));

  /**
   * @description Images without primary → first; none → placeholder; failed load logged.
   * @input images [first]; images []; request error.
   * @output first.jpg; placeholder; isLoading false + console.error.
   */
  it('falls back for images and failed loads', fakeAsync(() => {
    create({ ...simple, images: [{ url: 'first.jpg' }] });
    expect(page.activeImage()).toBe('first.jpg');
    TestBed.resetTestingModule();
    create({ ...simple, images: undefined, prices: undefined, stock_quantity: undefined });
    expect(page.activeImage()).toBe('assets/images/placeholder-product.png');
    expect([page.currentPrice(), page.priceWithoutVat(), page.currentStock()]).toEqual([0, 0, 0]);
    TestBed.resetTestingModule();
    spyOn(console, 'error');
    create(() => throwError(() => new Error('404')));
    expect(page.isLoading()).toBeFalse();
    expect(console.error).toHaveBeenCalled();
    discardPeriodicTasks();
  }));

  /**
   * @description Variants: first one selected (own image / price / stock), switching via the
   *   select (unknown id ignored), variant without images → product primary image; prices.
   * @input Product with Blue (stock 0) and Red; change to 10; change to 99.
   * @output Blue, v.jpg, 20 / 16.5, unavailable; Red, p.jpg, 22, stock 5; still Red; getVariantPrice.
   */
  it('selects variants', fakeAsync(() => {
    create(withVariants);
    expect(page.selectedVariant().variant_name).toBe('Blue');
    expect([page.activeImage(), page.currentPrice(), page.priceWithoutVat(), page.isAvailable()]).toEqual(['v.jpg', 20, 16.5, false]);
    expect(page.variantImages().length).toBe(1);

    page.onVariantChange({ target: { value: '10' } } as any);
    expect([page.selectedVariant().variant_name, page.activeImage(), page.currentPrice(), page.currentStock()]).toEqual(['Red', 'p.jpg', 22, 5]);
    page.onVariantChange({ target: { value: '99' } } as any);
    expect(page.selectedVariant().id).toBe(10);
    expect(page.getVariantPrice(withVariants.variants[1]).replace(/\s/g, ' ')).toBe('22,00 €');
    expect(page.getVariantPrice({}).replace(/\s/g, ' ')).toBe('0,00 €');
    discardPeriodicTasks();
  }));

  /**
   * @description Quantity between 1 and the stock; a smaller stock after a variant switch
   *   lowers the selected quantity.
   * @input Red (stock 5): increase ×6; decrease ×6; switch to a variant with stock 2 at quantity 5.
   * @output 5; 1; 2.
   */
  it('keeps the quantity within the stock', fakeAsync(() => {
    create(withVariants);
    page.onVariantChange({ target: { value: '10' } } as any);
    for (let i = 0; i < 6; i++) page.increaseQuantity();
    expect(page.selectedQuantity()).toBe(5);
    for (let i = 0; i < 6; i++) page.decreaseQuantity();
    expect(page.selectedQuantity()).toBe(1);

    for (let i = 0; i < 4; i++) page.increaseQuantity();
    page.selectVariant({ id: 11, stock_quantity: 2, prices: { price_eur_with_vat: 5 }, images: [] });
    fixture.detectChanges();
    expect(page.selectedQuantity()).toBe(2);
    discardPeriodicTasks();
  }));

  /**
   * @description Add to cart: unavailable and over-stock messages in the app's alert dialog (was the
   *   native window.alert, finding #45), success adds the item, flashes "added" for 2 s and marks the
   *   item as in the cart.
   * @input Blue (stock 0) add; Red with quantity 7 forced; Red quantity 2 add.
   * @output dialog ('Cannot add', 'Sold out'); ('Cannot add', 'Max 5'); no window.alert; cart item '2_10' ×2,
   *   addedToCart true → false, isInCart.
   */
  it('adds the selection to the cart', fakeAsync(() => {
    create(withVariants);
    const nativeAlert = spyOn(window, 'alert');
    const alertSpy = spyOn(TestBed.inject(AlertDialogService), 'open');
    page.addToCart();
    expect(alertSpy).toHaveBeenCalledWith('Cannot add', 'Sold out', 'warning');

    page.onVariantChange({ target: { value: '10' } } as any);
    page.selectedQuantity.set(7);
    page.addToCart();
    expect(alertSpy).toHaveBeenCalledWith('Cannot add', 'Max 5', 'warning');
    expect(nativeAlert).not.toHaveBeenCalled();

    page.selectedQuantity.set(2);
    expect(page.isInCart()).toBeFalse();
    page.addToCart();
    expect(cart.cartItems().map(i => [i.id, i.quantity])).toEqual([['2_10', 2]]);
    expect(page.addedToCart()).toBeTrue();
    expect(page.isInCart()).toBeTrue();
    expect(page.currentCartItemId()).toBe('2_10');
    tick(2000);
    expect(page.addedToCart()).toBeFalse();
    page.product.set(null);
    expect(page.currentCartItemId()).toBe('');
    discardPeriodicTasks();
  }));
});
