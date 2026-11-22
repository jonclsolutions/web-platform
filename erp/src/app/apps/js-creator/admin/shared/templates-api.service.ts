/**
 * @file templates-api.service.ts
 * @path src/app/apps/js-creator/admin/shared/templates-api.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Calls of the templates of a section (`/api/js-creator/<section>/templates`) through
 *   DataHandler. Every template belongs to the OWN workspace. The save of the editor goes without
 *   the global error dialog (putQuietly): the editor explains a version conflict (409) and an
 *   invalid document (422) itself.
 * @dependencies DataHandler; js-creator.models.ts; js-creator-sections.ts.
 */

import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { DataHandler } from '../../../../core/services/data-handler.service';
import { ApiPage } from '../../../../shared/interfaces/api-envelope';
import { CreatorAsset, CreatorTemplate, CreatorTemplateDetail, TemplateSave, TemplateSizeCount } from './js-creator.models';
import { JsCreatorSectionId } from './js-creator-sections';

/** Query of the list of templates. */
export interface TemplateQuery {
  page: number;
  search?: string;
  /** `<width>x<height>`. */
  size?: string;
  sortBy?: 'updated_at' | 'created_at' | 'name';
  sortDirection?: 'asc' | 'desc';
  trashed?: boolean;
}

/** Page of templates with the sizes in use. */
export type TemplatePage = ApiPage<CreatorTemplate> & { meta: ApiPage<CreatorTemplate>['meta'] & { sizes?: TemplateSizeCount[] } };

@Injectable({ providedIn: 'root' })
export class TemplatesApiService {
  private readonly api = inject(DataHandler);

  /** DataHandler of the calls (also for BlocksApiService). */
  protected readonly data = this.api;

  /**
   * @description Base path of the templates of a section.
   * @param section Section.
   */
  protected base(section: JsCreatorSectionId): string {
    return `js-creator/${section}/templates`;
  }

  /**
   * @description Page of the own templates of a section.
   * @param section Section.
   * @param query Page, search, size, sorting, trash.
   */
  list(section: JsCreatorSectionId, query: TemplateQuery): Observable<TemplatePage> {
    const params = new URLSearchParams({ page: String(query.page) });
    if (query.search) params.set('search', query.search);
    if (query.size) params.set('size', query.size);
    if (query.sortBy) params.set('sort_by', query.sortBy);
    if (query.sortDirection) params.set('sort_direction', query.sortDirection);
    if (query.trashed) params.set('only_trashed', '1');
    return this.api.getPaginatedCollection<CreatorTemplate>(`${this.base(section)}?${params.toString()}`) as Observable<TemplatePage>;
  }

  /** @description A template with its document and blocks. */
  get(section: JsCreatorSectionId, id: number): Observable<CreatorTemplateDetail> {
    return this.api.get<CreatorTemplateDetail>(`${this.base(section)}/${id}`);
  }

  /** @description A template with its document and blocks, without the global error dialog (background work). */
  getQuietly(section: JsCreatorSectionId, id: number): Observable<CreatorTemplateDetail> {
    return this.api.getQuietly<CreatorTemplateDetail>(`${this.base(section)}/${id}`);
  }

  /**
   * @description New template (empty document).
   * @param section Section.
   * @param data Name and size.
   */
  create(section: JsCreatorSectionId, data: { name: string; width: number; height: number }): Observable<CreatorTemplateDetail> {
    return this.api.post<CreatorTemplateDetail>(this.base(section), data);
  }

  /**
   * @description Save of the editor (no global error dialog - the editor handles 409 / 422).
   * @param section Section.
   * @param id Template.
   * @param data Every property, the document and the version the editor started from.
   */
  save(section: JsCreatorSectionId, id: number, data: TemplateSave): Observable<CreatorTemplateDetail> {
    return this.api.putQuietly<CreatorTemplateDetail>(`${this.base(section)}/${id}`, data);
  }

  /**
   * @description Replaces the thumbnail of a template.
   * @param section Section.
   * @param id Template.
   * @param blob PNG / WebP drawn by the editor.
   * @param quietly Without the global error dialog (background refresh of thumbnails).
   */
  uploadThumbnail(section: JsCreatorSectionId, id: number, blob: Blob, quietly = false): Observable<{ thumb_url: string }> {
    const data = new FormData();
    data.append('thumb', blob, blob.type === 'image/webp' ? 'thumb.webp' : 'thumb.png');
    const url = `${this.base(section)}/${id}/thumbnail`;
    return quietly ? this.api.postQuietly<{ thumb_url: string }>(url, data) : this.api.upload<{ thumb_url: string }>(url, data);
  }

  /**
   * @description Copy of a template, optionally in another size.
   * @param section Section.
   * @param id Template.
   * @param data Name of the copy and an optional size.
   */
  duplicate(section: JsCreatorSectionId, id: number, data: { name: string; width?: number; height?: number }): Observable<CreatorTemplateDetail> {
    return this.api.post<CreatorTemplateDetail>(`${this.base(section)}/${id}/duplicate`, data);
  }

  /** @description Template to the trash, or `force` = a template of the trash for good. */
  delete(section: JsCreatorSectionId, id: number, force = false): Observable<void> {
    return this.api.delete(`${this.base(section)}/${id}${force ? '?force=1' : ''}`);
  }

  /** @description Restore a template of the trash. */
  restore(section: JsCreatorSectionId, id: number): Observable<CreatorTemplate> {
    return this.api.post<CreatorTemplate>(`${this.base(section)}/${id}/restore`, {});
  }

  /** @description Empty the template trash of a section. */
  emptyTrash(section: JsCreatorSectionId): Observable<void> {
    return this.api.delete(`${this.base(section)}/trash`);
  }

  /**
   * @description Library images by their ids (the images a template uses).
   * @param ids Ids (at most 200).
   */
  assetsByIds(ids: number[]): Observable<ApiPage<CreatorAsset>> {
    return this.api.getPaginatedCollection<CreatorAsset>(`js-creator/library/assets?ids=${ids.slice(0, 200).join(',')}`);
  }
}
