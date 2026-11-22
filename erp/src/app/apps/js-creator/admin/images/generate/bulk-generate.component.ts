/**
 * @file bulk-generate.component.ts
 * @path src/app/apps/js-creator/admin/images/generate/bulk-generate.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Dialog "Generate from a table" of the page Generate (a template or a set): a CSV /
 *   XLSX table and photos of the computer are read ONLY in the browser (never uploaded - only
 *   the finished outputs are), the columns are mapped to the fields (found by key / label, can
 *   be changed), every row is checked like the form (required fields, lengths, texts that do
 *   not fit, characters the fonts do not have, images not found) and the rows without a problem
 *   are generated one after another into the folder of the page (a set: one output per
 *   template). Generating can be stopped after the row being made; a refusal that would repeat
 *   (full quota, folder gone, …) stops the rest. A sample CSV with the fields can be downloaded.
 *   Images of a cell: a chosen photo (file name, with or without the extension), otherwise an
 *   image of the library (its name) - the library is loaded only when a name is not a photo.
 * @usage `<app-jc-bulk-generate [runner]="bulkRunner" [folderLabel]="…" [waiting]="waiting()"
 *   (openOutputs)="…" (dismissed)="…" />`
 * @dependencies bulk-table.ts, BulkRunner (GeneratePageComponent), JsCreatorApiService (library),
 *   AdminModalComponent, AdminLocalizationService (section `js-creator-generate`).
 */

import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AdminModalComponent } from '../../../../../admin/components/admin-modal/admin-modal.component';
import { AdminLocalizationService } from '../../../../../core/services/admin-localization.service';
import { JsCreatorApiService } from '../../shared/js-creator-api.service';
import { CreatorAsset, CreatorOutput } from '../../shared/js-creator.models';
import { Field } from '../../shared/render/document';
import {
  BULK_LIMITS, BULK_TABLE_ACCEPT, BulkImage, BulkMapping, BulkRow, BulkTable, BulkTableException, CAPTION_COLUMN, NAME_COLUMN, autoMapping, matchImage,
  readTable, sampleCsv, tableRows,
} from './bulk-table';
import { GenerateProblem } from './generate-form';
import { LOCAL_IMAGE_ACCEPT } from './local-image';
import type { ProduceResult } from './generate-page.component';

/** One row to generate: its values with the images found. */
export interface BulkRunInput {
  index: number;
  texts: Record<string, string>;
  images: Record<string, BulkImage>;
  /** Name of the output ('' = the default with the number of the row). */
  name: string;
  /** Text of the post (null = from the pattern). */
  caption: string | null;
}

/** What the page offers to the dialog (its form rules and its generating). */
export interface BulkRunner {
  /** Fields of the form (united over the templates of a set). */
  fields(): Field[];
  /** Templates generated per row (a set: more). */
  targetCount(): number;
  /** Loads the fonts the texts need (before the rows are checked - overflows are measured). */
  prepare(texts: string[]): Promise<void>;
  /** What stops a row: rules of the form, texts that do not fit, missing characters. */
  check(texts: Record<string, string>, filled: ReadonlySet<string>): GenerateProblem[];
  /** Text of a problem. */
  problemText(problem: GenerateProblem): string;
  /** Generates one row. */
  run(row: BulkRunInput): Promise<ProduceResult>;
}

/** A checked row of the table. */
interface CheckedRow {
  row: BulkRow;
  images: Record<string, BulkImage>;
  problems: GenerateProblem[];
}

/** Result of a generated row. */
interface RowResult {
  index: number;
  outputs: CreatorOutput[];
  error: string | null;
}

