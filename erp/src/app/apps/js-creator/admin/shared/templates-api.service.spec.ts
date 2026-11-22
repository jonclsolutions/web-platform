/**
 * @file templates-api.service.spec.ts
 * @path src/app/apps/js-creator/admin/shared/templates-api.service.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of TemplatesApiService: paths and parameters of the template endpoints
 *   of a section, the quiet save, the thumbnail upload and library images by ids.
 * @dependencies TemplatesApiService, admin-test-helpers.ts (DataHandler double).
 */

import { TestBed } from '@angular/core/testing';
import { TemplatesApiService } from './templates-api.service';
import { emptyDocument } from './render/document';
import { AdminTestContext, createAdminTestContext } from '../../../../../testing/admin-test-helpers';

describe('TemplatesApiService', () => {
  let ctx: AdminTestContext;
  let api: TemplatesApiService;

  beforeEach(() => {
    ctx = createAdminTestContext();
    TestBed.configureTestingModule({ providers: ctx.providers });
    api = TestBed.inject(TemplatesApiService);
  });

  /**
   * @description Every call goes to `js-creator/<section>/templates…`; the save is quiet (the
   *   editor explains errors); the thumbnail is a file named by its type.
   * @input list page 2 search "a" trash; get, create, save, thumbnail (webp), duplicate, delete (force), restore, empty, assets 1,2
   * @output the expected DataHandler calls
   */
  it('calls the template endpoints', () => {
    api.list('images', { page: 2, search: 'a', trashed: true }).subscribe();
    expect(ctx.dataHandler.getPaginatedCollection).toHaveBeenCalledWith('js-creator/images/templates?page=2&search=a&only_trashed=1');
    api.get('images', 4).subscribe();
    expect(ctx.dataHandler.get).toHaveBeenCalledWith('js-creator/images/templates/4');
    api.create('images', { name: 'A', width: 1080, height: 1080 }).subscribe();
    expect(ctx.dataHandler.post).toHaveBeenCalledWith('js-creator/images/templates', { name: 'A', width: 1080, height: 1080 });
    const body = { name: 'A', width: 1080, height: 1080, output_format: 'png' as const, output_quality: 90, caption_template: null, version: 2, document: emptyDocument() };
    api.save('images', 4, body).subscribe();
    expect(ctx.dataHandler.putQuietly).toHaveBeenCalledWith('js-creator/images/templates/4', body);
    api.uploadThumbnail('images', 4, new Blob(['x'], { type: 'image/webp' })).subscribe();
    const form = ctx.dataHandler.upload.calls.mostRecent().args[1] as FormData;
    expect((form.get('thumb') as File).name).toBe('thumb.webp');
    api.duplicate('images', 4, { name: 'B', width: 1080, height: 1920 }).subscribe();
    expect(ctx.dataHandler.post).toHaveBeenCalledWith('js-creator/images/templates/4/duplicate', { name: 'B', width: 1080, height: 1920 });
    api.delete('images', 4, true).subscribe();
    expect(ctx.dataHandler.delete).toHaveBeenCalledWith('js-creator/images/templates/4?force=1');
    api.restore('images', 4).subscribe();
    expect(ctx.dataHandler.post).toHaveBeenCalledWith('js-creator/images/templates/4/restore', {});
    api.emptyTrash('images').subscribe();
    expect(ctx.dataHandler.delete).toHaveBeenCalledWith('js-creator/images/templates/trash');
    api.assetsByIds([1, 2]).subscribe();
    expect(ctx.dataHandler.getPaginatedCollection).toHaveBeenCalledWith('js-creator/library/assets?ids=1,2');
  });
});
