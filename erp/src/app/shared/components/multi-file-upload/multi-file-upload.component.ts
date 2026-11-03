/**
 * @file multi-file-upload.component.ts
 * @path src/app/shared/components/multi-file-upload/multi-file-upload.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Universal component for choosing several files (drag&drop and click) with a
 * client-side type / count / size check - only a UX aid, the real limit is always enforced by the
 * backend (App\Support\Uploads\AttachmentPolicy, published as `GET upload-rules`). Reusable in
 * public and admin forms.
 * @note The file picker offers every file (no `accept` filter - greyed-out files only confuse
 * users). With `allowedExtensions` a file of another type is refused right when it is chosen:
 * the error names the file and its extension and only then lists the allowed types.
 * @usage `<app-multi-file-upload (filesChanged)="onFilesChanged($event)" />`
 */

import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { extensionsLabel, fileExtension, isExtensionAllowed } from '../../utils/upload-rules';

/**
 * @description Minimal shape of an existing attachment needed for display - matches
 * `WebAttachmentResource` of the API, but the type is deliberately own (not an import of the
 * backend DTO), so the component stays independent of a specific resource.
 */
export interface ExistingAttachment {
  id: number;
  original_filename: string;
  size_bytes: number;
  download_url?: string | null;
  view_url?: string | null;
}

/**
 * @description Complete set of texts the component needs to render. The consumer (public and
 * admin) passes `Partial<MultiFileUploadTexts>` - anything missing is taken from
 * `DEFAULT_MULTI_FILE_UPLOAD_TEXTS`. Placeholders like `{name}` are replaced by the component
 * itself through `.replace()`, NEVER by the consumer - the consumer passes a template, not a
 * ready text (otherwise it would need internal details like `existingCount`).
 */
export interface MultiFileUploadTexts {
  /** Hint next to the label - {max} = maxFiles, {maxMb} = maxFileSizeMb, {totalMb} = maxTotalSizeMb */
  limitsHint: string;
  /** "Already uploaded attachments ({count})" - {count} = visibleExistingFiles.length */
  existingSectionTitle: string;
  /** title attribute of the "✕" button of an existing attachment */
  removeExistingTitle: string;
  /** Text inside the dropzone */
  dropzoneLabel: string;
  /** Error when the file COUNT limit is exceeded while some existing files exist -
   * {max} = maxFiles, {existing} = number of existing files */
  errorMaxFilesWithExisting: string;
  /** Error when the file COUNT limit is exceeded without existing files - {max} = maxFiles */
  errorMaxFiles: string;
  /** Error of a single file over the limit - {filename}, {maxMb} */
  errorFileTooLarge: string;
  /** Error of a file of a type that is not allowed - {filename}, {ext} (e.g. ".xml") */
  errorFileType: string;
  /** List of the allowed types under the label - {types} (e.g. "PDF, DOCX, PNG") */
  allowedTypesHint: string;
  /** Error of the total size over the limit - {maxMb} */
  errorTotalSizeExceeded: string;
  /** Counter at the bottom - {count} = combinedCount, {max} = maxFiles */
  totalLabel: string;
  /** Appended after totalLabel only when there are new files - {size} = totalSizeLabel */
  totalNewSuffix: string;
}

/**
 * @description Neutral English fallback texts - only for a consumer without `textOverrides`
 * (every current consumer passes its own translated set: admin form builder, contact, order form).
 */
export const DEFAULT_MULTI_FILE_UPLOAD_TEXTS: MultiFileUploadTexts = {
  limitsHint: '(max. {max} files, {maxMb} MB per file, {totalMb} MB in total)',
  existingSectionTitle: 'Uploaded attachments ({count})',
  removeExistingTitle: 'Remove attachment',
  dropzoneLabel: '↑ Choose files or drop them here',
  errorMaxFilesWithExisting: 'You can have at most {max} files (including {existing} already uploaded).',
  errorMaxFiles: 'You can upload at most {max} files.',
  errorFileTooLarge: 'The file "{filename}" exceeds the {maxMb} MB limit.',
  errorFileType: 'The file "{filename}" cannot be uploaded - the type {ext} is not allowed.',
  allowedTypesHint: 'Allowed types: {types}',
  errorTotalSizeExceeded: 'The attachments must not exceed {maxMb} MB in total.',
  totalLabel: 'Total: {count} / {max} files',
  totalNewSuffix: ' ({size} new)',
};

