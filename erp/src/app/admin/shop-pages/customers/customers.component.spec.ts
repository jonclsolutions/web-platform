/**
 * @file customers.component.spec.ts
 * @path src/app/admin/shop-pages/customers/customers.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of CustomersComponent and customers.config.ts – e-shop customers:
 *   translated configuration, form validation, chartable / importable columns, toolbar by
 *   permission and view, toolbar actions (incl. import), sorting by registration date, and the
 *   modal with the orders of a customer (paging, page list with gaps, expand, status classes,
 *   currency and date formatting).
 * @dependencies
 * - src/testing/admin-test-helpers.ts (all admin doubles)
 */

import { ComponentFixture, TestBed, fakeAsync, discardPeriodicTasks } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { By } from '@angular/platform-browser';

import { CustomersComponent } from './customers.component';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('CustomersComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<CustomersComponent>;
  let component: CustomersComponent;

  const toolbar = () => Object.fromEntries(component.toolbarButtons.map(b => [b.action, b]));
  const field = (name: string) => component.formFields.find(f => f.column_name === name) as any;
  const ordersUrl = (page: number) => `shop/orders?customer_id=5&per_page=10&page=${page}&sort_by=created_at&sort_direction=desc`;

  beforeEach(async () => {
    ctx = createAdminTestContext();
    await TestBed.configureTestingModule({ imports: [CustomersComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(CustomersComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => { fixture.destroy(); document.body.classList.remove('modal-open'); });

  /**
   * @description The configuration is built from the 'shop-customers' translations.
   * @input  component created
   * @output caption; row buttons details / edit / orders (shop-orders-view) / anonymize / delete; 12 form fields; 7 + 3 columns; filters search + is_active; 14 details
   */
  it('builds the configuration from translations', () => {
    expect(component.tableCaption).toBe('shop-customers.table_header');
    expect(component.buttons.map(b => [b.action, b.permission])).toEqual([
      ['details', undefined], ['edit', 'shop-customers-update'], ['customer_orders', 'shop-orders-view'], ['anonymize', 'shop-customers-delete'], ['delete', 'shop-customers-delete']
    ]);
    expect(component.formFields.length).toBe(12);
    expect(component.customerColumns.map(c => c.key)).toEqual(['id', 'last_name', 'first_name', 'email', 'phone', 'total_spent', 'is_active']);
    expect(component.trashCustomerColumns.map(c => c.key)).toEqual(['id', 'email', 'deleted_at']);
    expect(component.filterColumns.map(c => c.key)).toEqual(['search', 'is_active']);
    expect(component.detailsColumns.length).toBe(14);
    expect(component.t('btn_orders')).toBe('shop-customers.btn_orders');
  });

  /**
   * @description Names and e-mail are required; phone and text lengths are checked; user and country are hidden.
   * @input  patterns; required and hidden fields
   * @output '' name rejected; 'a@b.cz' ok, 'ab' rejected; '+420 777 123 456' ok, 'abc' rejected; postal code max 10; hidden user_id, country
   */
  it('validates the customer form', () => {
    const re = (name: string) => new RegExp(field(name).pattern);
    expect(re('first_name').test('')).toBeFalse();
    expect(re('first_name').test('Jan')).toBeTrue();
    expect(new RegExp(`^${field('email').pattern}$`).test('a@b.cz')).toBeTrue();
    expect(new RegExp(`^${field('email').pattern}$`).test('ab')).toBeFalse();
    expect(re('phone').test('+420 777 123 456')).toBeTrue();
    expect(re('phone').test('abc')).toBeFalse();
    expect(re('postal_code').test('12345678901')).toBeFalse();
    expect(component.formFields.filter(f => f.required).map(f => f.column_name)).toEqual(['first_name', 'last_name', 'email', 'is_active']);
    expect(component.formFields.filter(f => f.type === 'hidden').map(f => f.column_name)).toEqual(['user_id', 'country']);
  });

  /**
   * @description Country and state can be charted; personal data columns are importable.
   * @input  graphColumns; detailsColumns
   * @output country, is_active (['1', '0']); 12 importable columns
   */
  it('offers chartable and importable columns', () => {
    expect(component.graphColumns.map(g => [g.key, g.aggregation, g.possibleValues])).toEqual([
      ['country', 'count', undefined], ['is_active', 'count', ['1', '0']]
    ]);
    expect(component.detailsColumns.filter(c => c.importable).length).toBe(12);
  });

  /**
   * @description A language change rebuilds the configuration.
   * @input  getValue returns 'EN:<path>'; translations$.next({})
   * @output tableCaption 'EN:shop-customers.table_header'
   */
  it('rebuilds the configuration when translations change', () => {
    ctx.i18n.getValue.and.callFake((p: string) => `EN:${p}`);
    ctx.i18n.translations$.next({});
    expect(component.tableCaption).toBe('EN:shop-customers.table_header');
  });

  /**
   * @description Toolbar by permission and view.
   * @input  granted []; then all; then trash view with open filters
   * @output create / report / trash hidden without permission, no import (finding #25); trash view: create, export hidden; labels switched
   */
  it('builds the toolbar by permission and view', () => {
    ctx.permissions.granted = new Set();
    let t = toolbar();
    expect(['handleCreateFormOpened', 'openGraphBuilder', 'toggleTable'].map(a => t[a].showIf)).toEqual([false, false, false]);
    expect(t['triggerImport']).toBeUndefined();
    ctx.permissions.granted = 'all';
    t = toolbar();
    expect(['handleCreateFormOpened', 'exportActiveTable'].map(a => t[a].showIf)).toEqual([true, true]);
    expect(t['toggleTable'].label).toBe('shop-customers.toolbar_show_trash');
    expect(t['toggleFilters'].label).toBe('shop-customers.toolbar_filters');
    component.showTrashTable = true;
    component.isFilterVisible = true;
    t = toolbar();
    expect(['handleCreateFormOpened', 'exportActiveTable'].map(a => t[a].showIf)).toEqual([false, false]);
    expect(t['toggleTable'].label).toBe('shop-customers.toolbar_show_active');
    expect(t['toggleTable'].isActive).toBeTrue();
    expect(t['toggleFilters'].label).toBe('shop-customers.toolbar_hide_filters');
  });

  /**
   * @description Toolbar actions call their handlers; there is no import any more (finding #25).
   * @input  handleToolbarAction(each action) with an activeTable spy; 'triggerImport'; 'unknown'
   * @output handlers called once; importData() never called; no error
   */
  it('dispatches the toolbar actions', () => {
    const names = ['toggleFilters', 'handleCreateFormOpened', 'openGraphBuilder', 'exportActiveTable', 'toggleTable'];
    const spies = names.map(n => spyOn(component as any, n));
    names.forEach(a => component.handleToolbarAction(a));
    spies.forEach(s => expect(s).toHaveBeenCalledTimes(1));
    const table = jasmine.createSpyObj('TableBuilderComponent', ['importData']);
    component.activeTable = table;
    expect(() => { component.handleToolbarAction('triggerImport'); component.handleToolbarAction('unknown'); }).not.toThrow();
    expect(table.importData).not.toHaveBeenCalled();
  });

  /**
   * @description Customers are sorted newest first (also after clearing filters) and loaded from shop/customers.
   * @input  new component; ngOnInit(); clearFilters() on page 4
   * @output filters { sort_by: 'created_at', sort_direction: 'desc' }; getPaginatedData('shop/customers', …); page 1
   */
  it('sorts by registration date and loads the customers', fakeAsync(() => {
    expect(component.filters).toEqual({ sort_by: 'created_at', sort_direction: 'desc' });
    component.ngOnInit();
    expect(ctx.genericTable.getPaginatedData.calls.first().args[0]).toBe('shop/customers');
    component.filters = { search: 'x' };
    component.currentPage = 4;
    component.clearFilters();
    expect(component.filters).toEqual({ sort_by: 'created_at', sort_direction: 'desc' });
    expect(component.currentPage).toBe(1);
    expect(ctx.genericTable.getPaginatedData.calls.mostRecent().args[3]).toEqual(jasmine.objectContaining({ sort_by: 'created_at' }));
    discardPeriodicTasks();
  }));

  describe('anonymisation (finding #22)', () => {
    /**
     * @description The anonymise row button is hidden for already anonymised customers.
     * @input  anonymize button visibleWhen for a normal and an anonymised row
     * @output true for eva@example.com, false for customer-5@anonymized.invalid
     */
    it('hides the button for anonymised customers', () => {
      const button = component.buttons.find(b => b.action === 'anonymize')!;
      expect(button.visibleWhen!({ email: 'eva@example.com' })).toBeTrue();
      expect(button.visibleWhen!({ email: 'customer-5@anonymized.invalid' })).toBeFalse();
    });

    /**
     * @description Anonymising asks first, posts to the API and reloads; cancelling does nothing.
     * @input  anonymizeCustomer({ id: 5, full_name: 'Eva Nova' }) with confirm false, then true; row without id
     * @output confirm with the name and the anonymise label; no post when cancelled; post('shop/customers/5/anonymize', {}),
     *   success alert, refreshData(); nothing for a row without id
     */
    it('anonymises after confirmation', async () => {
      ctx.i18n.getValue.and.callFake((p: string) => (p === 'shop-customers.anonymize_confirm_message' ? 'Erase {name}?' : p));
      const refresh = spyOn(component, 'refreshData');
      ctx.confirm.open.and.returnValue(Promise.resolve(false));
      await component.anonymizeCustomer({ id: 5, full_name: 'Eva Nova' });
      expect(ctx.confirm.open).toHaveBeenCalledWith('shop-customers.anonymize_confirm_title', 'Erase Eva Nova?', { confirm: 'shop-customers.btn_anonymize' });
      expect((ctx.dataHandler as any).post).not.toHaveBeenCalled();

      ctx.confirm.open.and.returnValue(Promise.resolve(true));
      await component.anonymizeCustomer({ id: 5, full_name: 'Eva Nova' });
      expect((ctx.dataHandler as any).post).toHaveBeenCalledWith('shop/customers/5/anonymize', {});
      expect(ctx.alert.open).toHaveBeenCalledWith('shared.success', 'shop-customers.anonymize_done_message', 'success');
      expect(refresh).toHaveBeenCalledTimes(1);

      await component.anonymizeCustomer({});
      expect(ctx.confirm.open).toHaveBeenCalledTimes(2);
    });

    /**
     * @description The table row action and the trash "deleted permanently" event are wired in the template.
     * @input  detectChanges(); anonymizeRequested emitted by the table; trash view itemDeletedPermanently
     * @output anonymizeCustomer() called with the row; handleItemDeleted() called
     */
    it('wires the table and trash events', fakeAsync(() => {
      const anonymize = spyOn(component, 'anonymizeCustomer').and.resolveTo();
      fixture.detectChanges();
      const table = fixture.debugElement.query(By.css('app-table-builder')).componentInstance;
      table.anonymizeRequested.emit({ id: 3 });
      expect(anonymize).toHaveBeenCalledWith({ id: 3 });
      const deleted = spyOn(component, 'handleItemDeleted');
      component.showTrashTable = true;
      fixture.componentRef.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      fixture.debugElement.query(By.css('app-trash-table-builder')).componentInstance.itemDeletedPermanently.emit();
      expect(deleted).toHaveBeenCalled();
      discardPeriodicTasks();
    }));
  });

  describe('orders of a customer', () => {
    /**
     * @description Opening the modal loads the first page of the customer's orders, newest first.
     * @input  showCustomerOrders({ id: 5 }); API { data: [2 orders], last_page 3, total 25, current_page 1 }
     * @output get(ordersUrl(1)); 2 orders; totals 3 pages / 25 items; body has 'modal-open'; loading false
     */
    it('opens the modal with the first page of orders', () => {
      (ctx.dataHandler as any).get.and.returnValue(of({ data: [{ id: 1 }, { id: 2 }], last_page: 3, total: 25, current_page: 1 }));
      component.showCustomerOrders({ id: 5 });
      expect((ctx.dataHandler as any).get).toHaveBeenCalledWith(ordersUrl(1));
      expect(component.customerOrders.length).toBe(2);
      expect([component.ordersTotalPages, component.ordersTotalItems, component.ordersCurrentPage]).toEqual([3, 25, 1]);
      expect(component.showOrdersModal).toBeTrue();
      expect(document.body.classList.contains('modal-open')).toBeTrue();
      expect(component.customerOrdersLoading).toBeFalse();
      expect(component.maxDisplayedOrdersCount).toBe(10);
    });

    /**
     * @description An empty answer gives safe defaults; a failure shows the error; no customer → no request.
     * @input  API {}; then error; then loadCustomerOrders without a selected customer
     * @output orders [], 1 page, 0 items; error 'shop-customers.load_orders_failed_message'; get not called again
     */
    it('handles empty, failed and missing data', () => {
      (ctx.dataHandler as any).get.and.returnValue(of({}));
      component.showCustomerOrders({ id: 5 });
      expect([component.customerOrders, component.ordersTotalPages, component.ordersTotalItems, component.ordersCurrentPage]).toEqual([[], 1, 0, 1]);
      (ctx.dataHandler as any).get.and.returnValue(throwError(() => new Error('x')));
      component.loadCustomerOrders(1);
      expect(component.customerOrdersError).toBe('shop-customers.load_orders_failed_message');
      expect(component.customerOrdersLoading).toBeFalse();
      component.selectedCustomerForOrders = null;
      (ctx.dataHandler as any).get.calls.reset();
      component.loadCustomerOrders(1);
      expect((ctx.dataHandler as any).get).not.toHaveBeenCalled();
    });

    /**
     * @description Paging only loads valid other pages.
     * @input  3 pages, current 1; ordersChangePage(0), (4), (1), (2)
     * @output only page 2 requested
     */
    it('changes the orders page', () => {
      (ctx.dataHandler as any).get.and.callFake((url: string) => of({ data: [], last_page: 3, total: 25, current_page: Number(/[?&]page=(\d+)/.exec(url)![1]) }));
      component.showCustomerOrders({ id: 5 });
      (ctx.dataHandler as any).get.calls.reset();
      [0, 4, 1].forEach(p => component.ordersChangePage(p));
      expect((ctx.dataHandler as any).get).not.toHaveBeenCalled();
      component.ordersChangePage(2);
      expect((ctx.dataHandler as any).get).toHaveBeenCalledWith(ordersUrl(2));
      expect(component.ordersCurrentPage).toBe(2);
    });

    /**
     * @description The page list shows every page up to 7, otherwise first, last, neighbours and gaps (-1).
     * @input  total 5; total 20 with current 1, 10 and 20
     * @output [1..5]; [1, 2, -1, 20]; [1, -1, 9, 10, 11, -1, 20]; [1, -1, 19, 20]
     */
    it('builds the page list', () => {
      component.ordersTotalPages = 5;
      component.ordersCurrentPage = 1;
      expect(component.getOrderPages()).toEqual([1, 2, 3, 4, 5]);
      component.ordersTotalPages = 20;
      expect(component.getOrderPages()).toEqual([1, 2, -1, 20]);
      component.ordersCurrentPage = 10;
      expect(component.getOrderPages()).toEqual([1, -1, 9, 10, 11, -1, 20]);
      component.ordersCurrentPage = 20;
      expect(component.getOrderPages()).toEqual([1, -1, 19, 20]);
    });

    /**
     * @description An order row expands and collapses; closing the modal resets everything.
     * @input  toggleOrderExpand(3) twice, then (4); closeOrdersModal()
     * @output expanded 3 → null → 4; modal closed, customer null, orders [], body without 'modal-open'
     */
    it('expands orders and closes the modal', () => {
      component.showCustomerOrders({ id: 5 });
      component.toggleOrderExpand(3);
      expect(component.ordersExpandedId).toBe(3);
      component.toggleOrderExpand(3);
      expect(component.ordersExpandedId).toBeNull();
      component.toggleOrderExpand(4);
      component.closeOrdersModal();
      expect(component.showOrdersModal).toBeFalse();
      expect(component.selectedCustomerForOrders).toBeNull();
      expect(component.customerOrders).toEqual([]);
      expect(component.ordersExpandedId).toBeNull();
      expect(document.body.classList.contains('modal-open')).toBeFalse();
    });

    /**
     * @description Order and payment states map to CSS classes; unknown states fall back to pending.
     * @input  getStatusClass('shipped'), ('nope'); getPaymentStatusClass('cod'), ('nope')
     * @output 'status-shipped', 'status-pending'; 'pay-cod', 'pay-pending'
     */
    it('maps order and payment states to classes', () => {
      expect(component.getStatusClass('shipped')).toBe('status-shipped');
      expect(component.getStatusClass('nope')).toBe('status-pending');
      expect(component.getPaymentStatusClass('cod')).toBe('pay-cod');
      expect(component.getPaymentStatusClass('nope')).toBe('pay-pending');
    });

    /**
     * @description Money and dates use the admin locale; missing values are safe.
     * @input  formatCurrency(1234.5), (1234.5, 'CZK'), (undefined); formatDate(''), ('2026-03-04T05:06:00')
     * @output cs-CZ EUR / CZK strings; 0 for undefined; '—'; cs-CZ medium date + short time
     */
    it('formats money and dates', () => {
      const money = (v: number, c: string) => new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: c }).format(v);
      expect(component.formatCurrency(1234.5)).toBe(money(1234.5, 'EUR'));
      expect(component.formatCurrency(1234.5, 'CZK')).toBe(money(1234.5, 'CZK'));
      expect(component.formatCurrency(undefined as any)).toBe(money(0, 'EUR'));
      expect(component.formatDate('')).toBe('—');
      expect(component.formatDate('2026-03-04T05:06:00')).toBe(new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date('2026-03-04T05:06:00')));
    });
  });

  /**
   * @description The page and the orders modal render.
   * @input  detectChanges(); open the modal with one order
   * @output 'shop-customers.table_header'; 'shop-customers.stat_orders_label' in the modal
   */
  it('renders the page and the orders modal', fakeAsync(() => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('shop-customers.table_header');
    (ctx.dataHandler as any).get.and.returnValue(of({ data: [{ id: 1, order_number: 'OBJ-1', status: 'paid', payment_status: 'paid', total: 10, currency: 'EUR', items_count: 1, created_at: '2026-01-01' }], last_page: 1, total: 1, current_page: 1 }));
    component.showCustomerOrders({ id: 5, first_name: 'Jan', last_name: 'Novák', total_spent: 10 });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('shop-customers.stat_orders_label');
    discardPeriodicTasks();
  }));
});
