/**
 * @file dashboard.component.ts
 * @path src/app/admin/pages/dashboard/dashboard.component.ts
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Serves as the central management hub, aggregating operational KPIs, sales trends, and real-time shop status.
 * @dependencies
 * - HttpClient: Handles REST API communication for data fetching.
 * - RxJS (forkJoin, interval): Manages concurrent data streams and polling mechanisms.
 */

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { forkJoin, interval, Subscription } from 'rxjs';
import { catchError, of } from 'rxjs';

interface KpiCard {
  label: string;
  value: string | number;
  sub: string;
  icon: string;
  trend: 'up' | 'down' | 'neutral';
  trendValue: string;
  color: 'indigo' | 'green' | 'amber' | 'rose' | 'sky';
}

interface RecentOrder {
  id: number;
  order_number: string;
  status: string;
  status_label?: string;
  payment_status: string;
  payment_status_label?: string;
  final_amount: number;
  created_at: string;
  customer?: { full_name: string; email: string };
}

interface LowStockProduct {
  id: number;
  name: string;
  sku: string;
  stock_quantity: number;
  stock_warning_level: number;
}

interface ChartPoint {
  label: string;
  value: number;
  x: number;
  y: number;
}

interface StatusBreakdown {
  label: string;
  count: number;
  color: string;
  pct: number;
}

