/**
 * @file transfer-api.service.ts
 * @path src/app/apps/js-creator/admin/shared/transfer-api.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Calls of the multiselect of the lists of templates, blocks and sets: bulk actions
 *   (`/api/js-creator/<section>/<list>/bulk`), export of a selection as one JSON file
 *   (`…/export` - the package is saved by the browser) and import of such a file (`…/import`).
 *   Export and import go without the global error dialog: the pages explain a refusal
 *   (`invalid_package` with the paths of the errors, `export_too_large`, `quota_exceeded`).
 * @dependencies DataHandler; js-creator.models.ts; js-creator-sections.ts.
 */

import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DataHandler } from '../../../../core/services/data-handler.service';
import { BulkAction, BulkResult, ExportSelection, ImportSummary, TransferPackage } from './js-creator.models';
import { JsCreatorSectionId } from './js-creator-sections';

/** Lists with bulk actions. */
export type BulkList = 'templates' | 'blocks' | 'sets';

/** Most items of one bulk action / export list (API limit). */
export const MAX_SELECTION = 200;

@Injectable({ providedIn: 'root' })
export class TransferApiService {
  private readonly api = inject(DataHandler);

  /**
   * @description One action on several own items of a list.
   * @param section Section.
   * @param list templates | blocks | sets.
   * @param action delete (to the trash) | restore | destroy (items of the trash for good).
   * @param ids Items (at most MAX_SELECTION).
   */
  bulk(section: JsCreatorSectionId, list: BulkList, action: BulkAction, ids: number[]): Observable<BulkResult> {
    return this.api.post<BulkResult>(`js-creator/${section}/${list}/bulk`, { action, ids: ids.slice(0, MAX_SELECTION) });
  }

  /**
   * @description Package of a selection (with everything it needs).
   * @param section Section.
   * @param selection Ids of templates, blocks and sets.
   */
  export(section: JsCreatorSectionId, selection: ExportSelection): Observable<TransferPackage> {
    return this.api.postQuietly<TransferPackage>(`js-creator/${section}/export`, selection);
  }

  /**
   * @description Imports a JSON file of an export into the own workspace.
   * @param section Section.
   * @param file The .json file.
   */
  import(section: JsCreatorSectionId, file: File): Observable<ImportSummary> {
    const data = new FormData();
    data.append('file', file, file.name);
    return this.api.postQuietly<ImportSummary>(`js-creator/${section}/import`, data);
  }

  /**
   * @description Saves a package as a .json file on the disk of the user.
   * @param pkg Package of an export.
   * @param name File name without the extension.
   */
  download(pkg: TransferPackage, name: string): void {
    const blob = new Blob([JSON.stringify(pkg, null, 1)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name}.json`;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/**
 * @description File name of an export: `js-creator-<what>-<name>-<YYYY-MM-DD>` (the name of a
 *   single item as a slug, letters with diacritics simplified).
 * @param what templates | blocks | sets.
 * @param single Name of the only exported item (null = several).
 * @param now Date of the export.
 * @returns File name without the extension.
 */
export function exportFileName(what: BulkList, single: string | null, now = new Date()): string {
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const slug = (single ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
  return ['js-creator', what, slug, date].filter(Boolean).join('-');
}

/**
 * @description Text key (section `js-creator-shared`) of a refused export.
 * @param error Error of the export request.
 * @returns `export_too_large` (over the limits of one file) or `export_failed`.
 */
export function exportErrorKey(error: unknown): 'export_too_large' | 'export_failed' {
  return error instanceof HttpErrorResponse && error.error?.error_code === 'export_too_large' ? 'export_too_large' : 'export_failed';
}
