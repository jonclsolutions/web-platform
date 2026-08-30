/**
 * @file security-events.component.ts
 * @path src/app/admin/core-pages/security-events/security-events.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Admin stránka bezpečnostního monitoringu (core_security_events) - tabulka
 * podezřelých eventů (captcha, throttle, brute-force login, scanning...) s triage (změna
 * stavu + poznámka), jednoduchý graf objemu za posledních N dní, a nastavení retenční
 * doby (GDPR úklid) s možností okamžitého ručního purge.
 *
 * @dependencies
 * - BaseDataComponent: Standardní CRUD/stránkování pro `core/security_events` (tabulka).
 * - TableBuilderComponent: Renderuje tabulku, řeší row-level delete (confirm dialog
 *   zabudovaný přímo v komponentě) a export - export tlačítko v toolbaru deleguje na
 *   `#activeTable` referenci stejně jako business-logs.component.ts.
 * - ConfirmDialogService: Potvrzení PŘED destruktivním purge (hromadné mazání starých
 *   záznamů) - viz `purgeOldEvents()`. Řádkové mazání jednoho záznamu potvrzuje samo
 *   TableBuilderComponent stejným mechanismem.
 * - AlertDialogService: Zpětná vazba (úspěch/chyba) pro triage, purge i uložení retence.
 *
 * @note Nastavení retence, graf a ruční purge jsou samostatné (nestránkované) endpointy
 * mimo `apiEndpoint` a volají se přímo přes `DataHandler` - stejný vzor jako
 * `WebSettingsComponent`, který pro sub-resources (`legal/config/*`, `languages/*`)
 * taky nepoužívá `BaseDataComponent` CRUD helpery, jen je používá pro hlavní stránkovanou
 * entitu (zde tabulku eventů).
 *
 * @bugfix-note (2026-08-22) OPRAVA TŘÍ CHYB PROTI SKUTEČNÉMU `DataHandler`:
 * 1) `DataHandler.delete(apiUrl: string): Observable<void>` NEMÁ generický parametr -
 *    volání `this.dataHandler.delete<any>(...)` byla chyba kompilace TypeScriptu
 *    ("Expected 0 type arguments"). Opraveno na `delete(...)` bez generika, s `any`
 *    typováním přímo na parametru callbacku.
 * 2) Export v toolbaru byl NEFUNKČNÍ prázdný stub - chyběl `@ViewChild('activeTable')`
 *    (business-logs.component.ts ho má, tahle komponenta ho ztratila při psaní).
 *    Doplněno stejně jako v business-logs.component.ts.
 * 3) `saveRetention()` měl chybnou prioritu operátorů `??`/`?:`
 *    (`a ?? b ? c : d` se vyhodnotí jako `(a ?? b) ? c : d`, ne jak bylo zamýšleno) -
 *    přepsáno na explicitní vnořený ternární výraz.
 * 4) Chyběl sdílený `../default-style.css` ve `styleUrls` (byl jen vlastní
 *    `security-events.component.css`) - bez něj neexistuje `.filter-side-panel`
 *    skrývací/collapsed styl a filtr formulář se renderoval trvale rozbalený místo
 *    skrytého za toolbar tlačítkem "Filtry", jako u všech ostatních tabulkových
 *    stránek (business-logs, user-request, ...). Opraveno na
 *    `styleUrls: ['../default-style.css', './security-events.component.css']` -
 *    stejný vzor jako `UserRequestComponent`.
 *
 * @refactor-note (2026-08-22v2) UX PŘIPOMÍNKY Z REVIEW:
 * 1) Emoji odstraněna. Tlačítka renderovaná přes sdílené `TableButtons`/`Button`
 *    objekty (řádkové akce, toolbar) dostala prostý text - tyhle komponenty dělají
 *    plain-text interpolaci `{{ button.display_name }}`, ne HTML render, takže vložení
 *    SVG markupu jako stringu by se vypsalo doslovně jako text, ne jako ikona. Naproti
 *    tomu prvky přímo v `security-events.component.html` (hlavičky karet, tlačítka
 *    Uložit/Vyčistit, zavírací tlačítko modalu) mají SKUTEČNÉ inline SVG ikony, stejný
 *    styl jako zbytek admin systému (`admin-layout.component.html`).
 * 2) MINIMÁLNÍ VIDITELNOST SEGMENTU V GRAFU: při vysokém nepoměru (např. 2 kritické
 *    vs. 188 informativních eventů týž den) by kritický segment vyšel na zlomek
 *    pixelu a byl by fakticky neviditelný - viditelnost kritické aktivity je přitom
 *    ten nejdůležitější signál celého grafu. `computeSegmentHeights()` proto vynutí
 *    minimální podíl (`MIN_SEGMENT_SHARE`) pro každou kategorii s alespoň 1 výskytem,
 *    ukrojený z podílu dominantní kategorie - CELKOVÁ výška sloupce (odpovídající
 *    objemu dne vůči nejrušnějšímu dni v grafu) zůstává přesná, mění se jen VNITŘNÍ
 *    rozvržení segmentů uvnitř sloupce.
 * 3) HOVER TOOLTIP S PŘESNÝM ROZPISEM: nahrazen prohlížečový `[title]` (jedna řádka,
 *    žádné formátování) vlastním popupem s rozpisem info/warning/critical/celkem pro
 *    daný den - viz `.sec-chart-tooltip` v CSS.
 *
 * @refactor-note (2026-08-22v3) DALŠÍ UX PŘIPOMÍNKY:
 * 1) TOOLTIP PŘETÉKAL MIMO OBRAZOVKU: čistě CSS `:hover` pozicování vždy NAD sloupcem
 *    nezohledňovalo, jestli je nad sloupcem dost místa (u grafů blízko horního okraje
 *    stránky se tak polovina tooltipu ořízla mimo viewport). Zjednodušeno na: tooltip
 *    se zobrazuje VŽDY POD sloupcem (viz CSS), `onChartColumnEnter()` už jen dopočítává
 *    horizontální zarovnání (na střed / doleva / doprava) podle skutečné pozice
 *    sloupce (`getBoundingClientRect()`), ať se ani u krajních sloupců tooltip
 *    neusekne o levý/pravý okraj obrazovky.
 * 2) BUG "0127" MÍSTO "127": `CoreSecurityEventController::stats()` vrací `SUM(occurrences)`
 *    přes MySQL/PDO, který tuhle agregační hodnotu často vrací jako STRING, ne číslo.
 *    `buildChartDays()` dělal `(entry[severity] || 0) + row.total` - v JavaScriptu je
 *    `0 + "127"` KONKATENACE ŘETĚZCŮ (`"0127"`), ne sčítání, protože `+` s operandem
 *    typu string vždy převede druhý operand na string. Opraveno explicitním
 *    `Number(row.total)` PŘED sčítáním - opraveno i na backendu (`CAST(...AS UNSIGNED)`
 *    v `CoreSecurityEventController::stats()`) pro jistotu na obou stranách.
 * 3) KLIK NA SLOUPEC GRAFU: `filterByChartDay()` otevře filtr panel a nastaví
 *    `date_from`/`date_to` na půlnoc až 23:59:59 daného dne, ať se tabulka okamžitě
 *    zúží na eventy z toho konkrétního dne (`last_seen_at` v backendovém `index()` filtru
 *    už tenhle rozsah podporoval, jen se dřív nedal snadno vyplnit jedním kliknutím).
 * 4) Odstraněna barevná změna pozadí sloupce při najetí myší (`.sec-chart-col:hover`) -
 *    ponechán jen `cursor: pointer` jako indikace klikatelnosti, bez vizuálního "blikání"
 *    pozadí, které při rychlém přejíždění myší mezi sloupci působilo rušivě.
 *
 * @bugfix-note (2026-08-22v4) Tlačítko "Aktualizovat" V TABULCE (ne v horním headeru)
 * nedělalo nic, beze zjevné chyby - `TableBuilderComponent.onRefreshClick()` pouze
 * emituje `refreshRequested` output, ale šablona `security-events.component.html` na
 * něj neměla navázaný žádný handler (na rozdíl od `business-logs`/`user-request`, kde
 * je `(refreshRequested)="forceFullRefresh(filters)"` standardní součástí). Doplněno,
 * spolu s `[lastUpdatedAt]` bindingem (badge "Aktualizováno v HH:MM:SS" v toolbaru
 * tabulky, dostupný zdarma přes zděděný `activeLastUpdatedAt$` getter z
 * BaseDataComponent).
 */

