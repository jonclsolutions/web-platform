/**
 * @file orders.component.spec.ts
 * @path src/app/admin/shop-pages/orders/orders.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of OrdersComponent and orders.config.ts – e-shop orders: translated
 *   configuration, toolbar and tabs (all / pending tasks / trash) by permission, lookups
 *   (products, variants, payment / shipping methods, coupons), order details and status timeline,
 *   the order form (items, coupon rules, totals with discount, shipping and payment fee, VAT
 *   summary), validation and the payload for create / update.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (all admin doubles), LoadingService (real, spied on)
 */

import { ComponentFixture, TestBed, fakeAsync, discardPeriodicTasks } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { OrdersComponent } from './orders.component';
import { PAYMENT_STATUS_VALUES, STATUS_VALUES } from './orders.config';
import { LoadingService } from '../../../core/services/loading.service';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('OrdersComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<OrdersComponent>;
  let component: OrdersComponent;

  const dh = () => ctx.dataHandler as any;
  const day = 24 * 3600 * 1000;
  const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString();
  const products = [
    { id: 1, name: 'Pixel', variants: [{ id: 11, variant_name: '128 GB', price_with_vat: 500, vat_rate: 21 }, { id: 12, variant_name: '256 GB', price_with_vat: 600, vat_rate: 21 }] },
    { id: 2, name: 'Kabel', variants: [] }, { id: 3, name: 'Obal' }
  ];
  const payments = [{ id: 1, name: 'Dobírka', price: 2 }, { id: 2, name: 'Převod', price: 0 }];
  const shippings = [{ id: 1, name: 'PPL', base_price: 5 }];
  const coupons = [
    { id: 1, code: 'P10', discount_type: 'percent', discount_value: 10, is_active: true },
    { id: 2, code: 'F50', discount_type: 'fixed', discount_value: 50, is_active: true },
    { id: 3, code: 'OFF', discount_type: 'fixed', discount_value: 5, is_active: false }
  ];
  const lookups = () => {
    dh().getCollection.and.callFake((url: string) => of(
      url.startsWith('shop/products') ? products : url.startsWith('shop/payment_methods') ? payments
        : url.startsWith('shop/shipping_methods') ? shippings : url.startsWith('shop/coupons') ? coupons : []));
  };
  /** A valid order for the form. */
  const order = (): any => ({
    email: 'a@b.cz', first_name: 'Jan', last_name: 'Novák', phone: '777', company: '', status: 'pending', payment_status: 'unpaid',
    shipping_address: 'Ulice 1', shipping_city: 'Praha', shipping_postal_code: '11000', shipping_country: 'CZ',
    payment_method_id: '1', shipping_method_id: '1', coupon_id: null, notes: 'n',
    items: [{ product_id: '1', product_variant_id: '11', quantity: 2, unit_price: 100, vat_rate: 21 }]
  });

  beforeEach(async () => {
    ctx = createAdminTestContext();
    lookups();
    await TestBed.configureTestingModule({ imports: [OrdersComponent], providers: ctx.providers }).compileComponents();
    spyOn(TestBed.inject(LoadingService), 'show');
    spyOn(TestBed.inject(LoadingService), 'hide');
    fixture = TestBed.createComponent(OrdersComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => { fixture.destroy(); document.body.classList.remove('modal-open'); });

  const loadLookups = () => { component.ngOnInit(); };

  describe('configuration, toolbar and tabs', () => {
    /**
     * @description The configuration is built from the 'shop-orders' translations; status filters get the translated options.
     * @input  component created
     * @output caption; row buttons with shop-orders-* permissions; status / payment options = STATUS_VALUES / PAYMENT_STATUS_VALUES; filter options set; chartable status_label, payment_status_label
     */
    it('builds the configuration from translations', () => {
      expect(component.tableCaption).toBe('shop-orders.table_header');
      expect(component.buttons.map(b => b.permission)).toEqual([undefined, 'shop-orders-update', 'shop-orders-delete']);
      expect(component.statusOptions.map(o => o.value)).toEqual(STATUS_VALUES);
      expect(component.paymentStatusOptions.map(o => o.value)).toEqual(PAYMENT_STATUS_VALUES);
      expect((component.filterColumns.find(f => f.key === 'status') as any).options).toBe(component.statusOptions);
      expect((component.filterColumns.find(f => f.key === 'payment_status') as any).options).toBe(component.paymentStatusOptions);
      expect(component.graphColumns.map(g => g.key)).toEqual(['status_label', 'payment_status_label']);
      expect(component.orderColumns.length).toBeGreaterThan(0);
      expect(component.trashOrderColumns.length).toBeGreaterThan(0);
      expect(component.t('btn_edit')).toBe('shop-orders.btn_edit');
    });

    /**
     * @description Toolbar buttons without permission get showIf false; filter columns without status filters stay untouched.
     * @input  granted []; translations$.next({}); then filterColumns without status / payment_status
     * @output create, reports, import hidden; export visible; no error without the filters
     */
    it('hides toolbar buttons without permission', () => {
      ctx.permissions.granted = new Set();
      ctx.i18n.translations$.next({});
      const t = Object.fromEntries(component.toolbarButtons.map(b => [b.action, b]));
      expect([t['handleCreateFormOpened'].showIf, t['openGraphBuilder'].showIf, t['triggerImport'].showIf]).toEqual([false, false, false]);
      expect(t['exportActiveTable'].showIf).toBeTrue();
      component.filterColumns = [];
      expect(() => (component as any).updateFilterOptions()).not.toThrow();
    });

    /**
     * @description Tabs show the active mode; the trash tab needs 'view-deleted'.
     * @input  currentMode 'pending_tasks'; granted []
     * @output pending_tasks isActive; trash showIf false
     */
    it('builds the tabs', () => {
      component.currentMode = 'pending_tasks';
      ctx.permissions.granted = new Set();
      const tabs = Object.fromEntries(component.tabButtonsConfigs.map(b => [b.action, b]));
      expect(tabs['pending_tasks'].isActive).toBeTrue();
      expect(tabs['all'].isActive).toBeFalse();
      expect(tabs['trash'].showIf).toBeFalse();
      expect(tabs['all'].showIf).toBeUndefined();
    });

    /**
     * @description The tab modes set the filters: all (newest first), pending tasks (open states), trash (only_trashed).
     * @input  setTableMode('pending_tasks'), ('trash'), ('all'); clearFilters() in pending mode
     * @output status 'pending,confirmed,processing,shipped'; only_trashed 'true' and trash shown; plain sorting; clear keeps the mode filters
     */
    it('switches the table modes', () => {
      component.currentPage = 3;
      component.setTableMode('pending_tasks');
      expect(component.filters).toEqual({ sort_by: 'created_at', sort_direction: 'desc', status: 'pending,confirmed,processing,shipped' });
      expect(component.currentPage).toBe(1);
      component.setTableMode('trash');
      expect(component.filters['only_trashed']).toBe('true');
      expect(component.showTrashTable).toBeTrue();
      component.setTableMode('all');
      expect(component.filters).toEqual({ sort_by: 'created_at', sort_direction: 'desc' });
      expect(component.showTrashTable).toBeFalse();
      component.setTableMode('pending_tasks');
      component.filters['search'] = 'x';
      component.clearFilters();
      expect(component.filters['search']).toBeUndefined();
      expect(component.filters['status']).toBe('pending,confirmed,processing,shipped');
    });

    /**
     * @description Toolbar actions call their handlers; nothing runs while an order is loading.
     * @input  handleToolbarAction(each action) with an activeTable spy; then while processing
     * @output filter panel toggled; create form open; graph builder open; export and import on the table; ignored while processing
     */
    it('dispatches the toolbar actions', () => {
      const table = jasmine.createSpyObj('TableBuilderComponent', ['exportToCSV', 'importData']);
      component.activeTable = table;
      ['toggleFilters', 'handleCreateFormOpened', 'openGraphBuilder', 'exportActiveTable', 'triggerImport', 'unknown'].forEach(a => component.handleToolbarAction(a));
      expect(component.showFiltersPanel).toBeTrue();
      expect(component.showOrderForm).toBeTrue();
      expect(component.showGraphBuilder).toBeTrue();
      expect(table.exportToCSV).toHaveBeenCalled();
      expect(table.importData).toHaveBeenCalled();
      component.activeTable = undefined as any;
      expect(() => component.handleToolbarAction('triggerImport')).not.toThrow();
      (component as any).isProcessing = true;
      component.handleToolbarAction('toggleFilters');
      expect(component.showFiltersPanel).toBeTrue();
    });
  });

  describe('lookups and details', () => {
    /**
     * @description Init loads orders newest first and every lookup; variants are flattened with their product.
     * @input  ngOnInit()
     * @output getPaginatedData('shop/orders', …) exactly twice (active + trash, finding #18) sorted by
     *   created_at desc; products 3; variants 2 with product_id 1 / product_name 'Pixel'; payment, shipping, coupons loaded
     */
    it('loads orders and lookups', fakeAsync(() => {
      loadLookups();
      expect(ctx.genericTable.getPaginatedData.calls.first().args[0]).toBe('shop/orders');
      const orderCalls = ctx.genericTable.getPaginatedData.calls.allArgs().filter(a => a[0] === 'shop/orders');
      expect(orderCalls.length).toBe(2);
      orderCalls.forEach(a => expect(a[3]).toEqual(jasmine.objectContaining({ sort_by: 'created_at', sort_direction: 'desc' })));
      expect(component.filters).toEqual({ sort_by: 'created_at', sort_direction: 'desc' });
      expect(component.products.length).toBe(3);
      expect(component.variants.map(v => [v.id, v.product_id, v.product_name])).toEqual([[11, 1, 'Pixel'], [12, 1, 'Pixel']]);
      expect([component.paymentMethods.length, component.shippingMethods.length, component.coupons.length]).toEqual([2, 1, 3]);
      discardPeriodicTasks();
    }));

    /**
     * @description Failing lookups are only logged.
     * @input  every lookup request fails
     * @output console.error called 5 times; lists empty
     */
    it('logs failing lookups', fakeAsync(() => {
      dh().getCollection.and.returnValue(throwError(() => new Error('x')));
      const err = spyOn(console, 'error');
      loadLookups();
      expect(err).toHaveBeenCalledTimes(5);
      expect(component.coupons).toEqual([]);
      discardPeriodicTasks();
    }));

    /**
     * @description Details are loaded into the modal; failures show an error; guards prevent double loading.
     * @input  handleViewDetails({ id: 4 }); without id; while processing; failing request
     * @output getOne('shop/orders/4'); modal open, body locked; error 'shop-orders.load_details_failed_message'; one request per allowed call
     */
    it('shows the order details', () => {
      dh().getOne.and.returnValue(of({ id: 4, status: 'shipped' }));
      component.handleViewDetails({ id: 4 } as any);
      expect(dh().getOne).toHaveBeenCalledWith('shop/orders/4');
      expect(component.showDetailsModal).toBeTrue();
      expect(document.body.classList.contains('modal-open')).toBeTrue();
      component.handleViewDetails({} as any);
      (component as any).isProcessing = true;
      component.handleViewDetails({ id: 4 } as any);
      (component as any).isProcessing = false;
      dh().getOne.and.returnValue(throwError(() => new Error('x')));
      component.handleViewDetails({ id: 5 } as any);
      expect(ctx.alert.open).toHaveBeenCalledWith('shared.error', 'shop-orders.load_details_failed_message', 'danger');
      expect(dh().getOne).toHaveBeenCalledTimes(2);
      component.closeDetailsModal();
      expect(component.selectedOrderForDetail).toBeNull();
      expect(document.body.classList.contains('modal-open')).toBeFalse();
    });

    /**
     * @description The status timeline marks every step up to the current one; cancelled / unknown states mark nothing.
     * @input  isStatusReached('shipped', 'confirmed' | 'shipped' | 'delivered'); ('canceled', 'pending'); ('pending', 'x')
     * @output true, true, false; false; false
     */
    it('computes the status timeline', () => {
      expect(component.isStatusReached('shipped', 'confirmed')).toBeTrue();
      expect(component.isStatusReached('shipped', 'shipped')).toBeTrue();
      expect(component.isStatusReached('shipped', 'delivered')).toBeFalse();
      expect(component.isStatusReached('canceled', 'pending')).toBeFalse();
      expect(component.isStatusReached('pending', 'x')).toBeFalse();
    });
  });

  describe('order form', () => {
    /**
     * @description A new order starts as pending / unpaid with the translated default country.
     * @input  handleCreateFormOpened(); then while processing
     * @output editingOrder defaults; shipping_country 'shop-orders.default_shipping_country'; form open; nothing while processing
     */
    it('opens an empty order form', () => {
      component.handleCreateFormOpened();
      expect(component.editingOrder).toEqual(jasmine.objectContaining({ status: 'pending', payment_status: 'unpaid', items: [], shipping_country: 'shop-orders.default_shipping_country' }));
      expect(component.showOrderForm).toBeTrue();
      component.closeOrderForm();
      expect([component.showOrderForm, component.editingOrder]).toEqual([false, null]);
      (component as any).isProcessing = true;
      component.handleCreateFormOpened();
      expect(component.showOrderForm).toBeFalse();
    });

    /**
     * @description Editing loads the full order and copies the customer contact into the form; failures show an error.
     * @input  handleEditFormOpened({ id: 4 }, click) with customer; order without customer; failure; guards
     * @output email / names / phone / company from the customer; '' without customer; error 'shop-orders.load_order_failed_message'
     */
    it('opens an existing order', fakeAsync(() => {
      loadLookups();
      const event = jasmine.createSpyObj('Event', ['stopPropagation']);
      dh().getOne.and.returnValue(of({ id: 4, items: [], customer: { email: 'c@d.cz', first_name: 'Eva', last_name: 'Malá', phone: '1', company: 'ACME' } }));
      component.handleEditFormOpened({ id: 4 } as any, event);
      expect(event.stopPropagation).toHaveBeenCalled();
      expect([component.editingOrder!.email, component.editingOrder!.first_name, component.editingOrder!.last_name, component.editingOrder!.phone, component.editingOrder!.company])
        .toEqual(['c@d.cz', 'Eva', 'Malá', '1', 'ACME']);
      expect(component.showOrderForm).toBeTrue();
      dh().getOne.and.returnValue(of({ id: 5, items: [] }));
      component.handleEditFormOpened({ id: 5 } as any);
      expect([component.editingOrder!.email, component.editingOrder!.company]).toEqual(['', '']);
      dh().getOne.and.returnValue(of({ id: 6, items: [], customer: {} }));
      component.openEditOrderForm({ id: 6 } as any);
      expect(component.editingOrder!.phone).toBe('');
      dh().getOne.and.returnValue(throwError(() => new Error('x')));
      component.openEditOrderForm({ id: 7 } as any);
      expect(ctx.alert.open).toHaveBeenCalledWith('shared.error', 'shop-orders.load_order_failed_message', 'danger');
      dh().getOne.calls.reset();
      component.openEditOrderForm({} as any);
      (component as any).isProcessing = true;
      component.handleEditFormOpened({ id: 4 } as any);
      component.openEditOrderForm({ id: 4 } as any);
      expect(dh().getOne).not.toHaveBeenCalled();
      discardPeriodicTasks();
    }));

    /**
     * @description Items are added with defaults; saved items are marked for deletion, new ones removed; quantity / price update the line total.
     * @input  no order; order without items → addOrderItem(); delete saved and new item; cancelled delete; quantity 3 × price 10
     * @output nothing without order; item vat 21 quantity 1; saved _delete; new removed; cancel keeps; total_price 30 and totals recomputed
     */
    it('edits order items', async () => {
      component.addOrderItem();
      await component.deleteOrderItem(0);
      component.editingOrder = { ...order(), items: undefined };
      component.addOrderItem();
      expect(component.editingOrder!.items[0]).toEqual(jasmine.objectContaining({ quantity: 1, vat_rate: 21, total_price: 0 }));
      component.editingOrder!.items = [{ id: 9, quantity: 1, unit_price: 5 } as any, { quantity: 1, unit_price: 5 } as any];
      await component.deleteOrderItem(0);
      expect(component.editingOrder!.items[0]._delete).toBeTrue();
      await component.deleteOrderItem(1);
      expect(component.editingOrder!.items.length).toBe(1);
      ctx.confirm.open.and.returnValue(Promise.resolve(false));
      component.editingOrder!.items.push({ quantity: 1, unit_price: 1 } as any);
      await component.deleteOrderItem(1);
      expect(component.editingOrder!.items.length).toBe(2);
      const item: any = component.editingOrder!.items[1];
      item.quantity = 3;
      item.unit_price = 10;
      component.onItemQuantityChange(item);
      expect(item.total_price).toBe(30);
      expect(component.editingOrder!.total_amount).toBe(30);
      item.unit_price = 20;
      component.onItemPriceChange(item);
      expect(item.total_price).toBe(60);
    });

    /**
     * @description Choosing a variant fills product, name, price and VAT of the item; unknown variants change nothing.
     * @input  variants loaded; item quantity 2 with variant '11'; variant without product name; unknown variant 99
     * @output product_id 1, product_name 'Pixel', variant '128 GB', unit_price 500, total 1000; name falls back to the variant name; unchanged for 99
     */
    it('fills an item from the chosen variant', fakeAsync(() => {
      loadLookups();
      component.editingOrder = { ...order(), items: [] };
      const item: any = { product_variant_id: '11', quantity: 2 };
      component.onVariantSelected(item, 0);
      expect([item.product_id, item.product_name, item.variant_name, item.unit_price, item.vat_rate, item.total_price]).toEqual([1, 'Pixel', '128 GB', 500, 21, 1000]);
      component.variants = [{ id: 20, variant_name: 'Solo', product_id: 2, price_with_vat: 1, vat_rate: 10 } as any, { id: 21, product_id: 2, price_with_vat: 1, vat_rate: 10 } as any];
      const solo: any = { product_variant_id: 20, quantity: 1 };
      component.onVariantSelected(solo, 0);
      expect(solo.product_name).toBe('Solo');
      const bare: any = { product_variant_id: 21, quantity: 1 };
      component.onVariantSelected(bare, 0);
      expect(bare.product_name).toBe('');
      const none: any = { product_variant_id: 99, quantity: 1 };
      component.onVariantSelected(none, 0);
      expect(none.product_id).toBeUndefined();
      discardPeriodicTasks();
    }));
  });

  describe('coupons and totals', () => {
    /**
     * @description Coupon rules: active, started, not expired, usage left, minimum order amount.
     * @input  null; inactive; valid_from tomorrow; valid_until yesterday; usage 5/5; min 1000 for total 100; valid coupon with limits
     * @output valid; coupon_error_inactive / _not_started / _expired / _exhausted / _min_amount (with amount); valid
     */
    it('validates coupons', () => {
      ctx.i18n.getValue.and.callFake((p: string) => (p === 'shop-orders.coupon_error_min_amount' ? 'min {amount}' : p));
      const c = (extra: any) => ({ id: 1, code: 'X', discount_type: 'fixed', discount_value: 1, is_active: true, ...extra });
      expect(component.validateCouponRealtime(null as any, 0)).toEqual({ valid: true });
      expect(component.validateCouponRealtime(c({ is_active: false }), 0).error).toBe('shop-orders.coupon_error_inactive');
      expect(component.validateCouponRealtime(c({ valid_from: iso(1) }), 0).error).toBe('shop-orders.coupon_error_not_started');
      expect(component.validateCouponRealtime(c({ valid_until: iso(-1) }), 0).error).toBe('shop-orders.coupon_error_expired');
      expect(component.validateCouponRealtime(c({ max_usage: 5, usage_count: 5 }), 0).error).toBe('shop-orders.coupon_error_exhausted');
      expect(component.validateCouponRealtime(c({ min_order_amount: '1000' }), 100).error).toBe(`min ${component.formatCurrency(1000)}`);
      expect(component.validateCouponRealtime(c({ valid_from: iso(-1), valid_until: iso(1), max_usage: 5, min_order_amount: 50 }), 100)).toEqual({ valid: true });
      expect(component.validateCouponRealtime(c({ max_usage: 1 }), 0)).toEqual({ valid: true });
    });

    /**
     * @description Totals: items (deleted ones left out), percent / fixed discount capped at the subtotal, shipping and payment fee.
     * @input  items 2 × 100 + deleted; coupon P10; F50 with subtotal 20; invalid OFF; unknown coupon id; no coupon
     * @output total 200, discount 20, shipping 5, final 187; fixed capped at 20; invalid → 0 and validation false; unknown → 0; none → valid
     */
    it('recalculates the totals', fakeAsync(() => {
      component.recalculateTotals();
      loadLookups();
      component.editingOrder = { ...order(), coupon_id: 1 };
      component.editingOrder!.items.push({ quantity: 5, unit_price: 5, _delete: true } as any);
      component.recalculateTotals();
      expect([component.editingOrder!.total_amount, component.editingOrder!.discount_amount, component.editingOrder!.shipping_amount, component.editingOrder!.final_amount]).toEqual([200, 20, 5, 187]);
      component.editingOrder!.items = [{ quantity: 1, unit_price: 20 } as any];
      component.editingOrder!.coupon_id = 2;
      component.recalculateTotals();
      expect(component.editingOrder!.discount_amount).toBe(20);
      component.editingOrder!.coupon_id = 3;
      component.recalculateTotals();
      expect(component.editingOrder!.discount_amount).toBe(0);
      expect(component.couponValidation.valid).toBeFalse();
      expect(component.getCouponValidationClass()).toBe('is-invalid');
      component.editingOrder!.coupon_id = 99;
      component.recalculateTotals();
      expect(component.editingOrder!.discount_amount).toBe(0);
      component.editingOrder!.coupon_id = null;
      component.editingOrder!.items = undefined as any;
      component.recalculateTotals();
      expect(component.couponValidation).toEqual({ valid: true });
      expect(component.editingOrder!.total_amount).toBe(0);
      component.editingOrder!.items = [{} as any];
      component.recalculateTotals();
      expect(component.editingOrder!.total_amount).toBe(0);
      discardPeriodicTasks();
    }));

    /**
     * @description The VAT summary splits the discounted total into base and VAT per rate.
     * @input  no order; items 121 @21 % + 110 @10 % + item without rate (21 %) 0; discount 23.1; no items (totals recalculated); missing discount
     * @output zeros; base + VAT groups 21 / 10 summing to 207.9; no items → base 0 and factor 1; missing discount → full total
     */
    it('computes the VAT summary', () => {
      expect(component.calculateSummaryTotals()).toEqual({ baseAmount: 0, vatGroups: [], withVat: 0 });
      component.editingOrder = { ...order(), discount_amount: 23.1, items: [
        { quantity: 1, unit_price: 121, vat_rate: 21 }, { quantity: 1, unit_price: 110, vat_rate: 10 }, { quantity: 0, unit_price: 0 }, { quantity: 9, unit_price: 9, _delete: true }
      ] };
      const s = component.calculateSummaryTotals();
      expect(s.withVat).toBeCloseTo(207.9, 5);
      expect(s.vatGroups.map(g => g.rate)).toEqual([10, 21]);
      expect(s.baseAmount + s.vatGroups.reduce((a, g) => a + g.amount, 0)).toBeCloseTo(207.9, 5);
      component.editingOrder!.items = [];
      component.recalculateTotals();
      expect(component.calculateSummaryTotals()).toEqual({ baseAmount: 0, vatGroups: [], withVat: 0 });
      component.editingOrder!.discount_amount = undefined as any;
      component.editingOrder!.items = [{ quantity: 1, unit_price: 100, vat_rate: 0 } as any];
      expect(component.calculateSummaryTotals().withVat).toBe(100);
    });

    /**
     * @description Lookup helpers for names, prices and coupon labels.
     * @input  lookups loaded; ids found / unknown / empty; coupon object / id / unknown
     * @output names and prices; 'N/A' for unknown; '-' / 0 / '' for empty; '-10%', '-50,00 €', '10%'
     */
    it('resolves names, prices and coupon labels', fakeAsync(() => {
      loadLookups();
      expect([component.getCouponCode(1), component.getCouponCode(99), component.getCouponCode(null)]).toEqual(['P10', 'N/A', '-']);
      expect([component.getPaymentMethodName('1'), component.getPaymentMethodName(9), component.getPaymentMethodName(0)]).toEqual(['Dobírka', 'N/A', '-']);
      expect([component.getPaymentMethodPrice(1), component.getPaymentMethodPrice(9), component.getPaymentMethodPrice(null)]).toEqual([2, 0, 0]);
      expect([component.getShippingMethodPrice(1), component.getShippingMethodPrice(9), component.getShippingMethodPrice('0')]).toEqual([5, 0, 0]);
      expect(component.getCouponDisplayValue(coupons[0])).toBe('-10%');
      expect(component.getCouponDisplayValue(2)).toBe(`-${component.formatCurrency(50)}`);
      expect([component.getCouponDisplayValue(99), component.getCouponDisplayValue(null)]).toEqual(['', '']);
      expect([component.getCouponTypeLabel(1), component.getCouponTypeLabel(2), component.getCouponTypeLabel(99), component.getCouponTypeLabel(null)])
        .toEqual(['10%', component.formatCurrency(50), '', '']);
      expect(component.formatCurrency(12.5)).toBe(new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(12.5));
      expect([component.getStatusLabel('shipped'), component.getStatusLabel('nope')]).toEqual(['shop-orders.status_shipped', 'nope']);
      expect(component.getVisibleItems({ items: [{ id: 1 }, { id: 2, _delete: true }] } as any).map(i => i.id)).toEqual([1]);
      expect(component.getVisibleItems(null)).toEqual([]);
      expect(component.getCouponValidationClass()).toBe('');
      component.editingOrder = { ...order(), coupon_id: 1 };
      component.couponValidation = { valid: true };
      expect(component.getCouponValidationClass()).toBe('is-valid');
      discardPeriodicTasks();
    }));
  });

  describe('saving', () => {
    const save = (o: any) => { component.editingOrder = o; component.saveOrder(); };
    const lastWarning = () => ctx.alert.open.calls.mostRecent().args[1];

    /**
     * @description Validation: coupon, e-mail, names, phone, payment, shipping, items and address are required.
     * @input  orders missing each value in turn; invalid coupon with and without message
     * @output warnings for each rule; post never called
     */
    it('validates the order', () => {
      component.saveOrder();
      component.couponValidation = { valid: false, error: 'Expired' };
      save({ ...order(), coupon_id: 3 });
      expect(lastWarning()).toBe('Expired');
      component.couponValidation = { valid: false };
      save({ ...order(), coupon_id: 3 });
      expect(lastWarning()).toBe('shop-orders.coupon_error_generic');
      component.couponValidation = { valid: true };
      const cases: [any, string][] = [
        [{ email: '' }, 'validation_email_required'], [{ first_name: '' }, 'validation_name_required'], [{ last_name: '' }, 'validation_name_required'],
        [{ phone: '' }, 'validation_phone_required'], [{ payment_method_id: 0 }, 'validation_payment_method_required'],
        [{ shipping_method_id: 0 }, 'validation_shipping_method_required'], [{ items: undefined }, 'validation_items_required'],
        [{ items: [{ _delete: true }] }, 'validation_items_required'], [{ shipping_address: '' }, 'validation_address_required'],
        [{ shipping_city: '' }, 'validation_address_required'], [{ shipping_postal_code: '' }, 'validation_address_required']
      ];
      for (const [patch, key] of cases) {
        save({ ...order(), ...patch });
        expect(lastWarning()).withContext(key).toBe(`shop-orders.${key}`);
      }
      expect(dh().post).not.toHaveBeenCalled();
      (component as any).validateOrder.call({ editingOrder: null });
    });

    /**
     * @description A new order is posted with numeric ids, items and defaults (company null, VAT 21, no variant).
     * @input  valid new order; items with variant '11' and without variant / VAT
     * @output post('shop/orders', payload) with payment 1, shipping 1, coupon null, company null; items [{ id null, 1, 11, 2, 100, 21 }, { variant null, vat 21 }]; success; form closed; reload
     */
    it('creates an order', () => {
      const o = order();
      o.items.push({ product_id: '2', quantity: '1', unit_price: '9' });
      save(o);
      const [url, payload] = dh().post.calls.mostRecent().args;
      expect(url).toBe('shop/orders');
      expect(payload).toEqual(jasmine.objectContaining({ payment_method_id: 1, shipping_method_id: 1, coupon_id: null, company: null, notes: 'n' }));
      expect(payload.items).toEqual([
        { id: null, product_id: 1, product_variant_id: 11, quantity: 2, unit_price: 100, vat_rate: 21 },
        { id: null, product_id: 2, product_variant_id: null, quantity: 1, unit_price: 9, vat_rate: 21 }
      ]);
      expect(payload._method).toBeUndefined();
      expect(ctx.alert.open).toHaveBeenCalledWith('shared.success', 'shop-orders.order_saved_message', 'success');
      expect([component.showOrderForm, component.editingOrder]).toEqual([false, null]);
    });

    /**
     * @description An existing order is sent as POST + _method=PUT with deleted item ids; an open detail is refreshed.
     * @input  order 4 with items 7 (kept), 8 (deleted), new deleted item; details modal of order 4 open
     * @output post('shop/orders/4', { …, delete_items: [8], _method: 'PUT' }); kept item id 7; details reloaded; refresh failure only logged
     */
    it('updates an order and refreshes its details', () => {
      component.showDetailsModal = true;
      component.selectedOrderForDetail = { id: 4 } as any;
      dh().getOne.and.returnValue(of({ id: 4, status: 'confirmed' }));
      const o = { ...order(), id: 4, company: 'ACME', coupon_id: 2, items: [
        { id: 7, product_id: 1, quantity: 1, unit_price: 5, vat_rate: 10 }, { id: 8, _delete: true }, { _delete: true }
      ] };
      save(o);
      const [url, payload] = dh().post.calls.mostRecent().args;
      expect(url).toBe('shop/orders/4');
      expect(payload).toEqual(jasmine.objectContaining({ _method: 'PUT', delete_items: [8], coupon_id: 2, company: 'ACME' }));
      expect(payload.items).toEqual([{ id: 7, product_id: 1, product_variant_id: null, quantity: 1, unit_price: 5, vat_rate: 10 }]);
      expect(dh().getOne).toHaveBeenCalledWith('shop/orders/4');
      expect(component.selectedOrderForDetail!.status).toBe('confirmed');
      const err = spyOn(console, 'error');
      dh().getOne.and.returnValue(throwError(() => new Error('x')));
      save({ ...order(), id: 4 });
      expect(err).toHaveBeenCalledWith('Failed to refresh order details after save.');
      component.selectedOrderForDetail = { } as any;
      save({ ...order(), id: 4 });
      expect(dh().getOne).toHaveBeenCalledTimes(2);
    });

    /**
     * @description Server errors show their message or a generic one; a save in progress blocks a second one.
     * @input  post fails with { error: { message: 'Out of stock' } }, then with {}; isProcessing true
     * @output alerts 'Out of stock' / 'shop-orders.save_order_failed_message'; no second post while processing
     */
    it('reports save errors and blocks double saves', () => {
      const err = spyOn(console, 'error');
      dh().post.and.returnValue(throwError(() => ({ error: { message: 'Out of stock' } })));
      save(order());
      expect(ctx.alert.open).toHaveBeenCalledWith('shared.error', 'Out of stock', 'danger');
      dh().post.and.returnValue(throwError(() => ({})));
      save(order());
      expect(ctx.alert.open).toHaveBeenCalledWith('shared.error', 'shop-orders.save_order_failed_message', 'danger');
      expect(err).toHaveBeenCalled();
      (component as any).isProcessing = true;
      save(order());
      expect(dh().post).toHaveBeenCalledTimes(2);
    });
  });

  /**
   * @description Destroying the page releases the body scroll lock.
   * @input  body locked; fixture.destroy()
   * @output body without 'modal-open'
   */
  it('unlocks the body scroll on destroy', () => {
    document.body.classList.add('modal-open');
    fixture.destroy();
    expect(document.body.classList.contains('modal-open')).toBeFalse();
  });

  /**
   * @description The list, the detail modal and the order form render.
   * @input  detectChanges(); details of a shipped order; order form with one item and a coupon
   * @output 'shop-orders.table_header'; timeline in the details; VAT summary in the form
   */
  it('renders the page, details and form', fakeAsync(() => {
    loadLookups();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('shop-orders.table_header');
    dh().getOne.and.returnValue(of({ id: 4, order_number: 'OBJ-4', status: 'shipped', payment_status: 'paid', items: [{ id: 1, product_name: 'Pixel', quantity: 1, unit_price: 5, total_price: 5, vat_rate: 21 }], customer: { email: 'c@d.cz' } }));
    component.handleViewDetails({ id: 4 } as any);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('OBJ-4');
    component.closeDetailsModal();
    component.handleCreateFormOpened();
    component.editingOrder!.items = [{ product_id: 1, product_variant_id: 11, quantity: 1, unit_price: 100, vat_rate: 21, total_price: 100 } as any];
    component.editingOrder!.coupon_id = 1;
    component.recalculateTotals();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('input, select').length).toBeGreaterThan(0);
    discardPeriodicTasks();
  }));
});
