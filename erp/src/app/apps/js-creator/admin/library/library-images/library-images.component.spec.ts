/**
 * @file library-images.component.spec.ts
 * @path src/app/apps/js-creator/admin/library/library-images/library-images.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of LibraryImagesComponent: the first page and "load more", uploads one
 *   file per request, refuses wrong files and a full quota before sending, rename, trash, a used
 *   image is not deleted; the texts of the popup buttons exist.
 * @dependencies src/testing/admin-test-helpers.ts (admin doubles, upload rules stub).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { LibraryImagesComponent } from './library-images.component';
import { CreatorAsset } from '../../shared/js-creator.models';
import { WorkspaceUsageService } from '../../shared/workspace-usage.service';
import { AdminTestContext, createAdminTestContext } from '../../../../../../testing/admin-test-helpers';
import cz from '../../i18n/cz.json';
import en from '../../i18n/en.json';

/**
 * @description Image of the API.
 * @param id Id.
 * @param name Name.
 */
function asset(id: number, name = `img${id}`): CreatorAsset {
  return { id, name, mime: 'image/png', width: 100, height: 50, size_bytes: 2048, url: `/api/o/${id}`, thumb_url: `/api/t/${id}`, created_at: null, deleted_at: null };
}

describe('LibraryImagesComponent', () => {
  let fixture: ComponentFixture<LibraryImagesComponent>;
  let component: LibraryImagesComponent;
  let ctx: AdminTestContext;

  beforeEach(async () => {
    ctx = createAdminTestContext();
    ctx.dataHandler.getPaginatedCollection.and.callFake(((url: string) => of(url.includes('page=2')
      ? { data: [asset(3)], meta: { total: 3, per_page: 2, current_page: 2, last_page: 2 } }
      : { data: [asset(1), asset(2)], meta: { total: 3, per_page: 2, current_page: 1, last_page: 2 } })) as never);
    ctx.dataHandler.upload.and.returnValue(of([asset(4)]));
    await TestBed.configureTestingModule({ imports: [LibraryImagesComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(LibraryImagesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  /**
   * @description The first page is shown with "load more", which appends the next page.
   * @input pages of 2 + 1 images
   * @output 2 cards with thumbnails; loadMore → 3 items, page 2
   */
  it('lists the images page by page', () => {
    expect(fixture.nativeElement.querySelectorAll('.ws-card').length).toBe(2);
    expect(fixture.nativeElement.querySelector('.ws-card img').getAttribute('src')).toBe('/api/t/1');
    component.loadMore();
    expect(component.items.map(i => i.id)).toEqual([1, 2, 3]);
    expect(component.page).toBe(2);
  });

  /**
   * @description Allowed files are uploaded one per request; a wrong type or a too large file is
   *   refused with a message and not sent.
   * @input a.png, b.webp, c.gif, d.jpg of 16 MB
   * @output two uploads (a, b); alert upload_refused with c.gif and d.jpg
   */
  it('uploads allowed files one by one', () => {
    const big = new File([new Uint8Array(1)], 'd.jpg');
    Object.defineProperty(big, 'size', { value: 16 * 1024 * 1024 });
    component.upload([new File(['x'], 'a.png'), new File(['x'], 'b.webp'), new File(['x'], 'c.gif'), big]);

    expect(ctx.dataHandler.upload).toHaveBeenCalledTimes(2);
    expect(ctx.alert.open.calls.mostRecent().args[0]).toBe('js-creator-library.upload_refused_title');
    expect(ctx.alert.open.calls.mostRecent().args[1]).toContain('c.gif, d.jpg');
    expect(component.uploading).toBeNull();
  });

  /**
   * @description Files that do not fit into the quota are not sent.
   * @input usage 1000 of 1000 bytes; a.png
   * @output alert quota_full_title; no upload
   */
  it('refuses files over the quota', () => {
    TestBed.inject(WorkspaceUsageService).usage.set({ used_bytes: 1000, quota_bytes: 1000, trash_bytes: 0, counts: { folders: 0, images: 0, fonts: 0, templates: 0, outputs: 0 } });
    component.upload([new File(['x'], 'a.png')]);
    expect(ctx.alert.open.calls.mostRecent().args[0]).toBe('js-creator-library.quota_full_title');
    expect(ctx.dataHandler.upload).not.toHaveBeenCalled();
  });

  /**
   * @description Rename needs a name; trash actions call their endpoints after confirmations.
   * @input rename to "" then "Logo"; remove, switch to trash, restore, destroy, emptyTrash
   * @output error; PUT {name: Logo}; DELETE …/1; POST …/1/restore; DELETE ?force=1; DELETE trash
   */
  it('renames and works with the trash', async () => {
    component.openRename(asset(1));
    component.renaming!.name = ' ';
    component.submitRename();
    expect(component.renaming!.error).toBe('js-creator-library.error_name_required');
    component.renaming!.name = 'Logo';
    component.submitRename();
    expect(ctx.dataHandler.put).toHaveBeenCalledWith('js-creator/library/assets/1', { name: 'Logo' });

    await component.remove(asset(1));
    expect(ctx.dataHandler.delete).toHaveBeenCalledWith('js-creator/library/assets/1');
    component.switchView('trash');
    expect(ctx.dataHandler.getPaginatedCollection).toHaveBeenCalledWith('js-creator/library/assets?page=1&only_trashed=1');
    component.restore(asset(1));
    expect(ctx.dataHandler.post).toHaveBeenCalledWith('js-creator/library/assets/1/restore', {});
    await component.destroy(asset(1));
    expect(ctx.dataHandler.delete).toHaveBeenCalledWith('js-creator/library/assets/1?force=1');
    await component.emptyTrash();
    expect(ctx.dataHandler.delete).toHaveBeenCalledWith('js-creator/library/assets/trash');
  });

  /**
   * @description An image used by templates is not deleted (to the trash or for good): a message
   *   names the templates, a trashed one marked.
   * @input image with used_by [Post, Old (trashed)]; remove; destroy
   * @output alert in_use_title naming „Post“ and „Old“ (in_use_trashed); no DELETE, no confirmation
   */
  it('refuses to delete a used image', async () => {
    const used = { ...asset(1), used_by: [{ id: 3, name: 'Post', section: 'images', trashed: false }, { id: 4, name: 'Old', section: 'images', trashed: true }] };
    await component.remove(used);
    await component.destroy(used);
    expect(ctx.alert.open).toHaveBeenCalledTimes(2);
    expect(ctx.alert.open.calls.mostRecent().args[0]).toBe('js-creator-library.in_use_title');
    expect(ctx.alert.open.calls.mostRecent().args[1]).toContain('„Post“, „Old“ (js-creator-library.in_use_trashed)');
    expect(ctx.confirm.open).not.toHaveBeenCalled();
    expect(ctx.dataHandler.delete).not.toHaveBeenCalled();
  });

  /**
   * @description The buttons of the popups of the library (rename an image, upload / change a
   *   font) have texts in both languages - a missing key would show "Cannot load text".
   * @input keys of the section js-creator-library used by the popups.
   * @output every key is a non-empty text in cz and en.
   */
  it('popup buttons have their texts in both languages', () => {
    for (const lang of [cz, en] as Record<string, Record<string, string>>[]) {
      for (const key of ['cancel', 'save', 'upload']) expect(lang['js-creator-library'][key]).toBeTruthy();
    }
  });

  /**
   * @description The own icons (kind icon): their own list, upload and trash; PNG / JPG only;
   *   texts of the icons in both languages.
   * @input component with kind "icon"; upload a.png, b.webp; empty the trash
   * @output list with kind=icon; one upload with kind icon (b.webp refused); DELETE …/trash?kind=icon;
   *   icon texts in cz and en
   */
  it('manages the own icons', async () => {
    const icons = TestBed.createComponent(LibraryImagesComponent);
    icons.componentInstance.kind = 'icon';
    icons.detectChanges();
    expect(ctx.dataHandler.getPaginatedCollection.calls.mostRecent().args[0]).toContain('kind=icon');
    expect(icons.nativeElement.querySelector('.ws-panel-title').textContent).toContain('js-creator-library.own_icons_title');
    expect(icons.componentInstance.t('upload_images')).toBe('js-creator-library.icon_upload_images');

    icons.componentInstance.upload([new File(['x'], 'a.png'), new File(['x'], 'b.webp')]);
    expect(ctx.dataHandler.upload).toHaveBeenCalledTimes(1);
    const form = ctx.dataHandler.upload.calls.mostRecent().args[1] as FormData;
    expect(form.get('kind')).toBe('icon');
    expect(ctx.alert.open.calls.mostRecent().args[1]).toContain('b.webp');

    ctx.dataHandler.delete.and.returnValue(of(undefined) as never);
    await icons.componentInstance.emptyTrash();
    expect(ctx.dataHandler.delete).toHaveBeenCalledWith('js-creator/library/assets/trash?kind=icon');
    for (const lang of [cz, en] as Record<string, Record<string, string>>[]) {
      for (const key of ['own_icons_title', 'own_icons_hint', 'icon_max_edge', 'icon_upload_images', 'icon_images_empty', 'icon_delete_image_text',
        'icon_empty_images_trash_text', 'icon_in_use_image', 'icon_drop_hint']) {
        expect(lang['js-creator-library'][key]).withContext(key).toBeTruthy();
      }
    }
  });

  /**
   * @description Multiselect of the images: one image is downloaded under its download URL,
   *   several as a ZIP; a bulk delete names used images; texts in both languages.
   * @input checkbox of img1 + download; select all + download; delete answered with a skipped used image
   * @output link to /api/o/1 (no download_url); POST library/assets/zip [1, 2] → link /zip;
   *   POST library/assets/bulk {delete, [1, 2]}; alert bulk_skipped_files_title with „img1“ (Post)
   */
  it('selects, downloads and deletes images in bulk', async () => {
    const click = spyOn(HTMLAnchorElement.prototype, 'click');
    (fixture.nativeElement.querySelector('.ws-card .ws-check input') as HTMLInputElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.ws-card').classList).toContain('ws-card--selected');
    component.download();
    expect((click.calls.mostRecent().object as HTMLAnchorElement).getAttribute('href')).toBe('/api/o/1');
    component.download({ ...asset(2), download_url: '/api/d/2' });
    expect((click.calls.mostRecent().object as HTMLAnchorElement).getAttribute('href')).toBe('/api/d/2');

    component.toggleAll();
    ctx.dataHandler.post.and.returnValue(of({ url: '/zip', count: 2, bytes: 4096 }) as never);
    component.download();
    expect(ctx.dataHandler.post).toHaveBeenCalledWith('js-creator/library/assets/zip', { ids: [1, 2] });
    expect((click.calls.mostRecent().object as HTMLAnchorElement).getAttribute('href')).toBe('/zip');

    ctx.dataHandler.post.and.returnValue(of({ count: 1, skipped: [{ id: 1, name: 'img1', reason: 'in_use', used_by: [{ id: 5, kind: 'template', name: 'Post', section: 'images', trashed: false }] }] }) as never);
    await component.bulk('delete');
    expect(ctx.dataHandler.post).toHaveBeenCalledWith('js-creator/library/assets/bulk', { action: 'delete', ids: [1, 2] });
    expect(ctx.alert.open).toHaveBeenCalledWith('js-creator-shared.bulk_skipped_files_title', jasmine.stringContaining('„img1“ (Post)'), 'warning');
    for (const lang of [cz, en] as Record<string, Record<string, string>>[]) {
      for (const key of ['download', 'download_zip', 'bulk_skipped_files_title', 'bulk_skipped_files_text']) {
        expect(lang['js-creator-shared'][key]).withContext(key).toBeTruthy();
      }
    }
  });
});