import { Component, ViewChild, ChangeDetectionStrategy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { TableBuilderComponent } from '../../components/builders/table-builder/table-builder.component';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import * as Config from './security-events.config';
import { GraphBuilderComponent } from '../../components/builders/graph-builder/graph-builder.component';
import { GraphColumnOption } from '../../../shared/interfaces/graph-format';

/** @description Tvar singleton nastavení retence vraceného `GET core/security_settings`. */
interface SecuritySetting {
  id: number;
  retention_days: number;
}

/** @description Jeden řádek agregovaných statistik z `GET core/security_events/stats`. */
interface SecurityStatRow {
  day: string;
  severity: 'info' | 'warning' | 'critical';
  total: number;
}

/** @description Přepočtené statistiky do podoby použitelné pro vykreslení sloupcového grafu (jeden den = jeden sloupec). */
interface ChartDay {
  day: string;
  info: number;
  warning: number;
  critical: number;
  total: number;
}

@Component({
  selector: 'app-core-security-events',
  standalone: true,
  imports: [CommonModule, FormsModule, SHARED_UI_BUILDERS,GraphBuilderComponent],
  templateUrl: './security-events.component.html',
  styleUrls: ['../default-style.css', './security-events.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SecurityEventsComponent extends BaseDataComponent<any> implements OnInit {
  @ViewChild('activeTable') activeTable!: TableBuilderComponent;

  override apiEndpoint: string = 'core/security_events';

  buttons = Config.BUTTONS;
  tableColumns = Config.TABLE_COLUMNS;
  filterColumns = Config.FILTER_COLUMNS;
  detailsColumns = Config.DETAILS_COLUMNS;
  /** @description Select mapování pro čitelné popisky event_type/severity/status v tabulce a exportu - viz Config.FORM_FIELDS. */
  formFields = Config.FORM_FIELDS;
  selectedItemForDetails: any | null = null;

  private confirmDialog = inject(ConfirmDialogService);

  filters: Core.FilterParams = {
    sort_by: 'last_seen_at',
    sort_direction: 'desc'
  };

  // ── Graf objemu za posledních N dní ──────────────────────────────────────
  statsLoading = true;
  statsDays = 14;
  chartDays: ChartDay[] = [];
  /** @description Maximum přes `total` všech dní - použito pro škálování výšky sloupců. */
  chartMaxTotal = 1;
  /**
   * @description Finální výšky segmentů (v % výšky grafu) PO vynucení minimální
   * viditelnosti - viz `computeSegmentHeights()`. Index odpovídá pořadí v `chartDays`.
   */
  chartSegments: { info: number; warning: number; critical: number }[] = [];

  /** @description Index dne v `chartDays`, nad kterým je aktuálně myš - null = žádný tooltip vidět. */
  hoveredChartIndex: number | null = null;
  /** @description Vypočteno při najetí myší podle skutečné pozice sloupce - viz `onChartColumnEnter()`. */
  tooltipHorizontal: 'left' | 'center' | 'right' = 'center';

  /**
   * @description Minimální podíl výšky SLOUPCE (ne celého grafu), který dostane
   * kategorie s alespoň 1 výskytem, i kdyby její skutečný podíl byl zanedbatelný -
   * viz refactor-note (2026-08-22v2) v hlavičce souboru.
   */
  private readonly MIN_SEGMENT_SHARE = 0.14;

  // ── Nastavení retence (core_security_settings) ───────────────────────────
  settingsLoading = true;
  settingsSaving = false;
  retentionDays: number = 90;

  // ── Ruční purge ───────────────────────────────────────────────────────────
  purging = false;

  // ── Triage modal (změna stavu + poznámka jednoho eventu) ─────────────────
  triageItem: any | null = null;
  triageStatus: string = 'new';
  triageNotes: string = '';
  triageSaving = false;

  readonly statusOptions = [
    { value: 'new', label: 'Nový' },
    { value: 'reviewed', label: 'Vyřešeno' },
    { value: 'false_positive', label: 'Falešný poplach' },
    { value: 'confirmed_attack', label: 'Potvrzený útok' },
  ];

  readonly retentionOptions = [7, 14, 30, 60, 90, 180, 365];
showGraphBuilder = false;
  readonly graphColumns: GraphColumnOption[] = Config.DETAILS_COLUMNS
     .filter(col => col.chartable === true)
     .map(col => ({
       key: col.key,
       label: col.displayName,
      aggregation: col.chartAggregation ?? 'count',
      possibleValues: col.chartPossibleValues
     }));
  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: Core.ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
    private router: Core.Router
  ) {
    super(dataHandler, cd, genericTableService);
  }

  get toolbarButtons(): Core.Button[] {
    return Config.TOOLBAR_BUTTONS.map(btn => {
      const updatedBtn = { ...btn };
      if (btn.action === 'toggleFilters') {
        updatedBtn.label = this.isFilterVisible ? 'Skrýt' : 'Filtry';
        updatedBtn.isActive = this.isFilterVisible;
      }
      return updatedBtn;
    });
  }

  handleToolbarAction(action: string): void {
    const actions: { [key: string]: () => void } = {
      toggleFilters: () => this.toggleFilters(),
      openGraphBuilder: () => this.openGraphBuilder(),
      exportActiveTable: () => this.exportActiveTable(),
    };
    if (actions[action]) actions[action]();
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.initWithAuthCheck(this.router);
    this.loadStats();
    this.loadSettings();
  }

  override refreshData(): void {
    this.forceFullRefresh(this.filters);
  }

  applyFilters(newFilters: Core.FilterParams): void {
    this.filters = { ...this.filters, ...newFilters };
    this.currentPage = 1;
    this.refreshData();
  }

  clearFilters(): void {
    this.filters = { sort_by: 'last_seen_at', sort_direction: 'desc' };
    this.currentPage = 1;
    this.refreshData();
  }

  handlePageChange(page: number): void {
    this.onHandlePageChange(page, this.filters);
  }

  handleItemsPerPageChange(value: number): void {
    this.onHandleItemsPerPageChange(value, this.filters);
  }

  /**
   * @description Deleguje na TableBuilderComponent instanci - stejná implementace jako
   * business-logs.component.ts. Dřívější verze tohoto souboru měla toto tělo prázdné
   * (jen komentář), takže tlačítko "Export" v toolbaru fakticky nic nedělalo - viz
   * bugfix-note v hlavičce souboru.
   */
  exportActiveTable(): void {
    if (this.activeTable) this.activeTable.exportToCSV();
  }

  handleViewDetails(item: any): void {
    this.getItemDetails(item.id).subscribe({
      next: (details) => {
        this.selectedItemForDetails = details;
        this.showDetails = true;
        this.cd.markForCheck();
      },
      complete: () => this.cd.markForCheck(),
    });
  }

  handleCloseDetails(): void {
    this.selectedItemForDetails = null;
    this.showDetails = false;
    this.cd.markForCheck();
  }

  /**
   * @description Otevře triage modal pro daný řádek (tlačítko "Řešit" - action 'edit').
   * Předvyplní aktuální stav a poznámku záznamu.
   */
  handleEditTriage(item: any): void {
    this.triageItem = item;
    this.triageStatus = item.status || 'new';
    this.triageNotes = item.notes || '';
    this.cd.markForCheck();
  }

  /**
   * @description Konkrétní vysvětlení ("co se stalo" + doporučení) pro záznam právě
   * otevřený v triage modalu - dosazuje skutečná data (IP, endpoint, e-mail, počet
   * výskytů) do šablony podle typu eventu. Viz `Config.buildEventExplanation()`.
   */
  get triageExplanation(): { label: string; whatHappened: string; recommendation: string } | null {
    return this.triageItem ? Config.buildEventExplanation(this.triageItem) : null;
  }

  closeTriageModal(): void {
    if (this.triageSaving) return;
    this.triageItem = null;
    this.cd.markForCheck();
  }

  /**
   * @description Uloží triage rozhodnutí (stav + poznámka) přes standardní
   * `updateData()` (BaseDataComponent -> EntityCrudService -> DataHandler.put(), který
   * automaticky odbaluje `response.data` - viz bugfix-note u CoreSecurityEventController).
   * Změna na 'false_positive' se navíc potvrzuje dialogem, aby administrátor omylem
   * neoznačil skutečný útok jako neškodný jedním klikem.
   */
  async saveTriage(): Promise<void> {
    if (!this.triageItem || this.triageSaving) return;

    if (this.triageStatus === 'false_positive') {
      const confirmed = await this.confirmDialog.open(
        'Označit jako falešný poplach',
        'Opravdu chcete tento záznam označit jako falešný poplach? Přestane se počítat mezi aktivní podezřelou aktivitu.'
      );
      if (!confirmed) return;
    }

    this.triageSaving = true;
    this.cd.markForCheck();

    this.updateData(this.triageItem.id, {
      status: this.triageStatus,
      notes: this.triageNotes,
    } as any).subscribe({
      next: () => {
        this.triageSaving = false;
        this.triageItem = null;
        this.alertDialogService.open('Uloženo', 'Stav záznamu byl aktualizován.', 'success');
        this.refreshData();
      },
      error: (err: any) => {
        this.triageSaving = false;
        const msg = err?.error?.message ?? 'Uložení se nezdařilo.';
        this.alertDialogService.open('Chyba', String(msg), 'danger');
        this.cd.markForCheck();
      },
    });
  }

  /**
   * @description Načte agregovaná data pro graf objemu (posledních `statsDays` dní),
   * seskupená po dnech a rozdělená podle severity. `DataHandler.get<T>()` neodbaluje
   * nic (na rozdíl od `put`/`post`), takže `T` musí odpovídat PŘESNĚ tomu, co backend
   * vrací - zde `{data: SecurityStatRow[]}`, protože `CoreSecurityEventController::stats()`
   * vrací `response()->json(['data' => $rows])`.
   */
  private loadStats(): void {
    this.statsLoading = true;
    this.cd.markForCheck();

    this.dataHandler.get<{ data: SecurityStatRow[] }>(
      `core/security_events/stats?days=${this.statsDays}`
    ).subscribe({
      next: (res) => {
        this.chartDays = this.buildChartDays(res?.data ?? []);
        this.chartMaxTotal = Math.max(1, ...this.chartDays.map(d => d.total));
        this.chartSegments = this.chartDays.map(d => this.computeSegmentHeights(d));
        this.statsLoading = false;
        this.cd.markForCheck();
      },
      error: () => {
        this.chartDays = [];
        this.chartSegments = [];
        this.statsLoading = false;
        this.cd.markForCheck();
      },
    });
  }

  /**
   * @description Sestaví kompletní řadu dní (i ty bez jediného eventu, jako nulové
   * sloupce) za posledních `statsDays` dní, ať graf nemá "díry" v ose X.
   */
  private buildChartDays(rows: SecurityStatRow[]): ChartDay[] {
    const byDay = new Map<string, ChartDay>();

    for (let i = this.statsDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      byDay.set(key, { day: key, info: 0, warning: 0, critical: 0, total: 0 });
    }

    for (const row of rows) {
      const entry = byDay.get(row.day);
      if (!entry) continue;
      // Number() konverze je NUTNÁ - `row.total` může dorazit jako string (viz
      // bugfix-note v hlavičce souboru), a `0 + "127"` je v JS konkatenace řetězců
      // ("0127"), ne sčítání.
      const totalNum = Number(row.total) || 0;
      entry[row.severity] = (entry[row.severity] || 0) + totalNum;
      entry.total += totalNum;
    }

    return Array.from(byDay.values());
  }

  /** @description Šířka tooltipu použitá pro odhad, jestli se vejde na střed / musí se posunout doleva či doprava. */
  private static readonly TOOLTIP_ESTIMATED_WIDTH = 190;
  /** @description Bezpečnostní okraj od hrany obrazovky (px). */
  private static readonly TOOLTIP_VIEWPORT_MARGIN = 10;

  /**
   * @description Při najetí myší na sloupec grafu spočítá jeho skutečnou horizontální
   * pozici vůči viewportu a rozhodne, jestli tooltip zarovnat na střed sloupce, nebo
   * (u krajních sloupců) doleva/doprava, ať se vždy celý vejde na obrazovku. Tooltip se
   * zobrazuje vždy POD sloupcem (viz CSS `.sec-chart-tooltip`) - nahoře by mohl
   * zasahovat mimo horní okraj obrazovky u grafů blízko horního okraje stránky.
   */
  onChartColumnEnter(event: MouseEvent, index: number): void {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();

    const viewportWidth = window.innerWidth;
    const centerX = rect.left + rect.width / 2;
    const halfTooltip = SecurityEventsComponent.TOOLTIP_ESTIMATED_WIDTH / 2;
    const margin = SecurityEventsComponent.TOOLTIP_VIEWPORT_MARGIN;

    if (centerX - halfTooltip < margin) {
      this.tooltipHorizontal = 'left';
    } else if (centerX + halfTooltip > viewportWidth - margin) {
      this.tooltipHorizontal = 'right';
    } else {
      this.tooltipHorizontal = 'center';
    }

    this.hoveredChartIndex = index;
    this.cd.markForCheck();
  }

  onChartColumnLeave(): void {
    this.hoveredChartIndex = null;
    this.cd.markForCheck();
  }

  /**
   * @description Klik na sloupec grafu otevře filtr panel a rovnou zúží tabulku na
   * eventy z toho konkrétního dne (00:00:00 až 23:59:59), ať je vidět detail bez
   * ručního vyplňování filtru.
   * @param day Datum ve tvaru YYYY-MM-DD (klíč `ChartDay.day`).
   */
  filterByChartDay(day: string): void {
    this.filters = {
      ...this.filters,
      date_from: `${day} 00:00:00`,
      date_to: `${day} 23:59:59`,
    };
    this.isFilterVisible = true;
    this.currentPage = 1;
    this.refreshData();
    this.cd.markForCheck();
  }

  /** @description Formátuje ISO datum (YYYY-MM-DD) na krátký lidsky čitelný popisek dne pod sloupcem grafu. */
  formatChartDayLabel(day: string): string {
    const d = new Date(day + 'T00:00:00');
    return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' });
  }

  /** @description Plné datum pro nadpis hover tooltipu (např. "22. srpna 2026"). */
  formatChartDayLabelFull(day: string): string {
    const d = new Date(day + 'T00:00:00');
    return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  /**
   * @description Spočítá finální výšky tří segmentů jednoho sloupce (v % výšky
   * grafu), s vynucenou minimální viditelností pro každou kategorii s alespoň 1
   * výskytem - viz refactor-note (2026-08-22v2) v hlavičce souboru. CELKOVÁ výška
   * sloupce (`barHeightPercent`, poměr dne vůči nejrušnějšímu dni v grafu) zůstává
   * matematicky přesná - mění se jen to, jak se tahle výška rozdělí MEZI segmenty.
   */
  private computeSegmentHeights(day: ChartDay): { info: number; warning: number; critical: number } {
    const total = day.total;
    if (total <= 0 || this.chartMaxTotal <= 0) {
      return { info: 0, warning: 0, critical: 0 };
    }

    const barHeightPercent = (total / this.chartMaxTotal) * 100;
    const counts: Record<'info' | 'warning' | 'critical', number> = {
      info: day.info,
      warning: day.warning,
      critical: day.critical,
    };
    const keys: Array<'info' | 'warning' | 'critical'> = ['info', 'warning', 'critical'];

    const shares: Record<string, number> = {};
    keys.forEach(k => { shares[k] = counts[k] / total; });

    // Kategorie s alespoň 1 výskytem, jejichž přirozený podíl by byl vizuálně
    // zanedbatelný, dostanou vynucené minimum - jinak by např. 2 kritické eventy
    // vedle 188 informativních byly prakticky neviditelný proužek.
    const forced = keys.filter(k => counts[k] > 0 && shares[k] < this.MIN_SEGMENT_SHARE);
    const free = keys.filter(k => !forced.includes(k));
    const forcedTotal = forced.length * this.MIN_SEGMENT_SHARE;

    if (forcedTotal < 1) {
      const freeCountSum = free.reduce((sum, k) => sum + counts[k], 0);
      const remaining = 1 - forcedTotal;
      forced.forEach(k => { shares[k] = this.MIN_SEGMENT_SHARE; });
      free.forEach(k => {
        shares[k] = freeCountSum > 0 ? (counts[k] / freeCountSum) * remaining : 0;
      });
    }
    // else: extrémní okrajový případ (skoro všechny kategorie mají jen pár výskytů) -
    // ponechá se přirozený podíl, ať vynucená minima nepřetečou přes 100 %.

    return {
      info: shares['info'] * barHeightPercent,
      warning: shares['warning'] * barHeightPercent,
      critical: shares['critical'] * barHeightPercent,
    };
  }

  /**
   * @description Načte aktuální retenční nastavení. `CoreSecuritySettingController::show()`
   * vrací raw objekt (NEobalený v `data`), přesně jak `DataHandler.get<T>()` očekává.
   */
  private loadSettings(): void {
    this.settingsLoading = true;
    this.cd.markForCheck();

    this.dataHandler.get<SecuritySetting>('core/security_settings').subscribe({
      next: (res) => {
        this.retentionDays = res?.retention_days ?? 90;
        this.settingsLoading = false;
        this.cd.markForCheck();
      },
      error: () => {
        this.settingsLoading = false;
        this.cd.markForCheck();
      },
    });
  }

  /**
   * @description Uloží novou retenční dobu přes `DataHandler.put<T>()`, který
   * automaticky odbaluje `response.data` - `CoreSecuritySettingController::update()`
   * proto vrací `{data: $setting}` (viz bugfix-note v jeho hlavičce). Nedestruktivní
   * akce (samo o sobě nic nemaže), proto bez potvrzovacího dialogu, jen alert o výsledku.
   */
  saveRetention(): void {
    if (this.settingsSaving) return;
    this.settingsSaving = true;
    this.cd.markForCheck();

    this.dataHandler.put<SecuritySetting>('core/security_settings', {
      retention_days: this.retentionDays,
    } as any).subscribe({
      next: (res) => {
        this.retentionDays = res?.retention_days ?? this.retentionDays;
        this.settingsSaving = false;
        this.alertDialogService.open('Uloženo', 'Retenční doba byla aktualizována.', 'success');
        this.cd.markForCheck();
      },
      error: (err: any) => {
        this.settingsSaving = false;
        // Explicitní vnořený ternární výraz - `a ?? b ? c : d` by se kvůli prioritě
        // operátorů (`??` váže silněji než `?:`) vyhodnotilo jako `(a ?? b) ? c : d`,
        // což by při existujícím `message` chybně skočilo do větve `errors`.
        const msg = err?.error?.message
          ? err.error.message
          : err?.error?.errors
            ? Object.values(err.error.errors).flat().join(', ')
            : 'Uložení se nezdařilo.';
        this.alertDialogService.open('Chyba', String(msg), 'danger');
        this.cd.markForCheck();
      },
    });
  }

  /**
   * @description Okamžitý ruční purge všech záznamů starších než aktuální retenční
   * doba - DESTRUKTIVNÍ HROMADNÁ AKCE, proto vždy potvrzovaná dialogem PŘEDEM, ať
   * administrátor omylem nesmaže celou historii jedním klikem. Stejnou logiku (a
   * stejné cutoff datum) běží i automaticky jednou denně (PurgeSecurityEventsCommand).
   * @bugfix-note (2026-08-22) `DataHandler.delete()` NEMÁ generický parametr
   * (`delete(apiUrl: string): Observable<void>`) - `delete<any>(...)` byla chyba
   * kompilace. Odpověď backendu (`{message, deleted}`) se přesto v běhu přenese celá
   * (typování je jen na úrovni TypeScriptu), proto čteme `res.message` s `any` typem
   * přímo na parametru callbacku.
   */
  async purgeOldEvents(): Promise<void> {
    if (this.purging) return;

    const confirmed = await this.confirmDialog.open(
      'Vyčistit staré záznamy',
      `Opravdu chcete natrvalo smazat všechny bezpečnostní záznamy starší než ${this.retentionDays} dní? Tuto akci nelze vzít zpět.`
    );
    if (!confirmed) return;

    this.purging = true;
    this.cd.markForCheck();

    this.dataHandler.delete('core/security_events/purge').subscribe({
      next: (res: any) => {
        this.purging = false;
        this.alertDialogService.open(
          'Hotovo',
          res?.message ?? 'Staré záznamy byly smazány.',
          'success'
        );
        this.refreshData();
        this.loadStats();
      },
      error: (err: any) => {
        this.purging = false;
        const msg = err?.error?.message ?? 'Purge se nezdařil.';
        this.alertDialogService.open('Chyba', String(msg), 'danger');
        this.cd.markForCheck();
      },
    });
  }

  /**
   * @description Routuje akce z řádkových tlačítek TableBuilderComponent - 'edit'
   * (Řešit) otevírá triage modal místo standardního generického formuláře.
   */
  handleEditFormOpened(item: any): void {
    this.handleEditTriage(item);
  }

  /**
   * @description Po úspěšném smazání řádku (TableBuilderComponent vlastní confirm
   * dialog už proběhl a záznam odstranil lokálně) je potřeba jen dorovnat souhrnné
   * počty stránkování a graf, ne znovu potvrzovat.
   */
  handleItemDeleted(): void {
    this.refreshData();
    this.loadStats();
  }
    openGraphBuilder(): void {
    this.showGraphBuilder = true;
    this.cd.markForCheck();
  }

  closeGraphBuilder(): void {
    this.showGraphBuilder = false;
    this.cd.markForCheck();
  }
}