/**
 * @file graph-builder.component.spec.ts
 * @path src/app/admin/components/builders/graph-builder/graph-builder.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of GraphBuilderComponent – the report / chart popup of the admin tables.
 *   The chart rendering itself (Chart.js on canvas) is not tested; the tests cover the data the
 *   charts are built from: request parameters, distribution counts and "other" folding, value
 *   filters, metric sum/avg trends, time granularity, column selection, texts and audit log.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (DataHandler spy, auth stub, i18n stub), ScrollLockService (spy)
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { jsPDF } from 'jspdf';  // same module instance as the component's dynamic import
import { SimpleChange } from '@angular/core';
import { of, throwError } from 'rxjs';

import { GraphBuilderComponent } from './graph-builder.component';
import { ScrollLockService } from '../../../../core/services/scroll-lock.service';
import { AdminTestContext, createAdminTestContext } from '../../../../../testing/admin-test-helpers';


describe('GraphBuilderComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<GraphBuilderComponent>;
  let component: GraphBuilderComponent;
  let scrollLock: jasmine.SpyObj<ScrollLockService>;

  const columns: any[] = [
    { key: 'status', label: 'Status', aggregation: 'count' },
    { key: 'price', label: 'Price', aggregation: 'sum' },
    { key: 'score', label: 'Score', aggregation: 'avg' }
  ];
  const rows = [
    { created_at: '2026-01-05', status: 'open', price: 10, score: 2 },
    { created_at: '2026-01-05', status: 'open', price: 5, score: 4 },
    { created_at: '2026-01-20', status: 'closed', price: 1, score: 6 },
    { created_at: '2026-01-20', status: '', price: 'x', score: 8 }
  ];

  const setColumns = (cols = columns) => {
    component.columns = cols;
    component.ngOnChanges({ columns: new SimpleChange(undefined, cols, true) });
  };
  const generate = async (data: any[] = rows) => {
    (ctx.dataHandler as any).getCollection.and.returnValue(of(data));
    await component.generateReport();
  };
  const section = (kind: string, key?: string): any =>
    component.reportSections.find(s => s.kind === kind && (!key || (s.section as any).columnKey === key))?.section;

  beforeEach(async () => {
    ctx = createAdminTestContext();
    scrollLock = jasmine.createSpyObj<ScrollLockService>('ScrollLockService', ['lock', 'unlock']);
    await TestBed.configureTestingModule({
      imports: [GraphBuilderComponent],
      providers: [...ctx.providers, { provide: ScrollLockService, useValue: scrollLock }]
    }).compileComponents();
    fixture = TestBed.createComponent(GraphBuilderComponent);
    component = fixture.componentInstance;
    component.apiEndpoint = 'core/orders';
    component.tableCaption = 'Orders';
  });

  /**
   * @description New columns are all selected; count columns default to bar, metrics to line.
   * @input  columns status (count), price (sum), score (avg)
   * @output selected {status, price, score}; columnChartModes status 'bar'; metricChartModes price/score 'line'
   */
  it('selects every column with default chart modes', () => {
    setColumns();
    expect([...component.selectedColumnKeys]).toEqual(['status', 'price', 'score']);
    expect(component.columnChartModes.get('status')).toBe('bar');
    expect(component.metricChartModes.get('price')).toBe('line');
  });

  /**
   * @description The same column set passed again keeps the user's choices.
   * @input  deselect 'price'; ngOnChanges with an equal key set (not first change)
   * @output 'price' stays deselected
   */
  it('keeps the selection when the same columns arrive again', () => {
    setColumns();
    component.toggleColumn('price', { target: { checked: false } } as any);
    component.ngOnChanges({ columns: new SimpleChange(columns, [...columns], false) });
    expect(component.isColumnSelected('price')).toBeFalse();
  });

  /**
   * @description Opening the popup locks scroll, sets the default date label and generates the report.
   * @input  ngOnInit() with dateFieldLabel ''
   * @output scrollLock.lock(); dateFieldLabel 'graph-builder.default_date_field_label'; getCollection called
   */
  it('ngOnInit() locks scroll and generates the report', async () => {
    setColumns();
    (ctx.dataHandler as any).getCollection.and.returnValue(of([]));
    component.ngOnInit();
    expect(scrollLock.lock).toHaveBeenCalled();
    expect(component.dateFieldLabel).toBe('graph-builder.default_date_field_label');
    expect((ctx.dataHandler as any).getCollection).toHaveBeenCalled();
  });

  /**
   * @description The report loads all rows sorted by the date field and passes the date range.
   * @input  dateFrom '2026-01-01', dateTo '2026-01-31'; generateReport()
   * @output getCollection('core/orders', { no_pagination: 'true', sort_by: 'created_at', sort_direction: 'asc', date_from, date_to })
   */
  it('requests all rows with the date range', async () => {
    setColumns();
    component.dateFrom = '2026-01-01';
    component.dateTo = '2026-01-31';
    await generate();
    expect((ctx.dataHandler as any).getCollection).toHaveBeenCalledWith('core/orders', {
      no_pagination: 'true', sort_by: 'created_at', sort_direction: 'asc', date_from: '2026-01-01', date_to: '2026-01-31'
    });
    expect(component.reportGenerated).toBeTrue();
    expect(component.lastRowCount).toBe(4);
  });

  /**
   * @description A distribution counts each value (empty = "unfilled"), most frequent first.
   * @input  statuses open, open, closed, ''
   * @output labels ['open (2×)', 'closed (1×)', 'graph-builder.unfilled_value_label (1×)'], values [2, 1, 1]
   */
  it('counts values for a distribution chart', async () => {
    setColumns();
    await generate();
    const s = section('distribution', 'status');
    expect(s.values).toEqual([2, 1, 1]);
    expect(s.labels[0]).toBe('open (2×)');
    expect(s.labels).toContain('graph-builder.unfilled_value_label (1×)');
  });

  /**
   * @description More than 12 categories: the 11 biggest are kept, the rest is summed as "other".
   * @input  15 distinct statuses, one row each
   * @output 12 slices; last label 'graph-builder.other_category_label (4×)'
   */
  it('folds small categories into "other"', async () => {
    setColumns([columns[0]]);
    await generate(Array.from({ length: 15 }, (_, i) => ({ created_at: '2026-01-01', status: `s${i}` })));
    const s = section('distribution', 'status');
    expect(s.values.length).toBe(12);
    expect(s.labels[11]).toBe('graph-builder.other_category_label (4×)');
  });

  /**
   * @description Values the user unchecks disappear from the chart.
   * @input  toggleColumnValue('status', 'open', unchecked)
   * @output distribution values [1, 1]; isAllColumnValuesSelected false; toggleAllColumnValues → all again
   */
  it('filters chart values', async () => {
    setColumns();
    await generate();
    component.toggleColumnValue('status', 'open', { target: { checked: false } } as any);
    expect(section('distribution', 'status').values).toEqual([1, 1]);
    expect(component.isAllColumnValuesSelected('status')).toBeFalse();
    component.toggleAllColumnValues('status');
    expect(component.isAllColumnValuesSelected('status')).toBeTrue();
  });

  /**
   * @description Metric trends sum or average per time bucket; non-numbers are ignored.
   * @input  rows above (range 15 days → daily buckets 5.1. and 20.1.)
   * @output price sum [15, 1]; score avg [3, 7]; overall trend [2, 2]
   */
  it('sums and averages metrics per bucket', async () => {
    setColumns();
    await generate();
    expect(section('metricTrend', 'price').values).toEqual([15, 1]);
    expect(section('metricTrend', 'score').values).toEqual([3, 7]);
    expect(section('overallTrend').values).toEqual([2, 2]);
    expect(component.trendGranularityLabel).toBe('graph-builder.granularity_day');
  });

  /**
   * @description Longer ranges use weekly (≤ 180 days) and monthly buckets.
   * @input  rows spanning 100 days, then 400 days
   * @output granularity labels week, then month
   */
  it('chooses week and month granularity for longer ranges', async () => {
    setColumns([columns[0]]);
    await generate([{ created_at: '2026-01-01', status: 'a' }, { created_at: '2026-04-11', status: 'a' }]);
    expect(component.trendGranularityLabel).toBe('graph-builder.granularity_week');
    await generate([{ created_at: '2025-01-01', status: 'a' }, { created_at: '2026-02-05', status: 'a' }]);
    expect(component.trendGranularityLabel).toBe('graph-builder.granularity_month');
  });

  /**
   * @description Count columns in "trend" mode become one series per value over time.
   * @input  setColumnChartMode('status', 'trend')
   * @output categoryTrend section with series 'open' [2, 0] and 'closed' [0, 1]
   */
  it('builds a category trend in trend mode', async () => {
    setColumns();
    await generate();
    component.setColumnChartMode('status', 'trend');
    const s = section('categoryTrend', 'status');
    expect(s.series.find((x: any) => x.label === 'open').values).toEqual([2, 0]);
    expect(s.series.find((x: any) => x.label === 'closed').values).toEqual([0, 1]);
  });

  /**
   * @description Deselected columns and the disabled overall trend are left out.
   * @input  deselect 'price'; toggleShowOverallTrend(unchecked)
   * @output no metricTrend 'price', no overallTrend
   */
  it('omits deselected columns and the overall trend', async () => {
    setColumns();
    await generate();
    component.toggleColumn('price', { target: { checked: false } } as any);
    component.toggleShowOverallTrend({ target: { checked: false } } as any);
    expect(section('metricTrend', 'price')).toBeUndefined();
    expect(section('overallTrend')).toBeUndefined();
  });

  /**
   * @description Nothing is generated without a selected column.
   * @input  toggleSelectAllColumns() (all → none); generateReport()
   * @output canGenerate false; getCollection not called
   */
  it('cannot generate without columns', async () => {
    setColumns();
    component.toggleSelectAllColumns();
    expect(component.canGenerate).toBeFalse();
    await component.generateReport();
    expect((ctx.dataHandler as any).getCollection).not.toHaveBeenCalled();
  });

  /**
   * @description Every generated report is written to the audit log.
   * @input  generateReport() for 4 rows
   * @output POST 'web/logs' with event_type 'generate_report', module 'core/orders', user from the session
   */
  it('logs the generated report', async () => {
    setColumns();
    await generate();
    const [url, body] = (ctx.dataHandler as any).post.calls.mostRecent().args;
    expect(url).toBe('web/logs');
    expect(body).toEqual(jasmine.objectContaining({ event_type: 'generate_report', module: 'core/orders', user_id_plain: '1' }));
  });

  /**
   * @description The period label shows the generated range or "all".
   * @input  no dates; then dateFrom only
   * @output 'graph-builder.period_all'; '2026-01-01 – graph-builder.period_end_fallback'
   */
  it('periodLabel describes the generated range', async () => {
    setColumns();
    await generate();
    expect(component.periodLabel).toBe('graph-builder.period_all');
    component.dateFrom = '2026-01-01';
    await generate();
    expect(component.periodLabel).toBe('2026-01-01 – graph-builder.period_end_fallback');
  });

  /**
   * @description Section titles use the translated templates.
   * @input  title_distribution 'Distribution {label}'
   * @output 'Distribution Status'
   */
  it('builds section titles', async () => {
    ctx.i18n.getValue.and.callFake((p: string) => (p === 'graph-builder.title_distribution' ? 'Distribution {label}' : p));
    setColumns();
    await generate();
    const descriptor = component.reportSections.find(s => s.kind === 'distribution')!;
    expect(component.sectionTitle(descriptor)).toBe('Distribution Status');
  });

  /**
   * @description The popup closes on overlay click but not during a PDF export; destroy unlocks scroll.
   * @input  onOverlayMouseDown(overlay); isExportingPdf true → onClose(); ngOnDestroy()
   * @output closed emitted once; scrollLock.unlock() called
   */
  it('closing rules and scroll unlock', () => {
    let closed = 0;
    component.closed.subscribe(() => closed++);
    const overlay = {};
    component.onOverlayMouseDown({ target: overlay, currentTarget: overlay } as any);
    component.isExportingPdf = true;
    component.onClose();
    component.ngOnDestroy();
    expect(closed).toBe(1);
    expect(scrollLock.unlock).toHaveBeenCalled();
  });
  /** Renders the popup and waits until Chart.js drew every section. */
  const renderAll = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await (component as any).renderCharts();
    (component as any).chartInstances.forEach((chart: any) => chart.draw());
  };

  /**
   * @description Every section kind is drawn with Chart.js: bar / pie (outside labels plugin) /
   *   doughnut / radar / polarArea distributions, category trend, metric bar + line, overall trend.
   * @input status in each distribution mode, status2 as trend, price as bar metric; rendered popup.
   * @output One chart per section with the matching type; pie gets the outsideLabels plugin and padding;
   *   charts destroyed and recreated on the next render and on destroy.
   */
  it('draws every section with Chart.js', async () => {
    const cols: any[] = [
      ...['bar', 'pie', 'doughnut', 'radar', 'polarArea'].map(mode => ({ key: `s_${mode}`, label: mode, aggregation: 'count', mode })),
      { key: 'status', label: 'Status', aggregation: 'count', mode: 'trend' },
      { key: 'price', label: 'Price', aggregation: 'sum' },
      { key: 'score', label: 'Score', aggregation: 'avg' }
    ];
    setColumns(cols);
    cols.filter(c => c.mode).forEach(c => component.setColumnChartMode(c.key, c.mode));
    component.setMetricChartMode('price', 'bar');
    const data = rows.map(r => ({ ...r, s_bar: r.status, s_pie: r.status, s_doughnut: r.status, s_radar: r.status, s_polarArea: r.status }));
    await generate(data);
    await renderAll();

    const charts = (component as any).chartInstances as any[];
    expect(charts.map(c => c.config.type)).toEqual(['bar', 'pie', 'doughnut', 'radar', 'polarArea', 'line', 'bar', 'line', 'line']);
    const pie = charts[1];
    expect(pie.config.options.plugins.outsideLabels.enabled).toBeTrue();
    expect(pie.config.plugins.map((pl: any) => pl.id)).toEqual(['outsideLabels']);
    expect(charts[4].config.data.datasets[0].backgroundColor[0]).toMatch(/^rgba\(/);
    expect(charts[3].config.options.scales.r).toBeDefined();
    expect(charts[0].config.options.scales.y.beginAtZero).toBeTrue();

    const destroy = spyOn(charts[0], 'destroy').and.callThrough();
    await (component as any).renderCharts();
    expect(destroy).toHaveBeenCalled();
    component.ngOnDestroy();
    expect((component as any).chartInstances.length).toBe(0);
  });

  /**
   * @description Sidebar actions rebuild the generated report: column toggle / select-all,
   *   chart modes, overall trend, value filter panel and its select-all.
   * @input Generated report; each toggle once.
   * @output Sections / selection follow; panel open state; values deselected → summary meta line.
   */
  it('rebuilds the report from the sidebar settings', async () => {
    setColumns();
    await generate();
    component.toggleColumn('price', { target: { checked: false } } as any);
    expect(component.reportSections.some(s => s.kind === 'metricTrend' && (s.section as any).columnKey === 'price')).toBeFalse();
    expect(component.isAllColumnsSelected).toBeFalse();
    component.toggleSelectAllColumns();
    expect(component.isAllColumnsSelected).toBeTrue();
    component.toggleSelectAllColumns();
    expect(component.selectedColumnKeys.size).toBe(0);
    expect(component.selectedColumnSummary).toBe('—');
    component.toggleSelectAllColumns();
    component.toggleColumn('price', { target: { checked: true } } as any);

    component.toggleShowOverallTrend({ target: { checked: false } } as any);
    expect(component.reportSections.some(s => s.kind === 'overallTrend')).toBeFalse();

    expect(component.isValueFilterExpanded('status')).toBeFalse();
    component.toggleValueFilterPanel('status');
    expect(component.isValueFilterExpanded('status')).toBeTrue();
    component.toggleValueFilterPanel('status');
    expect(component.isValueFilterExpanded('status')).toBeFalse();

    expect(component.isAllColumnValuesSelected('status')).toBeTrue();
    component.toggleAllColumnValues('status');
    expect(component.isAllColumnValuesSelected('status')).toBeFalse();
    expect(component.reportMetaLines.some(l => l.startsWith('graph-builder.meta_excluded_values'))).toBeTrue();
    component.toggleAllColumnValues('status');
    expect(component.isAllColumnValuesSelected('status')).toBeTrue();
    expect(component.isAllColumnValuesSelected('nope')).toBeFalse();
    expect(component.isColumnValueSelected('nope', 'x')).toBeTrue();
    component.toggleColumnValue('nope', 'x', { target: { checked: true } } as any);
    expect(component.isColumnValueSelected('nope', 'x')).toBeTrue();

    expect(component.aggregationLabel('count')).toBe('graph-builder.agg_count');
    expect(component.aggregationLabel('sum')).toBe('graph-builder.agg_sum');
    expect(component.aggregationLabel('avg')).toBe('graph-builder.agg_avg');
  });

  /**
   * @description Texts of the report: descriptions of every section kind, legend only for the
   *   category trend, title and meta lines, setting a mode before generation does not rebuild.
   * @input Generated report with status as trend.
   * @output desc_* keys; legend items with counts; title 'prefix — Orders'; 4 meta lines.
   */
  it('describes the sections and the report', async () => {
    setColumns();
    component.setColumnChartMode('status', 'trend');
    component.setMetricChartMode('price', 'bar');
    component.toggleShowOverallTrend({ target: { checked: true } } as any);
    expect(component.reportSections).toEqual([]);
    await generate();
    const kinds = component.reportSections.map(d => d.kind);
    expect(kinds).toEqual(['categoryTrend', 'metricTrend', 'metricTrend', 'overallTrend']);
    expect(component.reportSections.map(d => component.sectionDescription(d))).toEqual([
      'graph-builder.desc_category_trend', 'graph-builder.desc_metric_trend', 'graph-builder.desc_metric_trend', 'graph-builder.desc_overall_trend'
    ]);
    expect(component.sectionTitle(component.reportSections[2])).toBe('graph-builder.title_metric_trend');
    expect(component.sectionTitle(component.reportSections[3])).toBe('graph-builder.title_overall_trend');
    expect(component.legendItemsFor(component.reportSections[0])!.map(i => i.label)).toEqual(['open (2×)', 'closed (1×)', 'graph-builder.unfilled_value_label (1×)']);
    expect(component.legendItemsFor(component.reportSections[1])).toBeNull();

    component.setColumnChartMode('status', 'bar');
    expect(component.sectionDescription(component.reportSections[0])).toBe('graph-builder.desc_distribution');
    expect(component.reportTitle).toBe('graph-builder.report_title_prefix — Orders');
    expect(component.reportMetaLines.length).toBe(4);
    expect(component.selectedColumnSummary).toContain('Status (');
    component.tableCaption = undefined;
    expect(component.reportTitle).toContain('core/orders');
  });

  /**
   * @description Load errors leave no report; a non-array answer counts as no rows; no rows
   *   without dates → one-day range; both dates given → their range decides the granularity.
   * @input getCollection error; {} answer; rows without dates; dateFrom/dateTo 2026-01-01..2026-12-31.
   * @output reportGenerated false + loading false; 0 rows; granularity 'day'; 'month'.
   */
  it('handles load errors and unusual data', async () => {
    setColumns();
    (ctx.dataHandler as any).getCollection.and.returnValue(throwError(() => new Error('x')));
    await component.generateReport();
    expect(component.reportGenerated).toBeFalse();
    expect(component.isLoading).toBeFalse();

    await generate({} as any);
    expect(component.lastRowCount).toBe(0);
    await generate([{ status: 'a' }, { status: 'b', created_at: 'not a date' }]);
    expect(component.trendGranularityLabel).toBe('graph-builder.granularity_day');
    component.dateFrom = '2026-01-01';
    component.dateTo = '2026-12-31';
    await generate();
    expect(component.trendGranularityLabel).toBe('graph-builder.granularity_month');
    expect(component.periodLabel).toBe('2026-01-01 – 2026-12-31');
  });

  /**
   * @description PDF export: nothing before a report; rendered report → html2canvas + jsPDF,
   *   file name with the range, audit log 'export_report_pdf'; a failure shows the error alert.
   * @input exportToPdf() before generation; after render (save spied); addImage throwing.
   * @output no save; save('report-orders-2026-01-01_az_….pdf') + log; alert export_error_*.
   */
  it('exports the report as PDF', async () => {
    setColumns();
    await component.exportToPdf();
    // jsPDF.save() is created per instance and downloads through an <a download> click
    const downloads: string[] = [];
    spyOn(HTMLAnchorElement.prototype, 'dispatchEvent').and.callFake(function (this: HTMLAnchorElement) { downloads.push(this.download); return true; });
    spyOn(URL, 'createObjectURL').and.returnValue('blob:test');
    component.dateFrom = '2026-01-01';
    await generate();
    await component.exportToPdf();
    expect(downloads).toEqual([]);

    await renderAll();
    await component.exportToPdf();
    await new Promise(resolve => setTimeout(resolve, 20));  // FileSaver clicks the link in a timeout
    expect(downloads).toEqual(['report-orders-2026-01-01_az_graph-builder.filename_end_fallback.pdf']);
    expect((ctx.dataHandler as any).post.calls.mostRecent().args[1].event_type).toBe('export_report_pdf');
    expect(component.isExportingPdf).toBeFalse();

    spyOn(jsPDF.API as any, 'addImage').and.throwError('canvas');
    await component.exportToPdf();
    expect(ctx.alert.open).toHaveBeenCalledWith('graph-builder.export_error_title', 'graph-builder.export_error_message', 'danger');
    component.ngOnDestroy();
  }, 20000);
  /**
   * @description Trend with more than 8 categories folds the rest into "other" (respecting the
   *   value filter); possible values without rows are listed with count 0.
   * @input 10 categories c0..c9 (one row each) + possibleValues ['zero']; c9 deselected.
   * @output 8 series (7 + other); other counts c7, c8 only (c9 filtered, zero has no rows); 'zero' in the catalog with 0.
   */
  it('folds trend categories into "other"', async () => {
    setColumns([{ key: 'cat', label: 'Cat', aggregation: 'count', possibleValues: ['zero'] } as any]);
    component.setColumnChartMode('cat', 'trend');
    await generate(Array.from({ length: 10 }, (_, i) => ({ created_at: '2026-01-05', cat: `c${i}` })));
    expect(component.columnValueCatalog.get('cat')!.find(e => e.value === 'zero')!.count).toBe(0);
    component.toggleColumnValue('cat', 'c9', { target: { checked: false } } as any);
    const trend = section('categoryTrend', 'cat');
    expect(trend.series.length).toBe(8);
    expect(trend.series[7].label).toBe('graph-builder.other_category_label');
    expect(trend.series[7].values).toEqual([2]);
  });
});
