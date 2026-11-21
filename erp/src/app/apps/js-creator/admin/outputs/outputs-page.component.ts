/**
 * @file outputs-page.component.ts
 * @path src/app/apps/js-creator/admin/outputs/outputs-page.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Page "Outputs" (js-creator/outputs) of the OWN workspace: the folder tree shared by
 *   every section (new folder, rename, move - also by drag and drop -, delete to the trash with
 *   the subtree), the content of the selected folder (its actions, subfolders; the generated
 *   posts are saved here by the generator) and the folder trash (restore, delete for good, empty). Every action
 *   needs its section permission; names are checked here before sending (the API checks again).
 * @dependencies JsCreatorApiService, WorkspaceUsageService, FolderTreeComponent, QuotaBarComponent,
 *   AdminModalComponent, ConfirmDialogService, AlertDialogService, PermissionService, AdminLocalizationService
 *   (section `js-creator-outputs`).
 */

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { AdminLocalizationService } from '../../../../core/services/admin-localization.service';
import { AlertDialogService } from '../../../../core/services/alert-dialog.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { PermissionService } from '../../../../core/auth/services/permission.service';
import { PageHeaderComponent } from '../../../../admin/components/page-header/page-header.component';
import { AdminModalComponent } from '../../../../admin/components/admin-modal/admin-modal.component';
import { RowButtonBuilderComponent } from '../../../../admin/components/builders/row-button-builder/row-button-builder.component';
import { RowButton, RowButtonItems } from '../../../../admin/components/builders/row-button-builder/row-button';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { JsCreatorApiService } from '../shared/js-creator-api.service';
import { WorkspaceUsageService } from '../shared/workspace-usage.service';
import { CreatorFolder } from '../shared/js-creator.models';
import { can } from '../shared/js-creator-sections';
import { MAX_FOLDER_DEPTH, canMove, childrenOf, levelOf, nameTaken, pathOf } from '../shared/folder-tree';
import { FolderDrop, FolderTreeComponent } from '../shared/folder-tree/folder-tree.component';
import { QuotaBarComponent } from '../shared/quota-bar/quota-bar.component';

/** Open popup of a folder. */
interface FolderDialog {
  kind: 'create' | 'rename' | 'move';
  folder: CreatorFolder | null;
  parentId: number | null;
  name: string;
  targetId: number | null;
  error: string;
}

/** Target of the move popup. */
interface MoveTarget {
  id: number | null;
  label: string;
}

