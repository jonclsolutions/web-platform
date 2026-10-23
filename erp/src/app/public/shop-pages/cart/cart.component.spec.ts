/**
 * @file cart.component.spec.ts
 * @path src/app/public/shop-pages/cart/cart.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of CartComponent: quantity buttons (min 1, stock cap, unknown item), removal
 *   after confirmation, net total, checkout navigation and the EUR price format; renders the items.
 * @dependencies
 * - createPublicPageContext (module shop); real CartService (localStorage cleared); ConfirmDialogService spy.
 */

import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { Router } from '@angular/router';

import { CartComponent } from './cart.component';
import { CartService } from '../components/services/cart.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { PublicPageContext, createPublicPageContext } from '../../../../testing/public-test-helpers';

describe('CartComponent', () => {
  let ctx: PublicPageContext;
  let fixture: ComponentFixture<CartComponent>;
  let page: CartComponent;
  let cart: CartService;
  let confirm: jasmine.SpyObj<ConfirmDialogService>;

  /** Creates the page with a cart of one mug (12.10 EUR incl. 21 % VAT, stock 3, quantity 2). */
  function create(): void {
    localStorage.removeItem('shop_cart');
    ctx = createPublicPageContext({ translations: { cart: { confirm_remove_title: 'Remove?', confirm_remove_text: 'Sure?' } } });
    confirm = jasmine.createSpyObj('ConfirmDialogService', ['open']);
    TestBed.configureTestingModule({ imports: [CartComponent], providers: [...ctx.providers, { provide: ConfirmDialogService, useValue: confirm }] });
    cart = TestBed.inject(CartService);
    cart.addItem({ id: 1, name: 'Mug', slug: 'mug', stock_quantity: 3, prices: { price_eur_with_vat: 12.1, price_eur_without_vat: 10, vat_rate: 21 } }, null, 2);
    fixture = TestBed.createComponent(CartComponent);
    page = fixture.componentInstance;
    fixture.detectChanges();
  }
  afterEach(() => localStorage.removeItem('shop_cart'));

  /**
   * @description Items rendered; + up to stock, − down to 1; unknown id logged; net total.
   * @input increase ×2 (stock 3); decrease ×3; increase 'missing'.
   * @output 3 + max reached; 1 (not 0); console.error; total 12.10 → net 10.
   */
  it('changes quantities within the stock', fakeAsync(() => {
    create();
    expect(ctx.localization.setModule).toHaveBeenCalledWith('shop');
    expect(fixture.nativeElement.textContent).toContain('Mug');
    page.increaseQuantity('1_novariant');
    page.increaseQuantity('1_novariant');
    expect(cart.cartItems()[0].quantity).toBe(3);
    expect(page.isMaxStockReached(cart.cartItems()[0])).toBeTrue();
    expect(page.isMaxStockReached(null as any)).toBeFalse();

    page.decreaseQuantity('1_novariant');
    page.decreaseQuantity('1_novariant');
    page.decreaseQuantity('1_novariant');
    page.decreaseQuantity('missing');
    expect(cart.cartItems()[0].quantity).toBe(1);
    spyOn(console, 'error');
    page.increaseQuantity('missing');
    expect(console.error).toHaveBeenCalled();
    expect(page.totalPriceWithoutTax()).toBeCloseTo(10, 5);
    discardPeriodicTasks();
  }));

  /**
   * @description Removal only after confirmation (translated texts); a rejected dialog is
   *   swallowed; checkout navigation; price format.
   * @input confirm false; true; rejected promise; proceedToCheckout(); formatPrice(1234.5).
   * @output item kept, then removed; no error; navigate(['/shop/checkout']); '1 234,50 €'.
   */
  it('removes items after confirmation and goes to checkout', fakeAsync(() => {
    create();
    confirm.open.and.resolveTo(false);
    page.removeItem('1_novariant');
    flushMicrotasks();
    expect(confirm.open).toHaveBeenCalledWith('Remove?', 'Sure?');
    expect(cart.cartCount()).toBe(1);
    confirm.open.and.returnValue(Promise.reject(new Error('closed')));
    page.removeItem('1_novariant');
    flushMicrotasks();
    confirm.open.and.resolveTo(true);
    page.removeItem('1_novariant');
    flushMicrotasks();
    expect(cart.cartCount()).toBe(0);

    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    page.proceedToCheckout();
    expect(router.navigate).toHaveBeenCalledWith(['/shop/checkout']);
    expect(page.formatPrice(1234.5).replace(/\s/g, ' ')).toBe('1 234,50 €');
    discardPeriodicTasks();
  }));
});
