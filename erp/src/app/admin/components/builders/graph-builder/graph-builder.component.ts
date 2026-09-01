/**
 * @file graph-builder.component.ts
 * @path src/app/admin/components/builders/graph-builder/graph-builder.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Generic, config-driven report/analytics popup. Given a resource's
 * `apiEndpoint` and a subset of its `detailsColumns` marked `chartable` (see
 * item-details-columns.ts), fetches the (optionally date-filtered) dataset from the
 * resource's EXISTING `index()` endpoint (no new backend routes required) and renders,
 * for each admin-selected column, an INDIVIDUALLY chosen chart:
 * - categorical (`aggregation: 'count'`) columns: bar / pie / doughnut / radar /
 *   polarArea (a value-distribution chart), OR `'trend'` mode - one colored line per
 *   distinct value plotted over time buckets;
 * - numeric (`aggregation: 'sum' | 'avg'`) columns: always a value-over-time chart
 *   (bar or line - there is no "distribution" for a continuous metric).
 * An optional baseline "Celkový počet záznamů v čase" chart can be toggled on/off
 * (`showOverallTrend`) independently of column selection.
 * All aggregation happens CLIENT-SIDE - the backend only needs `no_pagination=true` +
 * optional `date_from`/`date_to` on `index()`.
 *
 * @refactor-note (2026-08-26v2) Report auto-generates on open with empty date range
 * (= all data).
 * @refactor-note (2026-08-26v3) Per-column VALUE filter - toggling a value never
 * re-fetches, only recomputes from cached `rawRows`.
 * @refactor-note (2026-08-27) Per-column chart type (sidebar layout, compact topbar,
 * vertical chart stack).
 * @bugfix-note (2026-08-27v2) Chart.js legend replaced with our own HTML legend;
 * `ngOnChanges()` no longer resets admin selections on a same-key-set array reference
 * change.
 * @bugfix-note (2026-08-27v3) Radar/polarArea `r` scale drawn with `z: 1` (on top of
 * the dataset) + polarArea fill made semi-transparent, so the radial grid/numbers are
 * never buried under the filled shape.
 * @refactor-note (2026-08-27v4) Pie/doughnut/polarArea use a custom "leader line"
 * outside-slice-label plugin (`OUTSIDE_SLICE_LABELS_PLUGIN`) instead of a bottom
 * legend; `categoryTrend` keeps its own HTML legend.
 * @bugfix-note (2026-08-27v5) PDF export rebuilt: header/footer/each card captured
 * individually via html2canvas (consistent real-browser font incl. Czech diacritics,
 * white background, cards never split across a page break); section titles moved to a
 * real HTML `<h3>` above each canvas instead of Chart.js's in-canvas title.
 * @refactor-note (2026-08-27v6) Optional "Celkový vývoj v čase" toggle
 * (`showOverallTrend`) in the sidebar - purely local, never re-fetches.
 * @bugfix-note (2026-08-27v8) Close button moved into its own full-width
 * `.graph-window-topbar` (see .html/.css) so it can never overlap the mobile
 * hamburger or the sidebar heading.
 * @bugfix-note (2026-08-27v9) Background scroll lock uses `position:fixed` pinning
 * instead of plain `overflow:hidden` (which doesn't reliably stop scroll-chaining
 * from the sidebar/report body once they reach their own scroll end).
 * @bugfix-note (2026-08-27v10) Header/description "období" text now reads a SNAPSHOT
 * of the date range taken at the moment `generateReport()` actually runs
 * (`generatedDateFrom`/`generatedDateTo`), not the live `dateFrom`/`dateTo` bound to
 * the sidebar inputs - editing the date fields no longer makes the header claim a
 * period that hasn't been generated yet.
 *
 * @refactor-note (2026-08-27v11) BACKLOG "graf neukazuje hodnoty s 0 výskyty (např.
 * hodnocení 1-5, kde nikdo nedal '5')": `computeValueCatalog()` teď pro každý sloupec
 * nejdřív "naseje" katalog jeho `possibleValues` (pokud je caller poskytl - viz
 * GraphColumnOption.possibleValues / item-details-columns.ts stejné datum) s počtem 0,
 * teprve POTOM přičítá reálně pozorované hodnoty z `rows`. Bez `possibleValues`
 * (pole `undefined`) je chování BEZE ZMĚNY - jen pozorované hodnoty, jako dřív.
 * Důsledky pro zobrazení (záměrně NEŘEŠENO speciálním kódem, je to inherentní
 * vlastnost typu grafu, ne bug):
 * - bar/radar/trend: nulová hodnota se zobrazí normálně (nulová výška/bod/plochá čára).
 * - pie/doughnut: nulová výseč nemá geometrický smysl, Chart.js i
 *   `OUTSIDE_SLICE_LABELS_PLUGIN` (`if (!value) return;`) ji nevykreslí - hodnota
 *   zůstane vidět aspoň ve filtru hodnot v sidebaru.
 * - polarArea: zobrazí se (Chart.js dělí úhel rovnoměrně mezi kategorie bez ohledu na
 *   hodnotu, jen poloměr výseče odpovídá hodnotě - nulová hodnota = viditelný "bod").
 *
 * @refactor-note (2026-08-31) SCROLL LOCK SJEDNOCEN - vlastní `lockBackgroundScroll()`/
 * `unlockBackgroundScroll()` (position:fixed pinning, viz bugfix-note 2026-08-27v9)
 * nahrazeny sdíleným `ScrollLockService`, který používá STEJNÝ mechanismus (position:
 * fixed) napříč všemi overlay komponentami v aplikaci - viz scroll-lock.service.ts.
 * Chování beze změny, jen sdílené referenční počítadlo s ostatními modaly.
 *
 * @note GDPR/data-minimization by design: the report can only ever show columns the
 * page config explicitly marks `chartable`, so a generated PDF report structurally
 * cannot leak personal data.
 *
 * @dependencies
 * - DataHandler: read-only GET against `apiEndpoint` (no_pagination + optional date range).
 * - EntityCrudService: single POST to `web/logs` for audit trail.
 * - chart.js (`chart.js/auto`, dynamic import): renders one <canvas> per section.
 * - jsPDF + html2canvas (dynamic import): client-side PDF snapshot of the report body.
 * - ScrollLockService: Sdílený zámek scrollu na pozadí.
 */

