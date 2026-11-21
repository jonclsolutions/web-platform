/**
 * @file library-images.component.spec.ts
 * @path src/app/apps/js-creator/admin/library/library-images/library-images.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of LibraryImagesComponent: the first page and "load more", uploads one
 *   file per request, refuses wrong files and a full quota before sending, rename, trash.
 * @dependencies src/testing/admin-test-helpers.ts (admin doubles, upload rules stub).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { LibraryImagesComponent } from './library-images.component';
import { CreatorAsset } from '../../shared/js-creator.models';
import { WorkspaceUsageService } from '../../shared/workspace-usage.service';
import { AdminTestContext, createAdminTestContext } from '../../../../../../testing/admin-test-helpers';

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
    TestBed.inject(WorkspaceUsageService).usage.set({ used_bytes: 1000, quota_bytes: 1000, trash_bytes: 0, counts: { folders: 0, images: 0, fonts: 0 } });
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
});
