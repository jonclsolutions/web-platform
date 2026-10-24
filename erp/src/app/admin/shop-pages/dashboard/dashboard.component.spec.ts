/**
 * @file dashboard.component.spec.ts
 * @path src/app/admin/shop-pages/dashboard/dashboard.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of the e-shop DashboardComponent: data requested by permission, KPI
 *   cards with week-over-week trends, revenue only from paid and not cancelled / returned orders,
 *   the 30-day revenue chart (points, smooth path, axis labels, tooltip), status breakdown, low
 *   stock list, auto refresh, formatting and switching the shop between live and maintenance mode.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (DataHandler spy, permission stub, alert spy, i18n stub),
 *   ResourceCacheService (real, spied on for the error path)
 */

import { ComponentFixture, TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { DashboardComponent } from './dashboard.component';
import { ResourceCacheService } from '../../../core/services/resource-cache.service';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('DashboardComponent (shop)', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;

  const dh = () => ctx.dataHandler as any;
  const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); };
  /** All orders: 2 paid this week (100 + 50), 1 paid last week (60), 1 cancelled paid, 1 unpaid pending. */
  const allOrders = () => [
    { id: 1, status: 'delivered', payment_status: 'paid', final_amount: '100', created_at: daysAgo(1) },
    { id: 2, status: 'shipped', payment_status: 'paid', final_amount: 50, created_at: daysAgo(2) },
    { id: 3, status: 'delivered', payment_status: 'paid', final_amount: 60, created_at: daysAgo(9) },
    { id: 4, status: 'canceled', payment_status: 'paid', final_amount: 999, created_at: daysAgo(1) },
    { id: 5, status: 'pending', payment_status: 'pending', final_amount: 70, created_at: daysAgo(3) }
  ];
  const answers = (overrides: Record<string, any> = {}) => {
    const base: Record<string, any> = {
      'shop/orders?per_page=10&sort_by=created_at&sort_direction=desc': of({ data: [{ id: 1 }], meta: { total: 5 } }),
      'shop/orders?no_pagination=true&sort_by=created_at&sort_direction=desc': of({ data: allOrders() }),
      'shop/customers?per_page=1': of({ data: [], meta: { total: 12 } }),
      'shop/products?per_page=1&is_active=true': of({ data: [], meta: { total: 40 } }),
      'shop/products?low_stock=true&no_pagination=true': of({ data: [{ id: 9, name: 'Kabel', sku: 'K', stock_quantity: 1, stock_warning_level: 4 }, { id: 10, name: 'X', sku: 'X' }] }),
      'shop/coupons?is_active=true&per_page=1': of({ data: [], meta: { total: 3 } }),
      'shop/orders?status=pending&per_page=1': of({ data: [], meta: { total: 1 } })
    };
    dh().getPaginatedCollection.and.callFake((url: string) => (url in overrides ? overrides[url] : base[url]));
  };
  const card = (key: string) => component.kpiCards.find(c => c.key === key)!;
  const urls = () => dh().getPaginatedCollection.calls.allArgs().map((a: any[]) => a[0]);

  beforeEach(async () => {
    ctx = createAdminTestContext();
    answers();
    dh().get.and.returnValue(of({ is_shop_active: true, maintenance_message: 'Brzy' }));
    await TestBed.configureTestingModule({ imports: [DashboardComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  describe('data and KPI cards', () => {
    /**
     * @description With all permissions every source is loaded and turned into KPI cards.
     * @input  ngOnInit()
     * @output 7 requests; recent orders 1, total 5, pending 1, customers 12, products 40, coupons 3; cards revenueWeek … coupons; loading false
     */
    it('loads everything and builds the KPI cards', fakeAsync(() => {
      component.ngOnInit();
      expect(urls().length).toBe(7);
      expect([component.recentOrders.length, component.totalOrders, component.pendingOrders, component.totalCustomers, component.activeProducts, component.activeCoupons])
        .toEqual([1, 5, 1, 12, 40, 3]);
      expect(component.kpiCards.map(c => c.key)).toEqual(['revenueWeek', 'ordersWeek', 'aov', 'pendingOrders', 'activeProducts', 'customers', 'coupons']);
      expect(component.loading).toBeFalse();
      expect(component.t('header_title')).toBe('shop-dashboard.header_title');
      discardPeriodicTasks();
    }));

    /**
     * @description Revenue counts only paid orders that are not cancelled or returned; weeks compare the last 7 days with the 7 before.
     * @input  orders: 100 + 50 paid this week, 60 paid 9 days ago, 999 paid but cancelled, 70 unpaid
     * @output revenue this week 150, last week 60 (trend up 150 %); orders this week 4, last week 1; total revenue 210; month revenue / average of the eligible orders since the 1st
     */
    it('computes revenue and weekly trends', fakeAsync(() => {
      component.ngOnInit();
      expect([component.revenueThisWeek, component.revenueLastWeek, component.totalRevenue]).toEqual([150, 60, 210]);
      expect(card('revenueWeek').trend).toEqual({ pct: 150, direction: 'up' });
      expect([component.ordersThisWeek, component.ordersLastWeek]).toEqual([4, 1]);
      expect(card('ordersWeek').trend).toEqual({ pct: 300, direction: 'up' });
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const month = allOrders().filter(o => o.payment_status === 'paid' && !['canceled', 'returned'].includes(o.status) && new Date(o.created_at) >= monthStart);
      const monthRevenue = month.reduce((sum, o) => sum + Number(o.final_amount), 0);
      expect(component.revenueThisMonth).toBe(monthRevenue);
      expect(component.avgOrderValueThisMonth).toBe(month.length ? monthRevenue / month.length : 0);
      discardPeriodicTasks();
    }));

    /**
     * @description Paid orders without an amount count as 0 everywhere; with no eligible order this month the average is 0.
     * @input  orders: paid without final_amount yesterday and 9 days ago; nothing else
     * @output revenue this / last week 0; total 0; chart max 1; average 0; orders this / last week 1 / 1
     */
    it('treats missing amounts as zero', fakeAsync(() => {
      answers({ 'shop/orders?no_pagination=true&sort_by=created_at&sort_direction=desc': of({ data: [
        { id: 1, status: 'delivered', payment_status: 'paid', created_at: daysAgo(1) },
        { id: 2, status: 'delivered', payment_status: 'paid', created_at: daysAgo(9) }
      ] }) });
      component.ngOnInit();
      expect([component.revenueThisWeek, component.revenueLastWeek, component.totalRevenue, component.chartMax, component.avgOrderValueThisMonth]).toEqual([0, 0, 0, 1, 0]);
      expect([component.ordersThisWeek, component.ordersLastWeek]).toEqual([1, 1]);
      discardPeriodicTasks();
    }));

    /**
     * @description Trend rules: both zero → neutral; from zero → +100 %; fall → down; equal → neutral.
     * @input  pctChange(0, 0), (5, 0), (5, 10), (10, 10)
     * @output neutral 0; up 100; down 50; neutral 0
     */
    it('computes trends', () => {
      const pct = (c: number, p: number) => (component as any).pctChange(c, p);
      expect(pct(0, 0)).toEqual({ pct: 0, direction: 'neutral' });
      expect(pct(5, 0)).toEqual({ pct: 100, direction: 'up' });
      expect(pct(5, 10)).toEqual({ pct: 50, direction: 'down' });
      expect(pct(10, 10)).toEqual({ pct: 0, direction: 'neutral' });
    });

    /**
     * @description Pending orders and low stock make their cards urgent; nothing pending shows the calm text.
     * @input  pending 1, 2 low-stock products; then pending 0 and no low stock (paginated answers)
     * @output pendingOrders urgent with 'kpi_pending_orders_sub_action'; activeProducts urgent, count '2'; then not urgent, '…_sub_none'
     */
    it('marks urgent KPI cards', fakeAsync(() => {
      component.ngOnInit();
      expect([card('pendingOrders').urgent, card('pendingOrders').subKey]).toEqual([true, 'kpi_pending_orders_sub_action']);
      expect([card('activeProducts').urgent, card('activeProducts').subParams]).toEqual([true, { count: '2' }]);
      expect(component.lowStockProducts[1]).toEqual({ id: 10, name: 'X', sku: 'X', stock_quantity: 0, stock_warning_level: 5 });
      answers({
        'shop/orders?status=pending&per_page=1': of({ data: [], meta: { total: 0 } }),
        'shop/products?low_stock=true&no_pagination=true': of({ data: [] }),
        'shop/orders?no_pagination=true&sort_by=created_at&sort_direction=desc': of({ data: [] })
      });
      component.refresh();
      expect([card('pendingOrders').urgent, card('pendingOrders').subKey]).toEqual([false, 'kpi_pending_orders_sub_none']);
      expect(card('activeProducts').urgent).toBeFalse();
      expect(card('revenueWeek').trend).toEqual({ pct: 0, direction: 'neutral' });
      discardPeriodicTasks();
    }));

    /**
     * @description Only allowed sources are requested; missing or failed sources give zeros.
     * @input  granted ['shop-customers-view']; then all with every request failing
     * @output only shop/customers requested; cards ['customers']; after failures all values 0 / [] and cards built
     */
    it('requests only allowed data and survives failures', fakeAsync(() => {
      ctx.permissions.granted = new Set(['shop-customers-view']);
      component.ngOnInit();
      expect(urls()).toEqual(['shop/customers?per_page=1']);
      expect(component.kpiCards.map(c => c.key)).toEqual(['customers']);
      expect([component.totalOrders, component.activeProducts, component.lowStockProducts]).toEqual([0, 0, []]);
      ctx.permissions.granted = 'all';
      dh().getPaginatedCollection.and.returnValue(throwError(() => new Error('x')));
      component.refresh();
      expect([component.totalOrders, component.totalCustomers, component.activeCoupons, component.recentOrders]).toEqual([0, 0, 0, []]);
      expect(component.kpiCards.length).toBe(7);
      discardPeriodicTasks();
    }));

    /**
     * @description A failure of the whole stats stream shows the error state; refresh is ignored while running.
     * @input  ResourceCacheService.get errors; refresh() while isRefreshing
     * @output loadingError true; loading false; isRefreshing false; no new load while refreshing
     */
    it('shows the error state and guards refresh', fakeAsync(() => {
      spyOn(TestBed.inject(ResourceCacheService), 'get').and.returnValue(throwError(() => new Error('x')));
      component.isRefreshing = true;
      component.loadAll();
      expect([component.loadingError, component.loading, component.isRefreshing]).toEqual([true, false, false]);
      component.isRefreshing = true;
      const load = spyOn(component, 'loadAll');
      component.refresh();
      expect(load).not.toHaveBeenCalled();
    }));

    /**
     * @description The data refreshes itself every 2 minutes past the cache and stops when the page is left.
     * @input  ngOnInit(); tick(120 000); destroy; tick(120 000)
     * @output second round of 7 requests after 2 minutes; none after destroy
     */
    it('refreshes automatically every 2 minutes', fakeAsync(() => {
      component.ngOnInit();
      tick(120_000);
      expect(urls().length).toBe(14);
      component.ngOnDestroy();
      tick(120_000);
      expect(urls().length).toBe(14);
    }));
  });

  describe('chart and breakdown', () => {
    /**
     * @description The chart has one point per day of the last 30 days with eligible revenue; orders without date are skipped.
     * @input  orders above + one paid order without created_at
     * @output 30 points; last point (today) 0, yesterday 100; chartMax 100; first x = padding; line and area paths start with 'M'
     */
    it('builds the 30-day revenue chart', fakeAsync(() => {
      answers({ 'shop/orders?no_pagination=true&sort_by=created_at&sort_direction=desc': of({ data: [...allOrders(), { id: 6, status: 'delivered', payment_status: 'paid' }] }) });
      component.ngOnInit();
      expect(component.chartPoints.length).toBe(30);
      expect(component.chartPoints[28].value).toBe(100);
      expect(component.chartMax).toBe(100);
      expect(component.chartPoints[0].x).toBe(component.chartPadL);
      expect(component.linePath.startsWith('M ')).toBeTrue();
      expect(component.areaPath.endsWith('Z')).toBeTrue();
      expect(component.xAxisLabels.length).toBe(7);
      discardPeriodicTasks();
    }));

    /**
     * @description Paths: empty without points, straight line for fewer than 3 points.
     * @input  chartPoints []; 2 points
     * @output linePath '' and areaPath ''; 'M 0 0 L 10 5'
     */
    it('draws empty and short paths', () => {
      component.chartPoints = [];
      expect([component.linePath, component.areaPath]).toEqual(['', '']);
      component.chartPoints = [{ label: 'a', value: 0, x: 0, y: 0 }, { label: 'b', value: 1, x: 10, y: 5 }];
      expect(component.linePath).toBe('M 0 0 L 10 5');
    });

    /**
     * @description Orders are counted per status (largest first) with colours and shares; unknown states get the neutral colour.
     * @input  orders: 2 delivered, shipped, canceled, pending + 'weird'
     * @output first delivered 2 (33 %); weird labelKey '' and dim colour; empty list → []
     */
    it('builds the status breakdown', fakeAsync(() => {
      answers({ 'shop/orders?no_pagination=true&sort_by=created_at&sort_direction=desc': of({ data: [...allOrders(), { id: 7, status: 'weird', payment_status: 'paid' }] }) });
      component.ngOnInit();
      expect(component.statusBreakdown[0]).toEqual({ statusKey: 'delivered', labelKey: 'status_delivered', count: 2, color: 'var(--success, #059669)', pct: 33 });
      const weird = component.statusBreakdown.find(s => s.statusKey === 'weird')!;
      expect([weird.labelKey, weird.color]).toEqual(['', 'var(--text-dim, #a1a1aa)']);
      (component as any).buildStatusBreakdown([]);
      expect(component.statusBreakdown).toEqual([]);
      discardPeriodicTasks();
    }));

    /**
     * @description Axis labels and positions; the tooltip shows the formatted value of a point.
     * @input  chartMax 4 000 000 / 4 000 / 40; yLabel(steps); yPos(0), yPos(4); showTooltip(point); hideTooltip()
     * @output '4.0M', '4k', '40'; bottom and top of the inner chart; tooltip visible with formatted value, then hidden
     */
    it('labels the axes and shows the tooltip', () => {
      component.chartMax = 4_000_000;
      expect(component.yLabel(4)).toBe('4.0M');
      component.chartMax = 4_000;
      expect(component.yLabel(4)).toBe('4k');
      component.chartMax = 40;
      expect(component.yLabel(4)).toBe('40');
      expect(component.yPos(0)).toBe(component.chartPadT + component.chartInnerH);
      expect(component.yPos(4)).toBe(component.chartPadT);
      expect(component.yGridLines).toEqual([0, 1, 2, 3, 4]);
      component.showTooltip({ label: '1. 1.', value: 1500, x: 10, y: 20 });
      expect(component.chartTooltip).toEqual({ visible: true, x: 10, y: 20, label: '1. 1.', value: component.formatCurrency(1500) });
      component.hideTooltip();
      expect(component.chartTooltip.visible).toBeFalse();
    });
  });

  describe('formatting', () => {
    /**
     * @description Money, dates, status labels and classes; stock bars.
     * @input  formatCurrency(1500), (NaN); formatDate(''), ('2026-03-04T05:06:00'); labels / classes for known and unknown states; stockPct
     * @output cs-CZ EUR without decimals (finding #15, not CZK); '0 €' for NaN; '—'; cs-CZ date; translated or raw labels; classes; 8 % and capped 100 %
     */
    it('formats values', () => {
      const eur = (v: number) => new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
      expect(component.formatCurrency(1500)).toBe(eur(1500));
      expect(component.formatCurrency(1500)).toContain('€');
      expect(component.formatCurrency(1500)).not.toContain('Kč');
      expect(component.formatCurrency(NaN)).toBe(eur(0));
      expect(component.formatDate('')).toBe('—');
      expect(component.formatDate('2026-03-04T05:06:00')).toBe(new Date('2026-03-04T05:06:00').toLocaleDateString('cs-CZ',
        { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }));
      expect([component.statusLabel('shipped'), component.statusLabel('weird')]).toEqual(['shop-dashboard.status_shipped', 'weird']);
      expect([component.paymentStatusLabel('paid'), component.paymentStatusLabel('cod')]).toEqual(['shop-dashboard.payment_status_paid', 'cod']);
      expect([component.statusClass('returned'), component.statusClass('weird')]).toEqual(['status-returned', '']);
      expect([component.paymentClass('paid'), component.paymentClass('pending')]).toEqual(['payment-paid', 'payment-pending']);
      expect(component.stockPct({ id: 1, name: '', sku: '', stock_quantity: 1, stock_warning_level: 4 })).toBe(8);
      expect(component.stockPct({ id: 1, name: '', sku: '', stock_quantity: 50, stock_warning_level: 4 })).toBe(100);
      expect(component.stockPct({ id: 1, name: '', sku: '', stock_quantity: 0, stock_warning_level: 0 })).toBe(0);
      expect(String((component.getIcon('nope') as any).changingThisBreaksApplicationSecurity)).toBe('');
    });
  });

  describe('maintenance mode', () => {
    /**
     * @description The shop state is loaded with shop-set-maintenance-mode; null answers and failures keep the state.
     * @input  shop/settings { is_shop_active: false, maintenance_message: 'Brzy' }; without permission; null; failure; no message
     * @output isShopActive false, message 'Brzy'; no request without permission; state kept; message ''
     */
    it('loads the maintenance state', fakeAsync(() => {
      dh().get.and.returnValue(of({ is_shop_active: false, maintenance_message: 'Brzy' }));
      component.ngOnInit();
      expect(dh().get).toHaveBeenCalledWith('shop/settings');
      expect([component.isShopActive, component.shopMaintenanceMessage]).toEqual([false, 'Brzy']);
      const cache = TestBed.inject(ResourceCacheService);
      const load = () => { cache.invalidate('shop-dashboard:maintenance'); (component as any).loadMaintenanceStatus(); };
      dh().get.and.returnValue(of(null));
      load();
      expect(component.isShopActive).toBeFalse();
      dh().get.and.returnValue(throwError(() => new Error('x')));
      load();
      expect(component.isShopActive).toBeFalse();
      dh().get.and.returnValue(of({ is_shop_active: 1 }));
      load();
      expect([component.isShopActive, component.shopMaintenanceMessage]).toEqual([true, '']);
      ctx.permissions.granted = new Set();
      dh().get.calls.reset();
      load();
      expect(dh().get).not.toHaveBeenCalled();
      discardPeriodicTasks();
    }));

    /**
     * @description The modal targets the opposite state; cancel clears the password; the password is required.
     * @input  isShopActive true; open; type password; cancel; submit with '  '
     * @output pending target false; closed and password ''; warning 'shop-dashboard.maintenance_error_missing_password'; no request
     */
    it('opens, cancels and requires the password', () => {
      component.openShopMaintenanceModal();
      expect([component.pendingShopTargetState, component.showShopMaintenanceModal]).toEqual([false, true]);
      component.shopConfirmPasswordValue = 'pw';
      component.cancelShopMaintenanceModal();
      expect([component.showShopMaintenanceModal, component.shopConfirmPasswordValue]).toEqual([false, '']);
      component.shopConfirmPasswordValue = '  ';
      component.submitShopMaintenanceChange();
      expect(ctx.alert.open).toHaveBeenCalledWith('shop-dashboard.maintenance_error_title', 'shop-dashboard.maintenance_error_missing_password', 'danger');
      expect(dh().put).not.toHaveBeenCalled();
    });

    /**
     * @description Switching to maintenance uses the default message when empty; switching back keeps a custom message.
     * @input  active shop, message '' → submit; then inactive, message 'Brzy' → submit
     * @output put('shop/settings', { is_shop_active: false, maintenance_message: 'shop-dashboard.maintenance_default_message', confirm_password: 'pw' }); success texts for both directions
     */
    it('switches the shop mode', () => {
      component.isShopActive = true;
      component.shopMaintenanceMessage = '';
      component.openShopMaintenanceModal();
      component.shopConfirmPasswordValue = 'pw';
      component.submitShopMaintenanceChange();
      expect(dh().put).toHaveBeenCalledWith('shop/settings', { is_shop_active: false, maintenance_message: 'shop-dashboard.maintenance_default_message', confirm_password: 'pw' });
      expect(component.isShopActive).toBeFalse();
      expect(ctx.alert.open).toHaveBeenCalledWith('shop-dashboard.maintenance_success_title', 'shop-dashboard.maintenance_success_maintenance', 'success');
      component.shopMaintenanceMessage = 'Brzy';
      component.openShopMaintenanceModal();
      component.shopConfirmPasswordValue = 'pw';
      component.submitShopMaintenanceChange();
      expect(dh().put.calls.mostRecent().args[1].maintenance_message).toBe('Brzy');
      expect(component.isShopActive).toBeTrue();
      expect(ctx.alert.open).toHaveBeenCalledWith('shop-dashboard.maintenance_success_title', 'shop-dashboard.maintenance_success_active', 'success');
    });

    /**
     * @description A rejected change shows the server message or a generic one.
     * @input  put fails with { error: { message: 'Wrong password' } }, then with {}
     * @output alerts 'Wrong password' / 'shop-dashboard.maintenance_error_generic'
     */
    it('reports a rejected change', () => {
      component.shopConfirmPasswordValue = 'bad';
      dh().put.and.returnValue(throwError(() => ({ error: { message: 'Wrong password' } })));
      component.submitShopMaintenanceChange();
      expect(ctx.alert.open).toHaveBeenCalledWith('shop-dashboard.maintenance_error_auth_title', 'Wrong password', 'danger');
      dh().put.and.returnValue(throwError(() => ({})));
      component.submitShopMaintenanceChange();
      expect(ctx.alert.open).toHaveBeenCalledWith('shop-dashboard.maintenance_error_auth_title', 'shop-dashboard.maintenance_error_generic', 'danger');
    });
  });

  /**
   * @description The dashboard renders KPIs, chart, orders and the maintenance card.
   * @input  detectChanges() after loading; maintenance modal open
   * @output 'shop-dashboard.header_title', 'shop-dashboard.chart_title', 'shop-dashboard.section_maintenance' rendered
   */
  it('renders the dashboard', fakeAsync(() => {
    fixture.detectChanges();
    component.openShopMaintenanceModal();
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('shop-dashboard.header_title');
    expect(text).toContain('shop-dashboard.chart_title');
    expect(text).toContain('shop-dashboard.section_maintenance');
    discardPeriodicTasks();
  }));
});
