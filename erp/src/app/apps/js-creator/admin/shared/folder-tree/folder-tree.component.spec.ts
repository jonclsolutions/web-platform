/**
 * @file folder-tree.component.spec.ts
 * @path src/app/apps/js-creator/admin/shared/folder-tree/folder-tree.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of FolderTreeComponent: the expanded path of the selection, selecting,
 *   the actions of a row by permission, and drag and drop only where a move is allowed.
 * @dependencies src/testing/admin-test-helpers.ts (admin doubles).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FolderTreeComponent } from './folder-tree.component';
import { CreatorFolder } from '../js-creator.models';
import { createAdminTestContext } from '../../../../../../testing/admin-test-helpers';

/**
 * @description Folder of a test tree.
 * @param id Id.
 * @param parent Parent.
 * @param name Name.
 */
function folder(id: number, parent: number | null, name: string): CreatorFolder {
  return { id, parent_id: parent, name, created_at: null, updated_at: null, deleted_at: null };
}

describe('FolderTreeComponent', () => {
  let fixture: ComponentFixture<FolderTreeComponent>;
  let component: FolderTreeComponent;
  const folders = [folder(1, null, 'Kampaně'), folder(2, 1, 'Léto'), folder(3, null, 'Archiv')];

  /**
   * @description Creates the tree with the given permissions and selection.
   * @param can create / update / delete flags.
   * @param selectedId Selected folder.
   */
  async function create(can: boolean, selectedId: number | null = null): Promise<void> {
    await TestBed.configureTestingModule({ imports: [FolderTreeComponent], providers: createAdminTestContext().providers }).compileComponents();
    fixture = TestBed.createComponent(FolderTreeComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('folders', folders);
    fixture.componentRef.setInput('selectedId', selectedId);
    fixture.componentRef.setInput('canCreate', can);
    fixture.componentRef.setInput('canUpdate', can);
    fixture.componentRef.setInput('canDelete', can);
    fixture.detectChanges();
  }

  /**
   * @description The path to the selected folder is expanded; a click on a name selects it.
   * @input selection 2 (inside 1); click on "Archiv"
   * @output rows root, Archiv, Kampaně, Léto; selected emits 3
   */
  it('shows the selected path and selects a folder', async () => {
    await create(true, 2);
    const names = Array.from(fixture.nativeElement.querySelectorAll('.ft-name') as NodeListOf<HTMLElement>).map(el => el.textContent!.trim());
    expect(names).toEqual(['js-creator-outputs.root', 'Archiv', 'Kampaně', 'Léto']);

    const selected = jasmine.createSpy('selected');
    component.selected.subscribe(selected);
    (fixture.nativeElement.querySelectorAll('.ft-name')[1] as HTMLElement).click();
    expect(selected).toHaveBeenCalledWith(3);
  });

  /**
   * @description Without permissions the rows have no actions and are not draggable.
   * @input all permissions off
   * @output no .ws-icon-btn; draggable="false"
   */
  it('hides the actions without permissions', async () => {
    await create(false);
    expect(fixture.nativeElement.querySelectorAll('.ws-icon-btn').length).toBe(0);
    expect(fixture.nativeElement.querySelector('[draggable]').getAttribute('draggable')).toBe('false');
  });

  /**
   * @description A drop is allowed on another parent but not into the own subtree or the same
   *   parent; the allowed one emits the move.
   * @input drag 1 over 2 (its child), over 1's own parent (top), drop on 3
   * @output no preventDefault for 2 and the top; dropped {folderId 1, parentId 3}
   */
  it('accepts drops only for allowed moves', async () => {
    await create(true);
    const dropped = jasmine.createSpy('dropped');
    component.dropped.subscribe(dropped);
    const event = () => ({ preventDefault: jasmine.createSpy('preventDefault'), dataTransfer: null }) as unknown as DragEvent;

    component.onDragStart(folders[0], event());
    const intoChild = event();
    component.onDragOver(2, intoChild);
    expect(intoChild.preventDefault).not.toHaveBeenCalled();
    const sameParent = event();
    component.onDragOver(null, sameParent);
    expect(sameParent.preventDefault).not.toHaveBeenCalled();
    const valid = event();
    component.onDragOver(3, valid);
    expect(valid.preventDefault).toHaveBeenCalled();
    component.onDrop(3, event());
    expect(dropped).toHaveBeenCalledWith({ folderId: 1, parentId: 3 });
  });
});
