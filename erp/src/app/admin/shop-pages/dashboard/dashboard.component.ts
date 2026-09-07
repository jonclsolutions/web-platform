/**
 * @file dashboard.component.ts
 * @path src/app/admin/shop-pages/dashboard/dashboard.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Serves as the central management hub, aggregating operational KPIs, sales trends,
 * and real-time shop status.
 *
 * @refactor-note (2026-09-07) BACKLOG "shop dashboard refactor - vizuál + multijazyk +
 * analytika": kompletní přepis komponenty. Permission-gating logika (`canView*` gettery,
 * `PERM_*` konstanty) je BEZE ZMĚNY oproti předchozí verzi - viz zadání "jen kompletní
 * přepis, logiku permission ponech beze změny".
 *
 * - i18n: stejný minimalistický vzor jako `GraphBuilderComponent` - komponenta NEdědí
 *   `BaseDataComponent` (na rozdíl od Core/Web dashboardu), proto ruční
 *   `inject(AdminLocalizationService)` + `t()` čtoucí sekci `shop-dashboard`. Komponenta
 *   NEMÁ `ChangeDetectionStrategy.OnPush` (defaultní strategie), takže na rozdíl od
 *   `GraphBuilderComponent`/`CoreDashboardComponent` NENÍ potřeba explicitní
 *   `translations$.subscribe(() => markForCheck())` - defaultní CD strategie
 *   přehodnotí `t()` volání v šabloně samo při každém běžném CD cyklu.
 * - `eventTypeLabel`-like vzor (viz Core/Web dashboard) aplikován i tady:
 *   `statusLabel()`/`paymentStatusLabel()` teď mapují syrový `status`/`payment_status`
 *   na PŘEKLADOVÝ klíč, ne na text přímo z API (`order.status_label`/
 *   `order.payment_status_label` z `ShopOrderResource` jsou pravděpodobně jen česky -
 *   klientský multijazyk je nezávislý na tom, co vrátí backend).
 * - `formatDate()`/`formatCurrency()` respektují `i18n.getDateLocale()` místo natvrdo
 *   `'cs-CZ'` - stejná oprava jako u Core/Web dashboardu.
 *
 * - ANALYTIKA (backlog "chci graf s vývojem v čase, jen uzavřené zaplacené objednávky,
 *   procentuální srovnání oproti minulému týdnu"):
 *   - `isRevenueEligible()` - JEDINÉ centrální místo pravdy pro to, co se počítá jako
 *     "uzavřená zaplacená objednávka": `payment_status === 'paid'` AND `status`
 *     NENÍ `canceled`/`returned`. Zvoleno záměrně širší než jen `status === 'delivered'`
 *     - objednávka zaplacená, ale ještě ve stavu `shipped`, je pro firmu už reálně
 *     inkasovaná tržba, ne rozpracovaný obchod. Použito VŠUDE, kde jde o peníze
 *     (`buildChartData`, `buildRevenueStats`, `computeWeeklyComparison`) - `buildStatusBreakdown`
 *     záměrně NEfiltruje (ukazuje celý pipeline objednávek, ne jen zaplacené).
 *   - `buildChartData()` teď staví graf VÝHRADNĚ z eligible objednávek - dřív počítal se
 *     všemi objednávkami bez ohledu na stav platby.
 *   - `computeWeeklyComparison()` - nové: `revenueThisWeek`/`revenueLastWeek` (eligible
 *     objednávky, klouzavé 7denní okno) a `ordersThisWeek`/`ordersLastWeek` (VŠECHNY
 *     objednávky bez ohledu na platbu - jde o obchodní VOLUME, ne o peníze). `pctChange()`
 *     převádí dvojici čísel na `{ pct, direction }` s bezpečným ošetřením dělení nulou.
 *   - `buildRevenueStats()` navíc počítá `avgOrderValueThisMonth` (AOV) z eligible
 *     objednávek aktuálního kalendářního měsíce.
 *   - `buildKpiCards()` přepsán na deklarativní pole nesoucí `trend`/`urgent` navíc k
 *     dřívějším `label`/`value`/`icon` - viz `KpiCard` interface.
 *
 * - GRAF (backlog "nechci to bodové, chci křivku"): `chartPoints` (jeden bod na den,
 *   beze změny výpočtu) se teď vykresluje přes `buildSmoothPath()` (Catmull-Rom -> cubic
 *   Bézier, bez závislosti na žádné grafové knihovně) místo `<polyline>`. Samotné body
 *   zůstávají v DOM jen jako NEVIDITELNÉ hit-targety pro tooltip (`chart-dot`
 *   v `dashboard.component.css` má `opacity: 0`) - viditelný je jen při hoveru
 *   (`chart-dot-highlight`).
 *
 * @dependencies
 * - DataHandler: Centralizovaná HTTP komunikace (baseUrl + error handling).
 * - AlertDialogService: Zpětná vazba při úspěchu/chybě změny režimu údržby.
 * - HasPermissionDirective: Gate karty údržby na permission `shop-set-maintenance-mode`.
 * - PermissionService: Synchronní kontrola permission klíčů - řídí, které dílčí KPI/chart/
 *   tabulkové požadavky se vůbec pošlou.
 * - ResourceCacheService: TTL cache pro stats/maintenance fetch.
 * - AdminLocalizationService: Statické i18n admin UI (sekce `shop-dashboard`).
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
  imports: [CommonModule, HasPermissionDirective],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit, OnDestroy {

  private sanitizer = inject(DomSanitizer);
  private alertDialogService = inject(AlertDialogService);
  private resourceCache = inject(ResourceCacheService);
  private permissionService = inject(PermissionService);
  public readonly i18n = inject(AdminLocalizationService);
  private refreshSub?: Subscription;

  /**
   * @refactor-note (2026-09-07) i18n - stejný minimalistický vzor jako
   * `GraphBuilderComponent.t()`. Komponenta nemá `ChangeDetectionStrategy.OnPush`, takže
   * na rozdíl od Core/Web dashboardu NENÍ potřeba `translations$.subscribe()` pro
   * přerenderování při přepnutí jazyka - defaultní CD strategie to udělá sama.
   */
  t(key: string): string {
    return this.i18n.getValue(`shop-dashboard.${key}`);
  }

  private readonly TTL_MS = 2 * 60 * 1000;
  private readonly STATS_CACHE_KEY = 'shop-dashboard:all';
  private readonly MAINTENANCE_CACHE_KEY = 'shop-dashboard:maintenance';
  private readonly MAINTENANCE_TTL_MS = 60 * 1000;

  /** Permission klíče - přímo odpovídají `data: { permission }` v `admin-routing.module.ts`
   *  pro danou shop stránku. BEZE ZMĚNY oproti předchozí verzi. */
  private readonly PERM_ORDERS = 'shop-orders-view';
  private readonly PERM_CUSTOMERS = 'shop-customers-view';
  private readonly PERM_PRODUCTS = 'shop-products-view';
  private readonly PERM_COUPONS = 'shop-coupons-view';
  private readonly PERM_MAINTENANCE = 'shop-set-maintenance-mode';

  /** Objednávky, tržby, graf 30 dní, stavy objednávek - vše z `shop/orders`. */
  get canViewOrders(): boolean { return this.permissionService.hasPermission(this.PERM_ORDERS); }
  /** Počet zákazníků. */
  get canViewCustomers(): boolean { return this.permissionService.hasPermission(this.PERM_CUSTOMERS); }
  /** Aktivní produkty + nízký sklad. */
  get canViewProducts(): boolean { return this.permissionService.hasPermission(this.PERM_PRODUCTS); }
  /** Aktivní kupóny. */
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

  /**
   * @refactor-note (2026-09-07) BACKLOG "chci křivku, ne body": `polylinePoints`
   * nahrazeno `linePath` (hladká Catmull-Rom -> Bézier křivka, viz `buildSmoothPath()`).
   */
  get linePath(): string {
    return this.buildSmoothPath(this.chartPoints);
  }

  /** @description Stejná hladká křivka jako `linePath`, uzavřená dolů k ose X pro výplň plochy pod grafem. */
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

  /** Souhrn PLATNĚ INKASOVANÝCH tržeb (eligible objednávky) - viz `isRevenueEligible()`. */
  totalRevenue = 0;
  revenueThisMonth = 0;
  /** Průměrná hodnota objednávky (AOV) za aktuální kalendářní měsíc, jen eligible objednávky. */
  avgOrderValueThisMonth = 0;

  /** @refactor-note (2026-09-07) BACKLOG "procentuální srovnání oproti minulému týdnu". */
  revenueThisWeek = 0;
  revenueLastWeek = 0;
  ordersThisWeek = 0;
  ordersLastWeek = 0;

  // ── Režim údržby e-shopu ────────────────────────────────────────────
  isShopActive = true;
  shopMaintenanceMessage = '';
  showShopMaintenanceModal = false;
  shopConfirmPasswordValue = '';
  pendingShopTargetState = true;

  /**
   * @description "Uzavřená zaplacená objednávka" - jediné centrální místo pravdy pro to,
   * co se počítá jako reálně inkasovaná tržba (graf, KPI tržeb, AOV, týdenní srovnání).
   * Zvoleno záměrně jako `payment_status === 'paid'` AND `status` NENÍ v
   * `canceled`/`returned` - širší než jen `status === 'delivered'`, protože zaplacená,
   * ale ještě nedoručená objednávka (`shipped`) je z pohledu firmy už reálná tržba, ne
   * rozpracovaný obchod. `buildStatusBreakdown()` tuhle metodu ZÁMĚRNĚ NEPOUŽÍVÁ - ten
   * widget má ukazovat celý pipeline objednávek, ne jen zaplacené.
   * @param order Syrový objekt objednávky z `shop/orders`.
   */
  private isRevenueEligible(order: any): boolean {
    return order?.payment_status === 'paid' && !['canceled', 'returned'].includes(order?.status);
  }

  /**
   * @description Bezpečně spočítá procentuální změnu `current` oproti `previous`, s
   * ošetřením dělení nulou (žádné `Infinity`/`NaN` v UI).
   */
  private pctChange(current: number, previous: number): KpiTrend {
    if (previous === 0) {
      if (current === 0) return { pct: 0, direction: 'neutral' };
      return { pct: 100, direction: 'up' };
    }
    const pct = Math.round(((current - previous) / previous) * 100);
    return { pct: Math.abs(pct), direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral' };
  }

  /** @description event_type-like mapa: `status` -> překladový klíč (`statusLabel()`). */
  private readonly STATUS_LABEL_KEYS: Record<string, string> = {
    pending: 'status_pending', confirmed: 'status_confirmed', processing: 'status_processing',
    shipped: 'status_shipped', delivered: 'status_delivered', canceled: 'status_canceled', returned: 'status_returned',
  };

  /** @description `payment_status` -> překladový klíč (`paymentStatusLabel()`). */
  private readonly PAYMENT_STATUS_LABEL_KEYS: Record<string, string> = {
    paid: 'payment_status_paid', pending: 'payment_status_pending',
  };

  /**
   * Knihovna ikon použitých na dashboardu. Bez `viewBox`, velikost na obrazovce řídí CSS
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
   * @description Ruční "Aktualizovat" - stejný UX vzor jako Core/Web dashboard.
   */
  refresh(): void {
    if (this.isRefreshing) return;
    this.isRefreshing = true;
    this.loadAll(true);
  }

  /**
   * @description Fetches all dashboard modules the current user is permitted to see,
   * concurrently using forkJoin, and handles global loading/error states. Přes TTL cache.
   * @param force Bypass cache - použito ručním tlačítkem "Obnovit" a periodickým pollingem
   * (interval 120s).
   * @note Každé volání je zabaleno vlastním `catchError(() => of(null))` — jednotlivý selhavší
   * widget tak nespadne celý dashboard, jen se příslušná karta nevykreslí.
   * @note BEZE ZMĚNY: dílčí volání se posílají POUZE pro moduly, na které má uživatel
   * permission (`canViewOrders`/`canViewCustomers`/`canViewProducts`/`canViewCoupons`).
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
    this.computeWeeklyComparison(allOrds);
    this.buildKpiCards();
  }

  /**
   * @description Calculates 30-day revenue trends by aggregating order totals per calendar day.
   * @refactor-note (2026-09-07) Filtruje na `isRevenueEligible()` PŘED agregací - graf teď
   * ukazuje jen reálně inkasované tržby, ne hodnotu všech vystavených objednávek.
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
   * @refactor-note (2026-09-07) BACKLOG "chci křivku, ne body" - nahrazuje dřívější
   * `<polyline>` (ostré lomené čáry mezi jednotlivými dny).
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
   * visualization. ZÁMĚRNĚ nefiltruje na `isRevenueEligible()` - tenhle widget má ukazovat
   * CELÝ pipeline objednávek (včetně nezaplacených/zrušených), ne jen inkasované tržby.
   * Barvy jsou CSS proměnné z admin-layout palety (`--success`/`--error`/`--warning`/
   * `--accent`), ne natvrdo psané hexy.
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
   * @refactor-note (2026-09-07) Filtruje na `isRevenueEligible()` - dřív počítalo se
   * VŠEMI objednávkami bez ohledu na stav platby.
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
   * @description BACKLOG "procentuální srovnání oproti minulému týdnu" - klouzavé
   * 7denní okno (dnes - 7 dní) vs. bezprostředně předchozí 7denní okno (dnes - 14 dní
   * až dnes - 7 dní). Tržby počítají jen eligible objednávky (peníze); počet objednávek
   * počítá VŠECHNY objednávky bez ohledu na platbu (obchodní objem, ne peníze).
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
   * current user has permission to view - beze změny oproti předchozí verzi.
   * @refactor-note (2026-09-07) Přepsáno na deklarativní pole nesoucí i `trend`/`urgent`
   * - viz `KpiCard` interface. Text se resolvuje AŽ v šabloně přes `t()`, `KpiCard` nese
   * jen klíče (stejný princip jako Core/Web dashboard `QuickStat`).
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
   * @description Formats numeric amounts into CZK currency strings, respecting the
   * current admin UI locale for digit grouping.
   * @refactor-note (2026-09-07) BUGFIX - natvrdo `'cs-CZ'` nahrazeno
   * `this.i18n.getDateLocale()` (currency kód `CZK` zůstává beze změny - multiměnová
   * podpora není součástí tohoto úkolu).
   */
  formatCurrency(value: number): string {
    if (isNaN(value)) value = 0;
    return new Intl.NumberFormat(this.i18n.getDateLocale(), { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(value);
  }

  /**
   * @description Localizes date strings for display in UI tables.
   * @refactor-note (2026-09-07) BUGFIX - natvrdo `'cs-CZ'` nahrazeno `this.i18n.getDateLocale()`.
   */
  formatDate(iso: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString(this.i18n.getDateLocale(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  /**
   * @description Maps a raw order `status` to a translated label.
   * @refactor-note (2026-09-07) Nahrazuje `order.status_label` z API - klientský
   * multijazyk je nezávislý na tom, co vrátí backend.
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

  // ── Režim údržby e-shopu ────────────────────────────────────────────

  /**
   * @description Načte aktuální stav režimu údržby e-shopu ze shop-owned `shop/settings`
   * endpointu, přes krátkou TTL cache (1 min). Volá se samostatně od `loadAll()`, ať
   * výpadek shop-KPI dat neblokuje zobrazení stavu údržby a naopak. BEZE ZMĚNY oproti
   * předchozí verzi.
   */
  private loadMaintenanceStatus(force: boolean = false): void {
    if (!this.permissionService.hasPermission(this.PERM_MAINTENANCE)) {
      return;
    }

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
   * (ShopSiteSettingController::update). Po úspěchu invaliduje maintenance cache klíč.
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