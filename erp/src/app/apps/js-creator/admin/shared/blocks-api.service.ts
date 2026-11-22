/**
 * @file blocks-api.service.ts
 * @path src/app/apps/js-creator/admin/shared/blocks-api.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Calls of the blocks of a section (`/api/js-creator/<section>/blocks`) - the same
 *   calls as the templates (list, detail, new, save, thumbnail, copy, trash) on another path, plus
 *   a new block with its document ("block from the selection") and the save of the block editor.
 *   Every block belongs to the OWN workspace; a block used by templates cannot be deleted (the
 *   list carries `used_by`).
 * @dependencies TemplatesApiService (shared calls), DataHandler; js-creator.models.ts.
 */

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiPage } from '../../../../shared/interfaces/api-envelope';
import { BlockSave, CreatorBlock, CreatorBlockDetail } from './js-creator.models';
import { JsCreatorSectionId } from './js-creator-sections';
import { TemplateQuery, TemplatesApiService } from './templates-api.service';
import { TemplateDocument } from './render/document';

@Injectable({ providedIn: 'root' })
export class BlocksApiService extends TemplatesApiService {
  /**
   * @description Base path of the blocks of a section.
   * @param section Section.
   */
  protected override base(section: JsCreatorSectionId): string {
    return `js-creator/${section}/blocks`;
  }

  /**
   * @description Page of the own blocks of a section (each with `used_by`).
   * @param section Section.
   * @param query Page, search, sorting, trash.
   */
  blocks(section: JsCreatorSectionId, query: TemplateQuery): Observable<ApiPage<CreatorBlock>> {
    return this.list(section, query) as unknown as Observable<ApiPage<CreatorBlock>>;
  }

  /** @description A block with its document and the templates using it. */
  block(section: JsCreatorSectionId, id: number): Observable<CreatorBlockDetail> {
    return this.data.get<CreatorBlockDetail>(`${this.base(section)}/${id}`);
  }

  /**
   * @description New block, optionally with its document (no global error dialog - the editor
   *   explains a refusal).
   * @param section Section.
   * @param data Name, size and an optional document.
   */
  createBlock(section: JsCreatorSectionId, data: { name: string; width: number; height: number; document?: TemplateDocument }): Observable<CreatorBlockDetail> {
    return this.data.postQuietly<CreatorBlockDetail>(this.base(section), data);
  }

  /**
   * @description Save of the block editor (no global error dialog - the editor handles 409 / 422).
   * @param section Section.
   * @param id Block.
   * @param data Name, size, document and the version the editor started from.
   */
  saveBlock(section: JsCreatorSectionId, id: number, data: BlockSave): Observable<CreatorBlockDetail> {
    return this.data.putQuietly<CreatorBlockDetail>(`${this.base(section)}/${id}`, data);
  }
}
