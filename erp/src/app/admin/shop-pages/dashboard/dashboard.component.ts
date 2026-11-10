/**
 * @file dashboard.component.ts
 * @path src/app/admin/shop-pages/dashboard/dashboard.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Serves as the central management hub, aggregating operational KPIs, sales trends,
 * and real-time shop status.
 * @note i18n: the component does NOT extend `BaseDataComponent` (unlike the Core / Web
 * dashboard), hence the manual `inject(AdminLocalizationService)` + `t()` reading the
 * `shop-dashboard` section. It uses the default change detection (no OnPush), so no explicit
 * `translations$.subscribe(() => markForCheck())` is needed. `statusLabel()` /
 * `paymentStatusLabel()` map the raw `status` / `payment_status` to a TRANSLATION key, not to
 * a text from the API. `formatDate()` / `formatCurrency()` use `i18n.getDateLocale()`.
 * @note Analytics: `isRevenueEligible()` is the SINGLE source of truth of a "closed paid order":
 * `payment_status === 'paid'` AND `status` NOT `canceled` / `returned` (wider than
 * `status === 'delivered'` - a paid order still `shipped` is already collected revenue). Used
 * everywhere money is involved (`buildChartData`, `buildRevenueStats`,
 * `computeWeeklyComparison`); `buildStatusBreakdown` deliberately does NOT filter (it shows the
 * whole order pipeline). `computeWeeklyComparison()` compares a rolling 7-day window with the
 * previous one: revenue from eligible orders, order count from ALL orders (volume, not money);
 * `pctChange()` turns a pair of numbers into `{ pct, direction }` with safe division by zero.
 * `buildRevenueStats()` also computes `avgOrderValueThisMonth` (AOV) of the current month.
 * @note Chart: `chartPoints` (one point a day) are drawn through `buildSmoothPath()`
 * (Catmull-Rom -> cubic Bézier, no chart library). The points stay in the DOM only as INVISIBLE
 * hit targets of the tooltip (`chart-dot` has `opacity: 0`), visible only on hover
 * (`chart-dot-highlight`).
 *
 * @dependencies
 * - DataHandler: Centralized HTTP communication (baseUrl + error handling).
 * - AlertDialogService: Feedback on success / failure of the maintenance mode change.
 * - HasPermissionDirective: Gates the maintenance card on the `shop-set-maintenance-mode` permission.
 * - PermissionService: Synchronous check of permission keys - decides which KPI / chart / table
 *   requests are sent at all.
 * - ResourceCacheService: TTL cache of the stats / maintenance fetch.
 * - AdminLocalizationService: Static i18n of the admin UI (section `shop-dashboard`).
 * - RxJS (forkJoin, interval): Manages concurrent data streams and polling mechanisms.
 */

import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { forkJoin, interval, Subscription, catchError, of, Observable } from 'rxjs';
import { DataHandler } from '../../../core/services/data-handler.service';
import { AlertDialogService } from '../../../core/services/alert-dialog.service';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { PermissionService } from '../../../core/auth/services/permission.service';
import { ResourceCacheService } from '../../../core/services/resource-cache.service';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';
import { PageHelpComponent } from '../../components/page-help/page-help.component';

/** @description Trend badge shown on a KPI card - direction drives the color (success/error/neutral). */
interface KpiTrend {
  pct: number;
  direction: 'up' | 'down' | 'neutral';
}

/**
 * @description A single KPI tile. Carries translation KEYS (`labelKey`/`subKey`), not
 * resolved text - text is resolved in the template via `t()`, same reasoning as
 * Core/Web dashboard `QuickStat`.
 */
interface KpiCard {
  key: string;
  labelKey: string;
  icon: string;
  value: string;
  subKey?: string;
  subParams?: Record<string, string>;
  trend?: KpiTrend;
  trendLabelKey?: string;
  urgent?: boolean;
}

interface ChartPoint {
  label: string;
  value: number;
  x: number;
  y: number;
}

/** @description One row of the order-status breakdown widget. `labelKey` resolved via `t()`. */
interface StatusBreakdown {
  statusKey: string;
  labelKey: string;
  count: number;
  color: string;
  pct: number;
}

