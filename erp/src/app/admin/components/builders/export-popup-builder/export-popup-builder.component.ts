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
 *
 * @refactor-note (2026-08-18) SLOUPCOVÝ VÝBĚR PŘI EXPORTU - viz backlog task "export:
 * uživatelský výběr sloupců přes checkboxy". Přidán `@Input() columns` (jen `{key,
 * label}` páry, sestavené voláním komponentou z `ColumnDefinition[]` filtrovaných na
 * `exportable !== false` - viz `TableBuilderComponent.exportableColumnOptions` a
 * `ColumnDefinition.exportable` v generic-form-column-definiton.ts). Když je `columns`
 * neprázdné, nad formátovými kartami se zobrazí checkbox seznam (výchozí stav: VŠE
 * zaškrtnuto) + "Vybrat vše"/"Zrušit vše" přepínač. `formatSelected` output nyní
 * emituje `ExportSelection` (`{ format, columnKeys }`) místo prostého `ExportFormat` -
 * `columnKeys: null` značí "žádné omezení" (zpětně kompatibilní větev pro případ, že by
 * volající `columns` vůbec nepředal - komponenta se pak chová přesně jako předtím).
 * Formátové karty i "Zavřít"/"Zrušit" tlačítka se navíc zablokují, pokud je `columns`
 * neprázdné, ale výběr je prázdný (export s 0 sloupci nemá smysl) - viz
 * `formatGridDisabled` a `.export-columns-warning` v šabloně.
 */

import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ExportFormat, EXPORT_FORMAT_OPTIONS, ExportFormatOption } from '../../../../shared/interfaces/export-format';

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
 * the `columns` Input - or `null` when this popup instance was never given any columns
 * to pick from (`columns` empty), meaning "no restriction, export everything the caller
 * would export by default". Callers that don't care about column selection can safely
 * ignore this field's distinction and always export everything when it's `null`.
 */
export interface ExportSelection {
  format: ExportFormat;
  columnKeys: string[] | null;
}

/**
 * @description Modal popup letting the admin pick a file format (and, optionally, which
 * columns to include) before exporting the currently loaded (unpaginated) table dataset.
 * @usage `<app-export-popup-builder [itemCount]="data.length" [isExporting]="isExporting"
 *          [columns]="exportableColumnOptions"
 *          (formatSelected)="onFormat($event)" (closed)="onClose()" />`
 * @note Purely presentational regarding export logic - the parent table decides how each
 * format is actually generated and downloaded, and which raw data feeds the export; this
 * component only emits the admin's choice (format + selected column keys).
 */
@Component({
  selector: 'app-export-popup-builder',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './export-popup-builder.component.html',
  styleUrl: './export-popup-builder.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExportPopupBuilderComponent implements OnChanges {
  /** Number of records that will be exported - shown for context, no functional effect. */
  @Input() itemCount: number = 0;
  /** Disables format buttons and shows a spinner while the parent is building the file. */
  @Input() isExporting: boolean = false;
  /** Which formats to offer - defaults to all four supported formats. */
  @Input() formats: ExportFormat[] = ['csv', 'xlsx', 'json', 'txt'];
  /**
   * @description Columns the admin may choose to include/exclude from the export, in
   * display order. Empty (default) = column picker section is not rendered at all and
   * `formatSelected` emits `columnKeys: null` (pure backward-compatible behaviour).
   */
  @Input() columns: ExportColumnOption[] = [];

  @Output() formatSelected = new EventEmitter<ExportSelection>();
  @Output() closed = new EventEmitter<void>();

  /**
   * @description Keys of currently checked columns. Reset to "all checked" every time
   * a new `columns` array arrives (covers both the normal case - popup re-created fresh
   * on every open, since the parent renders it behind `@if` - and the defensive case of
   * the same instance receiving a different `columns` set later).
   */
  selectedColumnKeys = new Set<string>();

  private sanitizer = inject(DomSanitizer);
  private readonly formatOptions = EXPORT_FORMAT_OPTIONS;

  /**
   * @bugfix-note (2026-08-18) KRITICKÝ BUG - VÝBĚR SLOUPCŮ SE IGNOROVAL: dřív se tady
   * `selectedColumnKeys` resetoval NEPODMÍNĚNĚ pokaždé, když Angular vyhodnotil `columns`
   * Input jako "změněný" - a protože `TableBuilderComponent.exportableColumnOptions` byl
   * getter vracející PŘI KAŽDÉM CD PRŮCHODU novou instanci pole (stejný obsah, jiná
   * reference), stačilo zaškrtnout/odškrtnout JEDINÝ checkbox (což samo o sobě spustí CD
   * tick) a tenhle handler okamžitě vrátil výběr zpátky na "vše zaškrtnuto" - uživatel
   * tak fakticky nikdy nemohl nic reálně vyloučit z exportu. Primární oprava je v
   * `TableBuilderComponent` (`exportableColumnOptions` je teď stabilní property počítaná
   * jen JEDNOU při otevření popupu, ne getter). TOTO je druhá vrstva ochrany (defense in
   * depth): i kdyby `columns` dorazily s novou referencí, reset proběhne JEN pokud se
   * SKUTEČNĚ liší obsah (sada klíčů) oproti předchozí hodnotě - mere reference change se
   * signálem změny nepovažuje.
   */
  ngOnChanges(changes: SimpleChanges): void {
    const columnsChange = changes['columns'];
    if (!columnsChange) return;

    const previousKeys = ((columnsChange.previousValue as ExportColumnOption[] | undefined) ?? []).map(c => c.key);
    const currentKeys = this.columns.map(c => c.key);
    const sameKeys = previousKeys.length === currentKeys.length
      && previousKeys.every((key, i) => key === currentKeys[i]);

    if (columnsChange.firstChange || !sameKeys) {
      this.selectedColumnKeys = new Set(currentKeys);
    }
  }

  get visibleFormatOptions(): ExportFormatOption[] {
    return this.formatOptions.filter(opt => this.formats.includes(opt.value));
  }

  getIcon(svg: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(svg);
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
    return this.columns.length > 0 && this.selectedColumnKeys.size === this.columns.length;
  }

  toggleSelectAllColumns(): void {
    if (this.isAllColumnsSelected) {
      this.selectedColumnKeys.clear();
    } else {
      this.selectedColumnKeys = new Set(this.columns.map(c => c.key));
    }
  }

  /**
   * @description Zda mají být formátové karty i export zablokované, protože byl dán
   * výběr sloupců (`columns` neprázdné), ale admin momentálně nemá zaškrtnutý ani
   * jeden - export bez jediného sloupce by vyprodukoval nesmyslně prázdný soubor.
   * Tabulky, které `columns` vůbec nepředávají (`columns.length === 0`), tímto nejsou
   * nijak dotčené - pro ně žádný sloupcový výběr neexistuje.
   */
  get formatGridDisabled(): boolean {
    return this.isExporting || (this.columns.length > 0 && this.selectedColumnKeys.size === 0);
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

    const columnKeys = this.columns.length > 0 ? Array.from(this.selectedColumnKeys) : null;
    this.formatSelected.emit({ format, columnKeys });
  }
}