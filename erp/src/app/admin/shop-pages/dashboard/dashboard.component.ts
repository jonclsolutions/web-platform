/**
 * @file dashboard.component.ts
 * @path src/app/admin/shop-pages/dashboard/dashboard.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Serves as the central management hub, aggregating operational KPIs, sales trends,
 * and real-time shop status.
 *
 * @refactor-note (2025) Dříve volal `HttpClient` přímo (vlastní `/api` prefix, žádné centrální
 * error handling). Dashboard ale agreguje HNED SEDM různých endpointů paralelně přes `forkJoin`
 * — nejde o jeden resource s aktivní/koš duplicitou, takže dědit z `BaseDataComponent` by byla
 * špatná abstrakce (ten předpokládá jeden `apiEndpoint`). Správná vrstva k opakovanému použití
 * je tu `DataHandler` přímo — stejná služba, kterou interně používá i `EntityCrudService` — dává
 * jednotný `baseUrl` a centralizované error hlášení, takže komponenta už vůbec nepotřebuje znát
 * `HttpClient` ani `HttpClientModule`.
 *
 * @icons-note (2026) `kpiCards[].icon` teď nese klíč do `ICONS` mapy (viz `getIcon()`) místo
 *      emoji, šablona ho vykresluje jako inline SVG přes `[innerHTML]`. Ikony jsou záměrně
 *      bez `viewBox` a s `width="24" height="24"` (přesně dle souřadnic cest) - zmenšení na
 *      výslednou velikost řeší CSS, protože `[innerHTML]` na SVG vloženém do běžného HTML
 *      elementu prochází HTML parserem, který by `viewBox` přepsal na malé `viewbox`
 *      (SVG by ho pak ignorovalo) - tomuhle se tak vyhneme úplně.
 *
 * @refactor-note (2026-08) Přidána karta "Režim údržby e-shopu" (přesunuto z headeru
 * admin-layoutu, viz jeho @refactor-note) - `isShopActive`/`shopMaintenanceMessage` +
 * potvrzovací modál s heslem (`openShopMaintenanceModal()`/`submitShopMaintenanceChange()`).
 * Karta je viditelná jen s permission `shop-set-maitanance-mode` (`*appHasPermission`),
 * proto nový import `HasPermissionDirective`.
 *
 * @refactor-note (2026-08-9) TTL CACHE (backlog: "zbytečně moc dotazů na API"). Dashboard
 * je typický post-login landing point pro obchodní roli, ke kterému se admin často vrací
 * modul switcherem. `loadAll()` (7 souběžných requestů) a `loadMaintenanceStatus()` teď jdou
 * přes `ResourceCacheService` (2 min TTL). PONECHÁN existující `interval(120_000)` polling
 * (dashboard se má aktivně obnovovat, dokud je otevřený) - ale volání z intervalu i z tlačítka
 * "Obnovit" jsou explicitně `force=true` (obcházejí cache), protože jde o VĚDOMĚ vyžádaný
 * čerstvý fetch, ne jen mount-time navigaci. Jen počáteční `ngOnInit()` volání respektuje TTL.
 * `loadAll(force)`/`loadMaintenanceStatus(force)` - `dashboard.component.html` upraven tak,
 * aby tlačítko "Obnovit" volalo `loadAll(true)` místo `loadAll()`.
 *
 * @bugfix-note (2026-08-15) KRITICKÁ OPRAVA: `loadMaintenanceStatus()` a
 * `submitShopMaintenanceChange()` volaly sdílený `core/settings` endpoint, který od
 * přesunu shop maintenance do Shop domény (viz ShopSiteSettingController) obsluhuje už jen
 * WEB maintenance a `is_shop_active`/`maintenance_message` v requestu tiše ignoruje.
 * Důsledek v produkci: PUT request "prošel" (200 OK, heslo se ověřilo), ale zapsal se do
 * `core_site_settings` (web pole), ne do `shop_site_settings` - UI si po odeslání
 * OPTIMISTICKY nastavilo zelenou (`this.isShopActive = this.pendingShopTargetState`), ale
 * po refreshi `loadMaintenanceStatus()` znovu načetlo `core/settings`, který teď `is_shop_active`
 * vůbec nevrací (`undefined` -> `!!undefined` -> `false`) -> karta spadla zpět na oranžovou
 * a `shop_site_settings.is_shop_active` v DB reálně zůstalo nezměněné. Oba volání přepojena
 * na `shop/settings` (ShopSiteSettingController::show/update), který vrací/přijímá přesně
 * `is_shop_active`/`maintenance_message` shape, takže zbytek komponenty (šablona, optimistic
 * update) beze změny funguje správně.
 *
 * @dependencies
 * - DataHandler: Centralizovaná HTTP komunikace (baseUrl + error handling) — nahrazuje HttpClient.
 * - AlertDialogService: Zpětná vazba při úspěchu/chybě změny režimu údržby.
 * - HasPermissionDirective: Gate karty údržby na permission `shop-set-maitanance-mode`.
 * - ResourceCacheService: TTL cache pro stats/maintenance fetch (viz refactor-note výše).
 * - RxJS (forkJoin, interval): Manages concurrent data streams and polling mechanisms.
 */

