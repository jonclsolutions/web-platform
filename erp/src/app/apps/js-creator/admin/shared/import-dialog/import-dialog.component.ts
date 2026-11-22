/**
 * @file import-dialog.component.ts
 * @path src/app/apps/js-creator/admin/shared/import-dialog/import-dialog.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Popup importing a JSON file of an export of JS Creator (templates, blocks, sets
 *   with their images, icons and fonts) into the own workspace of a section. Only a .json file
 *   within the size of the upload profile `js_creator_import` is accepted; before sending, the
 *   browser checks that it is JSON of the format `js-creator` (fast answer for a wrong file);
 *   the API checks everything again and imports all or nothing. A refusal lists what is wrong
 *   (paths of the API); a success shows what was imported and which items got another name
 *   (` (2)` for a taken name) and emits `imported`.
 * @usage `@if (importing) { <app-jc-import-dialog section="images" (imported)="reload($event)" (dismissed)="importing = false" /> }`
 * @dependencies TransferApiService, WorkspaceUsageService, UploadRulesService, AdminModalComponent,
 *   AdminLocalizationService (section `js-creator-shared`).
 */

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { AdminLocalizationService } from '../../../../../core/services/admin-localization.service';
import { AdminModalComponent } from '../../../../../admin/components/admin-modal/admin-modal.component';
import { UploadRulesService } from '../../../../../shared/services/upload-rules.service';
import { UploadRule, isExtensionAllowed } from '../../../../../shared/utils/upload-rules';
import { TransferApiService } from '../transfer-api.service';
import { WorkspaceUsageService } from '../workspace-usage.service';
import { ImportSummary } from '../js-creator.models';
import { JsCreatorSectionId } from '../js-creator-sections';
import { formatBytes } from '../workspace-format';

/** Size limit before the rules are loaded (MB, the limit of the API). */
const DEFAULT_MAX_MB = 20;

/** Problem found in the file (path in the package - empty for the whole file). */
interface ImportProblem {
  path: string;
  message: string;
}

