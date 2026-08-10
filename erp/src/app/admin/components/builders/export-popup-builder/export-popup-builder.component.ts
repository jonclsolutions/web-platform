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
 */

import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ExportFormat, EXPORT_FORMAT_OPTIONS, ExportFormatOption } from '../../../../shared/interfaces/export-format';

/**
 * @description Modal popup letting the admin pick a file format before exporting the
 * currently loaded (unpaginated) table dataset.
 * @usage `<app-export-popup-builder [itemCount]="data.length" [isExporting]="isExporting"
 *          (formatSelected)="onFormat($event)" (closed)="onClose()" />`
 * @note Purely presentational regarding export logic - the parent table decides how each
 * format is actually generated and downloaded; this component only emits the choice.
 */
@Component({
  selector: 'app-export-popup-builder',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './export-popup-builder.component.html',
  styleUrl: './export-popup-builder.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExportPopupBuilderComponent {
  /** Number of records that will be exported - shown for context, no functional effect. */
  @Input() itemCount: number = 0;
  /** Disables format buttons and shows a spinner while the parent is building the file. */
  @Input() isExporting: boolean = false;
  /** Which formats to offer - defaults to all four supported formats. */
  @Input() formats: ExportFormat[] = ['csv', 'xlsx', 'json', 'txt'];

  @Output() formatSelected = new EventEmitter<ExportFormat>();
  @Output() closed = new EventEmitter<void>();

  private sanitizer = inject(DomSanitizer);
  private readonly formatOptions = EXPORT_FORMAT_OPTIONS;

  get visibleFormatOptions(): ExportFormatOption[] {
    return this.formatOptions.filter(opt => this.formats.includes(opt.value));
  }

  getIcon(svg: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

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
    if (this.isExporting) return;
    this.formatSelected.emit(format);
  }
}