@Component({
  selector: 'app-jc-bulk-generate',
  standalone: true,
  imports: [AdminModalComponent],
  templateUrl: './bulk-generate.component.html',
  styleUrls: ['../../../../../admin/shared-styles/modal.css', '../../shared-styles/workspace.css', './bulk-generate.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BulkGenerateComponent {
  private readonly creatorApi = inject(JsCreatorApiService);
  private readonly i18n = inject(AdminLocalizationService);

  /** Rules and generating of the page. */
  readonly runner = input.required<BulkRunner>();
  /** Name of the target folder (shown). */
  readonly folderLabel = input('');
  /** Seconds generating waits for the server (null = not waiting). */
  readonly waiting = input<number | null>(null);
  /** Open the outputs (the target folder). */
  readonly openOutputs = output<void>();
  /** The dialog is closed. */
  readonly dismissed = output<void>();

  /** File types of the pickers. */
  readonly tableAccept = BULK_TABLE_ACCEPT;
  readonly photoAccept = LOCAL_IMAGE_ACCEPT;
  readonly limits = BULK_LIMITS;
  /** Mapping keys of the special columns. */
  readonly nameColumn = NAME_COLUMN;
  readonly captionColumn = CAPTION_COLUMN;

  /** The table read. */
  readonly table = signal<BulkTable | null>(null);
  /** Name of the table file. */
  readonly fileName = signal('');
  /** Why the table cannot be used. */
  readonly tableError = signal<string | null>(null);
  /** Photos chosen for the table. */
  readonly photos = signal<File[]>([]);
  /** Column of each field / the name / the text of the post. */
  readonly mapping = signal<BulkMapping>({});
  /** Images of the library (null = not loaded). */
  readonly assets = signal<CreatorAsset[] | null>(null);
  /** The table is being read / the library and fonts loaded. */
  readonly loading = signal(false);
  /** Raised when the fonts of the texts are ready (the rows are checked again). */
  private readonly prepared = signal(0);
  /** Generating runs. */
  readonly running = signal(false);
  /** Stop after the row being made. */
  readonly stopping = signal(false);
  /** Rows generated / tried. */
  readonly results = signal<RowResult[]>([]);
  /** Why the whole run stopped (null = it did not). */
  readonly stoppedBy = signal<string | null>(null);

  /** Fields of the form. */
  readonly fields = computed(() => this.runner().fields());
  /** Columns of the table for the selects. */
  readonly columns = computed(() => (this.table()?.headers ?? []).map((name, index) => ({ index, name })));
  /** Rows with the mapped values. */
  readonly rows = computed(() => {
    const table = this.table();
    return table ? tableRows(table, this.mapping(), this.fields()) : [];
  });
  /** Rows with their images and problems. */
  readonly checked = computed<CheckedRow[]>(() => {
    this.prepared();
    const runner = this.runner();
    const fields = this.fields();
    const photos = this.photos();
    const assets = this.assets();
    return this.rows().map(row => {
      const images: Record<string, BulkImage> = {};
      const missing: GenerateProblem[] = [];
      for (const [key, value] of Object.entries(row.imageNames)) {
        const found = matchImage(value, photos, assets);
        if (found) images[key] = found;
        else missing.push({ kind: 'image_not_found', field: key, label: `${fields.find(f => f.key === key)?.label ?? key}: ${value}` });
      }
      // A required image field whose image was not found is named once (with the name of the image).
      const own = runner.check(row.texts, new Set(Object.keys(images))).filter(p => !(p.kind === 'required' && missing.some(m => m.field === p.field)));
      return { row, images, problems: [...own, ...missing] };
    });
  });
  /** Rows that can be generated. */
  readonly readyRows = computed(() => this.checked().filter(c => !c.problems.length));
  /** Outputs a run makes. */
  readonly outputCount = computed(() => this.readyRows().length * this.runner().targetCount());
  /** Rows done of the run. */
  readonly doneCount = computed(() => this.results().length);
  /** Outputs made by the run. */
  readonly madeCount = computed(() => this.results().reduce((sum, r) => sum + r.outputs.length, 0));
  /** Rows the run could not make. */
  readonly failedRows = computed(() => this.results().filter(r => r.error));

  /**
   * @description Text of the generating page.
   * @param key Key in `js-creator-generate`.
   */
  t(key: string): string {
    return this.i18n.getValue(`js-creator-generate.${key}`);
  }

  /**
   * @description Text with `{name}` parameters.
   * @param key Key.
   * @param params Values.
   */
  tf(key: string, params: Record<string, string | number>): string {
    return Object.entries(params).reduce((text, [name, value]) => text.split(`{${name}}`).join(String(value)), this.t(key));
  }

  /**
   * @description A table file was chosen: read it, map its columns, load what the checks need.
   * @param event Change of the file input.
   */
  async chooseTable(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.running()) return;
    this.loading.set(true);
    this.tableError.set(null);
    this.results.set([]);
    this.stoppedBy.set(null);
    try {
      const table = await readTable(file);
      this.table.set(table);
      this.fileName.set(file.name);
      this.mapping.set(autoMapping(table.headers, this.fields()));
      await this.prepare();
    } catch (error) {
      const code = error instanceof BulkTableException ? error.code : 'unreadable';
      this.table.set(null);
      this.fileName.set(file.name);
      this.tableError.set(this.tf(`bulk_error_${code}`, { rows: BULK_LIMITS.rows, columns: BULK_LIMITS.columns, mb: BULK_LIMITS.fileBytes / 1024 / 1024 }));
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * @description Photos for the image cells were chosen (they replace the earlier choice).
   * @param event Change of the file input.
   */
  async choosePhotos(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    this.photos.set(Array.from(input.files ?? []));
    input.value = '';
    await this.prepare();
  }

  /**
   * @description Another column for a field / the name / the text of the post.
   * @param key Mapping key.
   * @param value Index of the column ('' = not used).
   */
  async setColumn(key: string, value: string): Promise<void> {
    this.mapping.update(mapping => ({ ...mapping, [key]: value === '' ? null : Number(value) }));
    await this.prepare();
  }

  /** @description Saves a sample CSV with the fields of the form (header and one row of samples). */
  downloadSample(): void {
    const blob = new Blob([sampleCsv(this.fields())], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'js-creator-tabulka.csv';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /**
   * @description Texts of the problems of a row.
   * @param row Checked row.
   */
  problemsOf(row: CheckedRow): string[] {
    return row.problems.map(p => this.runner().problemText(p));
  }

  /**
   * @description Name shown for a row (its name, or the default).
   * @param row Row.
   */
  nameOf(row: BulkRow): string {
    return row.name || this.tf('bulk_default_name', { row: row.index });
  }

  /**
   * @description Result of a row of the run (null = not made yet).
   * @param index Number of the row.
   */
  resultOf(index: number): RowResult | null {
    return this.results().find(r => r.index === index) ?? null;
  }

  /** @description Generates the rows without problems one after another. */
  async generate(): Promise<void> {
    const rows = this.readyRows();
    if (!rows.length || this.running()) return;
    this.running.set(true);
    this.stopping.set(false);
    this.stoppedBy.set(null);
    this.results.set([]);
    try {
      for (const row of rows) {
        if (this.stopping()) break;
        const result = await this.runner().run({ index: row.row.index, texts: row.row.texts, images: row.images, name: row.row.name, caption: row.row.caption });
        this.results.update(list => [...list, { index: row.row.index, outputs: result.ok ? result.outputs : [], error: result.ok ? null : this.errorText(result) }]);
        if (!result.ok && result.stop) {
          this.stoppedBy.set(this.errorText(result));
          break;
        }
      }
    } finally {
      this.running.set(false);
      this.stopping.set(false);
    }
  }

  /** @description Stops after the row being made. */
  stop(): void {
    this.stopping.set(true);
  }

  /** @description Closes the dialog (not while generating). */
  close(): void {
    if (!this.running()) this.dismissed.emit();
  }

  /**
   * @description Text of a failed result.
   * @param result Failed result of a row.
   */
  private errorText(result: ProduceResult): string {
    if (result.ok) return '';
    return result.detail ? `${this.t(result.error)} (${result.detail})` : this.t(result.error);
  }

  /**
   * @description Loads what the checks need: the library when an image cell is not a chosen
   *   photo, the fonts of every text (overflows are measured with them).
   */
  private async prepare(): Promise<void> {
    const rows = this.rows();
    if (!rows.length) return;
    this.loading.set(true);
    try {
      const names = rows.flatMap(r => Object.values(r.imageNames));
      if (this.assets() === null && names.some(name => !matchImage(name, this.photos(), []))) await this.loadAssets();
      await this.runner().prepare(rows.flatMap(r => Object.values(r.texts)));
    } finally {
      this.loading.set(false);
      this.prepared.update(v => v + 1);
    }
  }

  /** @description Loads the images and own icons of the library (names for the image cells). */
  private async loadAssets(): Promise<void> {
    const all: CreatorAsset[] = [];
    try {
      for (const kind of ['image', 'icon'] as const) {
        for (let page = 1; page <= 20; page++) {
          const result = await firstValueFrom(this.creatorApi.assets({ page, kind }));
          all.push(...result.data);
          if (page >= (result.meta?.last_page ?? 1)) break;
        }
      }
    } catch {
      // Without the library only chosen photos match; the rows name what was not found.
    }
    this.assets.set(all);
  }
}
