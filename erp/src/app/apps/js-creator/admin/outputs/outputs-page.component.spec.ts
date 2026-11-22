/**
 * @file outputs-page.component.spec.ts
 * @path src/app/apps/js-creator/admin/outputs/outputs-page.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of OutputsPageComponent: loads the folders and the trash, creates /
 *   renames / moves a folder (names checked before sending), deletes after a confirmation, works
 *   with the trash, hides actions without permissions; lists the outputs of a folder and of a
 *   search, opens an output from the address, its detail (copy, rename, move, delete, generate
 *   again), selection (ZIP, move, delete) and the outputs of the trash.
 * @dependencies src/testing/admin-test-helpers.ts (admin doubles).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { OutputsPageComponent } from './outputs-page.component';
import { CreatorFolder, CreatorOutput } from '../shared/js-creator.models';
import { AdminTestContext, createAdminTestContext } from '../../../../../testing/admin-test-helpers';

/**
 * @description Folder of a test tree.
 * @param id Id.
 * @param parent Parent.
 * @param name Name.
 * @param deleted Deletion time.
 */
function folder(id: number, parent: number | null, name: string, deleted: string | null = null): CreatorFolder {
  return { id, parent_id: parent, name, created_at: null, updated_at: null, deleted_at: deleted };
}

/**
 * @description Output of the workspace.
 * @param id Id.
 * @param folderId Folder.
 * @param deleted Deletion time.
 */
function output(id: number, folderId: number | null, deleted: string | null = null): CreatorOutput {
  return {
    id, section: 'images', folder_id: folderId, name: `Post ${id}`, template_id: 7, template_name: 'Letní akce', caption: `Text ${id}`,
    width: 1080, height: 1350, format: 'png', page_count: 1, size_bytes: 2048, url: `/o/${id}`, thumb_url: `/t/${id}`, download_url: `/d/${id}`,
    created_at: '2026-11-22 10:00:00', updated_at: null, deleted_at: deleted,
  };
}

/**
 * @description Page of outputs answered by the API.
 * @param data Outputs.
 */
function page(data: CreatorOutput[]) {
  return { data, meta: { total: data.length, per_page: 48, current_page: 1, last_page: 1 } };
}

