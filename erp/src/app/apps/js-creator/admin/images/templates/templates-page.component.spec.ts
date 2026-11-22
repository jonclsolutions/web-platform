/**
 * @file templates-page.component.spec.ts
 * @path src/app/apps/js-creator/admin/images/templates/templates-page.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of TemplatesPageComponent: list with the sizes in use and "load more",
 *   filter and sorting in the request, a new template opens the editor, a copy and a copy to
 *   another size, the trash (delete, restore, delete for good, empty) and the permissions; the
 *   same page for blocks (route data kind 'block') and the background refresh of stale thumbnails.
 * @dependencies TemplatesPageComponent, admin-test-helpers.ts.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { TemplatesPageComponent } from './templates-page.component';
import { CreatorTemplate } from '../../shared/js-creator.models';
import { ThumbnailRefresherService } from '../../shared/thumbnail-refresher.service';
import { AdminTestContext, createAdminTestContext } from '../../../../../../testing/admin-test-helpers';

/**
 * @description Template of the list.
 * @param id Id.
 * @param size Width and height.
 */
function template(id: number, size: [number, number] = [1080, 1350]): CreatorTemplate {
  return {
    id, section: 'images', name: `T${id}`, width: size[0], height: size[1], output_format: 'png', output_quality: 90, caption_template: null,
    thumb_url: id === 1 ? `/thumb/${id}` : null, version: 1, created_at: null, updated_at: '2026-11-21 10:00:00', deleted_at: null,
  };
}

