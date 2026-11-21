/**
 * @file folder-tree.spec.ts
 * @path src/app/apps/js-creator/admin/shared/folder-tree.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the rules of the folder tree (the same as the API): children, path,
 *   level, height, moves into the own subtree and over the depth limit, free names.
 * @dependencies none
 */

import { CreatorFolder } from './js-creator.models';
import { MAX_FOLDER_DEPTH, canMove, childrenOf, heightOf, isWithin, levelOf, nameTaken, pathOf } from './folder-tree';

/**
 * @description Folder of a test tree.
 * @param id Id.
 * @param parent Parent id.
 * @param name Name.
 */
function folder(id: number, parent: number | null, name = `F${id}`): CreatorFolder {
  return { id, parent_id: parent, name, created_at: null, updated_at: null, deleted_at: null };
}

describe('folder-tree', () => {
  // 1 > 2 > 3, 4 (top), 5 inside 4 named "Akce"
  const tree = [folder(1, null, 'Beta'), folder(2, 1), folder(3, 2), folder(4, null, 'Alfa'), folder(5, 4, 'Akce')];

  /**
   * @description Children sorted by name, the path from the top, level and height.
   * @input the test tree
   * @output top [Alfa, Beta]; path of 3 = 1,2,3; levels 0 / 1 / 3; heights 3 / 1
   */
  it('reads the tree', () => {
    expect(childrenOf(tree, null).map(f => f.name)).toEqual(['Alfa', 'Beta']);
    expect(pathOf(tree, 3).map(f => f.id)).toEqual([1, 2, 3]);
    expect(levelOf(tree, null)).toBe(0);
    expect(levelOf(tree, 1)).toBe(1);
    expect(levelOf(tree, 3)).toBe(3);
    expect(heightOf(tree, 1)).toBe(3);
    expect(heightOf(tree, 3)).toBe(1);
  });

  /**
   * @description A folder cannot move into itself or its subtree, nor deeper than the limit.
   * @input moves of 1 into 3 and 1; of 4 into 3; a chain of MAX_FOLDER_DEPTH folders
   * @output false, false, true; moving a 2-level subtree under the deepest folder is false
   */
  it('checks moves', () => {
    expect(isWithin(tree, 1, 3)).toBeTrue();
    expect(canMove(tree, 1, 3)).toBeFalse();
    expect(canMove(tree, 1, 1)).toBeFalse();
    expect(canMove(tree, 4, 3)).toBeTrue();

    const chain = Array.from({ length: MAX_FOLDER_DEPTH }, (_, i) => folder(100 + i, i === 0 ? null : 99 + i));
    const all = [...chain, folder(200, null), folder(201, 200)];
    expect(canMove(all, 200, 100 + MAX_FOLDER_DEPTH - 2)).toBeFalse();
    expect(canMove(all, 201, 100 + MAX_FOLDER_DEPTH - 2)).toBeTrue();
  });

  /**
   * @description Names are compared case-insensitively and trimmed, per parent, the renamed
   *   folder itself is ignored.
   * @input " akce " under 4; "Akce" at the top; "Akce" for folder 5 itself
   * @output true, false, false
   */
  it('checks free names', () => {
    expect(nameTaken(tree, 4, ' akce ')).toBeTrue();
    expect(nameTaken(tree, null, 'Akce')).toBeFalse();
    expect(nameTaken(tree, 4, 'Akce', 5)).toBeFalse();
  });
});
