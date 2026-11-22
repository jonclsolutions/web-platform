/**
 * @file outputs-api.service.spec.ts
 * @path src/app/apps/js-creator/admin/shared/outputs-api.service.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of OutputsApiService: list parameters (folder, search, section, sorting,
 *   trash), the quiet generating upload, rename / move, trash, bulk actions and the ZIP.
 * @dependencies OutputsApiService, admin-test-helpers.ts (DataHandler double).
 */

import { TestBed } from '@angular/core/testing';
import { OutputsApiService } from './outputs-api.service';
import { AdminTestContext, createAdminTestContext } from '../../../../../testing/admin-test-helpers';

describe('OutputsApiService', () => {
  let ctx: AdminTestContext;
  let api: OutputsApiService;

  beforeEach(() => {
    ctx = createAdminTestContext();
    TestBed.configureTestingModule({ providers: ctx.providers });
    api = TestBed.inject(OutputsApiService);
  });

  /**
   * @description The list sends the folder (none = the top level), search, section and sorting;
   *   the trash sends only_trashed instead of the folder.
   * @input folder 3 + search + section + sort; top level; trash
   * @output the expected query strings
   */
  it('lists outputs', () => {
    api.list({ page: 2, folderId: 3, search: 'léto', section: 'images', sortBy: 'name', sortDirection: 'asc' }).subscribe();
    expect(ctx.dataHandler.getPaginatedCollection).toHaveBeenCalledWith(
      'js-creator/outputs?page=2&folder_id=3&search=l%C3%A9to&section=images&sort_by=name&sort_direction=asc');
    api.list({ page: 1, folderId: null }).subscribe();
    expect(ctx.dataHandler.getPaginatedCollection).toHaveBeenCalledWith('js-creator/outputs?page=1');
    api.list({ page: 1, folderId: 3, trashed: true }).subscribe();
    expect(ctx.dataHandler.getPaginatedCollection).toHaveBeenCalledWith('js-creator/outputs?page=1&only_trashed=1');
  });

  /**
   * @description Generating sends a multipart form of the section quietly (the page explains the
   *   errors): the PNG, template, folder (left out for the top level), name and text.
   * @input PNG blob, template 5, folder 2 / null, name, caption
   * @output postQuietly('js-creator/images/outputs', FormData with file output.png, template_id 5,
   *   folder_id 2, name, caption); no folder_id for the top level
   */
  it('uploads a generated output quietly', () => {
    const blob = new Blob(['png'], { type: 'image/png' });
    api.generate('images', { file: blob, template_id: 5, folder_id: 2, name: 'Post', caption: 'Text' }).subscribe();
    const [url, data] = ctx.dataHandler.postQuietly.calls.mostRecent().args as [string, FormData];
    expect(url).toBe('js-creator/images/outputs');
    expect((data.get('file') as File).name).toBe('output.png');
    expect([data.get('template_id'), data.get('folder_id'), data.get('name'), data.get('caption')]).toEqual(['5', '2', 'Post', 'Text']);
    api.generate('images', { file: blob, template_id: 5, folder_id: null, name: 'Post', caption: '' }).subscribe();
    expect((ctx.dataHandler.postQuietly.calls.mostRecent().args[1] as FormData).has('folder_id')).toBeFalse();
  });

  /**
   * @description Changes of outputs go to their endpoints.
   * @input update, delete (to the trash / for good), restore, empty trash, bulk move / delete, zip
   * @output the expected DataHandler calls
   */
  it('changes outputs', () => {
    api.update(4, { name: 'A' }).subscribe();
    expect(ctx.dataHandler.put).toHaveBeenCalledWith('js-creator/outputs/4', { name: 'A' });
    api.delete(4).subscribe();
    expect(ctx.dataHandler.delete).toHaveBeenCalledWith('js-creator/outputs/4');
    api.delete(4, true).subscribe();
    expect(ctx.dataHandler.delete).toHaveBeenCalledWith('js-creator/outputs/4?force=1');
    api.restore(4).subscribe();
    expect(ctx.dataHandler.post).toHaveBeenCalledWith('js-creator/outputs/4/restore', {});
    api.emptyTrash().subscribe();
    expect(ctx.dataHandler.delete).toHaveBeenCalledWith('js-creator/outputs/trash');
    api.bulk('move', [1, 2], null).subscribe();
    expect(ctx.dataHandler.post).toHaveBeenCalledWith('js-creator/outputs/bulk', { action: 'move', ids: [1, 2], folder_id: null });
    api.bulk('delete', [1]).subscribe();
    expect(ctx.dataHandler.post).toHaveBeenCalledWith('js-creator/outputs/bulk', { action: 'delete', ids: [1] });
    api.zip([1, 2]).subscribe();
    expect(ctx.dataHandler.post).toHaveBeenCalledWith('js-creator/outputs/zip', { ids: [1, 2] });
  });
});
