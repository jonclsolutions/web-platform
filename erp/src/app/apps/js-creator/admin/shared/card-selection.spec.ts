/**
 * @file card-selection.spec.ts
 * @path src/app/apps/js-creator/admin/shared/card-selection.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of CardSelection: toggling, "select all" of the listed items (and
 *   none when all are selected), the limit of selected items and clearing.
 * @dependencies CardSelection.
 */

import { CardSelection } from './card-selection';

describe('CardSelection', () => {
  /**
   * @description Toggling single items and all listed items.
   * @input toggle 1, 2, 1; toggleAll of [2, 3]; toggleAll again
   * @output [2]; [2, 3] (all selected); empty
   */
  it('selects items and all listed items', () => {
    const selection = new CardSelection(10);
    selection.toggle(1);
    selection.toggle(2);
    selection.toggle(1);
    expect(selection.ids()).toEqual([2]);
    expect(selection.has(2)).toBeTrue();
    const items = [{ id: 2 }, { id: 3 }];
    expect(selection.allOf(items)).toBeFalse();
    selection.toggleAll(items);
    expect(selection.ids()).toEqual([2, 3]);
    expect(selection.allOf(items)).toBeTrue();
    selection.toggleAll(items);
    expect(selection.size).toBe(0);
    expect(selection.allOf([])).toBeFalse();
  });

  /**
   * @description No more items than the limit; clear empties the selection.
   * @input limit 2; toggleAll of 3 items; toggle a 4th; clear
   * @output [1, 2]; still [1, 2]; empty
   */
  it('keeps the limit and clears', () => {
    const selection = new CardSelection(2);
    selection.toggleAll([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(selection.ids()).toEqual([1, 2]);
    selection.toggle(4);
    expect(selection.ids()).toEqual([1, 2]);
    selection.clear();
    expect(selection.size).toBe(0);
  });
});