import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef,
  OnChanges, OnDestroy, OnInit, AfterViewInit, SimpleChanges, ViewChildren, ViewChild,
  QueryList, ElementRef, inject
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, firstValueFrom } from 'rxjs';

import { DataHandler } from '../../../../core/services/data-handler.service';
import { EntityCrudService } from '../../../../core/services/entitiy-crud.service';
import { AlertDialogService } from '../../../../core/services/alert-dialog.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { ScrollLockService } from '../../../../core/services/scroll-lock.service';
import {
  GraphColumnOption, ColumnChartMode, MetricChartMode, DistributionChartType,
  ChartModeOption, COLUMN_CHART_MODE_OPTIONS, METRIC_CHART_MODE_OPTIONS
} from '../../../../shared/interfaces/graph-format';

type BucketGranularity = 'day' | 'week' | 'month';

interface ColumnValueEntry {
  value: string;
  count: number;
}

interface BucketDescriptor {
  key: string;
  label: string;
  date: Date;
}

/** Vlastní (ne-Chart.js) legenda - "barevná tečka + text" - jen pro categoryTrend. */
interface LegendItem {
  label: string;
  color: string;
}

interface DistributionSection {
  columnKey: string;
  columnLabel: string;
  chartType: DistributionChartType;
  /** Popisky UŽ obsahují počet výskytů, např. "AI vývoj (3×)". */
  labels: string[];
  values: number[];
  colors: string[];
}

interface CategoryTrendSeries {
  label: string;
  color: string;
  values: number[];
}

interface CategoryTrendSection {
  columnKey: string;
  columnLabel: string;
  labels: string[];
  series: CategoryTrendSeries[];
  legendItems: LegendItem[];
}

interface MetricTrendSection {
  columnKey: string;
  columnLabel: string;
  aggregation: 'sum' | 'avg';
  chartType: MetricChartMode;
  labels: string[];
  values: number[];
}

interface OverallTrendSection {
  labels: string[];
  values: number[];
}

type ChartSectionDescriptor =
  | { kind: 'distribution'; section: DistributionSection }
  | { kind: 'categoryTrend'; section: CategoryTrendSection }
  | { kind: 'metricTrend'; section: MetricTrendSection }
  | { kind: 'overallTrend'; section: OverallTrendSection };

/** Max distinct category values plotted individually in a distribution chart before the rest is folded into "Ostatní". */
const MAX_DISTRIBUTION_CATEGORIES = 12;
/** Max colored lines drawn in a "vývoj v čase" (trend) chart before the rest is folded into "Ostatní". */
const MAX_TREND_SERIES = 8;

/**
 * @description Custom Chart.js plugin drawing "leader line" callout labels OUTSIDE
 * pie/doughnut/polarArea slices instead of a bottom legend. Registered LOCALLY per
 * chart instance via `plugins: [...]` in `buildChartConfig()` (never globally), so it
 * only ever runs when a chart explicitly opts in through
 * `options.plugins.outsideLabels.enabled`.
 */
const OUTSIDE_SLICE_LABELS_PLUGIN = {
  id: 'outsideLabels',
  afterDraw(chart: any): void {
    const opts = chart.options?.plugins?.outsideLabels;
    if (!opts?.enabled) return;

    const meta = chart.getDatasetMeta(0);
    if (!meta?.data?.length) return;

    const ctx: CanvasRenderingContext2D = chart.ctx;
    const labels: string[] = opts.labels ?? [];
    const colors: string[] = opts.colors ?? [];
    const LEADER_GAP = 10;
    const LABEL_OFFSET = 16;
    const MIN_VERTICAL_GAP = 15;

    type PendingLabel = { index: number; edgeX: number; edgeY: number; midX: number; midY: number; endX: number; endY: number; isRight: boolean };
    const pending: PendingLabel[] = [];

    meta.data.forEach((arc: any, index: number) => {
      const value = chart.data.datasets[0].data[index];
      if (!value) return;

      const cx = arc.x, cy = arc.y;
      const angle = (arc.startAngle + arc.endAngle) / 2;
      const outerRadius = arc.outerRadius;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const isRight = cos >= 0;

      const edgeX = cx + cos * outerRadius;
      const edgeY = cy + sin * outerRadius;
      const midRadius = outerRadius + LEADER_GAP;
      const midX = cx + cos * midRadius;
      const midY = cy + sin * midRadius;
      const endX = midX + (isRight ? LABEL_OFFSET : -LABEL_OFFSET);

      pending.push({ index, edgeX, edgeY, midX, midY, endX, endY: midY, isRight });
    });

    for (const side of [true, false]) {
      const group = pending.filter(p => p.isRight === side).sort((a, b) => a.endY - b.endY);
      for (let i = 1; i < group.length; i++) {
        if (group[i].endY - group[i - 1].endY < MIN_VERTICAL_GAP) {
          group[i].endY = group[i - 1].endY + MIN_VERTICAL_GAP;
        }
      }
    }

    ctx.save();
    ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textBaseline = 'middle';

    pending.forEach(p => {
      const color = colors[p.index] ?? '#71717a';

      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p.edgeX, p.edgeY);
      ctx.lineTo(p.midX, p.midY);
      ctx.lineTo(p.endX, p.endY);
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.edgeX, p.edgeY, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#18181b';
      ctx.textAlign = p.isRight ? 'left' : 'right';
      ctx.fillText(labels[p.index] ?? '', p.endX + (p.isRight ? 4 : -4), p.endY);
    });

    ctx.restore();
  },
};

/**
 * @description Full-screen popup rendering a config-driven analytics report (charts +
 * PDF export) over a date-filtered (or, by default, unfiltered) snapshot of one admin
 * resource. Every included column gets its OWN chart-type choice (sidebar), and a
 * per-column value-inclusion filter to exclude outlier/negligible categories.
 * @usage `<app-graph-builder [apiEndpoint]="apiEndpoint" [tableCaption]="'...'"
 *          [columns]="graphColumns" (closed)="closeGraphBuilder()" />`
 * @note `[columns]` should be a STABLE array reference (a plain field, not a getter
 * that rebuilds a new array on every call).
 */