@Component({
  selector: 'app-multi-file-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './multi-file-upload.component.html',
  styleUrl: './multi-file-upload.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MultiFileUploadComponent {
  @Input() maxFiles = 10;
  @Input() maxFileSizeMb = 20;
  @Input() maxTotalSizeMb = 50;
  @Input() label = 'Attachments';

  /**
   * @description Allowed extensions (lower case, without the dot) - usually
   * `UploadRule.extensions` of UploadRulesService. Empty = no type check here (the API still
   * validates).
   */
  @Input() allowedExtensions: string[] = [];

  /**
   * @description Read-only attachments the record already has (from the API) - the component never
   * deletes them on the server itself, it only lets them be STAGED for removal in the view (see
   * `removeExistingFile()` / the `existingFileRemoved` output). Default `[]` = new record, no
   * existing attachments.
   */
  @Input() existingFiles: ExistingAttachment[] = [];

  /**
   * @description Texts of this component instance. Anything not filled in is taken from
   * `DEFAULT_MULTI_FILE_UPLOAD_TEXTS` (getter `t` below).
   */
  @Input() textOverrides: Partial<MultiFileUploadTexts> = {};

  @Output() filesChanged = new EventEmitter<File[]>();

  /**
   * @description Emits the current list of IDs of existing attachments marked for deletion (the
   * whole array, not only the new ID) - the consuming component keeps the list and sends it to
   * the server only when the form is really saved. Nothing is sent from here.
   */
  @Output() existingFileRemoved = new EventEmitter<number[]>();

  files: File[] = [];
  errorMessage: string | null = null;
  /** "Allowed types: …" shown under a type error only (null for every other error). */
  errorTypesHint: string | null = null;
  isDragging = false;

  /** IDs of existing attachments the user removed in the UI - local state only until saving. */
  removedExistingIds = new Set<number>();

  private cd = inject(ChangeDetectorRef);

  /**
   * @description Merged texts (defaults + `textOverrides`) - the only place the template and the
   * internal methods read UI texts from. Recomputed on every access (cheap, a spread of a small
   * object), so it reacts to `textOverrides` changed at runtime (e.g. switching the admin
   * language, see form-builder.component.ts).
   */
  get t(): MultiFileUploadTexts {
    // Missing / not yet translated keys (undefined) keep the default text.
    const overrides = Object.fromEntries(Object.entries(this.textOverrides ?? {}).filter(([, v]) => v != null && v !== ''));
    return { ...DEFAULT_MULTI_FILE_UPLOAD_TEXTS, ...overrides };
  }

  /** @description "Allowed types: PDF, DOCX, …" for the type error - empty when no list is known. */
  get allowedTypesText(): string {
    return this.allowedExtensions.length ? this.t.allowedTypesHint.replace('{types}', extensionsLabel(this.allowedExtensions)) : '';
  }

  /**
   * @description Hint next to the label with the limits filled in - see `t.limitsHint`.
   */
  get limitsHintText(): string {
    return this.t.limitsHint
      .replace('{max}', String(this.maxFiles))
      .replace('{maxMb}', String(this.maxFileSizeMb))
      .replace('{totalMb}', String(this.maxTotalSizeMb));
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.addFiles(Array.from(input.files));
      input.value = '';
    }
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
    if (event.dataTransfer?.files) {
      this.addFiles(Array.from(event.dataTransfer.files));
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = true;
  }

  onDragLeave(): void {
    this.isDragging = false;
  }

  /** @description Existing attachments the user has NOT marked for deletion (in the UI so far). */
  get visibleExistingFiles(): ExistingAttachment[] {
    return this.existingFiles.filter(f => !this.removedExistingIds.has(f.id));
  }

  /** @description "Already uploaded attachments (N)" with the count filled in - see `t.existingSectionTitle`. */
  get existingSectionTitleText(): string {
    return this.t.existingSectionTitle.replace('{count}', String(this.visibleExistingFiles.length));
  }

  /**
   * @description Staged removal of an existing attachment - no API call, only visual hiding +
   * recording the ID to be sent when the form is saved. Irreversible inside THIS component (no
   * "undo" button) - the only way back is closing the form without saving (Cancel), which
   * discards the whole component.
   */
  removeExistingFile(id: number): void {
    this.removedExistingIds.add(id);
    this.existingFileRemoved.emit(Array.from(this.removedExistingIds));
    this.cd.markForCheck();
  }

  private addFiles(newFiles: File[]): void {
    this.errorMessage = null;
    this.errorTypesHint = null;

    // Type first: a refused file must never reach the list, whatever its size.
    const wrongType = newFiles.find(f => !isExtensionAllowed(f.name, this.allowedExtensions));
    if (wrongType) {
      const ext = fileExtension(wrongType.name);
      this.errorMessage = this.t.errorFileType
        .replace('{filename}', wrongType.name)
        .replace('{ext}', ext ? '.' + ext : '?');
      this.errorTypesHint = this.allowedTypesText;
      this.cd.markForCheck();
      return;
    }
    const combined = [...this.files, ...newFiles];
    const existingCount = this.visibleExistingFiles.length;
    const totalCount = existingCount + combined.length;

    if (totalCount > this.maxFiles) {
      this.errorMessage = existingCount > 0
        ? this.t.errorMaxFilesWithExisting.replace('{max}', String(this.maxFiles)).replace('{existing}', String(existingCount))
        : this.t.errorMaxFiles.replace('{max}', String(this.maxFiles));
      this.cd.markForCheck();
      return;
    }

    const oversized = newFiles.find(f => f.size > this.maxFileSizeMb * 1024 * 1024);
    if (oversized) {
      this.errorMessage = this.t.errorFileTooLarge
        .replace('{filename}', oversized.name)
        .replace('{maxMb}', String(this.maxFileSizeMb));
      this.cd.markForCheck();
      return;
    }

    const totalSize = combined.reduce((sum, f) => sum + f.size, 0);
    if (totalSize > this.maxTotalSizeMb * 1024 * 1024) {
      this.errorMessage = this.t.errorTotalSizeExceeded.replace('{maxMb}', String(this.maxTotalSizeMb));
      this.cd.markForCheck();
      return;
    }

    this.files = combined;
    this.filesChanged.emit(this.files);
    this.cd.markForCheck();
  }

  removeFile(index: number): void {
    this.files = this.files.filter((_, i) => i !== index);
    this.errorMessage = null;
    this.errorTypesHint = null;
    this.filesChanged.emit(this.files);
    this.cd.markForCheck();
  }

  formatSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  get totalSizeLabel(): string {
    const total = this.files.reduce((sum, f) => sum + f.size, 0);
    return this.formatSize(total);
  }

  /** @description Total file count (not removed existing + newly chosen) - for the counter of the template. */
  get combinedCount(): number {
    return this.visibleExistingFiles.length + this.files.length;
  }

  /** @description "Total: N / max files (X MB new)" - see `t.totalLabel` / `t.totalNewSuffix`. */
  get totalLabelText(): string {
    const base = this.t.totalLabel.replace('{count}', String(this.combinedCount)).replace('{max}', String(this.maxFiles));
    const suffix = this.files.length > 0 ? this.t.totalNewSuffix.replace('{size}', this.totalSizeLabel) : '';
    return base + suffix;
  }
}