interface LowStockProduct {
  id: number;
  name: string;
  sku: string;
  stock_quantity: number;
  stock_warning_level: number;
}

interface RecentOrder {
  id: number;
  order_number: string;
  customer?: { full_name?: string; email?: string } | null;
  /** Buyer as given for the order (snapshot, findings #22 / #23) - preferred over `customer`. */
  contact?: { full_name?: string; email?: string | null } | null;
  status: string;
  payment_status: string;
  final_amount: number;
  created_at: string;
}

/**
 * @description Orchestrates the administration dashboard, visualizing key performance metrics and
 * operational tasks.
 * @usage Provides a high-level overview for store administrators to track sales, inventory, and
 * pending orders.
 * @note Implements an automatic data-polling mechanism to ensure the dashboard remains up-to-date
 * without page reloads. Every aggregated piece is additionally gated by `PermissionService`.
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, HasPermissionDirective, PageHelpComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['../../shared-styles/dashboard.css', '../../shared-styles/dashboard-maintenance.css', './dashboard.component.css'],
})
export class DashboardComponent implements OnInit, OnDestroy {

  private sanitizer = inject(DomSanitizer);
  private alertDialogService = inject(AlertDialogService);
  private resourceCache = inject(ResourceCacheService);
  private permissionService = inject(PermissionService);
  public readonly i18n = inject(AdminLocalizationService);
  private refreshSub?: Subscription;

  t(key: string): string {
    return this.i18n.getValue(`shop-dashboard.${key}`);
  }

  private readonly TTL_MS = 2 * 60 * 1000;
  private readonly STATS_CACHE_KEY = 'shop-dashboard:all';
  private readonly MAINTENANCE_CACHE_KEY = 'shop-dashboard:maintenance';
  private readonly MAINTENANCE_TTL_MS = 60 * 1000;

  /** Permission keys - match `data: { permission }` of the shop page in `admin-routing.module.ts`. */
  private readonly PERM_ORDERS = 'shop-orders-view';
  private readonly PERM_CUSTOMERS = 'shop-customers-view';
  private readonly PERM_PRODUCTS = 'shop-products-view';
  private readonly PERM_COUPONS = 'shop-coupons-view';
  private readonly PERM_MAINTENANCE = 'shop-set-maintenance-mode';

  /** Orders, revenue, 30-day chart, order states - all from `shop/orders`. */
  get canViewOrders(): boolean { return this.permissionService.hasPermission(this.PERM_ORDERS); }
  /** Customer count. */
  get canViewCustomers(): boolean { return this.permissionService.hasPermission(this.PERM_CUSTOMERS); }
  /** Active products + low stock. */
  get canViewProducts(): boolean { return this.permissionService.hasPermission(this.PERM_PRODUCTS); }
  /** Active coupons. */
  get canViewCoupons(): boolean { return this.permissionService.hasPermission(this.PERM_COUPONS); }

  loading = true;
  loadingError = false;
  lastRefreshed: Date = new Date();
  isRefreshing = false;

  kpiCards: KpiCard[] = [];

  chartPoints: ChartPoint[] = [];
  chartMax = 0;
  chartWidth = 700;
  chartHeight = 180;
  chartPadL = 50;
  chartPadR = 16;
  chartPadT = 16;
  chartPadB = 36;
  chartTooltip: { visible: boolean; x: number; y: number; label: string; value: string } = {
    visible: false, x: 0, y: 0, label: '', value: ''
  };

  get chartInnerW() { return this.chartWidth - this.chartPadL - this.chartPadR; }
  get chartInnerH() { return this.chartHeight - this.chartPadT - this.chartPadB; }

  get linePath(): string {
    return this.buildSmoothPath(this.chartPoints);
  }

  /** @description The same smooth curve as `linePath`, closed down to the X axis for the area fill below the chart. */
  get areaPath(): string {
    if (!this.chartPoints.length) return '';
    const bottom = this.chartPadT + this.chartInnerH;
    const first = this.chartPoints[0];
    const last = this.chartPoints[this.chartPoints.length - 1];
    return `${this.linePath} L ${last.x} ${bottom} L ${first.x} ${bottom} Z`;
  }

  get yGridLines(): number[] {
    const steps = 4;
    return Array.from({ length: steps + 1 }, (_, i) => i);
  }

  recentOrders: RecentOrder[] = [];
  totalOrders = 0;
  pendingOrders = 0;

  statusBreakdown: StatusBreakdown[] = [];
  lowStockProducts: LowStockProduct[] = [];

  totalCustomers = 0;
  activeProducts = 0;
  activeCoupons = 0;

  /** Summary of really COLLECTED revenue (eligible orders) - see `isRevenueEligible()`. */
  totalRevenue = 0;
  revenueThisMonth = 0;
  /** Average order value (AOV) of the current calendar month, eligible orders only. */
  avgOrderValueThisMonth = 0;

  revenueThisWeek = 0;
  revenueLastWeek = 0;
  ordersThisWeek = 0;
  ordersLastWeek = 0;

  // ── E-shop maintenance mode ────────────────────────────────────────────
  isShopActive = true;
  shopMaintenanceMessage = '';
  showShopMaintenanceModal = false;
  shopConfirmPasswordValue = '';
  pendingShopTargetState = true;

  /**
   * @description "Closed paid order" - the single source of truth of what counts as really
   * collected revenue (chart, revenue KPI, AOV, weekly comparison): `payment_status === 'paid'`
   * AND `status` NOT in `canceled` / `returned` - wider than `status === 'delivered'`, because a
   * paid but not yet delivered order (`shipped`) is already real revenue. `buildStatusBreakdown()`
   * deliberately does NOT use it - that widget shows the whole order pipeline.
   * @param order Raw order object from `shop/orders`.
   */
  private isRevenueEligible(order: any): boolean {
    return order?.payment_status === 'paid' && !['canceled', 'returned'].includes(order?.status);
  }

  /**
   * @description Safely computes the percentage change of `current` against `previous`, handling
   * division by zero (no `Infinity` / `NaN` in the UI).
   */
  private pctChange(current: number, previous: number): KpiTrend {
    if (previous === 0) {
      if (current === 0) return { pct: 0, direction: 'neutral' };
      return { pct: 100, direction: 'up' };
    }
    const pct = Math.round(((current - previous) / previous) * 100);
    return { pct: Math.abs(pct), direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral' };
  }

  /** @description Map `status` -> translation key (`statusLabel()`). */
  private readonly STATUS_LABEL_KEYS: Record<string, string> = {
    pending: 'status_pending', confirmed: 'status_confirmed', processing: 'status_processing',
    shipped: 'status_shipped', delivered: 'status_delivered', canceled: 'status_canceled', returned: 'status_returned',
  };

  /** @description `payment_status` -> translation key (`paymentStatusLabel()`). */
  private readonly PAYMENT_STATUS_LABEL_KEYS: Record<string, string> = {
    paid: 'payment_status_paid', pending: 'payment_status_pending',
  };

  /**
   * Icon library of the dashboard. No `viewBox`, the on-screen size is set by CSS
   * (`.kpi-icon svg`).
   */
  private readonly ICONS: Record<string, string> = {
    money: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    box: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
    users: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    bag: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
    coupon: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9a3 3 0 1 0 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 1 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/></svg>`,
    clock: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    scale: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="3" x2="12" y2="21"/><path d="M5 8h14"/><path d="M5 8 2 15a3 3 0 0 0 6 0L5 8Z"/><path d="M19 8l-3 7a3 3 0 0 0 6 0l-3-7Z"/></svg>`,
  };

  /**
   * @description Returns the sanitized SVG markup for the given icon key (see `ICONS`).
   */
  getIcon(key: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.ICONS[key] ?? '');
  }

  constructor(private dataHandler: DataHandler) {}

  ngOnInit(): void {
    this.loadAll();
    this.loadMaintenanceStatus();
    this.refreshSub = interval(120_000).subscribe(() => this.loadAll(true));
  }

  ngOnDestroy(): void {
    this.refreshSub?.unsubscribe();
  }

  /**
   * @description Manual "Refresh" - same UX pattern as the Core / Web dashboard.
   */
  refresh(): void {
    if (this.isRefreshing) return;
    this.isRefreshing = true;
    this.loadAll(true);
  }

  /**
   * @description Fetches all dashboard modules the current user is permitted to see,
   * concurrently using forkJoin, and handles global loading/error states. Through the TTL cache.
   * @param force Bypass cache - used by the manual "Refresh" button and the periodic polling
   * (interval 120 s).
   * @note Every call is wrapped in its own `catchError(() => of(null))` - a single failed widget
   * does not break the whole dashboard, only its card is not rendered.
   * @note Partial calls are sent ONLY for modules the user has permission for
   * (`canViewOrders` / `canViewCustomers` / `canViewProducts` / `canViewCoupons`).
   */
  loadAll(force: boolean = false): void {
    this.loading = true;
    this.loadingError = false;

    if (force) {
      this.resourceCache.invalidate(this.STATS_CACHE_KEY);
    }

    const skip = (): Observable<null> => of(null);

    this.resourceCache.get(this.STATS_CACHE_KEY, () => forkJoin({
      orders: this.canViewOrders
        ? this.dataHandler.getPaginatedCollection<any>('shop/orders?per_page=10&sort_by=created_at&sort_direction=desc').pipe(catchError(() => of(null)))
        : skip(),
      allOrders: this.canViewOrders
        ? this.dataHandler.getPaginatedCollection<any>('shop/orders?no_pagination=true&sort_by=created_at&sort_direction=desc').pipe(catchError(() => of(null)))
        : skip(),
      customers: this.canViewCustomers
        ? this.dataHandler.getPaginatedCollection<any>('shop/customers?per_page=1').pipe(catchError(() => of(null)))
        : skip(),
      products: this.canViewProducts
        ? this.dataHandler.getPaginatedCollection<any>('shop/products?per_page=1&is_active=true').pipe(catchError(() => of(null)))
        : skip(),
      lowStock: this.canViewProducts
        ? this.dataHandler.getPaginatedCollection<any>('shop/products?low_stock=true&no_pagination=true').pipe(catchError(() => of(null)))
        : skip(),
      coupons: this.canViewCoupons
        ? this.dataHandler.getPaginatedCollection<any>('shop/coupons?is_active=true&per_page=1').pipe(catchError(() => of(null)))
        : skip(),
      pendingOrders: this.canViewOrders
        ? this.dataHandler.getPaginatedCollection<any>('shop/orders?status=pending&per_page=1').pipe(catchError(() => of(null)))
        : skip(),
    }), this.TTL_MS).subscribe({
      next: (res) => {
        this.processData(res);
        this.lastRefreshed = new Date();
        this.loading = false;
        this.isRefreshing = false;
      },
      error: () => {
        this.loadingError = true;
        this.loading = false;
        this.isRefreshing = false;
      }
    });
  }

  /**
   * @description Maps API responses to component view models.
   */
  private processData(res: any): void {
    this.recentOrders = res.orders?.data ?? [];
    this.totalOrders = res.orders?.meta?.total ?? 0;
    this.pendingOrders = res.pendingOrders?.meta?.total ?? 0;

    this.totalCustomers = res.customers?.meta?.total ?? 0;
    this.activeProducts = res.products?.meta?.total ?? 0;
    this.activeCoupons = res.coupons?.meta?.total ?? 0;

    const allProds: any[] = res.lowStock?.data ?? [];
    this.lowStockProducts = allProds.slice(0, 8).map(p => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      stock_quantity: p.stock_quantity ?? 0,
      stock_warning_level: p.stock_warning_level ?? 5,
    }));

    const allOrds: any[] = res.allOrders?.data ?? [];
    this.buildChartData(allOrds);
    this.buildStatusBreakdown(allOrds);
    this.buildRevenueStats(allOrds);
    this.computeWeeklyComparison(allOrds);
    this.buildKpiCards();
  }

  /**
   * @description Calculates 30-day revenue trends by aggregating order totals per calendar day.
   */
  private buildChartData(orders: any[]): void {
    const eligibleOrders = orders.filter(o => this.isRevenueEligible(o));

    const days: Record<string, number> = {};
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days[key] = 0;
    }

    for (const o of eligibleOrders) {
      const key = (o.created_at ?? '').slice(0, 10);
      if (key in days) {
        days[key] += parseFloat(o.final_amount ?? 0);
      }
    }

    const entries = Object.entries(days);
    this.chartMax = Math.max(...entries.map(([, v]) => v), 1);

    this.chartPoints = entries.map(([date, value], i) => {
      const x = this.chartPadL + (i / (entries.length - 1)) * this.chartInnerW;
      const y = this.chartPadT + this.chartInnerH - (value / this.chartMax) * this.chartInnerH;
      const d = new Date(date);
      const label = `${d.getDate()}. ${d.getMonth() + 1}.`;
      return { label, value, x, y };
    });
  }

  /**
   * @description Converts a series of points into a smooth SVG path using a Catmull-Rom
   * to cubic-Bézier conversion - no charting library required. Falls back to straight
   * line segments when there are fewer than 3 points (a cubic curve needs neighbours on
   * both sides to be meaningful).
   */
  private buildSmoothPath(points: { x: number; y: number }[]): string {
    if (points.length === 0) return '';
    if (points.length < 3) {
      return 'M ' + points.map(p => `${p.x} ${p.y}`).join(' L ');
    }

    const at = (i: number) => points[Math.max(0, Math.min(points.length - 1, i))];
    let d = `M ${points[0].x} ${points[0].y}`;

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  }

  /**
   * @description Normalizes order status counts into a percentage breakdown for the status
   * visualization. Deliberately does NOT filter by `isRevenueEligible()` - this widget shows the
   * WHOLE order pipeline (incl. unpaid / canceled), not only collected revenue. The colors are
   * CSS variables of the admin-layout palette (`--success` / `--error` / `--warning` /
   * `--accent`), not hard-coded hex values.
   */
  private buildStatusBreakdown(orders: any[]): void {
    const map: Record<string, number> = {};
    for (const o of orders) {
      map[o.status] = (map[o.status] ?? 0) + 1;
    }
    const colorMap: Record<string, string> = {
      pending:    'var(--warning, #d97706)',
      confirmed:  'var(--accent, #18181b)',
      processing: 'var(--accent, #18181b)',
      shipped:    'var(--accent, #18181b)',
      delivered:  'var(--success, #059669)',
      canceled:   'var(--error, #e11d48)',
      returned:   'var(--warning, #d97706)',
    };
    const total = Object.values(map).reduce((a, b) => a + b, 0) || 1;
    this.statusBreakdown = Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([status, count]) => ({
        statusKey: status,
        labelKey: this.STATUS_LABEL_KEYS[status] ?? '',
        count,
        color: colorMap[status] ?? 'var(--text-dim, #a1a1aa)',
        pct: Math.round((count / total) * 100),
      }));
  }

  /**
   * @description Aggregates revenue (eligible orders only) globally and for the current
   * calendar month, and derives the average order value (AOV) for the current month.
   */
  private buildRevenueStats(orders: any[]): void {
    const eligibleOrders = orders.filter(o => this.isRevenueEligible(o));

    this.totalRevenue = eligibleOrders.reduce((s, o) => s + parseFloat(o.final_amount ?? 0), 0);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthOrders = eligibleOrders.filter(o => new Date(o.created_at) >= startOfMonth);

    this.revenueThisMonth = monthOrders.reduce((s, o) => s + parseFloat(o.final_amount ?? 0), 0);
    this.avgOrderValueThisMonth = monthOrders.length > 0 ? this.revenueThisMonth / monthOrders.length : 0;
  }

  /**
   * @description Comparison with the previous week - rolling 7-day window (today - 7 days) vs.
   * the immediately preceding 7-day window (today - 14 days to today - 7 days). Revenue counts
   * only eligible orders (money); the order count counts ALL orders regardless of payment
   * (business volume, not money).
   */
  private computeWeeklyComparison(allOrders: any[]): void {
    const now = new Date();
    const startCurrent = new Date(now);
    startCurrent.setDate(now.getDate() - 7);
    const startPrevious = new Date(now);
    startPrevious.setDate(now.getDate() - 14);

    const inRange = (dateStr: string, from: Date, to: Date): boolean => {
      const d = new Date(dateStr);
      return d >= from && d < to;
    };

    const currentWindowOrders = allOrders.filter(o => inRange(o.created_at, startCurrent, now));
    const previousWindowOrders = allOrders.filter(o => inRange(o.created_at, startPrevious, startCurrent));

    this.revenueThisWeek = currentWindowOrders
      .filter(o => this.isRevenueEligible(o))
      .reduce((s, o) => s + parseFloat(o.final_amount ?? 0), 0);
    this.revenueLastWeek = previousWindowOrders
      .filter(o => this.isRevenueEligible(o))
      .reduce((s, o) => s + parseFloat(o.final_amount ?? 0), 0);

    this.ordersThisWeek = currentWindowOrders.length;
    this.ordersLastWeek = previousWindowOrders.length;
  }

  /**
   * @description Constructs the KPI dashboard cards. Only builds cards for modules the
   * current user has permission to view.
   */
  private buildKpiCards(): void {
    const cards: KpiCard[] = [];

    if (this.canViewOrders) {
      cards.push({
        key: 'revenueWeek',
        labelKey: 'kpi_revenue_week_label',
        icon: 'money',
        value: this.formatCurrency(this.revenueThisWeek),
        trend: this.pctChange(this.revenueThisWeek, this.revenueLastWeek),
        trendLabelKey: 'trend_vs_last_week',
      });
      cards.push({
        key: 'ordersWeek',
        labelKey: 'kpi_orders_week_label',
        icon: 'box',
        value: String(this.ordersThisWeek),
        trend: this.pctChange(this.ordersThisWeek, this.ordersLastWeek),
        trendLabelKey: 'trend_vs_last_week',
      });
      cards.push({
        key: 'aov',
        labelKey: 'kpi_aov_label',
        icon: 'scale',
        value: this.formatCurrency(this.avgOrderValueThisMonth),
        subKey: 'kpi_aov_sub',
      });
      cards.push({
        key: 'pendingOrders',
        labelKey: 'kpi_pending_orders_label',
        icon: 'clock',
        value: String(this.pendingOrders),
        subKey: this.pendingOrders > 0 ? 'kpi_pending_orders_sub_action' : 'kpi_pending_orders_sub_none',
        urgent: this.pendingOrders > 0,
      });
    }

    if (this.canViewProducts) {
      cards.push({
        key: 'activeProducts',
        labelKey: 'kpi_active_products_label',
        icon: 'bag',
        value: String(this.activeProducts),
        subKey: 'kpi_active_products_sub',
        subParams: { count: String(this.lowStockProducts.length) },
        urgent: this.lowStockProducts.length > 0,
      });
    }

    if (this.canViewCustomers) {
      cards.push({
        key: 'customers',
        labelKey: 'kpi_customers_label',
        icon: 'users',
        value: String(this.totalCustomers),
        subKey: 'kpi_customers_sub',
      });
    }

    if (this.canViewCoupons) {
      cards.push({
        key: 'coupons',
        labelKey: 'kpi_coupons_label',
        icon: 'coupon',
        value: String(this.activeCoupons),
        subKey: 'kpi_coupons_sub',
      });
    }

    this.kpiCards = cards;
  }

  /**
   * @description Formats numeric amounts as EUR currency strings (whole euros on the KPI cards /
   * chart), respecting the current admin UI locale for digit grouping.
   * @param value Amount in EUR (NaN → 0).
   * @returns Formatted amount, e.g. "1 500 €".
   */
  formatCurrency(value: number): string {
    if (isNaN(value)) value = 0;
    return new Intl.NumberFormat(this.i18n.getDateLocale(), { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
  }

  /**
   * @description Localizes date strings for display in UI tables.
   */
  formatDate(iso: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString(this.i18n.getDateLocale(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  /**
   * @description Maps a raw order `status` to a translated label.
   */
  statusLabel(status: string): string {
    const key = this.STATUS_LABEL_KEYS[status];
    return key ? this.t(key) : status;
  }

  /** @description Maps a raw `payment_status` to a translated label. */
  paymentStatusLabel(status: string): string {
    const key = this.PAYMENT_STATUS_LABEL_KEYS[status];
    return key ? this.t(key) : status;
  }

  /**
   * @description Returns CSS class name based on order status for dynamic styling.
   */
  statusClass(status: string): string {
    const map: Record<string, string> = {
      pending: 'status-pending', confirmed: 'status-confirmed',
      processing: 'status-processing', shipped: 'status-shipped',
      delivered: 'status-delivered', canceled: 'status-canceled',
      returned: 'status-returned',
    };
    return map[status] ?? '';
  }

  /**
   * @description Determines payment status visual style.
   */
  paymentClass(status: string): string {
    return status === 'paid' ? 'payment-paid' : 'payment-pending';
  }

  /**
   * @description Calculates stock level percentage relative to warning threshold.
   */
  stockPct(product: LowStockProduct): number {
    const max = Math.max(product.stock_warning_level * 3, product.stock_quantity, 1);
    return Math.min(100, Math.round((product.stock_quantity / max) * 100));
  }

  /**
   * @description Activates the chart tooltip at specific mouse coordinates.
   */
  showTooltip(point: ChartPoint): void {
    this.chartTooltip = {
      visible: true,
      x: point.x,
      y: point.y,
      label: point.label,
      value: this.formatCurrency(point.value),
    };
  }

  hideTooltip(): void {
    this.chartTooltip.visible = false;
  }

  /**
   * @description Filters xAxis points for rendering to improve visual clarity on the chart axis.
   */
  get xAxisLabels(): ChartPoint[] {
    return this.chartPoints.filter((_, i) => i % 5 === 0 || i === this.chartPoints.length - 1);
  }

  /**
   * @description Normalizes Y-axis values (e.g., converting 1000 to 1k).
   */
  yLabel(step: number): string {
    const val = (this.chartMax / 4) * step;
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `${Math.round(val / 1_000)}k`;
    return Math.round(val).toString();
  }

  yPos(step: number): number {
    return this.chartPadT + this.chartInnerH - (step / 4) * this.chartInnerH;
  }

  // ── E-shop maintenance mode ────────────────────────────────────────────

  /**
   * @description Loads the current maintenance state of the e-shop from the shop-owned
   * `shop/settings` endpoint, through a short TTL cache (1 min). Called separately from
   * `loadAll()`, so an outage of the shop KPI data does not block the maintenance state and
   * vice versa.
   */
  private loadMaintenanceStatus(): void {
    if (!this.permissionService.hasPermission(this.PERM_MAINTENANCE)) {
      return;
    }

    this.resourceCache.get(
      this.MAINTENANCE_CACHE_KEY,
      () => this.dataHandler.get<any>('shop/settings'),
      this.MAINTENANCE_TTL_MS
    ).subscribe({
      next: (res) => {
        if (res) {
          this.isShopActive = !!res.is_shop_active;
          this.shopMaintenanceMessage = res.maintenance_message || '';
        }
      },
      error: () => { /* keep the last known state (default: shop active) */ }
    });
  }

  openShopMaintenanceModal(): void {
    this.pendingShopTargetState = !this.isShopActive;
    this.shopConfirmPasswordValue = '';
    this.showShopMaintenanceModal = true;
  }

  cancelShopMaintenanceModal(): void {
    this.showShopMaintenanceModal = false;
    this.shopConfirmPasswordValue = '';
  }

  /**
   * @description Sends the e-shop state change to `shop/settings`
   * (ShopSiteSettingController::update). Invalidates the maintenance cache key on success.
   */
  submitShopMaintenanceChange(): void {
    if (!this.shopConfirmPasswordValue.trim()) {
      this.alertDialogService.open(this.t('maintenance_error_title'), this.t('maintenance_error_missing_password'), 'danger');
      return;
    }

    this.dataHandler.put<any>('shop/settings', {
      is_shop_active: this.pendingShopTargetState,
      maintenance_message: this.shopMaintenanceMessage || this.t('maintenance_default_message'),
      confirm_password: this.shopConfirmPasswordValue
    }).subscribe({
      next: () => {
        this.isShopActive = this.pendingShopTargetState;
        this.showShopMaintenanceModal = false;
        this.resourceCache.invalidate(this.MAINTENANCE_CACHE_KEY);
        this.alertDialogService.open(
          this.t('maintenance_success_title'),
          this.pendingShopTargetState ? this.t('maintenance_success_active') : this.t('maintenance_success_maintenance'),
          'success'
        );
      },
      error: (err) => {
        const message = err?.error?.message || this.t('maintenance_error_generic');
        this.alertDialogService.open(this.t('maintenance_error_auth_title'), message, 'danger');
      }
    });
  }
}