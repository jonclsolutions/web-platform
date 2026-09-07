/**
 * @file export-popup-builder.component.ts
 * @path src/app/admin/components/builders/export-popup-builder/export-popup-builder.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Reusable format-picker popup for table data export. Presents the
 * available export formats (CSV, XLSX, JSON, TXT) as selectable cards and emits the
 * user's choice back to the caller - contains no export logic itself (file building/
 * downloading stays in TableBuilderComponent, which already owns column/cell-value
 * resolution), so this component can be dropped into any table-based admin screen.
 * @dependencies
 * - CommonModule: @if/@for control flow.
 * - DomSanitizer: Safely renders inline SVG icons via [innerHTML].
 * - ScrollLockService: Sdílený zámek scrollu na pozadí (viz refactor-note 2026-08-31).
 * - AdminLocalizationService: Statické i18n admin UI.
 *
 * @refactor-note (2026-08-18) SLOUPCOVÝ VÝBĚR PŘI EXPORTU - viz backlog task "export:
 * uživatelský výběr sloupců přes checkboxy". Přidán `@Input() columns`.
 *
 * @refactor-note (2026-08-23) EXPORT V "SUROVÉM" (IMPORT-KOMPATIBILNÍM) FORMÁTU - viz
 * backlog task "raw_request_commissions: plně funkční bulk import/export/delete".
 * Přidán volitelný přepínač "Exportovat v surovém formátu" - dostupný jen pokud
 * caller předá `showRawFormatOption = true` (tj. daná tabulka má aspoň jeden sloupec
 * označený `importable: true` v `detailsColumns`, viz TableBuilderComponent).
 * V zapnutém stavu:
 * 1) Sloupcový checkbox seznam se přepne z PLNÉHO seznamu (`columns`) na podmnožinu
 *    `importableColumns` - jen sloupce, které daný resource umí přijmout zpátky přes
 *    import (syrové technické názvy sloupců jako hlavičky, ne české popisky).
 * 2) XLSX se z nabídky formátů SCHOVÁ - import aktuálně podporuje jen CSV/JSON/TXT
 *    (viz ImportFileParser), takže surový export do XLSX by stejně nešel zpětně
 *    naimportovat.
 * `ExportSelection` nese nové pole `rawFormat: boolean` - `TableBuilderComponent` podle
 * něj přepíná mezi zpracovaným (`getExportValueForKey`, české popisky) a syrovým
 * (`getRawExportValueForKey`, technické názvy sloupců, needitované hodnoty) exportem.
 *
 * @refactor-note (2026-08-31) SCROLL LOCK SJEDNOCEN - dřív vlastní statický
 * `scrollLockCount` + přímé `document.body.style.overflow`, teď deleguje na sdílený
 * `ScrollLockService` (stejný mechanismus jako u všech ostatních overlay komponent -
 * viz scroll-lock.service.ts).
 *
 * @refactor-note (2026-09) BACKLOG "vícejazyčná administrace, žádné hardcoded texty"
 * Ruční injection AdminLocalizationService + `strings`/`subtitleText` getter -
 * viz `{count}` interpolace v `subtitleText` (jediné místo v komponentě, kde i18n
 * text nese proměnnou).
 *
 * @refactor-note (2026-09v2) BACKLOG "žádný český fallback": `EXPORT_FORMAT_OPTIONS`
 * (statická konstanta) byla ODSTRANĚNA z export-format.ts. `private readonly
 * formatOptions` pole nahrazeno getterem volajícím `createExportFormatOptions
 * (this.i18n)` - viz export-format.ts refactor-note (2026-09v2).
 */

import { Component, EventEmitter, Input, Output, OnChanges, OnInit, OnDestroy, SimpleChanges, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ExportFormat, createExportFormatOptions, ExportFormatOption } from '../../../../shared/interfaces/export-format';
import { ScrollLockService } from '../../../../core/services/scroll-lock.service';
import { AdminLocalizationService } from '../../../../core/services/admin-localization.service';
/**
 * @description Minimal shape needed to render one row in the column-picker checklist -
 * intentionally NOT the full `ColumnDefinition` (this component has no reason to know
 * about `type`/`format`/`currencyCode` etc., only what to show and which key to report
 * back).
 */
export interface ExportColumnOption {
  key: string;
  label: string;
}

/**
 * @description Payload emitted by `formatSelected` once the admin picks a format.
 * @property columnKeys Keys of the columns the admin left checked, in the same order as
 * the active `columns` source (`columns` or, in raw mode, `importableColumns`) - or
 * `null` when this popup instance was never given any columns to pick from.
 * @property rawFormat True když admin zaškrtl "Exportovat v surovém formátu" - viz
 * refactor-note (2026-08-23) v hlavičce souboru. Vždy `false`, pokud `showRawFormatOption`
 * nebyl daný resource vůbec nabídnut.
 */
