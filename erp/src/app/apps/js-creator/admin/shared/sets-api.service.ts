/**
 * @file sets-api.service.ts
 * @path src/app/apps/js-creator/admin/shared/sets-api.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Calls of the sets of a section (`/api/js-creator/<section>/sets`) through
 *   DataHandler: list, detail, new, save, trash. New / save go without the global error dialog:
 *   the page explains a field of another kind (422 `field_conflict`) itself.
 * @dependencies DataHandler; js-creator.models.ts; js-creator-sections.ts.
 */

import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { DataHandler } from '../../../../core/services/data-handler.service';
import { ApiPage } from '../../../../shared/interfaces/api-envelope';
import { CreatorSet, SetSave } from './js-creator.models';
import { JsCreatorSectionId } from './js-creator-sections';

/** Query of the list of sets. */
export interface SetQuery {
  page: number;
  search?: string;
  sortBy?: 'updated_at' | 'created_at' | 'name';
  sortDirection?: 'asc' | 'desc';
  trashed?: boolean;
}

@Injectable({ providedIn: 'root' })
export class SetsApiService {
  private readonly api = inject(DataHandler);

  /**
   * @description Base path of the sets of a section.
   * @param section Section.
   */
  private base(section: JsCreatorSectionId): string {
    return `js-creator/${section}/sets`;
  }

  /**
   * @description Page of the own sets of a section with their templates.
   * @param section Section.
   * @param query Page, search, sorting, trash.
   */
  list(section: JsCreatorSectionId, query: SetQuery): Observable<ApiPage<CreatorSet>> {
    const params = new URLSearchParams({ page: String(query.page) });
    if (query.search) params.set('search', query.search);
    if (query.sortBy) params.set('sort_by', query.sortBy);
    if (query.sortDirection) params.set('sort_direction', query.sortDirection);
    if (query.trashed) params.set('only_trashed', '1');
    return this.api.getPaginatedCollection<CreatorSet>(`${this.base(section)}?${params.toString()}`);
  }

  /** @description A set with its templates. */
  get(section: JsCreatorSectionId, id: number): Observable<CreatorSet> {
    return this.api.get<CreatorSet>(`${this.base(section)}/${id}`);
  }

  /** @description New set (422 explained by the page). */
  create(section: JsCreatorSectionId, data: SetSave): Observable<CreatorSet> {
    return this.api.postQuietly<CreatorSet>(this.base(section), data);
  }

  /** @description Save of a set (422 explained by the page). */
  save(section: JsCreatorSectionId, id: number, data: SetSave): Observable<CreatorSet> {
    return this.api.putQuietly<CreatorSet>(`${this.base(section)}/${id}`, data);
  }

  /** @description Set to the trash, or `force` = a set of the trash for good. */
  delete(section: JsCreatorSectionId, id: number, force = false): Observable<void> {
    return this.api.delete(`${this.base(section)}/${id}${force ? '?force=1' : ''}`);
  }

  /** @description Restore a set of the trash. */
  restore(section: JsCreatorSectionId, id: number): Observable<CreatorSet> {
    return this.api.post<CreatorSet>(`${this.base(section)}/${id}/restore`, {});
  }

  /** @description Empty the set trash of a section. */
  emptyTrash(section: JsCreatorSectionId): Observable<void> {
    return this.api.delete(`${this.base(section)}/trash`);
  }
}
