/**
 * @file import-popup-builder.component.ts
 * @path src/app/admin/components/builders/import-popup-builder/import-popup-builder.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Reusable import popup - the same role as `ExportPopupBuilderComponent`, for the
 * opposite direction (file -> database, append-only). Handles the whole flow: format choice,
 * download of the empty template, file upload, the dry-run summary (valid / invalid rows) and,
 * after confirmation, the real write (`core/import/commit`).
 *
 * @security The import is ALWAYS two-step (dry-run token -> commit) - the component never sends
 * the file twice, only the `import_token` returned by the validation (see `ImportController` on
 * the backend). The permission check (`-create` permission of the resource) and the column
 * whitelist are enforced only by the backend - this component is a presentation /
 * orchestration layer, like the export.
 *
 * @dependencies
 * - DataHandler: multipart upload (`upload()`) and JSON calls (`post()` / `get()`).
 * - HttpClient: direct call to download the template as a blob (DataHandler.get() has no
 *   responseType 'blob' variant - the same reason why the XLSX export of TableBuilderComponent
 *   calls SheetJS directly).
 * - ScrollLockService: Shared background scroll lock.
 * - AdminLocalizationService: Static i18n of the admin UI.
 */

import { Component, EventEmitter, Input, Output, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { DataHandler } from '../../../../core/services/data-handler.service';
import { AlertDialogService } from '../../../../core/services/alert-dialog.service';
import { ScrollLockService } from '../../../../core/services/scroll-lock.service';
import { AdminLocalizationService } from '../../../../core/services/admin-localization.service';
import { environment } from '../../../../../environments/environment';
import { ExportFormat, createExportFormatOptions, ExportFormatOption } from '../../../../shared/interfaces/export-format';
import { ImportEnumHint } from '../table-builder/table-builder.component';

/** @description One row of the error summary of the dry-run validation. */
interface ImportRowError {
  row: number;
  errors: Record<string, string[]>;
}

/** @description Response of `POST core/import/validate`. */
interface ImportValidateResponse {
  import_token: number;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  errors: ImportRowError[];
  can_commit: boolean;
}

/** @description Response of `POST core/import/commit` for synchronous (small) imports. */
interface ImportCommitResponse {
  queued: boolean;
  batch_id?: number;
  message?: string;
  imported_count?: number;
  skipped_count?: number;
  skip_reasons?: Record<number, string>;
}

type ImportStep = 'format' | 'upload' | 'summary' | 'done';

/**
 * @description Modal popup for a bulk append-only data import into any table registered in the
 * backend `config/importable_resources.php`.
 * @usage `<app-import-popup-builder [resource]="apiEndpoint" (imported)="onImported()" (closed)="onClose()" />`
 */
@Component({
  selector: 'app-import-popup-builder',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './import-popup-builder.component.html',
  styleUrl: './import-popup-builder.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImportPopupBuilderComponent implements OnInit, OnDestroy {
  /** @description Resource key - MUST match the `apiEndpoint` of the page and the key of the backend registry exactly. */
  @Input({ required: true }) resource!: string;

  @Output() imported = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();
@Input() enumHints: ImportEnumHint[] = [];
  private dataHandler = inject(DataHandler);
  private http = inject(HttpClient);
  private alertDialogService = inject(AlertDialogService);
  private cd = inject(ChangeDetectorRef);
  private scrollLock = inject(ScrollLockService);

  public readonly i18n = inject(AdminLocalizationService);
  public get strings(): any { return this.i18n.getMergedSection('import-popup'); }
  public t(key: string): string { return this.i18n.getValue(`import-popup.${key}`); }

  step: ImportStep = 'format';
  selectedFormat: ExportFormat | null = null;
  selectedFile: File | null = null;

  isDownloadingTemplate = false;
  isValidating = false;
  isCommitting = false;

  validation: ImportValidateResponse | null = null;
  commitResult: ImportCommitResponse | null = null;

  get formatOptions(): ExportFormatOption[] {
    return createExportFormatOptions(this.i18n).filter(opt => opt.value !== 'xlsx');
  }

  private readonly baseUrl = environment.base_api_url;

  constructor() {
    // After switching the admin language, forces the OnPush component to re-evaluate
    // `strings` / getters - same pattern as TableBuilderComponent / GraphBuilderComponent.
    this.i18n.translations$.pipe(takeUntilDestroyed()).subscribe(() => this.cd.markForCheck());
  }

  ngOnInit(): void {
    this.scrollLock.lock();
  }

  ngOnDestroy(): void {
    this.scrollLock.unlock();
  }

  // ── Step 1: format choice ────────────────────────────────────────────────

  selectFormat(format: ExportFormat): void {
    this.selectedFormat = format;
    this.step = 'upload';
  }

  backToFormat(): void {
    this.selectedFile = null;
    this.validation = null;
    this.step = 'format';
  }

  // ── Template ──────────────────────────────────────────────────────────────

  /**
   * @description Downloads an empty template with the correct headers. Calls `HttpClient`
   * directly (not `DataHandler`) because `responseType: 'blob'` is needed - the same reason as
   * the XLSX export of `TableBuilderComponent`.
   */
  downloadTemplate(): void {
    if (this.isDownloadingTemplate || !this.selectedFormat) return;
    this.isDownloadingTemplate = true;

    this.http.get(`${this.baseUrl}/${this.resource}/import/template`, {
      params: { format: this.selectedFormat! },
      responseType: 'blob',
    }).subscribe({
      next: (blob) => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `import-sablona-${this.resource.replace(/\//g, '-')}.${this.selectedFormat}`;
        link.click();
        URL.revokeObjectURL(link.href);
        this.isDownloadingTemplate = false;
        this.cd.markForCheck();
      },
      error: (err) => {
        this.isDownloadingTemplate = false;
        const msg = err?.status === 404
          ? this.t('template_not_configured')
          : this.t('template_download_failed');
        this.alertDialogService.open(this.t('error_title'), msg, 'danger');
        this.cd.markForCheck();
      }
    });
  }

  // ── Step 2: file choice + dry-run validation ────────────────────────────

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.selectedFile = file;
  }

  clearSelectedFile(): void {
    this.selectedFile = null;
  }

  /**
   * @description Sends the file to `core/import/validate` - writes NOTHING to the database, only
   * returns the summary and the `import_token` for the following `commit()`.
   */
  runValidation(): void {
    if (!this.selectedFile || !this.selectedFormat || this.isValidating) return;

    this.isValidating = true;

    const formData = new FormData();
    formData.append('format', this.selectedFormat!);
    formData.append('file', this.selectedFile, this.selectedFile.name);

    this.dataHandler.upload<ImportValidateResponse>(`${this.resource}/import/validate`, formData).subscribe({
      next: (res) => {
        this.validation = res;
        this.isValidating = false;
        this.step = 'summary';
        this.cd.markForCheck();
      },
      error: () => {
        // The error message is shown by DataHandler.handleError() (global alert),
        // here only the UI is unlocked again.
        this.isValidating = false;
        this.cd.markForCheck();
      }
    });
  }

  // ── Step 3: dry-run summary + write confirmation ───────────────────────────

  get hasErrors(): boolean {
    return (this.validation?.invalid_rows ?? 0) > 0;
  }

  /**
   * @description Confirms the write - sends only the `import_token` (the file is NOT sent again,
   * see the security note in the file header).
   */
  confirmCommit(): void {
    if (!this.validation || this.isCommitting) return;
    this.isCommitting = true;

    this.dataHandler.post<ImportCommitResponse>(`${this.resource}/import/commit`, {
      import_token: this.validation.import_token,
    }).subscribe({
      next: (res) => {
        this.commitResult = res;
        this.isCommitting = false;
        this.step = 'done';
        this.cd.markForCheck();

        if (!res.queued) {
          this.alertDialogService.open(
            this.t('import_done_title'),
            this.t('import_done_message')
              .replace('{imported}', String(res.imported_count))
              .replace('{skipped}', String(res.skipped_count)),
            'success'
          );
        } else {
          this.alertDialogService.open(this.t('import_queued_title'), res.message ?? this.t('import_queued_default_message'), 'success');
        }

        this.imported.emit();
      },
      error: () => {
        this.isCommitting = false;
        this.cd.markForCheck();
      }
    });
  }

  onOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  onClose(): void {
    if (this.isValidating || this.isCommitting) return;
    this.closed.emit();
  }
}