describe('OutputsPageComponent', () => {
  let fixture: ComponentFixture<OutputsPageComponent>;
  let component: OutputsPageComponent;
  let ctx: AdminTestContext;
  const folders = [folder(1, null, 'Kampaně'), folder(2, 1, 'Léto')];
  const trashed = [folder(9, null, 'Staré', '2026-11-20 10:00:00')];
  /** Folders the API answers with (a test adds the created one). */
  let served: CreatorFolder[];

  /**
   * @description Creates the page with the given permissions.
   * @param granted Permissions of the account.
   */
  async function create(granted: string[] | 'all' = 'all', query: Record<string, string> = {}): Promise<void> {
    ctx = createAdminTestContext({ granted });
    served = [...folders];
    ctx.dataHandler.getCollection.and.callFake(((url: string, params?: { only_trashed?: number }) =>
      of(url === 'js-creator/folders' ? (params?.only_trashed ? trashed : served) : [])) as never);
    ctx.dataHandler.getPaginatedCollection.and.callFake(((url: string) => of(
      url.includes('only_trashed=1') ? page([output(8, null, '2026-11-21 09:00:00')])
        : url.includes('search=') ? page([output(1, null), output(2, 2)])
          : url.includes('folder_id=2') ? page([output(2, 2), output(3, 2)])
            : page([output(1, null)]),
    )) as never);
    ctx.dataHandler.post.and.returnValue(of(folder(5, 1, 'Nová')));
    const providers = [...ctx.providers];
    if (Object.keys(query).length) {
      providers.push({ provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } });
    }
    await TestBed.configureTestingModule({ imports: [OutputsPageComponent], providers }).compileComponents();
    fixture = TestBed.createComponent(OutputsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  /**
   * @description The folders and the trash are loaded; the trash count (folders and outputs) is
   *   on its button.
   * @input folders [Kampaně > Léto], trash [Staré] + one output in the trash
   * @output tree rows; view button of the trash with count 2
   */
  it('loads the folders and the trash', async () => {
    await create();
    expect(component.folders.length).toBe(2);
    expect(component.trashed.length).toBe(1);
    expect(component.viewItems[1].count).toBe(2);
    expect(fixture.nativeElement.querySelector('app-folder-tree')).not.toBeNull();
  });

  /**
   * @description A new folder: empty name and a taken name are refused here; a free one is sent
   *   and becomes the selection.
   * @input openCreate(1); names "", " léto ", "Nová"
   * @output errors name_required / name_taken without a request; POST {name: Nová, parent_id: 1}; selectedId 5
   */
  it('creates a folder with checked names', async () => {
    await create();
    component.openCreate(1);
    component.submitDialog();
    expect(component.dialog!.error).toBe('js-creator-outputs.error_name_required');
    component.dialog!.name = ' léto ';
    component.submitDialog();
    expect(component.dialog!.error).toBe('js-creator-outputs.error_name_taken');
    expect(ctx.dataHandler.post).not.toHaveBeenCalled();

    component.dialog!.name = 'Nová';
    served = [...folders, folder(5, 1, 'Nová')];
    component.submitDialog();
    expect(ctx.dataHandler.post).toHaveBeenCalledWith('js-creator/folders', { name: 'Nová', parent_id: 1 });
    expect(component.dialog).toBeNull();
    expect(component.selectedId).toBe(5);
  });

  /**
   * @description Moving offers only allowed targets and sends the new parent; renaming sends the
   *   name.
   * @input openMove(Léto) → targets; target top; openRename(Kampaně) "Akce"
   * @output targets [top, Kampaně]; PUT folders/2 {parent_id: null}; PUT folders/1 {name: Akce}
   */
  it('moves and renames a folder', async () => {
    await create();
    component.openMove(folders[1]);
    expect(component.moveTargets.map(t => t.id)).toEqual([null, 1]);
    component.dialog!.targetId = null;
    component.submitDialog();
    expect(ctx.dataHandler.put).toHaveBeenCalledWith('js-creator/folders/2', { parent_id: null });

    component.openRename(folders[0]);
    component.dialog!.name = 'Akce';
    component.submitDialog();
    expect(ctx.dataHandler.put).toHaveBeenCalledWith('js-creator/folders/1', { name: 'Akce' });
  });

  /**
   * @description Delete asks first and moves the selection up when the selected folder goes;
   *   the trash restores, deletes for good and empties.
   * @input select 2, remove(Kampaně); restore / destroy / emptyTrash of the trash
   * @output confirm; DELETE folders/1; selectedId null; POST restore; DELETE ?force=1; DELETE folders/trash
   */
  it('deletes to the trash and works with the trash', async () => {
    await create();
    component.select(2);
    await component.remove(folders[0]);
    expect(ctx.confirm.open).toHaveBeenCalled();
    expect(ctx.dataHandler.delete).toHaveBeenCalledWith('js-creator/folders/1');
    expect(component.selectedId).toBeNull();

    component.restore(trashed[0]);
    expect(ctx.dataHandler.post).toHaveBeenCalledWith('js-creator/folders/9/restore', {});
    await component.destroy(trashed[0]);
    expect(ctx.dataHandler.delete).toHaveBeenCalledWith('js-creator/folders/9?force=1');
    await component.emptyTrash();
    expect(ctx.dataHandler.delete).toHaveBeenCalledWith('js-creator/folders/trash');
  });

  /**
   * @description A cancelled confirmation sends nothing.
   * @input confirm answers false; remove(Kampaně)
   * @output no DELETE
   */
  it('does nothing when the deletion is cancelled', async () => {
    await create();
    ctx.confirm.open.and.returnValue(Promise.resolve(false));
    await component.remove(folders[0]);
    expect(ctx.dataHandler.delete).not.toHaveBeenCalled();
  });

  /**
   * @description With view only, no button changes anything.
   * @input permissions view-js-creator + js-creator-images-view
   * @output no "new folder" button, flags false
   */
  it('offers no changes with view only', async () => {
    await create(['view-js-creator', 'js-creator-images-view']);
    expect([component.canCreate, component.canUpdate, component.canDelete]).toEqual([false, false, false]);
    expect(fixture.nativeElement.querySelector('.op-tree-head .ws-btn')).toBeNull();
  });

  /**
   * @description The outputs of the top level are listed; selecting a folder lists its outputs;
   *   a search looks into every folder and shows the folder of each result.
   * @input start; select(2); search "a"
   * @output Post 1; Post 2 + Post 3 (folder_id=2); 2 results, folder path "Kampaně / Léto"
   */
  it('lists the outputs of a folder and of a search', async () => {
    await create();
    expect(component.outputs.map(o => o.id)).toEqual([1]);
    expect(ctx.dataHandler.getPaginatedCollection).toHaveBeenCalledWith('js-creator/outputs?page=1&sort_by=created_at&sort_direction=desc');
    component.select(2);
    expect(component.outputs.map(o => o.id)).toEqual([2, 3]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.op-card').length).toBe(2);

    jasmine.clock().install();
    component.search = 'a';
    component.onSearch();
    jasmine.clock().tick(400);
    jasmine.clock().uninstall();
    expect(component.outputs.length).toBe(2);
    expect(component.folderPath(component.outputs[1])).toBe('Kampaně / Léto');
    expect(component.folderPath(component.outputs[0])).toBe('js-creator-outputs.root');
  });

  /**
   * @description `?folder=2&output=3` opens the folder and the detail of the output; the detail
   *   copies the text of the post, renames, moves, deletes and generates again.
   * @input query folder 2, output 3; copy; rename "Nové"; move to the top; delete; generate again
   * @output detail of 3; clipboard "Text 3"; PUT outputs/3 {name}; PUT {folder_id: null}; DELETE outputs/3
   *   after a confirmation and the detail closed; navigate to image-templates/7/generate
   */
  it('opens an output from the address and works with its detail', async () => {
    await create('all', { folder: '2', output: '3' });
    expect(component.selectedId).toBe(2);
    expect(component.detail?.id).toBe(3);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.op-detail')).not.toBeNull();

    const clipboard = spyOn(navigator.clipboard, 'writeText').and.resolveTo();
    await component.copyCaption(component.detail!);
    expect(clipboard).toHaveBeenCalledWith('Text 3');
    expect(component.copied).toBeTrue();

    ctx.dataHandler.put.and.returnValue(of(output(3, 2)) as never);
    component.openRenameOutput(component.detail!);
    component.outputDialog!.name = ' ';
    component.submitOutputDialog();
    expect(component.outputDialog!.error).toBe('js-creator-outputs.error_output_name_required');
    component.outputDialog!.name = 'Nové';
    component.submitOutputDialog();
    expect(ctx.dataHandler.put).toHaveBeenCalledWith('js-creator/outputs/3', { name: 'Nové' });
    component.openMoveOutput(component.detail!);
    component.setOutputTarget('');
    component.submitOutputDialog();
    expect(ctx.dataHandler.put).toHaveBeenCalledWith('js-creator/outputs/3', { folder_id: null });

    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    component.generateAgain(component.detail!);
    expect(navigate).toHaveBeenCalledWith(['/admin/js-creator/image-templates', 7, 'generate']);
    await component.removeOutput(component.detail!);
    expect(ctx.confirm.open).toHaveBeenCalled();
    expect(ctx.dataHandler.delete).toHaveBeenCalledWith('js-creator/outputs/3');
    expect(component.detail).toBeNull();
  });

  /**
   * @description Several outputs: select all, download as a ZIP (the signed URL is opened as a
   *   download), move them and delete them after a confirmation.
   * @input folder 2 with outputs 2 and 3; select all; ZIP; move to folder 1; delete
   * @output POST outputs/zip {ids [2, 3]} and a link clicked; POST outputs/bulk move to 1; bulk delete; selection cleared
   */
  it('works with several outputs', async () => {
    await create();
    component.select(2);
    component.toggleAll();
    expect(component.allSelected).toBeTrue();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.ws-selection')).not.toBeNull();

    const click = spyOn(HTMLAnchorElement.prototype, 'click');
    ctx.dataHandler.post.and.returnValue(of({ url: '/api/js-creator/files/zip?x', count: 2, bytes: 10 }) as never);
    component.downloadZip();
    expect(ctx.dataHandler.post).toHaveBeenCalledWith('js-creator/outputs/zip', { ids: [2, 3] });
    expect(click).toHaveBeenCalled();

    ctx.dataHandler.post.and.returnValue(of({ count: 2 }) as never);
    component.openBulkMove();
    component.setOutputTarget('1');
    component.submitOutputDialog();
    expect(ctx.dataHandler.post).toHaveBeenCalledWith('js-creator/outputs/bulk', { action: 'move', ids: [2, 3], folder_id: 1 });
    expect(component.selected.size).toBe(0);

    component.toggle(component.outputs[0]);
    await component.removeSelected();
    expect(ctx.dataHandler.post).toHaveBeenCalledWith('js-creator/outputs/bulk', { action: 'delete', ids: [2] });
  });

  /**
   * @description The trash lists the deleted outputs beside the folders; an output is restored or
   *   deleted for good; emptying empties both.
   * @input switch to the trash; restore / destroy output 8; empty
   * @output output 8 listed, count 2 on the trash button; POST outputs/8/restore; DELETE outputs/8?force=1;
   *   DELETE folders/trash and outputs/trash
   */
  it('works with the outputs of the trash', async () => {
    await create();
    expect(component.viewItems[1].count).toBe(2);
    component.switchView('trash');
    expect(component.outputs.map(o => o.id)).toEqual([8]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.op-card').length).toBe(1);
    component.restoreOutput(component.outputs[0]);
    expect(ctx.dataHandler.post).toHaveBeenCalledWith('js-creator/outputs/8/restore', {});
    await component.destroyOutput(component.outputs[0]);
    expect(ctx.dataHandler.delete).toHaveBeenCalledWith('js-creator/outputs/8?force=1');
    await component.emptyTrash();
    expect(ctx.dataHandler.delete).toHaveBeenCalledWith('js-creator/folders/trash');
    expect(ctx.dataHandler.delete).toHaveBeenCalledWith('js-creator/outputs/trash');
  });

  /**
   * @description A carousel output: the card shows the number of slides, the detail switches the
   *   slides and downloads one slide or all of them as a ZIP.
   * @input output 4 with 3 pages; detail; next slide twice, once more; download slides
   * @output badge "3" (title with the word for 2–4); picture /p/1 → /p/3, stays at 3; download link /dp/3; POST outputs/zip {ids [4]}
   */
  it('shows the slides of a carousel output', async () => {
    await create();
    const carousel: CreatorOutput = {
      ...output(4, null), page_count: 3,
      pages: [1, 2, 3].map(n => ({ page: n, url: `/p/${n}`, thumb_url: `/tp/${n}`, download_url: `/dp/${n}` })),
    };
    component.outputs = [carousel];
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.op-slides').textContent.trim()).toBe('3');
    expect(fixture.nativeElement.querySelector('.op-slides').getAttribute('title')).toBe('3 js-creator-outputs.slides_few');
    expect(component.slideCount(5)).toBe('5 js-creator-outputs.slides');

    component.openDetail(carousel);
    fixture.detectChanges();
    const picture = () => (document.querySelector('.op-detail-picture img') as HTMLImageElement).getAttribute('src');
    expect(picture()).toBe('/p/1');
    component.showSlide(1);
    component.showSlide(2);
    component.showSlide(3);
    fixture.detectChanges();
    expect(component.slide).toBe(2);
    expect(picture()).toBe('/p/3');
    expect((document.querySelector('a.op-download') as HTMLAnchorElement).getAttribute('href')).toBe('/dp/3');

    spyOn(HTMLAnchorElement.prototype, 'click');
    ctx.dataHandler.post.and.returnValue(of({ url: '/zip', count: 1, bytes: 10 }) as never);
    component.downloadZip([carousel.id]);
    expect(ctx.dataHandler.post).toHaveBeenCalledWith('js-creator/outputs/zip', { ids: [4] });
    component.closeDetail();
  });

  /**
   * @description Filters by template and period list outputs of every folder (their folder is
   *   shown, a note says so); the templates of the filter come from the API.
   * @input outputs/templates [Letní akce]; template 7; period week
   * @output request with template_id=7; then period=week; filter note shown
   */
  it('filters outputs by template and period', async () => {
    await create();
    ctx.dataHandler.getCollection.and.callFake(((url: string) => of(url === 'js-creator/outputs/templates' ? [{ id: 7, name: 'Letní akce' }] : [])) as never);
    component.ngOnInit();
    fixture.detectChanges();
    expect(component.templateRefs.map(r => r.name)).toEqual(['Letní akce']);

    component.templateFilter = 7;
    component.reload();
    let url = String(ctx.dataHandler.getPaginatedCollection.calls.mostRecent().args[0]);
    expect(url).toContain('template_id=7');
    component.periodFilter = 'week';
    component.reload();
    fixture.detectChanges();
    url = String(ctx.dataHandler.getPaginatedCollection.calls.mostRecent().args[0]);
    expect(url).toContain('period=week');
    expect(component.acrossFolders).toBeTrue();
    expect(fixture.nativeElement.querySelector('.op-search-note').textContent).toContain('js-creator-outputs.filter_note');
  });
});
