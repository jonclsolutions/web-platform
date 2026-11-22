/**
 * @file folder-tree.ts
 * @path src/app/apps/js-creator/admin/shared/folder-tree.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Pure helpers of the folder tree of a workspace (the same rules as the API,
 *   FolderTree.php): children of a folder, path from the top, level, height of a subtree, whether
 *   a folder lies inside another one, whether a name is free among the siblings, and the tree as
 *   an indented list (select of a target folder).
 * @usage The folder tree component and the outputs page check a move or a name before sending it;
 *   the generator and the outputs page offer target folders with folderOptions().
 */

import { CreatorFolder } from './js-creator.models';

/** Deepest allowed level (a top-level folder is level 1) - CreatorFolder::MAX_DEPTH of the API. */
export const MAX_FOLDER_DEPTH = 10;

/**
 * @description Direct subfolders, by name.
 * @param folders All folders.
 * @param parentId Parent (null = top level).
 */
export function childrenOf(folders: readonly CreatorFolder[], parentId: number | null): CreatorFolder[] {
  return folders.filter(f => f.parent_id === parentId).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * @description Folders from the top level down to the folder itself.
 * @param folders All folders.
 * @param id Folder (null = none).
 */
export function pathOf(folders: readonly CreatorFolder[], id: number | null): CreatorFolder[] {
  const byId = new Map(folders.map(f => [f.id, f]));
  const path: CreatorFolder[] = [];
  let current = id !== null ? byId.get(id) : undefined;
  while (current && !path.includes(current)) {
    path.unshift(current);
    current = current.parent_id !== null ? byId.get(current.parent_id) : undefined;
  }
  return path;
}

/**
 * @description Level of a folder (0 = the top, i.e. none; a top-level folder is 1).
 * @param folders All folders.
 * @param id Folder.
 */
export function levelOf(folders: readonly CreatorFolder[], id: number | null): number {
  return pathOf(folders, id).length;
}

/**
 * @description Number of levels of the subtree of a folder (1 = no subfolders).
 * @param folders All folders.
 * @param id Folder.
 */
export function heightOf(folders: readonly CreatorFolder[], id: number): number {
  const children = folders.filter(f => f.parent_id === id);
  return 1 + (children.length ? Math.max(...children.map(c => heightOf(folders, c.id))) : 0);
}

/**
 * @description Whether a candidate is the folder itself or lies in its subtree.
 * @param folders All folders.
 * @param folderId Folder.
 * @param candidateId Folder to test.
 */
export function isWithin(folders: readonly CreatorFolder[], folderId: number, candidateId: number): boolean {
  return pathOf(folders, candidateId).some(f => f.id === folderId);
}

/**
 * @description Whether a folder may move under a new parent (not into its own subtree, within
 *   the depth limit).
 * @param folders All folders.
 * @param folderId Moved folder.
 * @param parentId New parent (null = top level).
 */
export function canMove(folders: readonly CreatorFolder[], folderId: number, parentId: number | null): boolean {
  if (parentId !== null && isWithin(folders, folderId, parentId)) return false;
  return levelOf(folders, parentId) + heightOf(folders, folderId) <= MAX_FOLDER_DEPTH;
}

/**
 * @description Whether a sibling already has the name (case-insensitive, trimmed).
 * @param folders All folders.
 * @param parentId Parent.
 * @param name Name.
 * @param exceptId Folder ignored (the renamed one).
 */
export function nameTaken(folders: readonly CreatorFolder[], parentId: number | null, name: string, exceptId: number | null = null): boolean {
  const needle = name.trim().toLocaleLowerCase();
  return folders.some(f => f.parent_id === parentId && f.id !== exceptId && f.name.toLocaleLowerCase() === needle);
}

/** A folder in an indented list. */
export interface FolderOption {
  id: number;
  /** Name with the indentation of its level. */
  label: string;
  /** Level (1 = top-level folder). */
  depth: number;
}

/**
 * @description Every folder in the order of the tree (each folder before its subfolders, by
 *   name), with the indentation of its level - options of a select.
 * @param folders All folders.
 * @returns Options (without the top level itself).
 */
export function folderOptions(folders: readonly CreatorFolder[]): FolderOption[] {
  const options: FolderOption[] = [];
  const walk = (parentId: number | null, depth: number): void => {
    for (const folder of childrenOf(folders, parentId)) {
      options.push({ id: folder.id, label: `${'\u2014 '.repeat(depth - 1)}${folder.name}`, depth });
      if (depth < MAX_FOLDER_DEPTH + 1) walk(folder.id, depth + 1);
    }
  };
  walk(null, 1);
  return options;
}
