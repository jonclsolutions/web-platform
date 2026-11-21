/**
 * @file folder-tree.component.ts
 * @path src/app/apps/js-creator/admin/shared/folder-tree/folder-tree.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Tree of the folders of the own workspace: the top level ("all outputs") and the
 *   nested folders with expand / collapse, the selected folder, actions of a row (new subfolder,
 *   rename, delete - each only with its permission; shown on the hovered, focused or selected row)
 *   and moving by drag and drop (only where the move is allowed - not into the own subtree, within
 *   the depth limit).
 * @usage `<app-folder-tree [folders]="folders" [selectedId]="id" (selected)="…" (createIn)="…"
 *   (rename)="…" (remove)="…" (dropped)="…" />`
 * @dependencies folder-tree.ts (rules), IconComponent, AdminLocalizationService (section
 *   `js-creator-outputs`).
 */

import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { AdminLocalizationService } from '../../../../../core/services/admin-localization.service';
import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { CreatorFolder } from '../js-creator.models';
import { MAX_FOLDER_DEPTH, canMove, childrenOf, levelOf, pathOf } from '../folder-tree';

/** A requested move by drag and drop. */
export interface FolderDrop {
  folderId: number;
  parentId: number | null;
}

@Component({
  selector: 'app-folder-tree',
  standalone: true,
  imports: [NgTemplateOutlet, IconComponent],
  templateUrl: './folder-tree.component.html',
  styleUrls: ['../../shared-styles/workspace.css', './folder-tree.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FolderTreeComponent implements OnChanges {
  private readonly i18n = inject(AdminLocalizationService);

  /** Folders of the workspace (outside the trash). */
  @Input() folders: CreatorFolder[] = [];
  /** Selected folder (null = the top level). */
  @Input() selectedId: number | null = null;
  /** The account may create folders. */
  @Input() canCreate = false;
  /** The account may rename / move folders. */
  @Input() canUpdate = false;
  /** The account may delete folders. */
  @Input() canDelete = false;

  /** A folder (or the top level) was selected. */
  @Output() selected = new EventEmitter<number | null>();
  /** New folder inside the given parent. */
  @Output() createIn = new EventEmitter<number | null>();
  /** Rename the folder. */
  @Output() rename = new EventEmitter<CreatorFolder>();
  /** Delete the folder (to the trash). */
  @Output() remove = new EventEmitter<CreatorFolder>();
  /** A folder was dropped on a new parent. */
  @Output() dropped = new EventEmitter<FolderDrop>();

  /** Expanded folders. */
  readonly expanded = new Set<number>();
  /** Folder being dragged. */
  draggingId: number | null = null;
  /** Drop target under the pointer (undefined = none, null = the top level). */
  dropTarget: number | null | undefined = undefined;

  /** @description Expands the path to the selected folder. */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedId'] || changes['folders']) {
      for (const folder of pathOf(this.folders, this.selectedId)) {
        if (folder.id !== this.selectedId) this.expanded.add(folder.id);
      }
    }
  }

  /**
   * @description Text of the section.
   * @param key Key in `js-creator-outputs`.
   */
  t(key: string): string {
    return this.i18n.getValue(`js-creator-outputs.${key}`);
  }

  /**
   * @description Subfolders of a folder.
   * @param parentId Parent (null = top level).
   */
  children(parentId: number | null): CreatorFolder[] {
    return childrenOf(this.folders, parentId);
  }

  /**
   * @description Whether a subfolder may still be created inside a folder.
   * @param folder Folder.
   */
  canNest(folder: CreatorFolder): boolean {
    return levelOf(this.folders, folder.id) < MAX_FOLDER_DEPTH;
  }

  /**
   * @description Selects a folder and expands it (its subfolders show).
   * @param folder Folder.
   */
  choose(folder: CreatorFolder): void {
    this.expanded.add(folder.id);
    this.selected.emit(folder.id);
  }

  /**
   * @description Expands / collapses a folder.
   * @param folder Folder.
   * @param event Click (does not select the folder).
   */
  toggle(folder: CreatorFolder, event: Event): void {
    event.stopPropagation();
    if (this.expanded.has(folder.id)) this.expanded.delete(folder.id);
    else this.expanded.add(folder.id);
  }

  /**
   * @description Starts dragging a folder.
   * @param folder Folder.
   * @param event Drag event.
   */
  onDragStart(folder: CreatorFolder, event: DragEvent): void {
    this.draggingId = folder.id;
    event.dataTransfer?.setData('text/plain', String(folder.id));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  /**
   * @description Allows the drop where the move is allowed.
   * @param parentId Target (null = top level).
   * @param event Drag event.
   */
  onDragOver(parentId: number | null, event: DragEvent): void {
    if (this.draggingId === null || !this.dropAllowed(this.draggingId, parentId)) return;
    event.preventDefault();
    this.dropTarget = parentId;
  }

  /** @description The pointer left a target. */
  onDragLeave(): void {
    this.dropTarget = undefined;
  }

  /**
   * @description Drops the dragged folder on a target.
   * @param parentId Target (null = top level).
   * @param event Drag event.
   */
  onDrop(parentId: number | null, event: DragEvent): void {
    event.preventDefault();
    const folderId = this.draggingId;
    this.onDragEnd();
    if (folderId !== null && this.dropAllowed(folderId, parentId)) {
      this.dropped.emit({ folderId, parentId });
    }
  }

  /** @description Dragging ended. */
  onDragEnd(): void {
    this.draggingId = null;
    this.dropTarget = undefined;
  }

  /**
   * @description Whether a folder may be dropped on a target (another parent, a valid move).
   * @param folderId Dragged folder.
   * @param parentId Target.
   */
  private dropAllowed(folderId: number, parentId: number | null): boolean {
    const folder = this.folders.find(f => f.id === folderId);
    return !!folder && folder.parent_id !== parentId && canMove(this.folders, folderId, parentId);
  }
}
