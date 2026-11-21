/**
 * @file outputs-page.component.spec.ts
 * @path src/app/apps/js-creator/admin/outputs/outputs-page.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of OutputsPageComponent: loads the folders and the trash, creates /
 *   renames / moves a folder (names checked before sending), deletes after a confirmation, works
 *   with the trash, and hides actions without permissions.
 * @dependencies src/testing/admin-test-helpers.ts (admin doubles).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { OutputsPageComponent } from './outputs-page.component';
import { CreatorFolder } from '../shared/js-creator.models';
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
  async function create(granted: string[] | 'all' = 'all'): Promise<void> {
    ctx = createAdminTestContext({ granted });
    served = [...folders];
    ctx.dataHandler.getCollection.and.callFake(((url: string, params?: { only_trashed?: number }) =>
      of(url === 'js-creator/folders' ? (params?.only_trashed ? trashed : served) : [])) as never);
    ctx.dataHandler.post.and.returnValue(of(folder(5, 1, 'Nová')));
    await TestBed.configureTestingModule({ imports: [OutputsPageComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(OutputsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  /**
   * @description The folders and the trash are loaded; the trash count is on its button.
   * @input folders [Kampaně > Léto], trash [Staré]
   * @output tree rows; view button of the trash with count 1
   */
  it('loads the folders and the trash', async () => {
    await create();
    expect(component.folders.length).toBe(2);
    expect(component.trashed.length).toBe(1);
    expect(component.viewItems[1].count).toBe(1);
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
});