import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { forkJoin, interval, Subscription, catchError, of } from 'rxjs';
import { DataHandler } from '../../../core/services/data-handler.service';
import { AlertDialogService } from '../../../core/services/alert-dialog.service';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { ResourceCacheService } from '../../../core/services/resource-cache.service';
import { StatusBreakdown, ChartPoint, LowStockProduct, RecentOrder, KpiCard } from './';

/**
 * @description Orchestrates the administration dashboard, visualizing key performance metrics and
 * operational tasks.
 * @usage Provides a high-level overview for store administrators to track sales, inventory, and
 * pending orders.
 * @note Implements an automatic data-polling mechanism to ensure the dashboard remains up-to-date
 * without page reloads.
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, HasPermissionDirective],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit, OnDestroy {

  private sanitizer = inject(DomSanitizer);
  private alertDialogService = inject(AlertDialogService);
  private resourceCache = inject(ResourceCacheService);
  private refreshSub?: Subscription;

  private readonly TTL_MS = 2 * 60 * 1000;
  private readonly STATS_CACHE_KEY = 'shop-dashboard:all';
  private readonly MAINTENANCE_CACHE_KEY = 'shop-dashboard:maintenance';
  private readonly MAINTENANCE_TTL_MS = 60 * 1000;

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

  // ── Režim údržby e-shopu ────────────────────────────────────────────
  isShopActive = true;
  shopMaintenanceMessage = '';
  showShopMaintenanceModal = false;
  shopConfirmPasswordValue = '';
  pendingShopTargetState = true;

  /**
   * Knihovna ikon použitých na dashboardu (viz @icons-note výše). Bez `viewBox`,
   * velikost na obrazovce řídí CSS (`.kpi-icon svg`).
   */
  private readonly ICONS: Record<string, string> = {
    money: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    box: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
    users: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    bag: `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
  };

  /**
   * @description Vrátí bezpečně vysanitizovanou SVG značku pro zadaný klíč ikony (viz `ICONS`).
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
   * @description Fetches all dashboard modules concurrently using forkJoin and handles global
   * loading/error states. Přes TTL cache (viz refactor-note v hlavičce souboru).
   * @param force Bypass cache - použito ručním tlačítkem "Obnovit" a periodickým pollingem
   * (interval 120s), oba případy jsou vědomě vyžádaný čerstvý fetch, ne mount-time navigace.
   * @note Každé volání je zabaleno vlastním `catchError(() => of(null))` — jednotlivý selhavší
   * widget (např. výpadek endpointu s doporučeními) tak nespadne celý dashboard, jen se
   * příslušná karta nevykreslí. DataHandler přitom na pozadí případnou chybu ještě centrálně
   * nahlásí přes AlertDialogService, takže uživatel o výpadku ví.
   */
  loadAll(force: boolean = false): void {
    this.loading = true;
    this.loadingError = false;

    if (force) {
      this.resourceCache.invalidate(this.STATS_CACHE_KEY);
    }

    this.resourceCache.get(this.STATS_CACHE_KEY, () => forkJoin({
      orders: this.dataHandler.getPaginatedCollection<any>('shop/orders?per_page=10&sort_by=created_at&sort_direction=desc').pipe(catchError(() => of(null))),
      allOrders: this.dataHandler.getPaginatedCollection<any>('shop/orders?no_pagination=true&sort_by=created_at&sort_direction=desc').pipe(catchError(() => of(null))),
      customers: this.dataHandler.getPaginatedCollection<any>('shop/customers?per_page=1').pipe(catchError(() => of(null))),
      products: this.dataHandler.getPaginatedCollection<any>('shop/products?per_page=1&is_active=true').pipe(catchError(() => of(null))),
      lowStock: this.dataHandler.getPaginatedCollection<any>('shop/products?low_stock=true&no_pagination=true').pipe(catchError(() => of(null))),
      coupons: this.dataHandler.getPaginatedCollection<any>('shop/coupons?is_active=true&per_page=1').pipe(catchError(() => of(null))),
      pendingOrders: this.dataHandler.getPaginatedCollection<any>('shop/orders?status=pending&per_page=1').pipe(catchError(() => of(null))),
    }), this.TTL_MS).subscribe({
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
   * @description Normalizes order status counts into a percentage breakdown for the status
   * visualization.
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
   * @description Constructs the KPI dashboard cards based on calculated revenue and order
   * statistics.
   */
  private buildKpiCards(): void {
    this.kpiCards = [
      {
        label: 'Tržby tento měsíc',
        value: this.formatCurrency(this.revenueThisMonth),
        sub: `Celkem: ${this.formatCurrency(this.totalRevenue)}`,
        icon: 'money',
        trend: 'up',
        trendValue: '',
        color: 'indigo',
      },
      {
        label: 'Objednávky celkem',
        value: this.totalOrders,
        sub: `${this.pendingOrders} čeká na vyřízení`,
        icon: 'box',
        trend: this.pendingOrders > 0 ? 'down' : 'neutral',
        trendValue: `${this.pendingOrders} pending`,
        color: 'amber',
      },
      {
        label: 'Zákazníci',
        value: this.totalCustomers,
        sub: 'Registrovaní zákazníci',
        icon: 'users',
        trend: 'up',
        trendValue: '',
        color: 'sky',
      },
      {
        label: 'Aktivní produkty',
        value: this.activeProducts,
        sub: `${this.lowStockProducts.length} pod limitem skladu`,
        icon: 'bag',
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

  // ── Režim údržby e-shopu ────────────────────────────────────────────

  /**
   * @description Načte aktuální stav režimu údržby e-shopu ze shop-owned `shop/settings`
   * endpointu, přes krátkou TTL cache (1 min - stav je bezpečnostně/provozně citlivý,
   * proto kratší TTL než u zbytku dashboardu). Volá se samostatně od `loadAll()`, ať
   * výpadek shop-KPI dat neblokuje zobrazení stavu údržby a naopak.
   * @bugfix-note (2026-08-15) Dříve volalo `core/settings` (sdílený Core endpoint) - po
   * přesunu shop maintenance do Shop domény ten endpoint `is_shop_active` už vůbec
   * nevrací. Přepojeno na `shop/settings` (ShopSiteSettingController::show).
   * @param force Bypass cache - voláno po vlastní úspěšné změně stavu.
   */
  private loadMaintenanceStatus(force: boolean = false): void {
    if (force) {
      this.resourceCache.invalidate(this.MAINTENANCE_CACHE_KEY);
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
      }
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
   * @description Odešle změnu stavu e-shopu na `shop/settings`
   * (ShopSiteSettingController::update). Po úspěchu invaliduje maintenance cache klíč, ať
   * další čtení (i jinde v adminu) odráží novou hodnotu.
   * @bugfix-note (2026-08-15) Dříve volalo `core/settings` - viz bugfix-note u
   * `loadMaintenanceStatus()` a hlavičky souboru pro plné vysvětlení dopadu.
   */
  submitShopMaintenanceChange(): void {
    if (!this.shopConfirmPasswordValue.trim()) {
      this.alertDialogService.open('Chyba', 'Zadejte prosím heslo pro potvrzení.', 'danger');
      return;
    }

    this.dataHandler.put<any>('shop/settings', {
      is_shop_active: this.pendingShopTargetState,
      maintenance_message: this.shopMaintenanceMessage || 'Omlouváme se, na systému momentálně probíhá údržba.',
      confirm_password: this.shopConfirmPasswordValue
    }).subscribe({
      next: () => {
        this.isShopActive = this.pendingShopTargetState;
        this.showShopMaintenanceModal = false;
        this.resourceCache.invalidate(this.MAINTENANCE_CACHE_KEY);
        this.alertDialogService.open(
          'Úspěch',
          this.pendingShopTargetState ? 'E-shop je nyní aktivní.' : 'Režim údržby byl aktivován.',
          'success'
        );
      },
      error: (err) => {
        const message = err?.error?.message || 'Změna režimu údržby selhala.';
        this.alertDialogService.open('Chyba autorizace', message, 'danger');
      }
    });
  }
}