@Component({
  selector: 'app-graph-builder',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './graph-builder.component.html',
  styleUrl: './graph-builder.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GraphBuilderComponent implements OnInit, OnChanges, OnDestroy, AfterViewInit {
  @Input() apiEndpoint: string = '';
  @Input() tableCaption?: string;
  @Input() columns: GraphColumnOption[] = [];
  @Input() dateField: string = 'created_at';
  @Input() dateFieldLabel: string = 'Datum vytvoření';

  @Output() closed = new EventEmitter<void>();

  @ViewChildren('chartCanvas') private chartCanvases!: QueryList<ElementRef<HTMLCanvasElement>>;
  /** Every rendered chart CARD (heading + canvas + legend + description) - captured individually so no card ever splits across a PDF page break. */
  @ViewChildren('pdfCard') private pdfCardRefs!: QueryList<ElementRef<HTMLElement>>;
  /** Off-screen dark title band + metadata block - captured as one image for the PDF header (real HTML font, correct diacritics). */
  @ViewChild('pdfHeader') private pdfHeaderRef?: ElementRef<HTMLElement>;
  /** Off-screen plain-text report title - captured as an image for the PDF footer's left side (avoids jsPDF's built-in-font diacritics bug). */
  @ViewChild('pdfFooterTitle') private pdfFooterTitleRef?: ElementRef<HTMLElement>;

  public readonly columnChartModeOptions: ChartModeOption<ColumnChartMode>[] = COLUMN_CHART_MODE_OPTIONS;
  public readonly metricChartModeOptions: ChartModeOption<MetricChartMode>[] = METRIC_CHART_MODE_OPTIONS;

  /** Prázdné = bez omezení (výchozí stav - "zobrazit vše"). */
  dateFrom: string = '';
  dateTo: string = '';

  /** Snapshot POUŽITÉHO období, pořízený v okamžiku skutečného generateReport() - viz bugfix-note (2026-08-27v10). `periodLabel` čte TOTO, ne živé dateFrom/dateTo. */
  private generatedDateFrom: string = '';
  private generatedDateTo: string = '';

  selectedColumnKeys = new Set<string>();
  /** Zvolený typ grafu PER kategorický sloupec (default 'bar'). */
  columnChartModes = new Map<string, ColumnChartMode>();
  /** Zvolený typ grafu PER numerický (sum/avg) sloupec (default 'line'). */
  metricChartModes = new Map<string, MetricChartMode>();

  /** Zda se má na konci reportu zobrazit doplňkový graf "Celkový počet záznamů v čase". Default zapnuto. */
  showOverallTrend = true;

  isLoading = false;
  isExportingPdf = false;
  reportGenerated = false;
  reportGeneratedAt: Date | null = null;
  lastRowCount = 0;

  /** Sjednocený, POŘADÍM daný seznam všech grafů reportu - šablona je vykresluje pod sebou. */
  reportSections: ChartSectionDescriptor[] = [];
  trendGranularityLabel = '';

  /** Ovládá vysouvací boční panel na mobilu (na desktopu je panel vždy viditelný, viz .css). */
  mobileSidebarOpen = false;
  /** Které sloupce mají v postranním panelu rozbalený filtr konkrétních hodnot. */
  private expandedValueFilterColumns = new Set<string>();

  /** Raw rows z posledního reálného fetchnutí - drženo v paměti, ať toggle hodnoty/typu grafu nikdy nemusí znovu volat API. */
  private rawRows: any[] = [];
  /** Distinct hodnoty + počty per kategorický sloupec, spočítané z `rawRows` (+ doplněné o `possibleValues` s počtem 0 - viz computeValueCatalog()). */
  columnValueCatalog = new Map<string, ColumnValueEntry[]>();
  /** Které hodnoty (per sloupec) jsou aktuálně zahrnuté v grafu daného sloupce. */
  selectedColumnValues = new Map<string, Set<string>>();

  private currentGranularity: BucketGranularity = 'month';
  /** Sdílené časové "buckety" (stejná osa X) pro VŠECHNY časové grafy v reportu. */
  private canonicalBuckets: BucketDescriptor[] = [];

  private destroy$ = new Subject<void>();
  private ChartJS: any = null;
  private chartInstances: any[] = [];

  public alertDialogService = inject(AlertDialogService);
  public authService = inject(AuthService);
  private scrollLock = inject(ScrollLockService);

  private readonly webLogsEndpoint = 'web/logs';
  private _logCrud?: EntityCrudService<any>;
  private get logCrud(): EntityCrudService<any> {
    if (!this._logCrud) {
      this._logCrud = new EntityCrudService<any>(this.dataHandler, () => this.webLogsEndpoint, this.destroy$);
    }
    return this._logCrud;
  }

  constructor(private dataHandler: DataHandler, private cd: ChangeDetectorRef) {}

  /**
   * @description Initializes (or, if the key SET is unchanged, PRESERVES) column
   * selection and per-column chart-mode defaults.
   */
  ngOnChanges(changes: SimpleChanges): void {
    const change = changes['columns'];
    if (!change) return;

    const previousColumns = (change.previousValue as GraphColumnOption[] | undefined) ?? [];
    if (!change.firstChange && this.sameColumnKeySet(previousColumns, this.columns)) {
      // Same set of columns, just a different array instance (e.g. an unmemoized
      // getter upstream) - keep whatever the admin already configured.
      return;
    }

    this.selectedColumnKeys = new Set(this.columns.map(c => c.key));
    this.columnChartModes = new Map(
      this.columns.filter(c => c.aggregation === 'count').map(c => [c.key, 'bar' as ColumnChartMode])
    );
    this.metricChartModes = new Map(
      this.columns.filter(c => c.aggregation !== 'count').map(c => [c.key, 'line' as MetricChartMode])
    );
  }

  private sameColumnKeySet(a: GraphColumnOption[], b: GraphColumnOption[]): boolean {
    if (a.length !== b.length) return false;
    const aKeys = new Set(a.map(c => c.key));
    return b.every(c => aKeys.has(c.key));
  }

  /** @description Locks background scroll and auto-generates the report immediately on open (all columns, no date restriction). */
  ngOnInit(): void {
    this.scrollLock.lock();
    this.generateReport();
  }

  ngAfterViewInit(): void {
    this.chartCanvases.changes.subscribe(() => this.renderCharts());
  }

  ngOnDestroy(): void {
    this.scrollLock.unlock();
    this.destroyCharts();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Sidebar: column inclusion + per-column chart type ────────────────────

  isColumnSelected(key: string): boolean {
    return this.selectedColumnKeys.has(key);
  }

  toggleColumn(key: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    checked ? this.selectedColumnKeys.add(key) : this.selectedColumnKeys.delete(key);
    if (this.reportGenerated) this.rebuildAllSections();
  }

  get isAllColumnsSelected(): boolean {
    return this.columns.length > 0 && this.selectedColumnKeys.size === this.columns.length;
  }

  toggleSelectAllColumns(): void {
    this.selectedColumnKeys = this.isAllColumnsSelected ? new Set() : new Set(this.columns.map(c => c.key));
    if (this.reportGenerated) this.rebuildAllSections();
  }

  aggregationLabel(aggregation: 'count' | 'sum' | 'avg'): string {
    return aggregation === 'count' ? 'Kategorie' : aggregation === 'sum' ? 'Součet' : 'Průměr';
  }

  setColumnChartMode(key: string, mode: ColumnChartMode): void {
    this.columnChartModes.set(key, mode);
    if (this.reportGenerated) this.rebuildAllSections();
  }

  setMetricChartMode(key: string, mode: MetricChartMode): void {
    this.metricChartModes.set(key, mode);
    if (this.reportGenerated) this.rebuildAllSections();
  }

  toggleShowOverallTrend(event: Event): void {
    this.showOverallTrend = (event.target as HTMLInputElement).checked;
    if (this.reportGenerated) this.rebuildAllSections();
  }

  /** @description Čte SNAPSHOT období (`generatedDateFrom`/`generatedDateTo`), ne živé date inputy - viz bugfix-note (2026-08-27v10). */
  get periodLabel(): string {
    if (!this.generatedDateFrom && !this.generatedDateTo) return 'celé období (bez omezení)';
    return `${this.generatedDateFrom || 'začátek'} – ${this.generatedDateTo || 'dnes'}`;
  }

  /** @description Human summary of every included column + its chosen chart type, used in the meta block and PDF header. */
  get selectedColumnSummary(): string {
    const parts = this.columns
      .filter(c => this.selectedColumnKeys.has(c.key))
      .map(c => {
        const modeLabel = c.aggregation === 'count'
          ? (this.columnChartModeOptions.find(o => o.value === (this.columnChartModes.get(c.key) ?? 'bar'))?.label ?? '')
          : (this.metricChartModeOptions.find(o => o.value === (this.metricChartModes.get(c.key) ?? 'line'))?.label ?? '');
        return `${c.label} (${modeLabel})`;
      });
    return parts.length > 0 ? parts.join(', ') : '—';
  }

  // ── Report generation (real fetch) ───────────────────────────────────────

  get canGenerate(): boolean {
    return this.selectedColumnKeys.size > 0 && !this.isLoading;
  }

  async generateReport(): Promise<void> {
    if (!this.canGenerate) return;

    this.isLoading = true;
    this.reportGenerated = false;
    this.mobileSidebarOpen = false;
    this.cd.markForCheck();

    try {
      const params: Record<string, string> = {
        no_pagination: 'true',
        sort_by: this.dateField,
        sort_direction: 'asc',
      };
      if (this.dateFrom) params['date_from'] = this.dateFrom;
      if (this.dateTo) params['date_to'] = this.dateTo;

      // Snapshot POUŽITÉHO období - viz bugfix-note (2026-08-27v10). periodLabel/PDF
      // čtou TOTO, ne živé dateFrom/dateTo, takže hlavička se změní až po skutečném
      // vygenerování, ne při každém úhozu v date inputu.
      this.generatedDateFrom = this.dateFrom;
      this.generatedDateTo = this.dateTo;

      const rows = await firstValueFrom(this.dataHandler.getCollection<any>(this.apiEndpoint, params));
      this.buildReportFromRows(Array.isArray(rows) ? rows : []);
      this.reportGenerated = true;
      this.reportGeneratedAt = new Date();
      this.logReportActivity(this.lastRowCount, false);
       } catch {
      // DataHandler.handleError() už zobrazil toast pro tuto HTTP chybu - viz
      // bugfix-note (2026-08-31) v data-handler.service.ts.
    } finally {
      this.isLoading = false;
      this.cd.markForCheck();
      setTimeout(() => this.renderCharts(), 0);
    }
  }

  private buildReportFromRows(rows: any[]): void {
    this.rawRows = rows;
    this.lastRowCount = rows.length;

    this.computeValueCatalog(rows);

    this.currentGranularity = this.resolveBucketGranularity(rows);
    this.trendGranularityLabel = this.currentGranularity === 'day' ? 'den' : this.currentGranularity === 'week' ? 'týden' : 'měsíc';
    this.canonicalBuckets = this.computeCanonicalBuckets(rows, this.currentGranularity);

    this.rebuildAllSections();
  }

  /**
   * @description Rebuilds `reportSections` from CACHED `rawRows`/`canonicalBuckets` -
   * called after any local UI toggle (column inclusion, per-column chart type, value
   * filter, overall-trend toggle) so nothing but the initial "Generovat" click ever
   * re-fetches data.
   */
  private rebuildAllSections(): void {
    const bucketsMap = this.groupRowsByBucket(this.rawRows, this.currentGranularity);
    const sections: ChartSectionDescriptor[] = [];

    for (const col of this.columns) {
      if (!this.selectedColumnKeys.has(col.key)) continue;

      if (col.aggregation === 'count') {
        const mode = this.columnChartModes.get(col.key) ?? 'bar';
        if (mode === 'trend') {
          sections.push({ kind: 'categoryTrend', section: this.buildCategoryTrendSection(col, bucketsMap) });
        } else {
          sections.push({ kind: 'distribution', section: this.buildDistributionSection(col, mode) });
        }
      } else {
        sections.push({ kind: 'metricTrend', section: this.buildMetricTrendSection(col, bucketsMap) });
      }
    }

    if (this.showOverallTrend) {
      sections.push({ kind: 'overallTrend', section: this.buildOverallTrendSection(bucketsMap) });
    }

    this.reportSections = sections;
    this.cd.markForCheck();
    setTimeout(() => this.renderCharts(), 0);
  }

  // ── Value catalog + per-value filter ──────────────────────────────────

  /**
   * @description Pro každý kategorický sloupec spočítá distinct hodnoty + počty
   * z `rows`. Pokud sloupec nese `possibleValues` (viz GraphColumnOption -
   * refactor-note 2026-08-27v11), katalog se PŘED počítáním "naseje" těmito hodnotami
   * s počtem 0 - takže hodnota, která se v datech vůbec nevyskytla (např. hodnocení
   * "5" u škály 1-5, kterou nikdo nezvolil), zůstane v katalogu, filtru hodnot i
   * grafu (v typech grafu, které umí nulu zobrazit - viz refactor-note v hlavičce
   * souboru). Bez `possibleValues` je chování beze změny oproti dřívějšku.
   */
  private computeValueCatalog(rows: any[]): void {
    const dimensionColumns = this.columns.filter(c => c.aggregation === 'count');
    const catalog = new Map<string, ColumnValueEntry[]>();
    const selection = new Map<string, Set<string>>();

    for (const col of dimensionColumns) {
      const counts = new Map<string, number>();

      for (const possible of col.possibleValues ?? []) {
        counts.set(possible, 0);
      }

      for (const row of rows) {
        const raw = row?.[col.key];
        const label = (raw === null || raw === undefined || raw === '') ? 'Nevyplněno' : String(raw);
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }

      const entries = Array.from(counts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count);

      catalog.set(col.key, entries);
      selection.set(col.key, new Set(entries.map(e => e.value)));
    }

    this.columnValueCatalog = catalog;
    this.selectedColumnValues = selection;
  }

  isValueFilterExpanded(columnKey: string): boolean {
    return this.expandedValueFilterColumns.has(columnKey);
  }

  toggleValueFilterPanel(columnKey: string): void {
    this.expandedValueFilterColumns.has(columnKey)
      ? this.expandedValueFilterColumns.delete(columnKey)
      : this.expandedValueFilterColumns.add(columnKey);
    this.cd.markForCheck();
  }

  isColumnValueSelected(columnKey: string, value: string): boolean {
    return this.selectedColumnValues.get(columnKey)?.has(value) ?? true;
  }

  toggleColumnValue(columnKey: string, value: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    let set = this.selectedColumnValues.get(columnKey);
    if (!set) {
      set = new Set();
      this.selectedColumnValues.set(columnKey, set);
    }
    checked ? set.add(value) : set.delete(value);
    this.rebuildAllSections();
  }

  isAllColumnValuesSelected(columnKey: string): boolean {
    const catalog = this.columnValueCatalog.get(columnKey) ?? [];
    const set = this.selectedColumnValues.get(columnKey);
    return catalog.length > 0 && !!set && set.size === catalog.length;
  }

  toggleAllColumnValues(columnKey: string): void {
    const catalog = this.columnValueCatalog.get(columnKey) ?? [];
    this.selectedColumnValues.set(
      columnKey,
      this.isAllColumnValuesSelected(columnKey) ? new Set() : new Set(catalog.map(e => e.value))
    );
    this.rebuildAllSections();
  }

  // ── Section builders ──────────────────────────────────────────────────

  private buildDistributionSection(col: GraphColumnOption, chartType: DistributionChartType): DistributionSection {
    const catalog = this.columnValueCatalog.get(col.key) ?? [];
    const selectedValues = this.selectedColumnValues.get(col.key);

    let entries: [string, number][] = catalog
      .filter(e => !selectedValues || selectedValues.has(e.value))
      .map(e => [e.value, e.count]);

    if (entries.length > MAX_DISTRIBUTION_CATEGORIES) {
      const top = entries.slice(0, MAX_DISTRIBUTION_CATEGORIES - 1);
      const restCount = entries.slice(MAX_DISTRIBUTION_CATEGORIES - 1).reduce((sum, [, c]) => sum + c, 0);
      entries = [...top, ['Ostatní', restCount]];
    }

    return {
      columnKey: col.key,
      columnLabel: col.label,
      chartType,
      labels: entries.map(([label, count]) => `${label} (${count}×)`),
      values: entries.map(([, count]) => count),
      colors: this.categoryPalette(entries.length),
    };
  }

  private buildCategoryTrendSection(col: GraphColumnOption, bucketsMap: Map<string, any[]>): CategoryTrendSection {
    const catalog = this.columnValueCatalog.get(col.key) ?? [];
    const selectedValues = this.selectedColumnValues.get(col.key);

    let categoryValues = catalog.filter(e => !selectedValues || selectedValues.has(e.value)).map(e => e.value);
    let foldRest = false;
    if (categoryValues.length > MAX_TREND_SERIES) {
      categoryValues = categoryValues.slice(0, MAX_TREND_SERIES - 1);
      foldRest = true;
    }
    const topSet = new Set(categoryValues);
    const colors = this.categoryPalette(categoryValues.length + (foldRest ? 1 : 0));

    const valueOfRow = (row: any): string => {
      const raw = row?.[col.key];
      return (raw === null || raw === undefined || raw === '') ? 'Nevyplněno' : String(raw);
    };

    const series: CategoryTrendSeries[] = categoryValues.map((category, idx) => ({
      label: category,
      color: colors[idx],
      values: this.canonicalBuckets.map(bucket =>
        (bucketsMap.get(bucket.key) ?? []).filter(row => valueOfRow(row) === category).length
      ),
    }));

    if (foldRest) {
      series.push({
        label: 'Ostatní',
        color: colors[colors.length - 1],
        values: this.canonicalBuckets.map(bucket =>
          (bucketsMap.get(bucket.key) ?? []).filter(row => {
            const label = valueOfRow(row);
            return !topSet.has(label) && (!selectedValues || selectedValues.has(label));
          }).length
        ),
      });
    }

    const legendItems: LegendItem[] = series.map(s => ({
      label: `${s.label} (${s.values.reduce((a, b) => a + b, 0)}×)`,
      color: s.color,
    }));

    return {
      columnKey: col.key,
      columnLabel: col.label,
      labels: this.canonicalBuckets.map(b => b.label),
      series,
      legendItems,
    };
  }

  private buildMetricTrendSection(col: GraphColumnOption, bucketsMap: Map<string, any[]>): MetricTrendSection {
    const aggregation = col.aggregation as 'sum' | 'avg';
    const values = this.canonicalBuckets.map(bucket => {
      const rowsInBucket = bucketsMap.get(bucket.key) ?? [];
      const nums = rowsInBucket.map(r => Number(r?.[col.key])).filter(n => !Number.isNaN(n));
      if (nums.length === 0) return 0;
      const sum = nums.reduce((a, b) => a + b, 0);
      return aggregation === 'sum' ? sum : sum / nums.length;
    });

    return {
      columnKey: col.key,
      columnLabel: col.label,
      aggregation,
      chartType: this.metricChartModes.get(col.key) ?? 'line',
      labels: this.canonicalBuckets.map(b => b.label),
      values,
    };
  }

  private buildOverallTrendSection(bucketsMap: Map<string, any[]>): OverallTrendSection {
    return {
      labels: this.canonicalBuckets.map(b => b.label),
      values: this.canonicalBuckets.map(b => (bucketsMap.get(b.key) ?? []).length),
    };
  }

  // ── Time bucketing (shared across all trend-like sections) ──────────────

  private resolveBucketGranularity(rows: any[]): BucketGranularity {
    const { from, to } = this.resolveEffectiveRange(rows);
    const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000));
    if (days <= 62) return 'day';
    if (days <= 180) return 'week';
    return 'month';
  }

  private resolveEffectiveRange(rows: any[]): { from: Date; to: Date } {
    if (this.dateFrom && this.dateTo) {
      return { from: new Date(this.dateFrom), to: new Date(this.dateTo) };
    }
    const observedDates = rows.map(r => new Date(r?.[this.dateField])).filter(d => !isNaN(d.getTime()));
    if (observedDates.length === 0) {
      const today = new Date();
      return { from: today, to: today };
    }
    const from = this.dateFrom ? new Date(this.dateFrom) : new Date(Math.min(...observedDates.map(d => d.getTime())));
    const to = this.dateTo ? new Date(this.dateTo) : new Date(Math.max(...observedDates.map(d => d.getTime())));
    return { from, to };
  }

  private computeCanonicalBuckets(rows: any[], granularity: BucketGranularity): BucketDescriptor[] {
    const map = new Map<string, Date>();
    for (const row of rows) {
      const raw = row?.[this.dateField];
      if (!raw) continue;
      const d = new Date(raw);
      if (isNaN(d.getTime())) continue;
      const bucketDate = this.bucketDateFor(d, granularity);
      map.set(this.bucketKey(bucketDate), bucketDate);
    }
    const sortedKeys = Array.from(map.keys()).sort();
    const dateFormat = granularity === 'month' ? 'MM/yyyy' : 'd.M.';
    return sortedKeys.map(k => ({
      key: k,
      label: new DatePipe('cs-CZ').transform(map.get(k)!, dateFormat) ?? k,
      date: map.get(k)!,
    }));
  }

  private groupRowsByBucket(rows: any[], granularity: BucketGranularity): Map<string, any[]> {
    const map = new Map<string, any[]>();
    for (const row of rows) {
      const raw = row?.[this.dateField];
      if (!raw) continue;
      const d = new Date(raw);
      if (isNaN(d.getTime())) continue;
      const key = this.bucketKey(this.bucketDateFor(d, granularity));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    return map;
  }

  private bucketDateFor(date: Date, granularity: BucketGranularity): Date {
    if (granularity === 'day') return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (granularity === 'month') return new Date(date.getFullYear(), date.getMonth(), 1);
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const isoDayIndex = (d.getDay() + 6) % 7; // 0 = Monday
    d.setDate(d.getDate() - isoDayIndex);
    return d;
  }

  private bucketKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  // ── Chart rendering (Chart.js, lazy-loaded) ──────────────────────────

  get chartSectionDescriptors(): ChartSectionDescriptor[] {
    return this.reportSections;
  }

  /** @description Used for the HTML `<h3>` heading above each chart (and thus for the PDF card image too). */
  sectionTitle(descriptor: ChartSectionDescriptor): string {
    switch (descriptor.kind) {
      case 'distribution': return `${descriptor.section.columnLabel} — rozložení hodnot`;
      case 'categoryTrend': return `${descriptor.section.columnLabel} — vývoj v čase`;
      case 'metricTrend': return `${descriptor.section.columnLabel} — vývoj v čase (${descriptor.section.aggregation === 'sum' ? 'součet' : 'průměr'})`;
      case 'overallTrend': return 'Celkový počet záznamů v čase';
    }
  }

  sectionDescription(descriptor: ChartSectionDescriptor): string {
    switch (descriptor.kind) {
      case 'distribution': {
        const total = descriptor.section.values.reduce((a, b) => a + b, 0);
        return `Počet záznamů podle hodnoty pole „${descriptor.section.columnLabel}“ - ${total} z ${this.lastRowCount} v období: ${this.periodLabel}.`;
      }
      case 'categoryTrend':
        return `Vývoj počtu záznamů podle hodnoty pole „${descriptor.section.columnLabel}“ v čase (krok: ${this.trendGranularityLabel}), období: ${this.periodLabel}.`;
      case 'metricTrend':
        return `Vývoj hodnoty pole „${descriptor.section.columnLabel}“ v čase (krok: ${this.trendGranularityLabel}), období: ${this.periodLabel}.`;
      case 'overallTrend':
        return `Celkový objem záznamů podle pole „${this.dateFieldLabel}“ (krok: ${this.trendGranularityLabel}), období: ${this.periodLabel}.`;
    }
  }

  /**
   * @description Vlastní HTML legenda - JEN pro `categoryTrend` (vícebarevný spojnicový
   * graf, kde by "leader lines" ke každému bodu na každé čáře nebyly čitelné).
   * `distribution` (pie/doughnut/polarArea) místo toho kreslí popisky přímo do canvasu
   * pomocí `OUTSIDE_SLICE_LABELS_PLUGIN`.
   */
  legendItemsFor(descriptor: ChartSectionDescriptor): LegendItem[] | null {
    if (descriptor.kind === 'categoryTrend') return descriptor.section.legendItems;
    return null;
  }

  private async renderCharts(): Promise<void> {
    if (!this.chartCanvases || this.chartCanvases.length === 0) return;
    if (!this.ChartJS) {
      this.ChartJS = (await import('chart.js/auto')).default;
    }
    this.destroyCharts();

    const descriptors = this.reportSections;
    this.chartCanvases.forEach((canvasRef, index) => {
      const descriptor = descriptors[index];
      if (!descriptor) return;
      const ctx = canvasRef.nativeElement.getContext('2d');
      if (!ctx) return;
      this.chartInstances.push(new this.ChartJS(ctx, this.buildChartConfig(descriptor)));
    });
  }

  private destroyCharts(): void {
    this.chartInstances.forEach(chart => chart.destroy());
    this.chartInstances = [];
  }

  private buildChartConfig(descriptor: ChartSectionDescriptor): any {
    switch (descriptor.kind) {
      case 'distribution': {
        const { section } = descriptor;
        const isRing = section.chartType !== 'bar' && section.chartType !== 'radar';
        const scaleKind: 'linear' | 'radial' | 'none' =
          section.chartType === 'bar' ? 'linear' : (section.chartType === 'radar' || section.chartType === 'polarArea') ? 'radial' : 'none';

        const polarBackground = section.chartType === 'polarArea'
          ? this.withAlpha(section.colors, 0.55)
          : section.colors;

        const usesOutsideLabels = section.chartType === 'pie' || section.chartType === 'doughnut' || section.chartType === 'polarArea';

        const options = this.baseChartOptions(scaleKind, true);
        if (usesOutsideLabels) {
          options.plugins.outsideLabels = { enabled: true, labels: section.labels, colors: section.colors };
          options.layout = { padding: { top: 16, bottom: 16, left: 96, right: 96 } };
        }

        return {
          type: section.chartType,
          data: {
            labels: section.labels,
            datasets: [{
              label: section.columnLabel,
              data: section.values,
              backgroundColor: section.chartType === 'radar' ? 'rgba(67,56,202,0.25)' : polarBackground,
              borderColor: section.chartType === 'radar' ? '#6f65d4ff' : (isRing ? '#ffffff' : section.colors),
              borderWidth: section.chartType === 'radar' ? 2 : (isRing ? 2 : 0),
              pointBackgroundColor: section.chartType === 'radar' ? section.colors : undefined,
            }],
          },
          options,
          plugins: usesOutsideLabels ? [OUTSIDE_SLICE_LABELS_PLUGIN] : [],
        };
      }

      case 'categoryTrend': {
        const { section } = descriptor;
        return {
          type: 'line',
          data: {
            labels: section.labels,
            datasets: section.series.map(s => ({
              label: s.label,
              data: s.values,
              borderColor: s.color,
              backgroundColor: s.color,
              fill: false,
              tension: 0.25,
              borderWidth: 2,
              pointRadius: 2,
            })),
          },
          options: this.baseChartOptions('linear'),
        };
      }

      case 'metricTrend': {
        const { section } = descriptor;
        return {
          type: section.chartType,
          data: {
            labels: section.labels,
            datasets: [{
              label: `${section.columnLabel} (${section.aggregation === 'sum' ? 'součet' : 'průměr'})`,
              data: section.values,
              backgroundColor: 'rgba(67,56,202,0.55)',
              borderColor: '#4338ca',
              borderWidth: 2,
              fill: section.chartType === 'line' ? false : true,
              tension: 0.25,
            }],
          },
          options: this.baseChartOptions('linear'),
        };
      }

      case 'overallTrend': {
        const { section } = descriptor;
        return {
          type: 'line',
          data: {
            labels: section.labels,
            datasets: [{
              label: 'Počet záznamů',
              data: section.values,
              backgroundColor: 'rgba(24,24,27,0.5)',
              borderColor: '#18181b',
              borderWidth: 2,
              fill: false,
              tension: 0.2,
              pointRadius: 2,
            }],
          },
          options: this.baseChartOptions('linear'),
        };
      }
    }
  }

  /**
   * @description Chart.js's own `plugins.title` is ALWAYS off - the section title is
   * a real HTML `<h3>` above the canvas. Legend is also always off - see
   * `legendItemsFor()`/`OUTSIDE_SLICE_LABELS_PLUGIN`.
   * @param scaleKind 'linear' = cartesian x/y (bar/line trends), 'radial' = `r` scale
   * (radar/polarArea), 'none' = no scale at all (pie/doughnut).
   */
  private baseChartOptions(scaleKind: 'linear' | 'radial' | 'none', categoryTooltip: boolean = false): any {
    const base: any = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: false },
        legend: { display: false },
        ...(categoryTooltip ? {
          tooltip: {
            callbacks: {
              title: () => '',
              label: (ctx: any) => ctx.label ?? '',
            },
          },
        } : {}),
      },
    };

    if (scaleKind === 'linear') {
      base.scales = {
        x: { ticks: { autoSkip: true, maxRotation: 55, minRotation: 0, font: { size: 10 } } },
        y: { beginAtZero: true, title: { display: true, text: 'Počet / hodnota' } },
      };
    } else if (scaleKind === 'radial') {
      base.scales = {
        r: {
          beginAtZero: true,
          z: 1,
          pointLabels: { font: { size: 10 }, color: '#18181b' },
          ticks: {
            z: 1,
            stepSize: 1,
            color: '#000000',
            showLabelBackdrop: false,
          },
          grid: { color: '#d4d4d8' },
          angleLines: { color: '#d4d4d8' },
        },
      };
    }

    return base;
  }

  private categoryPalette(count: number): string[] {
    const base = ['#18181b', '#4338ca', '#be123c', '#b45309', '#0f766e', '#6366f1', '#71717a', '#fb7185', '#a5b4fc', '#a1a1aa', '#d4d4d8', '#52525b'];
    return Array.from({ length: count }, (_, i) => base[i % base.length]);
  }

  private withAlpha(hexColors: string[], alpha: number): string[] {
    return hexColors.map(hex => {
      const clean = hex.replace('#', '');
      const r = parseInt(clean.substring(0, 2), 16);
      const g = parseInt(clean.substring(2, 4), 16);
      const b = parseInt(clean.substring(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    });
  }

  // ── PDF export (jsPDF + html2canvas, lazy-loaded) ────────────────────

  get reportTitle(): string {
    return `Report — ${this.tableCaption || this.apiEndpoint}`;
  }

  private get reportFilename(): string {
    const range = (this.generatedDateFrom || this.generatedDateTo) ? `${this.generatedDateFrom || 'zacatek'}_az_${this.generatedDateTo || 'dnes'}` : 'vsechna-data';
    const slug = (this.tableCaption || this.apiEndpoint).toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `report-${slug}-${range}`;
  }

  get reportMetaLines(): string[] {
    const lines = [
      `Vygenerováno: ${new DatePipe('cs-CZ').transform(this.reportGeneratedAt, 'd.M.yyyy HH:mm') ?? ''}`,
      `Období: ${this.periodLabel}`,
      `Počet záznamů: ${this.lastRowCount}`,
      `Zahrnuté sloupce: ${this.selectedColumnSummary}`,
    ];

    for (const descriptor of this.reportSections) {
      const columnKey = descriptor.kind === 'distribution' || descriptor.kind === 'categoryTrend' ? descriptor.section.columnKey : null;
      const columnLabel = descriptor.kind === 'distribution' || descriptor.kind === 'categoryTrend' ? descriptor.section.columnLabel : null;
      if (!columnKey || !columnLabel) continue;

      const catalog = this.columnValueCatalog.get(columnKey) ?? [];
      const selected = this.selectedColumnValues.get(columnKey);
      if (selected && selected.size < catalog.length) {
        const excluded = catalog.filter(e => !selected.has(e.value)).map(e => e.value);
        lines.push(`${columnLabel} — vynechané hodnoty: ${excluded.join(', ')}`);
      }
    }

    return lines;
  }

  /**
   * @description Builds the PDF from independently captured pieces (header, each
   * card, footer title). Two passes: pass 1 computes page boundaries without
   * drawing (so the total page count is known before drawing "Strana 1 / N"), pass 2
   * actually draws using that layout.
   */
  async exportToPdf(): Promise<void> {
    if (!this.reportGenerated || this.isExportingPdf) return;
    if (!this.pdfHeaderRef || !this.pdfFooterTitleRef || !this.pdfCardRefs || this.pdfCardRefs.length === 0) return;

    this.isExportingPdf = true;
    this.cd.markForCheck();

    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const headerCanvas = await html2canvas(this.pdfHeaderRef.nativeElement, { scale: 2, backgroundColor: '#18181b', useCORS: true });
      const footerCanvas = await html2canvas(this.pdfFooterTitleRef.nativeElement, { scale: 2, backgroundColor: '#ffffff', useCORS: true });

      const cardCanvases: HTMLCanvasElement[] = [];
      for (const cardRef of this.pdfCardRefs.toArray()) {
        const el = cardRef.nativeElement;
        const prevBackground = el.style.background;
        const prevBorder = el.style.border;
        el.style.background = '#ffffff';
        el.style.border = '1px solid #e4e4e7';
        const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
        el.style.background = prevBackground;
        el.style.border = prevBorder;
        cardCanvases.push(canvas);
      }

      const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 28;
      const usableWidth = pageWidth - margin * 2;
      const footerReserved = 34;
      const cardGap = 14;

      const headerImgHeight = (headerCanvas.height * pageWidth) / headerCanvas.width;
      const cardImgs = cardCanvases.map(c => ({ canvas: c, height: (c.height * usableWidth) / c.width }));

      type PageLayout = { hasHeader: boolean; cards: { canvas: HTMLCanvasElement; height: number }[] };
      const pages: PageLayout[] = [];
      let current: PageLayout = { hasHeader: true, cards: [] };
      let cursorY = headerImgHeight + cardGap;

      for (const item of cardImgs) {
        const limit = pageHeight - footerReserved;
        if (cursorY + item.height > limit && current.cards.length > 0) {
          pages.push(current);
          current = { hasHeader: false, cards: [] };
          cursorY = margin;
        }
        current.cards.push(item);
        cursorY += item.height + cardGap;
      }
      pages.push(current);

      pages.forEach((page, pageIndex) => {
        if (pageIndex > 0) pdf.addPage();

        let y = margin;
        if (page.hasHeader) {
          pdf.addImage(headerCanvas.toDataURL('image/png'), 'PNG', 0, 0, pageWidth, headerImgHeight);
          y = headerImgHeight + cardGap;
        }

        for (const item of page.cards) {
          pdf.addImage(item.canvas.toDataURL('image/png'), 'PNG', margin, y, usableWidth, item.height);
          y += item.height + cardGap;
        }

        this.drawPdfFooter(pdf, footerCanvas, pageWidth, pageHeight, margin, pageIndex + 1, pages.length);
      });

      pdf.save(`${this.reportFilename}.pdf`);
      this.logReportActivity(this.lastRowCount, true);
    } catch {
      this.alertDialogService.open('Chyba', 'Export reportu do PDF se nezdařil.', 'danger');
    } finally {
      this.isExportingPdf = false;
      this.cd.markForCheck();
    }
  }

  private drawPdfFooter(pdf: any, footerCanvas: HTMLCanvasElement, pageWidth: number, pageHeight: number, margin: number, pageNum: number, totalPages: number): void {
    pdf.setDrawColor(228, 228, 231);
    pdf.line(margin, pageHeight - 26, pageWidth - margin, pageHeight - 26);

    const footerImgHeight = 12;
    const footerImgWidth = (footerCanvas.width * footerImgHeight) / footerCanvas.height;
    pdf.addImage(footerCanvas.toDataURL('image/png'), 'PNG', margin, pageHeight - 20, footerImgWidth, footerImgHeight);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(113, 113, 122);
    pdf.text(`Strana ${pageNum} / ${totalPages}`, pageWidth - margin, pageHeight - 12, { align: 'right' });
  }

  private logReportActivity(rowCount: number, pdfExported: boolean): void {
    const caption = this.tableCaption || this.apiEndpoint;
    const logData = {
      event_type: pdfExported ? 'export_report_pdf' : 'generate_report',
      module: this.apiEndpoint,
      description: pdfExported
        ? `User exported a PDF report (${this.periodLabel}, ${rowCount} records) for table: ${caption}.`
        : `User generated a graph report (${this.periodLabel}, ${rowCount} records) for table: ${caption}.`,
      affected_entity_type: 'collection',
      user_id_plain: this.authService.getUserId()?.toString(),
      user_plain: this.authService.getUserEmail(),
    };
    this.logCrud.create(logData).subscribe({ error: (err) => console.error('Failed to log report activity:', err) });
  }

  // ── Overlay / closing ─────────────────────────────────────────────────

  onOverlayMouseDown(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.onClose();
  }

  onClose(): void {
    if (this.isExportingPdf) return;
    this.closed.emit();
  }
}