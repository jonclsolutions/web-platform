/**
 * @file js-creator-api.service.spec.ts
 * @path src/app/apps/js-creator/admin/shared/js-creator-api.service.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of JsCreatorApiService: every call goes to its endpoint of
 *   `/api/js-creator/…` with the right method and payload.
 * @dependencies src/testing/admin-test-helpers.ts (DataHandler spy).
 */

import { TestBed } from '@angular/core/testing';
import { JsCreatorApiService } from './js-creator-api.service';
import { AdminTestContext, createAdminTestContext } from '../../../../../testing/admin-test-helpers';

describe('JsCreatorApiService', () => {
  let ctx: AdminTestContext;
  let service: JsCreatorApiService;

  beforeEach(() => {
    ctx = createAdminTestContext();
    TestBed.configureTestingModule({ providers: ctx.providers });
    service = TestBed.inject(JsCreatorApiService);
  });

  /**
   * @description Folder calls (list, trash, create, update, delete, force, restore, empty).
   * @input each folder method
   * @output the endpoints and payloads of FolderController
   */
  it('calls the folder endpoints', () => {
    service.folders().subscribe();
    service.folders(true).subscribe();
    service.createFolder('A', 3).subscribe();
    service.updateFolder(5, { parent_id: null }).subscribe();
    service.deleteFolder(5).subscribe();
    service.deleteFolder(5, true).subscribe();
    service.restoreFolder(5).subscribe();
    service.emptyFolderTrash().subscribe();

    expect(ctx.dataHandler.getCollection.calls.allArgs()).toEqual([['js-creator/folders', undefined], ['js-creator/folders', { only_trashed: 1 }]]);
    expect(ctx.dataHandler.post).toHaveBeenCalledWith('js-creator/folders', { name: 'A', parent_id: 3 });
    expect(ctx.dataHandler.put).toHaveBeenCalledWith('js-creator/folders/5', { parent_id: null });
    expect(ctx.dataHandler.delete.calls.allArgs()).toEqual([['js-creator/folders/5'], ['js-creator/folders/5?force=1'], ['js-creator/folders/trash']]);
    expect(ctx.dataHandler.post).toHaveBeenCalledWith('js-creator/folders/5/restore', {});
  });

  /**
   * @description Library calls: page with search / trash, multipart upload of one image, font
   *   upload with its face.
   * @input assets page 2 search "logo" in the trash; uploadAsset; uploadFont
   * @output URL with page, search, only_trashed; FormData files[] / file + family, weight, style
   */
  it('calls the library endpoints', () => {
    service.assets({ page: 2, search: 'logo', trashed: true }).subscribe();
    expect(ctx.dataHandler.getPaginatedCollection).toHaveBeenCalledWith('js-creator/library/assets?page=2&search=logo&only_trashed=1');

    const image = new File(['x'], 'a.png', { type: 'image/png' });
    service.uploadAsset(image).subscribe();
    const imageData = ctx.dataHandler.upload.calls.mostRecent().args[1] as FormData;
    expect(ctx.dataHandler.upload.calls.mostRecent().args[0]).toBe('js-creator/library/assets');
    expect((imageData.getAll('files[]')[0] as File).name).toBe('a.png');

    service.uploadFont(new File(['wOF2'], 'b.woff2'), { family: 'Brand', weight: 700, style: 'italic' }).subscribe();
    const fontData = ctx.dataHandler.upload.calls.mostRecent().args[1] as FormData;
    expect([fontData.get('family'), fontData.get('weight'), fontData.get('style')]).toEqual(['Brand', '700', 'italic']);

    service.renameAsset(4, 'N').subscribe();
    service.deleteFont(9, true).subscribe();
    expect(ctx.dataHandler.put).toHaveBeenCalledWith('js-creator/library/assets/4', { name: 'N' });
    expect(ctx.dataHandler.delete).toHaveBeenCalledWith('js-creator/library/fonts/9?force=1');
  });

  /**
   * @description Usage and settings calls.
   * @input usage, settings, updateSettings, quotaAccounts, updateQuota(null)
   * @output the endpoints of UsageController and SettingsController
   */
  it('calls the usage and settings endpoints', () => {
    service.usage().subscribe();
    service.settings().subscribe();
    service.updateSettings({ default_quota_mb: 2048 }).subscribe();
    service.quotaAccounts().subscribe();
    service.updateQuota(7, null).subscribe();
    expect(ctx.dataHandler.get.calls.allArgs()).toEqual([['js-creator/usage'], ['js-creator/settings']]);
    expect(ctx.dataHandler.put).toHaveBeenCalledWith('js-creator/settings', { default_quota_mb: 2048 });
    expect(ctx.dataHandler.getCollection).toHaveBeenCalledWith('js-creator/settings/users');
    expect(ctx.dataHandler.put).toHaveBeenCalledWith('js-creator/settings/users/7/quota', { quota_mb: null });
  });
});