export interface ExportSelection {
  format: ExportFormat;
  columnKeys: string[] | null;
  rawFormat: boolean;
}

/**
 * @description Modal popup letting the admin pick a file format (and, optionally, which
 * columns to include, and whether to export in raw import-compatible form) before
 * exporting the currently loaded (unpaginated) table dataset.
 * @usage `<app-export-popup-builder [itemCount]="data.length" [isExporting]="isExporting"
 *          [columns]="exportableColumnOptions"
 *          [importableColumns]="importableColumnOptions"
 *          [showRawFormatOption]="hasImportableColumns"
 *          (formatSelected)="onFormat($event)" (closed)="onClose()" />`
 * @note Purely presentational regarding export logic - the parent table decides how each
 * format is actually generated and downloaded, and which raw data feeds the export; this
 * component only emits the admin's choice (format + selected column keys + raw mode flag).
 */
@Component({
  selector: 'app-export-popup-builder',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './export-popup-builder.component.html',
  styleUrl: './export-popup-builder.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExportPopupBuilderComponent implements OnChanges, OnInit, OnDestroy {
  /** Number of records that will be exported - shown for context, no functional effect. */
  @Input() itemCount: number = 0;
  /** Disables format buttons and shows a spinner while the parent is building the file. */
  @Input() isExporting: boolean = false;
  /** Which formats to offer - defaults to all four supported formats. */
  @Input() formats: ExportFormat[] = ['csv', 'xlsx', 'json', 'txt'];
  /**
   * @description Columns the admin may choose to include/exclude from the STANDARD
   * (zpracovaný, česky popsaný) export, in display order. Empty (default) = column
   * picker section is not rendered at all.
   */
  @Input() columns: ExportColumnOption[] = [];
  /**
   * @description Podmnožina sloupců, které resource umí přijmout ZPĚT přes import -
   * nabízí se místo `columns` v okamžiku, kdy admin zaškrtne "Exportovat v surovém
   * formátu". Prázdné pole = raw export by neměl co exportovat, `showRawFormatOption`
   * by v takovém případě neměl být `true` vůbec.
   */
  @Input() importableColumns: ExportColumnOption[] = [];
  /**
   * @description Zda vůbec nabídnout přepínač "Exportovat v surovém formátu" - má
   * smysl jen u resources, které mají hotový i import (jinak by export nikam zpátky
   * nešel naimportovat). Caller (TableBuilderComponent) tohle vyhodnocuje podle toho,
   * jestli `detailsColumns` obsahuje aspoň jeden sloupec s `importable: true`.
   */
  @Input() showRawFormatOption: boolean = false;

  @Output() formatSelected = new EventEmitter<ExportSelection>();
  @Output() closed = new EventEmitter<void>();

  /**
   * @description Keys of currently checked columns. Reset to "all checked" every time
   * a new active columns source arrives.
   */
  selectedColumnKeys = new Set<string>();

  public readonly i18n = inject(AdminLocalizationService);
  /** @description Stav přepínače "Exportovat v surovém formátu" - viz refactor-note (2026-08-23). */
  rawFormat = false;

  private sanitizer = inject(DomSanitizer);
  private scrollLock = inject(ScrollLockService);

  /**
   * @refactor-note (2026-09v2) `private readonly formatOptions` -> getter, ať se
   * `description` texty přepočítají po přepnutí admin jazyka; `EXPORT_FORMAT_OPTIONS`
   * (statický deprecated fallback) byl odstraněn z export-format.ts.
   */
  private get formatOptions(): ExportFormatOption[] {
    return createExportFormatOptions(this.i18n);
  }

  /**
   * @description Merged `shared` + `export-popup` i18n section - viz refactor-note
   * (2026-09) v hlavičce souboru.
   * @note Typ `any` záměrně - viz `AdminLocalizationService.getMergedSection()`.
   */
  get strings(): any {
    return this.i18n.getMergedSection('export-popup');
  }

  /**
   * @description Subtitle textu s interpolovaným počtem záznamů - jediné místo
   * v komponentě, kde se do i18n textu vkládá proměnná (`{count}`), řešeno prostým
   * `.replace()` (stejný vzor jako `PersonalInfoComponent.security2faStatusMessage`) -
   * jeden výskyt v celé komponentě nestojí za obecný templating engine.
   */
  get subtitleText(): string {
    return this.itemCount > 0
      ? this.strings.subtitle_with_count.replace('{count}', String(this.itemCount))
      : this.strings.subtitle_no_count;
  }
  /**
   * @description Zdroj sloupců pro checkbox seznam - PODLE AKTUÁLNÍHO stavu `rawFormat`.
   * V raw módu se nabízí jen `importableColumns`, jinak plný `columns` seznam.
   */
  get activeColumnSource(): ExportColumnOption[] {
    return this.rawFormat ? this.importableColumns : this.columns;
  }

  ngOnInit(): void {
    this.scrollLock.lock();
  }

  ngOnDestroy(): void {
    this.scrollLock.unlock();
  }

  /**
   * @bugfix-note (2026-08-18) KRITICKÝ BUG - VÝBĚR SLOUPCŮ SE IGNOROVAL - viz
   * TableBuilderComponent.exportableColumnOptions bugfix-note stejné datum (stabilní
   * property místo getteru, aby se `columns`/`importableColumns` reference neměnila
   * při každém CD průchodu). Reset proběhne JEN při reálné změně OBSAHU klíčů zdroje,
   * který je zrovna aktivní (`activeColumnSource`), ne mere reference change.
   */
  ngOnChanges(changes: SimpleChanges): void {
    const columnsChange = changes['columns'];
    const importableChange = changes['importableColumns'];
    if (!columnsChange && !importableChange) return;

    this.resetSelectionToActiveSource();
  }

  private resetSelectionToActiveSource(): void {
    this.selectedColumnKeys = new Set(this.activeColumnSource.map(c => c.key));
  }

  get visibleFormatOptions(): ExportFormatOption[] {
    // V raw módu se XLSX schovává - import ho nepodporuje, surový export do XLSX by
    // stejně nešel zpětně naimportovat (viz refactor-note 2026-08-23 v hlavičce souboru).
    const allowed = this.rawFormat ? this.formats.filter(f => f !== 'xlsx') : this.formats;
    return this.formatOptions.filter(opt => allowed.includes(opt.value));
  }

  getIcon(svg: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  // ── Přepínač surového (import-kompatibilního) formátu ────────────────────

  /**
   * @description Přepne mezi standardním a surovým exportem - při přepnutí se
   * checkbox výběr sloupců přenastaví na "vše zaškrtnuto" z nově aktivního zdroje
   * (`columns` vs `importableColumns`), ať staré zaškrtnutí z jiného seznamu
   * nezůstane matoucně "napůl" aplikované.
   */
  toggleRawFormat(): void {
    this.rawFormat = !this.rawFormat;
    this.resetSelectionToActiveSource();
  }

  // ── Výběr sloupců k exportu ───────────────────────────────────────────

  isColumnSelected(key: string): boolean {
    return this.selectedColumnKeys.has(key);
  }

  toggleColumn(key: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.selectedColumnKeys.add(key);
    } else {
      this.selectedColumnKeys.delete(key);
    }
  }

  get isAllColumnsSelected(): boolean {
    const source = this.activeColumnSource;
    return source.length > 0 && this.selectedColumnKeys.size === source.length;
  }

  toggleSelectAllColumns(): void {
    if (this.isAllColumnsSelected) {
      this.selectedColumnKeys.clear();
    } else {
      this.selectedColumnKeys = new Set(this.activeColumnSource.map(c => c.key));
    }
  }

  /**
   * @description Zda mají být formátové karty i export zablokované - buď se ještě
   * generuje soubor, nebo je aktivní zdroj sloupců neprázdný, ale výběr je prázdný
   * (export s 0 sloupci nemá smysl), nebo je zapnutý raw mód a `importableColumns`
   * je prázdné (nemělo by se to stát, pokud `showRawFormatOption` bylo nastavené
   * správně, ale kontrola tu je jako pojistka).
   */
  get formatGridDisabled(): boolean {
    if (this.isExporting) return true;
    if (this.rawFormat && this.importableColumns.length === 0) return true;
    const source = this.activeColumnSource;
    return source.length > 0 && this.selectedColumnKeys.size === 0;
  }

  // ── Overlay / zavírání ────────────────────────────────────────────────

  onOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  onClose(): void {
    if (this.isExporting) return;
    this.closed.emit();
  }

  onSelect(format: ExportFormat): void {
    if (this.formatGridDisabled) return;

    const source = this.activeColumnSource;
    const columnKeys = source.length > 0 ? Array.from(this.selectedColumnKeys) : null;
    this.formatSelected.emit({ format, columnKeys, rawFormat: this.rawFormat });
  }
}