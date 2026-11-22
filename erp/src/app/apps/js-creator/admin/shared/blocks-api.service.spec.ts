/**
 * @file blocks-api.service.spec.ts
 * @path src/app/apps/js-creator/admin/shared/blocks-api.service.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of BlocksApiService and SetsApiService: paths of the block and set
 *   endpoints of a section; quiet new block / block save / set saves (the pages explain 409 / 422).
 * @dependencies BlocksApiService, SetsApiService, admin-test-helpers.ts (DataHandler double).
 */

import { TestBed } from '@angular/core/testing';
import { BlocksApiService } from './blocks-api.service';
import { SetsApiService } from './sets-api.service';
import { emptyDocument } from './render/document';
import { AdminTestContext, createAdminTestContext } from '../../../../../testing/admin-test-helpers';

describe('BlocksApiService and SetsApiService', () => {
  let ctx: AdminTestContext;

  beforeEach(() => {
    ctx = createAdminTestContext();
    TestBed.configureTestingModule({ providers: ctx.providers });
  });

  /**
   * @description Blocks use the calls of templates on `js-creator/<section>/blocks…`; new block
   *   and save are quiet; the thumbnail can be sent quietly too.
   * @input list, block, createBlock with a document, saveBlock, duplicate, delete, thumbnail (quiet)
   * @output the expected DataHandler calls
   */
  it('calls the block endpoints', () => {
    const api = TestBed.inject(BlocksApiService);
    api.blocks('images', { page: 1, search: 'logo' }).subscribe();
    expect(ctx.dataHandler.getPaginatedCollection).toHaveBeenCalledWith('js-creator/images/blocks?page=1&search=logo');
    api.block('images', 3).subscribe();
    expect(ctx.dataHandler.get).toHaveBeenCalledWith('js-creator/images/blocks/3');
    const document = emptyDocument(true);
    api.createBlock('images', { name: 'A', width: 300, height: 100, document }).subscribe();
    expect(ctx.dataHandler.postQuietly).toHaveBeenCalledWith('js-creator/images/blocks', { name: 'A', width: 300, height: 100, document });
    api.saveBlock('images', 3, { name: 'A', width: 300, height: 100, version: 2, document }).subscribe();
    expect(ctx.dataHandler.putQuietly).toHaveBeenCalledWith('js-creator/images/blocks/3', { name: 'A', width: 300, height: 100, version: 2, document });
    api.duplicate('images', 3, { name: 'B' }).subscribe();
    expect(ctx.dataHandler.post).toHaveBeenCalledWith('js-creator/images/blocks/3/duplicate', { name: 'B' });
    api.delete('images', 3).subscribe();
    expect(ctx.dataHandler.delete).toHaveBeenCalledWith('js-creator/images/blocks/3');
    api.uploadThumbnail('images', 3, new Blob(['x'], { type: 'image/webp' }), true).subscribe();
    expect(ctx.dataHandler.postQuietly.calls.mostRecent().args[0]).toBe('js-creator/images/blocks/3/thumbnail');
    expect(ctx.dataHandler.upload).not.toHaveBeenCalled();
  });

  /**
   * @description Sets: list with parameters, detail, quiet new / save, trash calls.
   * @input list page 1 search "x" sorted by name in the trash; get; create; save; delete force; restore; empty
   * @output the expected DataHandler calls
   */
  it('calls the set endpoints', () => {
    const api = TestBed.inject(SetsApiService);
    api.list('images', { page: 1, search: 'x', sortBy: 'name', sortDirection: 'asc', trashed: true }).subscribe();
    expect(ctx.dataHandler.getPaginatedCollection).toHaveBeenCalledWith('js-creator/images/sets?page=1&search=x&sort_by=name&sort_direction=asc&only_trashed=1');
    api.get('images', 4).subscribe();
    expect(ctx.dataHandler.get).toHaveBeenCalledWith('js-creator/images/sets/4');
    const body = { name: 'S', caption_template: null, template_ids: [1, 2] };
    api.create('images', body).subscribe();
    expect(ctx.dataHandler.postQuietly).toHaveBeenCalledWith('js-creator/images/sets', body);
    api.save('images', 4, body).subscribe();
    expect(ctx.dataHandler.putQuietly).toHaveBeenCalledWith('js-creator/images/sets/4', body);
    api.delete('images', 4, true).subscribe();
    expect(ctx.dataHandler.delete).toHaveBeenCalledWith('js-creator/images/sets/4?force=1');
    api.restore('images', 4).subscribe();
    expect(ctx.dataHandler.post).toHaveBeenCalledWith('js-creator/images/sets/4/restore', {});
    api.emptyTrash('images').subscribe();
    expect(ctx.dataHandler.delete).toHaveBeenCalledWith('js-creator/images/sets/trash');
  });
});
