/**
 * @file outputs-api.service.ts
 * @path src/app/apps/js-creator/admin/shared/outputs-api.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Calls of the generated outputs through DataHandler: generating in a section
 *   (`/api/js-creator/<section>/outputs` - without the global error dialog, the generator explains
 *   a full quota or a changed template itself), the list of every section
 *   (`/api/js-creator/outputs`), rename / move, trash, bulk actions and the signed URL of a ZIP.
 *   Every output belongs to the OWN workspace.
 * @dependencies DataHandler; js-creator.models.ts; js-creator-sections.ts.
 */

import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { DataHandler } from '../../../../core/services/data-handler.service';
import { ApiPage } from '../../../../shared/interfaces/api-envelope';
import { CreatorOutput, OutputUpload, OutputZip } from './js-creator.models';
import { JsCreatorSectionId } from './js-creator-sections';

/** Query of the list of outputs. */
export interface OutputQuery {
  page: number;
  /** Folder (null = the top level); ignored with a search (every folder). */
  folderId: number | null;
  search?: string;
  section?: JsCreatorSectionId | '';
  sortBy?: 'created_at' | 'name' | 'size_bytes';
  sortDirection?: 'asc' | 'desc';
  trashed?: boolean;
}

/** Bulk action on outputs. */
export type OutputBulkAction = 'move' | 'delete' | 'restore' | 'destroy';

@Injectable({ providedIn: 'root' })
export class OutputsApiService {
  private readonly api = inject(DataHandler);

  /**
   * @description Page of the own outputs.
   * @param query Folder, search, section, sorting, trash, page.
   */
  list(query: OutputQuery): Observable<ApiPage<CreatorOutput>> {
    const params = new URLSearchParams({ page: String(query.page) });
    if (query.trashed) params.set('only_trashed', '1');
    else if (query.folderId !== null) params.set('folder_id', String(query.folderId));
    if (query.search) params.set('search', query.search);
    if (query.section) params.set('section', query.section);
    if (query.sortBy) params.set('sort_by', query.sortBy);
    if (query.sortDirection) params.set('sort_direction', query.sortDirection);
    return this.api.getPaginatedCollection<CreatorOutput>(`js-creator/outputs?${params.toString()}`);
  }

  /**
   * @description Stores a generated output (no global error dialog - the generator explains the
   *   errors).
   * @param section Section of the template.
   * @param upload PNG, template, folder, name, text of the post.
   */
  generate(section: JsCreatorSectionId, upload: OutputUpload): Observable<CreatorOutput> {
    const data = new FormData();
    if (upload.file) data.append('file', upload.file, 'output.png');
    (upload.pages ?? []).forEach(token => data.append('pages[]', token));
    data.append('template_id', String(upload.template_id));
    if (upload.folder_id !== null) data.append('folder_id', String(upload.folder_id));
    data.append('name', upload.name);
    data.append('caption', upload.caption);
    return this.api.postQuietly<CreatorOutput>(`js-creator/${section}/outputs`, data);
  }

  /**
   * @description Stages one slide of a carousel before its output (every slide in its own
   *   request - a whole carousel would exceed the limit of one request).
   * @param section Section.
   * @param templateId Template.
   * @param file PNG of the slide drawn by the renderer.
   * @returns Token of the staged slide (sent with the output in `pages`).
   */
  stagePage(section: JsCreatorSectionId, templateId: number, file: Blob): Observable<{ token: string; bytes: number }> {
    const data = new FormData();
    data.append('file', file, 'page.png');
    data.append('template_id', String(templateId));
    return this.api.postQuietly<{ token: string; bytes: number }>(`js-creator/${section}/outputs/pages`, data);
  }

  /**
   * @description Rename and / or move an output.
   * @param id Output.
   * @param changes `name` and / or `folder_id` (null = top level).
   */
  update(id: number, changes: { name?: string; folder_id?: number | null }): Observable<CreatorOutput> {
    return this.api.put<CreatorOutput>(`js-creator/outputs/${id}`, changes);
  }

  /** @description Output to the trash, or `force` = an output of the trash for good. */
  delete(id: number, force = false): Observable<void> {
    return this.api.delete(`js-creator/outputs/${id}${force ? '?force=1' : ''}`);
  }

  /** @description Restore an output of the trash. */
  restore(id: number): Observable<CreatorOutput> {
    return this.api.post<CreatorOutput>(`js-creator/outputs/${id}/restore`, {});
  }

  /** @description Empty the output trash. */
  emptyTrash(): Observable<void> {
    return this.api.delete('js-creator/outputs/trash');
  }

  /**
   * @description One action on several outputs.
   * @param action move | delete | restore | destroy.
   * @param ids Outputs (at most 200).
   * @param folderId Target of a move (null = top level).
   * @returns Number of changed outputs.
   */
  bulk(action: OutputBulkAction, ids: number[], folderId: number | null = null): Observable<{ count: number }> {
    return this.api.post<{ count: number }>('js-creator/outputs/bulk', action === 'move' ? { action, ids, folder_id: folderId } : { action, ids });
  }

  /**
   * @description Signed URL of a ZIP with the outputs (at most 200 / 500 MB).
   * @param ids Outputs.
   */
  zip(ids: number[]): Observable<OutputZip> {
    return this.api.post<OutputZip>('js-creator/outputs/zip', { ids });
  }
}