/**
 * @description Orchestrates the administration dashboard, visualizing key performance metrics and operational tasks.
 * @usage Provides a high-level overview for store administrators to track sales, inventory, and pending orders.
 * @note Implements an automatic data-polling mechanism to ensure the dashboard remains up-to-date without page reloads.
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit, OnDestroy {

  private readonly API = '/api';
  private refreshSub?: Subscription;

  loading = true;
  loadingError = false;
  lastRefreshed: Date = new Date();

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

  /** @description Returns the width available for the chart area within the container. */
  get chartInnerW() { return this.chartWidth - this.chartPadL - this.chartPadR; }
  /** @description Returns the height available for the chart area within the container. */
  get chartInnerH() { return this.chartHeight - this.chartPadT - this.chartPadB; }
  /** @description Maps coordinate pairs to SVG polyline string format. */
  get polylinePoints(): string {
    return this.chartPoints.map(p => `${p.x},${p.y}`).join(' ');
  }
  /** @description Generates path coordinates for the SVG area fill, closing the shape at the bottom axis. */
  get areaPoints(): string {
    if (!this.chartPoints.length) return '';
    const bottom = this.chartPadT + this.chartInnerH;
    const first = this.chartPoints[0];
    const last = this.chartPoints[this.chartPoints.length - 1];
    return `${first.x},${bottom} ${this.polylinePoints} ${last.x},${bottom}`;
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
  totalRevenue = 0;
  revenueThisMonth = 0;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadAll();
    this.refreshSub = interval(120_000).subscribe(() => this.loadAll());
  }

  ngOnDestroy(): void {
    this.refreshSub?.unsubscribe();
  }

  /**
   * @description Fetches all dashboard modules concurrently using forkJoin and handles global loading/error states.
   */
  loadAll(): void {
    this.loading = true;
    this.loadingError = false;

    forkJoin({
      orders: this.http.get<any>(`${this.API}/shop/orders?per_page=10&sort_by=created_at&sort_direction=desc`).pipe(catchError(() => of(null))),
      allOrders: this.http.get<any>(`${this.API}/shop/orders?no_pagination=true&sort_by=created_at&sort_direction=desc`).pipe(catchError(() => of(null))),
      customers: this.http.get<any>(`${this.API}/shop/customers?per_page=1`).pipe(catchError(() => of(null))),
      products: this.http.get<any>(`${this.API}/shop/products?per_page=1&is_active=true`).pipe(catchError(() => of(null))),
      lowStock: this.http.get<any>(`${this.API}/shop/products?low_stock=true&no_pagination=true`).pipe(catchError(() => of(null))),
      coupons: this.http.get<any>(`${this.API}/shop/coupons?is_active=true&per_page=1`).pipe(catchError(() => of(null))),
      pendingOrders: this.http.get<any>(`${this.API}/shop/orders?status=pending&per_page=1`).pipe(catchError(() => of(null))),
    }).subscribe({
      next: (res) => {
        this.processData(res);
        this.lastRefreshed = new Date();
        this.loading = false;
      },
      error: () => {
        this.loadingError = true;
        this.loading = false;
      }
    });
  }

  /**
   * @description Maps API responses to component view models.
   * @param res The collective response object from API calls.
   */
  private processData(res: any): void {
    this.recentOrders = res.orders?.data ?? [];
    this.totalOrders = res.orders?.total ?? 0;
    this.pendingOrders = res.pendingOrders?.total ?? 0;

    this.totalCustomers = res.customers?.total ?? 0;
    this.activeProducts = res.products?.total ?? 0;
    this.activeCoupons = res.coupons?.total ?? 0;

    const allProds: any[] = Array.isArray(res.lowStock) ? res.lowStock : (res.lowStock?.data ?? []);
    this.lowStockProducts = allProds.slice(0, 8).map(p => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      stock_quantity: p.stock_quantity ?? 0,
      stock_warning_level: p.stock_warning_level ?? 5,
    }));

    const allOrds: any[] = Array.isArray(res.allOrders) ? res.allOrders : (res.allOrders?.data ?? []);
    this.buildChartData(allOrds);
    this.buildStatusBreakdown(allOrds);
    this.buildRevenueStats(allOrds);
    this.buildKpiCards();
  }

  /**
   * @description Calculates 30-day revenue trends by aggregating order totals per calendar day.
   * @param orders Full list of shop orders.
   */
  private buildChartData(orders: any[]): void {
    const days: Record<string, number> = {};
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days[key] = 0;
    }

    for (const o of orders) {
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
   * @description Normalizes order status counts into a percentage breakdown for the status visualization.
   * @param orders Full list of shop orders.
   */
  private buildStatusBreakdown(orders: any[]): void {
    const map: Record<string, number> = {};
    for (const o of orders) {
      map[o.status] = (map[o.status] ?? 0) + 1;
    }
    const colorMap: Record<string, string> = {
      pending:    '#f59e0b',
      confirmed:  '#3b82f6',
      processing: '#8b5cf6',
      shipped:    '#06b6d4',
      delivered:  '#10b981',
      canceled:   '#ef4444',
      returned:   '#f97316',
    };
    const labelMap: Record<string, string> = {
      pending: 'Čeká', confirmed: 'Potvrzena', processing: 'Zpracovává se',
      shipped: 'Odesláno', delivered: 'Doručeno', canceled: 'Zrušeno', returned: 'Vráceno',
    };
    const total = Object.values(map).reduce((a, b) => a + b, 0) || 1;
    this.statusBreakdown = Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([status, count]) => ({
        label: labelMap[status] ?? status,
        count,
        color: colorMap[status] ?? '#94a3b8',
        pct: Math.round((count / total) * 100),
      }));
  }

  /**
   * @description Aggregates revenue globally and filters orders for the current calendar month.
   * @param orders Full list of shop orders.
   */
  private buildRevenueStats(orders: any[]): void {
    this.totalRevenue = orders.reduce((s, o) => s + parseFloat(o.final_amount ?? 0), 0);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    this.revenueThisMonth = orders
      .filter(o => new Date(o.created_at) >= startOfMonth)
      .reduce((s, o) => s + parseFloat(o.final_amount ?? 0), 0);
  }

  /**
   * @description Constructs the KPI dashboard cards based on calculated revenue and order statistics.
   */
  private buildKpiCards(): void {
    this.kpiCards = [
      {
        label: 'Tržby tento měsíc',
        value: this.formatCurrency(this.revenueThisMonth),
        sub: `Celkem: ${this.formatCurrency(this.totalRevenue)}`,
        icon: '💰',
        trend: 'up',
        trendValue: '',
        color: 'indigo',
      },
      {
        label: 'Objednávky celkem',
        value: this.totalOrders,
        sub: `${this.pendingOrders} čeká na vyřízení`,
        icon: '📦',
        trend: this.pendingOrders > 0 ? 'down' : 'neutral',
        trendValue: `${this.pendingOrders} pending`,
        color: 'amber',
      },
      {
        label: 'Zákazníci',
        value: this.totalCustomers,
        sub: 'Registrovaní zákazníci',
        icon: '👥',
        trend: 'up',
        trendValue: '',
        color: 'sky',
      },
      {
        label: 'Aktivní produkty',
        value: this.activeProducts,
        sub: `${this.lowStockProducts.length} pod limitem skladu`,
        icon: '🛍️',
        trend: this.lowStockProducts.length > 0 ? 'down' : 'neutral',
        trendValue: `${this.lowStockProducts.length} low stock`,
        color: this.lowStockProducts.length > 0 ? 'rose' : 'green',
      },
    ];
  }

  /**
   * @description Formats numeric amounts into CZK currency strings.
   * @param value The amount to format.
   * @returns {string} Currency formatted string.
   */
  formatCurrency(value: number): string {
    if (isNaN(value)) return '0 Kč';
    return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(value);
  }

  /**
   * @description Localizes date strings for display in UI tables.
   */
  formatDate(iso: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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
  showTooltip(point: ChartPoint, event: MouseEvent): void {
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
   * @param step Grid step index.
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
}