@Component({
  selector: 'app-js-creator-outputs-page',
  standalone: true,
  imports: [DatePipe, FormsModule, PageHeaderComponent, AdminModalComponent, RowButtonBuilderComponent, IconComponent, FolderTreeComponent, QuotaBarComponent],
  templateUrl: './outputs-page.component.html',
  styleUrls: [
    '../../../../admin/shared-styles/modal.css',
    '../shared-styles/workspace.css',
    './outputs-page.component.css',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OutputsPageComponent implements OnInit {
  private readonly api = inject(JsCreatorApiService);
  private readonly usage = inject(WorkspaceUsageService);
  private readonly i18n = inject(AdminLocalizationService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly alert = inject(AlertDialogService);
  private readonly permissions = inject(PermissionService);
  private readonly cd = inject(ChangeDetectorRef);

  /** Id of the form of the popup (submit button in the footer). */
  readonly formId = 'jc-folder-form';

  /** View: the folders or the trash. */
  view: 'folders' | 'trash' = 'folders';
  /** Folders of the workspace. */
  folders: CreatorFolder[] = [];
  /** Items of the folder trash. */
  trashed: CreatorFolder[] = [];
  /** Selected folder (null = top level). */
  selectedId: number | null = null;
  /** A request is running. */
  busy = false;
  /** Open popup. */
  dialog: FolderDialog | null = null;

  /** May create folders. */
  readonly canCreate = can(this.permissions, 'create');
  /** May rename / move folders. */
  readonly canUpdate = can(this.permissions, 'update');
  /** May delete / restore folders. */
  readonly canDelete = can(this.permissions, 'delete');

  private readonly viewButtons = new RowButtonItems();

  /** @description Loads the folders. */
  ngOnInit(): void {
    this.loadFolders();
  }

  /**
   * @description Text of the page section.
   * @param key Key in `js-creator-outputs`.
   */
  t(key: string): string {
    return this.i18n.getValue(`js-creator-outputs.${key}`);
  }

  /** @description Buttons of the view switch (folders / trash). */
  get viewItems(): RowButton[] {
    return this.viewButtons.update([
      { value: 'folders', label: this.t('view_folders'), icon: 'folder' },
      { value: 'trash', label: this.t('view_trash'), icon: 'trash', count: this.trashed.length || null },
    ]);
  }

  /** @description Path from the top to the selected folder. */
  get path(): CreatorFolder[] {
    return pathOf(this.folders, this.selectedId);
  }

  /** @description The selected folder (null = the top level). */
  get selectedFolder(): CreatorFolder | null {
    return this.folders.find(f => f.id === this.selectedId) ?? null;
  }

  /** @description Subfolders of the selected folder. */
  get subfolders(): CreatorFolder[] {
    return childrenOf(this.folders, this.selectedId);
  }

  /** @description Targets of the open move popup (the top level and every allowed folder). */
  get moveTargets(): MoveTarget[] {
    const folder = this.dialog?.folder;
    if (!folder) return [];
    const targets: MoveTarget[] = [{ id: null, label: this.t('root') }];
    const walk = (parentId: number | null, depth: number): void => {
      for (const f of childrenOf(this.folders, parentId)) {
        if (f.id === folder.id) continue;
        if (canMove(this.folders, folder.id, f.id)) targets.push({ id: f.id, label: `${'— '.repeat(depth)}${f.name}` });
        walk(f.id, depth + 1);
      }
    };
    walk(null, 0);
    return targets;
  }

  /**
   * @description Switches between the folders and the trash.
   * @param value 'folders' | 'trash'.
   */
  switchView(value: string): void {
    this.view = value === 'trash' ? 'trash' : 'folders';
    this.cd.markForCheck();
  }

  /**
   * @description Selects a folder.
   * @param id Folder (null = top level).
   */
  select(id: number | null): void {
    this.selectedId = id;
    this.cd.markForCheck();
  }

  /**
   * @description Opens the popup of a new folder.
   * @param parentId Parent (null = top level).
   */
  openCreate(parentId: number | null): void {
    if (levelOf(this.folders, parentId) >= MAX_FOLDER_DEPTH) return;
    this.dialog = { kind: 'create', folder: null, parentId, name: '', targetId: null, error: '' };
    this.cd.markForCheck();
  }

  /**
   * @description Opens the rename popup.
   * @param folder Folder.
   */
  openRename(folder: CreatorFolder): void {
    this.dialog = { kind: 'rename', folder, parentId: folder.parent_id, name: folder.name, targetId: null, error: '' };
    this.cd.markForCheck();
  }

  /**
   * @description Opens the move popup.
   * @param folder Folder.
   */
  openMove(folder: CreatorFolder): void {
    this.dialog = { kind: 'move', folder, parentId: folder.parent_id, name: folder.name, targetId: folder.parent_id, error: '' };
    this.cd.markForCheck();
  }

  /** @description Closes the popup (not while saving). */
  closeDialog(): void {
    if (!this.busy) this.dialog = null;
    this.cd.markForCheck();
  }

  /** @description Saves the popup: create, rename or move (names checked first). */
  submitDialog(): void {
    const dialog = this.dialog;
    if (!dialog || this.busy) return;
    const name = dialog.name.trim();
    const parentId = dialog.kind === 'move' ? dialog.targetId : dialog.parentId;

    if (dialog.kind !== 'move' && name === '') {
      dialog.error = this.t('error_name_required');
    } else if (nameTaken(this.folders, parentId, dialog.kind === 'move' ? dialog.folder!.name : name, dialog.folder?.id ?? null)) {
      dialog.error = this.t('error_name_taken');
    } else {
      dialog.error = '';
    }
    if (dialog.error) {
      this.cd.markForCheck();
      return;
    }

    const request = dialog.kind === 'create'
      ? this.api.createFolder(name, parentId)
      : this.api.updateFolder(dialog.folder!.id, dialog.kind === 'rename' ? { name } : { parent_id: parentId });
    this.run(request, created => {
      this.dialog = null;
      if (dialog.kind === 'create') this.selectedId = created.id;
    });
  }

  /**
   * @description Moves a dropped folder under its new parent.
   * @param drop Folder and target.
   */
  onDrop(drop: FolderDrop): void {
    const folder = this.folders.find(f => f.id === drop.folderId);
    if (!folder || nameTaken(this.folders, drop.parentId, folder.name, folder.id)) {
      if (folder) this.alert.open(this.t('move_title'), this.t('error_name_taken_move'), 'warning');
      return;
    }
    this.run(this.api.updateFolder(drop.folderId, { parent_id: drop.parentId }), () => undefined);
  }

  /**
   * @description Moves a folder with its subtree to the trash (after a confirmation).
   * @param folder Folder.
   */
  async remove(folder: CreatorFolder): Promise<void> {
    if (!(await this.confirm.open(this.t('delete_title'), `${this.t('delete_text')} „${folder.name}“`))) return;
    const leavesSelection = this.selectedId !== null && pathOf(this.folders, this.selectedId).some(f => f.id === folder.id);
    this.run(this.api.deleteFolder(folder.id), () => {
      if (leavesSelection) this.selectedId = folder.parent_id;
    });
  }

  /**
   * @description Restores an item of the trash.
   * @param folder Item of the trash.
   */
  restore(folder: CreatorFolder): void {
    this.run(this.api.restoreFolder(folder.id), () => undefined);
  }

  /**
   * @description Deletes an item of the trash for good (after a confirmation).
   * @param folder Item of the trash.
   */
  async destroy(folder: CreatorFolder): Promise<void> {
    if (!(await this.confirm.open(this.t('destroy_title'), `${this.t('destroy_text')} „${folder.name}“`))) return;
    this.run(this.api.deleteFolder(folder.id, true), () => undefined);
  }

  /** @description Empties the folder trash (after a confirmation). */
  async emptyTrash(): Promise<void> {
    if (!(await this.confirm.open(this.t('empty_trash_title'), this.t('empty_trash_text')))) return;
    this.run(this.api.emptyFolderTrash(), () => undefined);
  }

  /**
   * @description Runs a change, then reloads the folders, the trash and the usage.
   * @param request Request of the change.
   * @param done Called with its result before the reload.
   */
  private run<T>(request: Observable<T>, done: (result: T) => void): void {
    this.busy = true;
    this.cd.markForCheck();
    request.subscribe({
      next: result => {
        this.busy = false;
        done(result);
        this.loadFolders();
        this.usage.refresh();
      },
      error: () => {
        this.busy = false;
        this.cd.markForCheck();
      },
    });
  }

  /** @description Loads the folders and the trash. */
  private loadFolders(): void {
    this.api.folders().subscribe(folders => {
      this.folders = folders;
      if (this.selectedId !== null && !folders.some(f => f.id === this.selectedId)) this.selectedId = null;
      this.cd.markForCheck();
    });
    this.api.folders(true).subscribe(trashed => {
      this.trashed = trashed;
      this.cd.markForCheck();
    });
  }
}