describe('TemplatesPageComponent', () => {
  let fixture: ComponentFixture<TemplatesPageComponent>;
  let component: TemplatesPageComponent;
  let ctx: AdminTestContext;
  let navigate: jasmine.Spy;

  /**
   * @description Creates the page.
   * @param granted Permissions.
   * @param kind Templates / blocks (route data).
   * @param before Called before the page is created (spies on services).
   */
  async function create(granted: string[] | 'all' = 'all', kind: 'template' | 'block' = 'template', before?: () => void): Promise<void> {
    ctx = createAdminTestContext({ granted });
    ctx.dataHandler.getPaginatedCollection.and.callFake(((url: string) => of(url.includes('page=2')
      ? { data: [template(3)], meta: { total: 3, per_page: 2, current_page: 2, last_page: 2 } }
      : { data: [template(1), template(2, [1080, 1920])], meta: { total: 3, per_page: 2, current_page: 1, last_page: 2, sizes: [{ width: 1080, height: 1350, count: 2 }, { width: 1080, height: 1920, count: 1 }] } })) as never);
    ctx.dataHandler.post.and.returnValue(of({ ...template(9), document: {} }) as never);
    await TestBed.configureTestingModule({
      imports: [TemplatesPageComponent],
      providers: [...ctx.providers, { provide: ActivatedRoute, useValue: { snapshot: { data: kind === 'block' ? { kind } : {} } } }],
    }).compileComponents();
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    before?.();
    fixture = TestBed.createComponent(TemplatesPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  /**
   * @description Cards with thumbnails (or the size), the sizes of the filter, "load more"; the
   *   filter and the sorting go to the request.
   * @input pages of 2 + 1; size filter 1080x1920; sorting by name
   * @output 2 cards (img + size text), 2 sizes; 3 items; request with size and sort_by=name&sort_direction=asc
   */
  it('lists, filters and sorts templates', async () => {
    await create();
    const cards = fixture.nativeElement.querySelectorAll('.tp-card');
    expect(cards.length).toBe(2);
    expect(cards[0].querySelector('img').getAttribute('src')).toBe('/thumb/1');
    expect(cards[1].querySelector('.tp-nothumb').textContent).toContain('1080 × 1920');
    expect(component.sizes.length).toBe(2);
    component.loadMore();
    expect(component.items.map(t => t.id)).toEqual([1, 2, 3]);

    component.sizeFilter = '1080x1920';
    component.sort = 'name';
    component.reload();
    const url = ctx.dataHandler.getPaginatedCollection.calls.mostRecent().args[0] as string;
    expect(url).toContain('js-creator/images/templates?');
    expect(url).toContain('size=1080x1920');
    expect(url).toContain('sort_by=name');
    expect(url).toContain('sort_direction=asc');
  });

  /**
   * @description A new template needs a name and a valid size and opens the editor; a copy keeps
   *   the size, a copy to another size sends it.
   * @input new without name; new "Akce" 1080 × 1350; copy of T1; copy of T1 to 1080 × 1920
   * @output error; POST templates {name, 1080, 1350} → editor of 9; POST …/1/duplicate {name}; {name, 1080, 1920}
   */
  it('creates and copies templates', async () => {
    await create();
    component.openCreate();
    component.submitDialog();
    expect(component.dialog?.error).toBe('js-creator-templates.error_name_required');
    component.dialog!.name = 'Akce';
    component.submitDialog();
    expect(ctx.dataHandler.post).toHaveBeenCalledWith('js-creator/images/templates', { name: 'Akce', width: 1080, height: 1350 });
    expect(navigate).toHaveBeenCalledWith(['/admin/js-creator/image-templates', 9, 'edit']);

    component.openDuplicate(template(1), 'duplicate');
    expect(component.dialog?.name).toBe('T1 (js-creator-templates.copy_suffix)');
    component.submitDialog();
    expect(ctx.dataHandler.post).toHaveBeenCalledWith('js-creator/images/templates/1/duplicate', { name: 'T1 (js-creator-templates.copy_suffix)' });

    component.openDuplicate(template(1), 'format');
    expect(component.dialog?.size).toEqual({ width: 1080, height: 1920 });
    component.setDialogSize({ width: 50, height: 1920 });
    component.submitDialog();
    expect(component.dialog?.error).toBe('js-creator-templates.error_size');
    component.setDialogSize({ width: 1080, height: 1920 });
    component.submitDialog();
    expect(ctx.dataHandler.post).toHaveBeenCalledWith('js-creator/images/templates/1/duplicate', { name: 'T1', width: 1080, height: 1920 });
  });

  /**
   * @description Trash: delete after a confirmation, the trash view, restore, delete for good,
   *   empty the trash.
   * @input remove T1; switch to trash; restore T2; destroy T2; empty
   * @output DELETE …/1; list with only_trashed=1; POST …/2/restore; DELETE …/2?force=1; DELETE …/trash
   */
  it('works with the trash', async () => {
    await create();
    await component.remove(template(1));
    expect(ctx.dataHandler.delete).toHaveBeenCalledWith('js-creator/images/templates/1');
    component.switchView('trash');
    expect(ctx.dataHandler.getPaginatedCollection.calls.mostRecent().args[0]).toContain('only_trashed=1');
    component.restore(template(2));
    expect(ctx.dataHandler.post).toHaveBeenCalledWith('js-creator/images/templates/2/restore', {});
    await component.destroy(template(2));
    expect(ctx.dataHandler.delete).toHaveBeenCalledWith('js-creator/images/templates/2?force=1');
    await component.emptyTrash();
    expect(ctx.dataHandler.delete).toHaveBeenCalledWith('js-creator/images/templates/trash');
  });

  /**
   * @description A view-only account sees the templates without the actions that change them.
   * @input permissions view only
   * @output no "New template", no copy / delete buttons, open (pencil) stays
   */
  it('hides changes without permissions', async () => {
    await create(['view-js-creator', 'js-creator-images-view']);
    expect(fixture.nativeElement.querySelector('app-page-header .ws-btn--primary')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.tp-card')[0].querySelectorAll('.ws-icon-btn').length).toBe(1);
  });

  /**
   * @description The main action of a card is Generate: the thumbnail and the button open
   *   generating; the pencil opens the editor; nothing opens from the trash.
   * @input click on the preview and on Generate of T1; open(T1); generate in the trash view
   * @output navigate to image-templates/1/generate (twice) and image-templates/1/edit; no navigation in the trash
   */
  it('opens generating as the main action', async () => {
    await create();
    const card: HTMLElement = fixture.nativeElement.querySelector('.tp-card');
    (card.querySelector('.tp-preview') as HTMLButtonElement).click();
    (card.querySelector('.tp-generate') as HTMLButtonElement).click();
    expect(navigate.calls.allArgs()).toEqual([
      [['/admin/js-creator/image-templates', 1, 'generate']], [['/admin/js-creator/image-templates', 1, 'generate']],
    ]);
    component.open(template(1));
    expect(navigate).toHaveBeenCalledWith(['/admin/js-creator/image-templates', 1, 'edit']);
    navigate.calls.reset();
    component.view = 'trash';
    component.generate(template(1));
    expect(navigate).not.toHaveBeenCalled();
  });
  /**
   * @description The page of blocks: blocks API, no size filter, the card opens the editor of the
   *   block, a block used by templates is not deleted (a message names them), an unused one is.
   * @input kind block; block 1 used by template "Post" (in the trash), block 2 unused; delete both
   * @output request js-creator/images/blocks?; no size select; navigate image-blocks/1/edit; alert
   *   with "Post" and no DELETE for 1; DELETE js-creator/images/blocks/2
   */
  it('lists blocks with the same page', async () => {
    await create('all', 'block');
    expect(ctx.dataHandler.getPaginatedCollection.calls.mostRecent().args[0]).toContain('js-creator/images/blocks?');
    expect(fixture.nativeElement.querySelectorAll('.tp-select').length).toBe(1);
    (fixture.nativeElement.querySelector('.tp-preview') as HTMLButtonElement).click();
    expect(navigate).toHaveBeenCalledWith(['/admin/js-creator/image-blocks', 1, 'edit']);
    expect(component.t('header')).toBe('js-creator-blocks.header');

    ctx.dataHandler.delete.and.returnValue(of(undefined) as never);
    await component.remove({ ...template(1), used_by: [{ id: 5, kind: 'template', name: 'Post', section: 'images', trashed: true }] });
    expect(ctx.alert.open).toHaveBeenCalledWith('js-creator-blocks.in_use_title', jasmine.stringContaining('„Post“'), 'warning');
    expect(ctx.dataHandler.delete).not.toHaveBeenCalled();
    await component.remove({ ...template(2), used_by: [] });
    expect(ctx.dataHandler.delete).toHaveBeenCalledWith('js-creator/images/blocks/2');
  });

  /**
   * @description Thumbnails made stale by a changed block are drawn again in the background and
   *   replaced in the grid.
   * @input template 1 with thumb_stale; the refresher answers a new URL
   * @output refresh('images', [1]); the card shows /new-thumb
   */
  it('draws stale thumbnails again', async () => {
    let refresh: jasmine.Spy | undefined;
    const stale = template(1);
    stale.thumb_stale = true;
    await create('all', 'template', () => {
      ctx.dataHandler.getPaginatedCollection.and.returnValue(of({ data: [stale, template(2)], meta: { total: 2, per_page: 48, current_page: 1, last_page: 1 } }) as never);
      refresh = spyOn(TestBed.inject(ThumbnailRefresherService), 'refresh').and.callFake(async (_section, _ids, done) => {
        done?.(1, '/new-thumb');
        return 1;
      });
    });
    for (let i = 0; i < 50 && component.items[0]?.thumb_url !== '/new-thumb'; i++) await new Promise(r => setTimeout(r, 10));
    expect(refresh).toHaveBeenCalledWith('images', [1], jasmine.any(Function));
    expect(component.items[0].thumb_url).toBe('/new-thumb');
  });
});
