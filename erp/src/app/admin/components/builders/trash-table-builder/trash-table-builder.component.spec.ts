/**
 * @file trash-table-builder.component.spec.ts
 * @path src/app/admin/components/builders/trash-table-builder/trash-table-builder.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of TrashTableBuilderComponent – the trash (soft-deleted rows) table:
 *   restore, permanent delete, "empty trash", permission for trash actions and cell formatting.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (DataHandler spy, confirm/alert spies, permission stub, i18n stub)
 */

import { ComponentFixture, TestBed, fakeAsync, flush } from '@angular/core/testing';
import { TrashTableBuilderComponent } from './trash-table-builder.component';
import { AdminTestContext, createAdminTestContext } from '../../../../../testing/admin-test-helpers';

describe('TrashTableBuilderComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<TrashTableBuilderComponent>;
  let component: TrashTableBuilderComponent;

  beforeEach(async () => {
    ctx = createAdminTestContext();
    await TestBed.configureTestingModule({ imports: [TrashTableBuilderComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(TrashTableBuilderComponent);
    component = fixture.componentInstance;
    component.apiEndpoint = 'core/links';
    component.data = [{ id: 1 }, { id: 2 }];
  });

  /**
   * @description Each row has a "restore" and a "delete permanently" action with translated labels.
   * @input  new component (translations$ emitted)
   * @output buttons: restore ('trash-table-builder.btn_restore'), delete ('trash-table-builder.btn_delete_permanently')
   */
  it('builds the row buttons from translations', () => {
    expect(component.buttons.map(b => [b.action, b.display_name])).toEqual([
      ['restore', 'trash-table-builder.btn_restore'],
      ['delete', 'trash-table-builder.btn_delete_permanently']
    ]);
  });

  /**
   * @description Restoring asks first, then POSTs …/restore, removes the row and notifies the page.
   * @input  confirm → true; handleAction(row 1, 'restore')
   * @output post('core/links/1/restore', {}); rows [2]; itemRestored emitted; success alert
   */
  it('restores a row after confirmation', fakeAsync(() => {
    let restored = 0;
    component.itemRestored.subscribe(() => restored++);
    component.handleAction({ id: 1 }, 'restore');
    flush();
    expect(ctx.confirm.open).toHaveBeenCalledWith('trash-table-builder.restore_confirm_title', 'trash-table-builder.restore_confirm_message');
    expect((ctx.dataHandler as any).post).toHaveBeenCalledWith('core/links/1/restore', {});
    expect(component.data.map(d => d.id)).toEqual([2]);
    expect(restored).toBe(1);
    expect(ctx.alert.open).toHaveBeenCalledWith('shared.success', 'trash-table-builder.item_restored_message', 'success');
  }));

  /**
   * @description Permanent delete uses force_delete=true.
   * @input  confirm → true; handleAction(row 2, 'delete')
   * @output delete('core/links/2?force_delete=true'); itemDeletedPermanently emitted
   */
  it('deletes a row permanently', fakeAsync(() => {
    let deleted = 0;
    component.itemDeletedPermanently.subscribe(() => deleted++);
    component.handleAction({ id: 2 }, 'delete');
    flush();
    expect((ctx.dataHandler as any).delete).toHaveBeenCalledWith('core/links/2?force_delete=true');
    expect(deleted).toBe(1);
  }));

  /**
   * @description Nothing happens when the confirmation is cancelled or the row has no id.
   * @input  confirm → false for restore; handleAction({}, 'delete')
   * @output no post, no delete
   */
  it('does nothing when cancelled or without id', fakeAsync(() => {
    ctx.confirm.open.and.returnValue(Promise.resolve(false));
    component.handleAction({ id: 1 }, 'restore');
    component.handleAction({}, 'delete');
    flush();
    expect((ctx.dataHandler as any).post).not.toHaveBeenCalled();
    expect((ctx.dataHandler as any).delete).not.toHaveBeenCalled();
  }));

  /**
   * @description "Empty trash" deletes every trashed row of the endpoint.
   * @input  confirm → true; handleToolbarAction('deleteAll')
   * @output delete('core/links/force-delete-all'); data []; itemDeletedPermanently emitted
   */
  it('empties the trash', fakeAsync(() => {
    let deleted = 0;
    component.itemDeletedPermanently.subscribe(() => deleted++);
    component.handleToolbarAction('deleteAll');
    flush();
    expect((ctx.dataHandler as any).delete).toHaveBeenCalledWith('core/links/force-delete-all');
    expect(component.data).toEqual([]);
    expect(deleted).toBe(1);
  }));

  /**
   * @description Emptying an already empty trash only warns.
   * @input  data []; deleteAll()
   * @output alert ('trash-table-builder.warning_title', 'trash-table-builder.no_items_to_delete_message', 'warning'); no confirm, no request
   */
  it('warns when the trash is already empty', () => {
    component.data = [];
    component.deleteAll();
    expect(ctx.alert.open).toHaveBeenCalledWith('trash-table-builder.warning_title', 'trash-table-builder.no_items_to_delete_message', 'warning');
    expect(ctx.confirm.open).not.toHaveBeenCalled();
  });

  /**
   * @description Trash actions need the page's delete permission ("a|b" = any of them).
   * @input  deletePermission 'x-delete|x-admin'; granted [] then ['x-admin']; no deletePermission
   * @output canManageTrash false, true, true; empty-trash button showIf follows it; colspan without/with the action column
   */
  it('checks the trash permission', () => {
    component.columnDefinitions = [{ key: 'a' }, { key: 'b' }] as any;
    component.deletePermission = 'x-delete|x-admin';
    ctx.permissions.granted = new Set();
    expect(component.canManageTrash).toBeFalse();
    expect(component.deleteAllButtonConfig[0].showIf).toBeFalse();
    expect(component.colspanValue).toBe(2);
    ctx.permissions.granted = new Set(['x-admin']);
    expect(component.canManageTrash).toBeTrue();
    expect(component.colspanValue).toBe(3);
    component.deletePermission = undefined;
    expect(component.canManageTrash).toBeTrue();
  });

  /**
   * @description Cells: booleans use shared yes/no, arrays are joined, objects become JSON.
   * @input  getCellValue for boolean 1, array ['a','b'], object { x: 1 }
   * @output 'shared.yes', 'a, b', '{"x":1}'
   */
  it('formats trash cells', () => {
    expect(component.getCellValue({ v: 1 }, { key: 'v', type: 'boolean' } as any)).toBe('shared.yes');
    expect(component.getCellValue({ v: ['a', 'b'] }, { key: 'v', type: 'array' } as any)).toBe('a, b');
    expect(component.getCellValue({ v: { x: 1 } }, { key: 'v', type: 'object' } as any)).toBe('{"x":1}');
  });

  /**
   * @description Unknown toolbar actions are ignored.
   * @input  handleToolbarAction('other')
   * @output no confirm dialog
   */
  it('ignores unknown toolbar actions', () => {
    component.handleToolbarAction('other');
    expect(ctx.confirm.open).not.toHaveBeenCalled();
  });
});
