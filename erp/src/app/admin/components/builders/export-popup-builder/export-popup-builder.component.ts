/**
 * @file export-popup-builder.component.ts
 * @path src/app/admin/components/builders/export-popup-builder/export-popup-builder.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Reusable format-picker popup for table data export. Presents the
 * available export formats (CSV, XLSX, JSON, TXT) as selectable cards and emits the
 * user's choice back to the caller - contains no export logic itself (file building/
 * downloading stays in TableBuilderComponent, which already owns column/cell-value
 * resolution), so this component can be dropped into any table-based admin screen.
 * @dependencies
 * - CommonModule: @if/@for control flow.
 * - DomSanitizer: Safely renders inline SVG icons via [innerHTML].
 * - ScrollLockService: Shared background scroll lock.
 * - AdminLocalizationService: Static i18n of the admin UI.
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
 * @property rawFormat True when the admin checked "Export in raw format". Always `false` when
 * `showRawFormatOption` was not offered for the resource.
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
   * (processed, human-labelled) export, in display order. Empty (default) = column
   * picker section is not rendered at all.
   */
  @Input() columns: ExportColumnOption[] = [];
  /**
   * @description Subset of the columns the resource can take BACK through the import - offered
   * instead of `columns` once the admin checks "Export in raw format". An empty array = the raw
   * export would have nothing to export, `showRawFormatOption` should not be `true` then.
   */
  @Input() importableColumns: ExportColumnOption[] = [];
  /**
   * @description Whether to offer the "Export in raw format" toggle at all - only for resources
   * that also have an import (otherwise the export could not be imported back). The caller
   * (TableBuilderComponent) decides by whether `detailsColumns` has at least one column with
   * `importable: true`.
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
  /** @description State of the "Export in raw format" toggle. */
  rawFormat = false;

  private sanitizer = inject(DomSanitizer);
  private scrollLock = inject(ScrollLockService);

  private get formatOptions(): ExportFormatOption[] {
    return createExportFormatOptions(this.i18n);
  }

  /**
   * @description Merged `shared` + `export-popup` i18n section.
   * @note Type `any` on purpose - see `AdminLocalizationService.getMergedSection()`.
   */
  get strings(): any {
    return this.i18n.getMergedSection('export-popup');
  }

  /**
   * @description Subtitle with the interpolated record count - the only place of the component
   * that inserts a variable into an i18n text (`{count}`), done with a plain `.replace()` (same
   * pattern as `PersonalInfoComponent.security2faStatusMessage`).
   */
  get subtitleText(): string {
    return this.itemCount > 0
      ? this.strings.subtitle_with_count.replace('{count}', String(this.itemCount))
      : this.strings.subtitle_no_count;
  }
  /**
   * @description Source of the columns of the checkbox list - BY the CURRENT `rawFormat` state.
   * In raw mode only `importableColumns` are offered, otherwise the full `columns` list.
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
    // In raw mode XLSX is hidden - the import does not support it, a raw XLSX export
    // could not be imported back anyway.
    const allowed = this.rawFormat ? this.formats.filter(f => f !== 'xlsx') : this.formats;
    return this.formatOptions.filter(opt => allowed.includes(opt.value));
  }

  getIcon(svg: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  // ── Raw (import-compatible) format toggle ────────────────────

  /**
   * @description Switches between the standard and the raw export - the column selection is
   * reset to "all checked" from the newly active source (`columns` vs `importableColumns`), so
   * an old selection from the other list does not stay half applied.
   */
  toggleRawFormat(): void {
    this.rawFormat = !this.rawFormat;
    this.resetSelectionToActiveSource();
  }

  // ── Choice of the exported columns ───────────────────────────────────────────

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
   * @description Whether the format cards and the export are blocked - either the file is still
   * being generated, or the active column source is non-empty but the selection is empty (an
   * export with 0 columns makes no sense), or raw mode is on and `importableColumns` is empty
   * (should not happen when `showRawFormatOption` is set correctly, kept as a safety net).
   */
  get formatGridDisabled(): boolean {
    if (this.isExporting) return true;
    if (this.rawFormat && this.importableColumns.length === 0) return true;
    const source = this.activeColumnSource;
    return source.length > 0 && this.selectedColumnKeys.size === 0;
  }

  // ── Overlay / closing ────────────────────────────────────────────────

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