@Component({
  selector: 'app-jc-import-dialog',
  standalone: true,
  imports: [AdminModalComponent],
  templateUrl: './import-dialog.component.html',
  styleUrls: ['../../../../../admin/shared-styles/modal.css', '../../shared-styles/workspace.css', './import-dialog.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportDialogComponent implements OnInit, OnDestroy {
  private readonly api = inject(TransferApiService);
  private readonly usage = inject(WorkspaceUsageService);
  private readonly uploadRules = inject(UploadRulesService);
  private readonly i18n = inject(AdminLocalizationService);
  private readonly cd = inject(ChangeDetectorRef);

  /** Section of the import. */
  @Input() section: JsCreatorSectionId = 'images';

  /** The import succeeded (the page reloads its list). */
  @Output() readonly imported = new EventEmitter<ImportSummary>();
  /** The popup was closed. */
  @Output() readonly dismissed = new EventEmitter<void>();

  /** Chosen file (checked in the browser). */
  file: File | null = null;
  /** Problems of the file (browser or API). */
  problems: ImportProblem[] = [];
  /** Import running. */
  busy = false;
  /** Result of a finished import. */
  result: ImportSummary | null = null;
  /** Rules of the upload profile. */
  rules: UploadRule | null = null;

  private rulesSub?: Subscription;

  /** @description Loads the rules of the upload. */
  ngOnInit(): void {
    this.rulesSub = this.uploadRules.rules('js_creator_import').subscribe(rules => {
      this.rules = rules;
      this.cd.markForCheck();
    });
  }

  /** @description Stops the rules subscription. */
  ngOnDestroy(): void {
    this.rulesSub?.unsubscribe();
  }

  /**
   * @description Text of the shared section.
   * @param key Key in `js-creator-shared`.
   */
  t(key: string): string {
    return this.i18n.getValue(`js-creator-shared.${key}`);
  }

  /** @description Largest file (MB). */
  get maxMb(): number {
    return this.rules?.max_file_size_mb ?? DEFAULT_MAX_MB;
  }

  /** @description Hint of the allowed file. */
  get hint(): string {
    return this.t('import_file_hint').replace('{size}', String(this.maxMb));
  }

  /** @description Counts of the result as text rows (only kinds with items). */
  get resultRows(): string[] {
    const r = this.result;
    if (!r) return [];
    const rows: [string, number][] = [
      ['import_count_templates', r.templates], ['import_count_blocks', r.blocks], ['import_count_sets', r.sets],
      ['import_count_assets', r.assets], ['import_count_fonts', r.fonts], ['import_count_fonts_reused', r.fonts_reused],
    ];
    return rows.filter(([, count]) => count > 0).map(([key, count]) => `${this.t(key)}: ${count}`);
  }

  /**
   * @description Name of a kind of item of the list of renamed items.
   * @param type template | block | set | asset | font.
   */
  typeLabel(type: string): string {
    return this.t(`import_type_${type}`);
  }

  /**
   * @description Size in the locale of the admin.
   * @param bytes Size.
   */
  size(bytes: number): string {
    return formatBytes(bytes, this.i18n.getDateLocale());
  }

  /**
   * @description A file was chosen: only a .json file within the size limit that holds JSON of
   *   the format `js-creator` is kept.
   * @param event Change of the file input.
   */
  async choose(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    this.file = null;
    this.problems = [];
    this.result = null;
    if (!file) return this.cd.markForCheck();
    if (!isExtensionAllowed(file.name, this.rules?.extensions ?? ['json']) || file.size > this.maxMb * 1024 * 1024 || file.size === 0) {
      this.problems = [{ path: '', message: this.hint }];
      return this.cd.markForCheck();
    }
    const problem = await this.checkContent(file);
    if (problem) {
      this.problems = [{ path: '', message: problem }];
    } else {
      this.file = file;
    }
    this.cd.markForCheck();
  }

  /** @description Sends the chosen file to the API. */
  submit(): void {
    const file = this.file;
    if (!file || this.busy) return;
    this.busy = true;
    this.problems = [];
    this.cd.markForCheck();
    this.api.import(this.section, file).subscribe({
      next: summary => {
        this.busy = false;
        this.result = summary;
        this.file = null;
        this.usage.refresh();
        this.imported.emit(summary);
        this.cd.markForCheck();
      },
      error: (error: unknown) => {
        this.busy = false;
        this.problems = this.problemsOf(error);
        this.cd.markForCheck();
      },
    });
  }

  /** @description Closes the popup (not while importing). */
  close(): void {
    if (!this.busy) this.dismissed.emit();
  }

  /**
   * @description Quick check of the content in the browser.
   * @param file Chosen file.
   * @returns Text of the problem, or null.
   */
  private async checkContent(file: File): Promise<string | null> {
    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      return this.t('import_not_json');
    }
    const format = data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>)['format'] : null;
    return format === 'js-creator' ? null : this.t('import_not_package');
  }

  /**
   * @description Problems of a refused import.
   * @param error Error of the request.
   */
  private problemsOf(error: unknown): ImportProblem[] {
    const body = error instanceof HttpErrorResponse ? error.error : null;
    const code = body?.error_code;
    if (code === 'quota_exceeded') return [{ path: '', message: this.t('import_quota') }];
    if (code === 'invalid_package' || (error instanceof HttpErrorResponse && error.status === 422)) {
      const errors = (body?.errors ?? {}) as Record<string, string[] | string>;
      const list = Object.entries(errors).slice(0, 20).map(([path, messages]) => ({
        path: path === 'package' || path === 'file' ? '' : path,
        message: Array.isArray(messages) ? String(messages[0] ?? '') : String(messages),
      }));
      return [{ path: '', message: this.t('import_refused') }, ...list];
    }
    return [{ path: '', message: this.t('import_error') }];
  }
}
