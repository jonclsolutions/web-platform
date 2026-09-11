/**
 * @file security-events.component.ts
 * @path src/app/admin/core-pages/security-events/security-events.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Admin stránka bezpečnostního monitoringu (core_security_events) - tabulka
 * podezřelých eventů s triage (změna stavu + poznámka), graf objemu za posledních N dní,
 * a nastavení retenční doby (GDPR úklid) s možností okamžitého ručního purge.
 * @dependencies
 * - BaseDataComponent: Standardní CRUD/stránkování pro `core/security_events`.
 * - ConfirmDialogService: Potvrzení PŘED destruktivním purge a před 'false_positive' triage.
 * - Config.create* factory functions: i18n-aware definitions - viz refactor-note
 *   (2026-09-08) níže.
 *
 * (Earlier bugfix-note 2026-08-31 for duplicate error toasts is unchanged.)
 *
 * @bugfix-note (2026-09-08) `toolbarButtons` getter NIKDY nekontroloval `btn.permission`
 * - `openGraphBuilder` tlačítko s `permission: 'core-security-view'` se tak
 * zobrazovalo i uživatelům bez tohoto práva. Doplněna stejná
 * `permissionService.hasPermission()` kontrola jako u ostatních stránek.
 *
 * @refactor-note (2026-09-08) BACKLOG "vícejazyčná administrace, žádné hardcoded texty":
 * `Config.*` konstanty nahrazeny `Config.create*()` factory funkcemi.
 * `readonly statusOptions` (dřív hardcoded) přepsáno na `Config.createStatusOptions(i18n)`,
 * přepočítávané ve stejném `translations$.subscribe()` bloku - sjednoceno s
 * FORM_FIELDS/FILTER_COLUMNS `status` hodnotami (viz config.ts hlavička).
 * `graphColumns` přestalo být `readonly`. `formatChartDayLabel()`/
 * `formatChartDayLabelFull()` respektují `i18n.getDateLocale()` místo natvrdo
 * `'cs-CZ'`. `triageExplanation` getter teď volá `Config.buildEventExplanation(item, this.i18n)`
 * (nová signatura vyžaduje i18n parametr).
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

interface SecuritySetting {
  id: number;
  retention_days: number;
}

interface SecurityStatRow {
  day: string;
  severity: 'info' | 'warning' | 'critical';
  total: number;
}

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
  imports: [CommonModule, FormsModule, SHARED_UI_BUILDERS, GraphBuilderComponent],
  templateUrl: './security-events.component.html',
  styleUrls: ['../default-style.css', './security-events.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SecurityEventsComponent extends BaseDataComponent<any> implements OnInit {
  @ViewChild('activeTable') activeTable!: TableBuilderComponent;

  protected override translationSection: string = 'security-events';

  public override t(key: string): string {
    return this.i18n.getValue(`security-events.${key}`);
  }

  tableCaption: string = '';

  override apiEndpoint: string = 'core/security_events';

  buttons: Core.TableButtons[] = [];
  tableColumns: Core.ColumnDefinition[] = [];
  filterColumns: Core.FilterColumns[] = [];
  detailsColumns: Core.ItemDetailsColumns[] = [];
  formFields: Core.InputDefinition[] = [];
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
  chartMaxTotal = 1;
  chartSegments: { info: number; warning: number; critical: number }[] = [];

  hoveredChartIndex: number | null = null;
  tooltipHorizontal: 'left' | 'center' | 'right' = 'center';

  private readonly MIN_SEGMENT_SHARE = 0.14;

  // ── Nastavení retence (core_security_settings) ───────────────────────────
  settingsLoading = true;
  settingsSaving = false;
  retentionDays: number = 90;

  // ── Ruční purge ───────────────────────────────────────────────────────────
  purging = false;

  // ── Triage modal ───────────────────────────────────────────────────────
  triageItem: any | null = null;
  triageStatus: string = 'new';
  triageNotes: string = '';
  triageSaving = false;

  /** @refactor-note (2026-09-08) Přestalo být `readonly` hardcoded pole - viz hlavička souboru. */
  statusOptions: { value: string; label: string }[] = [];

  readonly retentionOptions = [7, 14, 30, 60, 90, 180, 365];

  showGraphBuilder = false;

  /** @refactor-note (2026-09-08) Přestalo být `readonly` - přepočítáno v i18n subscribe. */
  graphColumns: GraphColumnOption[] = [];

  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: Core.ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
    private router: Core.Router
  ) {
    super(dataHandler, cd, genericTableService);

    this.i18n.translations$.subscribe(() => {
      this.tableCaption = this.t('table_header');
      this.buttons = Config.createButtons(this.i18n);
      this.tableColumns = Config.createTableColumns(this.i18n);
      this.filterColumns = Config.createFilterColumns(this.i18n);
      this.detailsColumns = Config.createDetailsColumns(this.i18n);
      this.formFields = Config.createFormFields(this.i18n);
      this.statusOptions = Config.createStatusOptions(this.i18n);
      this.graphColumns = this.detailsColumns
        .filter(col => col.chartable === true)
        .map(col => ({
          key: col.key,
          label: col.displayName,
          aggregation: col.chartAggregation ?? 'count',
          possibleValues: col.chartPossibleValues,
        }));
      this.cd.markForCheck();
    });
  }

  /**
   * @bugfix-note (2026-09-08) Doplněna `permission` kontrola - viz hlavička souboru.
   */
  get toolbarButtons(): Core.Button[] {
    return Config.createToolbarButtons(this.i18n).map(btn => {
      const updatedBtn = { ...btn };

      if (updatedBtn.permission && !this.permissionService.hasPermission(updatedBtn.permission)) {
        updatedBtn.showIf = false;
      }

      if (btn.action === 'toggleFilters') {
        updatedBtn.label = this.isFilterVisible ? this.t('toolbar_hide_filters') : this.t('toolbar_filters');
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

  handleEditTriage(item: any): void {
    this.triageItem = item;
    this.triageStatus = item.status || 'new';
    this.triageNotes = item.notes || '';
    this.cd.markForCheck();
  }

  /**
   * @refactor-note (2026-09-08) `Config.buildEventExplanation()` nyní vyžaduje `i18n`
   * parametr navíc - viz config.ts hlavička.
   */
  get triageExplanation(): { label: string; whatHappened: string; recommendation: string } | null {
    return this.triageItem ? Config.buildEventExplanation(this.triageItem, this.i18n) : null;
  }

  closeTriageModal(): void {
    if (this.triageSaving) return;
    this.triageItem = null;
    this.cd.markForCheck();
  }

  /**
   * @description Uloží triage rozhodnutí (stav + poznámka). Změna na
   * 'false_positive' se navíc potvrzuje dialogem.
   */
  async saveTriage(): Promise<void> {
    if (!this.triageItem || this.triageSaving) return;

    if (this.triageStatus === 'false_positive') {
      const confirmed = await this.confirmDialog.open(
        this.t('mark_false_positive_confirm_title'),
        this.t('mark_false_positive_confirm_message')
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
        this.alertDialogService.open(this.t('saved_title'), this.t('status_updated_message'), 'success');
        this.refreshData();
      },
      error: () => {
        this.triageSaving = false;
        this.cd.markForCheck();
      },
    });
  }

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
      const totalNum = Number(row.total) || 0;
      entry[row.severity] = (entry[row.severity] || 0) + totalNum;
      entry.total += totalNum;
    }

    return Array.from(byDay.values());
  }

  private static readonly TOOLTIP_ESTIMATED_WIDTH = 190;
  private static readonly TOOLTIP_VIEWPORT_MARGIN = 10;

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

  /** @refactor-note (2026-09-08) BUGFIX - natvrdo `'cs-CZ'` nahrazeno `this.i18n.getDateLocale()`. */
  formatChartDayLabel(day: string): string {
    const d = new Date(day + 'T00:00:00');
    return d.toLocaleDateString(this.i18n.getDateLocale(), { day: 'numeric', month: 'numeric' });
  }

  formatChartDayLabelFull(day: string): string {
    const d = new Date(day + 'T00:00:00');
    return d.toLocaleDateString(this.i18n.getDateLocale(), { day: 'numeric', month: 'long', year: 'numeric' });
  }

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

    return {
      info: shares['info'] * barHeightPercent,
      warning: shares['warning'] * barHeightPercent,
      critical: shares['critical'] * barHeightPercent,
    };
  }

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
        this.alertDialogService.open(this.t('saved_title'), this.t('retention_updated_message'), 'success');
        this.cd.markForCheck();
      },
      error: () => {
        this.settingsSaving = false;
        this.cd.markForCheck();
      },
    });
  }

  /**
   * @description Okamžitý ruční purge záznamů starších než retenční doba -
   * destruktivní hromadná akce, vždy potvrzovaná dialogem předem.
   */
  async purgeOldEvents(): Promise<void> {
    if (this.purging) return;

    const confirmed = await this.confirmDialog.open(
      this.t('purge_confirm_title'),
      this.t('purge_confirm_message').replace('{days}', String(this.retentionDays))
    );
    if (!confirmed) return;

    this.purging = true;
    this.cd.markForCheck();

    this.dataHandler.delete('core/security_events/purge').subscribe({
      next: (res: any) => {
        this.purging = false;
        this.alertDialogService.open(
          this.t('purge_done_title'),
          res?.message ?? this.t('purge_done_default_message'),
          'success'
        );
        this.refreshData();
        this.loadStats();
      },
      error: () => {
        this.purging = false;
        this.cd.markForCheck();
      },
    });
  }

  handleEditFormOpened(item: any): void {
    this.handleEditTriage(item);
  }

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