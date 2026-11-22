/**
 * @file outputs-page.component.ts
 * @path src/app/apps/js-creator/admin/outputs/outputs-page.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Page "Outputs" (js-creator/outputs) of the OWN workspace:
 *   - the folder tree shared by every section (new folder, rename, move - also by drag and
 *     drop -, delete to the trash with the subtree and its outputs);
 *   - the content of the selected folder: subfolders and the generated outputs (thumbnails,
 *     search in every folder, filter by type, by template and by period - both over every
 *     folder -, sorting, "load more"), the detail of an output
 *     (picture, data, text of the post with Copy, download, rename, move, delete, generate
 *     again from its template), selection of several outputs (download as a ZIP, move, delete);
 *   - the trash: deleted folders (with their outputs) and deleted outputs - restore, delete for
 *     good, empty.
 *   `?folder=<id|root>&output=<id>` opens a folder and the detail of an output (after generating).
 *   Every action needs its section permission; names are checked here before sending (the API
 *   checks again).
 * @dependencies JsCreatorApiService (folders), OutputsApiService, WorkspaceUsageService,
 *   FolderTreeComponent, QuotaBarComponent, AdminModalComponent, ConfirmDialogService,
 *   AlertDialogService, PermissionService, AdminLocalizationService (section `js-creator-outputs`).
 */

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subscription, forkJoin } from 'rxjs';
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
import { OutputPeriod, OutputQuery, OutputsApiService } from '../shared/outputs-api.service';
import { WorkspaceUsageService } from '../shared/workspace-usage.service';
import { CreatorFolder, CreatorOutput, OutputTemplateRef } from '../shared/js-creator.models';
import { JS_CREATOR_SECTIONS, JsCreatorSectionId, can } from '../shared/js-creator-sections';
import { FolderOption, MAX_FOLDER_DEPTH, canMove, childrenOf, folderOptions, levelOf, nameTaken, pathOf } from '../shared/folder-tree';
import { FolderDrop, FolderTreeComponent } from '../shared/folder-tree/folder-tree.component';
import { QuotaBarComponent } from '../shared/quota-bar/quota-bar.component';
import { CreatorIconComponent } from '../shared/creator-icon/creator-icon.component';
import { UiIconName, uiIcon } from '../shared/ui-icons';
import { formatBytes } from '../shared/workspace-format';

/** Open popup of a folder. */
interface FolderDialog {
  kind: 'create' | 'rename' | 'move';
  folder: CreatorFolder | null;
  parentId: number | null;
  name: string;
  targetId: number | null;
  error: string;
}

/** Open popup of outputs: rename / move one, move the selected ones. */
interface OutputDialog {
  kind: 'rename' | 'move' | 'bulk-move';
  output: CreatorOutput | null;
  name: string;
  targetId: number | null;
  error: string;
}

/** Target of the move popup. */
interface MoveTarget {
  id: number | null;
  label: string;
}

/** Sorting of the outputs (value of the select). */
type OutputSort = 'newest' | 'oldest' | 'name' | 'largest';

/** Sorting values of the API. */
const SORTS: Record<OutputSort, Pick<OutputQuery, 'sortBy' | 'sortDirection'>> = {
  newest: { sortBy: 'created_at', sortDirection: 'desc' },
  oldest: { sortBy: 'created_at', sortDirection: 'asc' },
  name: { sortBy: 'name', sortDirection: 'asc' },
  largest: { sortBy: 'size_bytes', sortDirection: 'desc' },
};

/** Most outputs in one bulk action / ZIP (API limit). */
const MAX_SELECTION = 200;

@Component({
  selector: 'app-js-creator-outputs-page',
  standalone: true,
  imports: [
    DatePipe, FormsModule, PageHeaderComponent, AdminModalComponent, RowButtonBuilderComponent, IconComponent, FolderTreeComponent,
    QuotaBarComponent, CreatorIconComponent,
  ],
  templateUrl: './outputs-page.component.html',
  styleUrls: [
    '../../../../admin/shared-styles/modal.css',
    '../shared-styles/workspace.css',
    './outputs-page.component.css',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OutputsPageComponent implements OnInit, OnDestroy {
  private readonly api = inject(JsCreatorApiService);
  private readonly outputsApi = inject(OutputsApiService);
  private readonly usage = inject(WorkspaceUsageService);
  private readonly i18n = inject(AdminLocalizationService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly alert = inject(AlertDialogService);
  private readonly permissions = inject(PermissionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cd = inject(ChangeDetectorRef);

  /** Ids of the forms of the popups (submit buttons in the footers). */
  readonly formId = 'jc-folder-form';
  readonly outputFormId = 'jc-output-form';
  /** Sections for the type filter. */
  readonly sections = JS_CREATOR_SECTIONS;

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
  /** Open popup of a folder. */
  dialog: FolderDialog | null = null;

  /** Outputs of the folder / search / trash. */
  outputs: CreatorOutput[] = [];
  /** Paging of the outputs. */
  page = 1;
  lastPage = 1;
  total = 0;
  /** Outputs are loading. */
  loading = false;
  /** Search in the names of every folder. */
  search = '';
  /** Type filter ('' = every section). */
  sectionFilter: JsCreatorSectionId | '' = '';
  /** Template filter ('' = every template; outputs of every folder). */
  templateFilter: number | '' = '';
  /** Period filter ('' = any time; outputs of every folder). */
  periodFilter: OutputPeriod | '' = '';
  /** Templates the outputs were generated from (options of the template filter). */
  templateRefs: OutputTemplateRef[] = [];
  /** Sorting. */
  sort: OutputSort = 'newest';
  /** Selected outputs (ids). */
  selected = new Set<number>();
  /** Output shown in the detail. */
  detail: CreatorOutput | null = null;
  /** Slide shown in the detail of a carousel (0 = the first). */
  slide = 0;
  /** Open popup of outputs. */
  outputDialog: OutputDialog | null = null;
  /** The text of the detail was copied. */
  copied = false;
  /** Number of outputs in the trash. */
  trashedOutputs = 0;

  /** May create folders. */
  readonly canCreate = can(this.permissions, 'create');
  /** May rename / move. */
  readonly canUpdate = can(this.permissions, 'update');
  /** May delete / restore. */
  readonly canDelete = can(this.permissions, 'delete');

  private readonly viewButtons = new RowButtonItems();
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private listSub?: Subscription;
  /** Output to open once the list is loaded (`?output=`). */
  private pendingOutput: number | null = null;

  /** @description Reads the folder / output of the address and loads the folders and outputs. */
  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const folder = params.get('folder');
    this.selectedId = folder && folder !== 'root' && Number(folder) > 0 ? Number(folder) : null;
    this.pendingOutput = Number(params.get('output')) || null;
    this.loadFolders();
    this.loadOutputs();
    this.loadTrashCount();
    this.outputsApi.templates().subscribe({
      next: refs => {
        this.templateRefs = refs;
        this.cd.markForCheck();
      },
      error: () => undefined,
    });
  }

  /** The list shows outputs of every folder (a search, a template or a period filter). */
  get acrossFolders(): boolean {
    return this.view === 'folders' && (!!this.search.trim() || !!this.templateFilter || !!this.periodFilter);
  }

  /** @description Stops a waiting search. */
  ngOnDestroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.listSub?.unsubscribe();
  }

  /**
   * @description Text of the page section.
   * @param key Key in `js-creator-outputs`.
   */
  t(key: string): string {
    return this.i18n.getValue(`js-creator-outputs.${key}`);
  }

  /**
   * @description Elements of an interface icon.
   * @param name Name.
   */
  icon(name: UiIconName) {
    return uiIcon(name);
  }

  /**
   * @description Name of a section (type filter, cards).
   * @param section Section id.
   */
  sectionLabel(section: string): string {
    return this.t(`type_${section}`);
  }

  /** @description Buttons of the view switch (folders / trash). */
  get viewItems(): RowButton[] {
    const count = this.trashed.length + this.trashedOutputs;
    return this.viewButtons.update([
      { value: 'folders', label: this.t('view_folders') },
      { value: 'trash', label: this.t('view_trash'), count: count || null },
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

  /** @description Targets of the open folder move popup (the top level and every allowed folder). */
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

  /** @description Targets of an output move (every folder). */
  get outputTargets(): FolderOption[] {
    return folderOptions(this.folders);
  }

  /** @description Every listed output is selected. */
  get allSelected(): boolean {
    return this.outputs.length > 0 && this.outputs.every(o => this.selected.has(o.id));
  }

  /**
   * @description Path of the folder of an output (shown with a search in every folder).
   * @param output Output.
   */
  folderPath(output: CreatorOutput): string {
    const path = pathOf(this.folders, output.folder_id);
    return path.length ? path.map(f => f.name).join(' / ') : this.t('root');
  }

  /**
   * @description Size of a file.
   * @param bytes Bytes.
   */
  bytes(bytes: number): string {
    return formatBytes(bytes, this.i18n.getDateLocale());
  }

  /**
   * @description Aspect ratio of the thumbnail frame of an output.
   * @param output Output.
   */
  aspect(output: CreatorOutput): string {
    return `${output.width} / ${output.height}`;
  }

  /**
   * @description Switches between the folders and the trash.
   * @param value 'folders' | 'trash'.
   */
  switchView(value: string): void {
    this.view = value === 'trash' ? 'trash' : 'folders';
    this.selected.clear();
    this.loadOutputs();
  }

  /**
   * @description Selects a folder.
   * @param id Folder (null = top level).
   */
  select(id: number | null): void {
    this.selectedId = id;
    this.search = '';
    this.selected.clear();
    this.loadOutputs();
  }

  // ── folders ─────────────────────────────────────────────────────────────────

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
      if (dialog.kind === 'create') this.select(created.id);
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
   * @description Moves a folder with its subtree and outputs to the trash (after a confirmation).
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
   * @description Restores a folder of the trash.
   * @param folder Item of the trash.
   */
  restore(folder: CreatorFolder): void {
    this.run(this.api.restoreFolder(folder.id), () => undefined);
  }

  /**
   * @description Deletes a folder of the trash for good (after a confirmation).
   * @param folder Item of the trash.
   */
  async destroy(folder: CreatorFolder): Promise<void> {
    if (!(await this.confirm.open(this.t('destroy_title'), `${this.t('destroy_text')} „${folder.name}“`))) return;
    this.run(this.api.deleteFolder(folder.id, true), () => undefined);
  }

  /** @description Empties the trash - folders and outputs (after a confirmation). */
  async emptyTrash(): Promise<void> {
    if (!(await this.confirm.open(this.t('empty_trash_title'), this.t('empty_trash_text')))) return;
    this.run(forkJoin([this.api.emptyFolderTrash(), this.outputsApi.emptyTrash()]), () => undefined);
  }

  // ── outputs ─────────────────────────────────────────────────────────────────

  /** @description The search changed: reload after a short pause. */
  onSearch(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.selected.clear();
      this.loadOutputs();
    }, 300);
  }

  /** @description The filter or sorting changed. */
  reload(): void {
    this.selected.clear();
    this.loadOutputs();
  }

  /** @description Loads the next page of outputs. */
  loadMore(): void {
    if (this.page < this.lastPage && !this.loading) this.loadOutputs(this.page + 1);
  }

  /**
   * @description Selects / unselects an output.
   * @param output Output.
   */
  toggle(output: CreatorOutput): void {
    if (this.selected.has(output.id)) this.selected.delete(output.id);
    else if (this.selected.size < MAX_SELECTION) this.selected.add(output.id);
    else this.alert.open(this.t('selection_title'), this.t('selection_limit'), 'warning');
    this.cd.markForCheck();
  }

  /** @description Selects every listed output (or none, when all are selected). */
  toggleAll(): void {
    if (this.allSelected) this.selected.clear();
    else this.outputs.slice(0, MAX_SELECTION).forEach(o => this.selected.add(o.id));
    this.cd.markForCheck();
  }

  /** @description Clears the selection. */
  clearSelection(): void {
    this.selected.clear();
    this.cd.markForCheck();
  }

  /**
   * @description Opens the detail of an output.
   * @param output Output.
   */
  openDetail(output: CreatorOutput): void {
    this.detail = output;
    this.slide = 0;
    this.copied = false;
    this.cd.markForCheck();
  }

  /**
   * @description Page shown in the detail (a slide of a carousel; the first page otherwise).
   * @param output Output of the detail.
   */
  detailPage(output: CreatorOutput): { page: number; url: string | null; download_url: string | null } | null {
    return output.pages?.[this.slide] ?? (output.url ? { page: 1, url: output.url, download_url: output.download_url } : null);
  }

  /**
   * @description Number of slides of a carousel with its word ("3 slidy", "5 slidů").
   * @param count Slides (2 … 20).
   */
  slideCount(count: number): string {
    return `${count} ${this.t(count <= 4 ? 'slides_few' : 'slides')}`;
  }

  /**
   * @description Shows another slide of a carousel in the detail.
   * @param index Slide (0 = the first).
   */
  showSlide(index: number): void {
    const count = this.detail?.page_count ?? 1;
    this.slide = Math.max(0, Math.min(index, count - 1));
    this.cd.markForCheck();
  }

  /** @description Closes the detail. */
  closeDetail(): void {
    this.detail = null;
    this.cd.markForCheck();
  }

  /**
   * @description Copies the text of the post of an output.
   * @param output Output.
   */
  async copyCaption(output: CreatorOutput): Promise<void> {
    try {
      await navigator.clipboard.writeText(output.caption ?? '');
      this.copied = true;
      this.cd.markForCheck();
      setTimeout(() => {
        this.copied = false;
        this.cd.markForCheck();
      }, 2000);
    } catch {
      this.alert.open(this.t('copy'), this.t('copy_failed'), 'warning');
    }
  }

  /**
   * @description Opens generating from the template of an output.
   * @param output Output.
   */
  generateAgain(output: CreatorOutput): void {
    if (output.template_id) void this.router.navigate(['/admin/js-creator/image-templates', output.template_id, 'generate']);
  }

  /**
   * @description Opens the rename popup of an output.
   * @param output Output.
   */
  openRenameOutput(output: CreatorOutput): void {
    this.outputDialog = { kind: 'rename', output, name: output.name, targetId: null, error: '' };
    this.cd.markForCheck();
  }

  /**
   * @description Opens the move popup of an output.
   * @param output Output.
   */
  openMoveOutput(output: CreatorOutput): void {
    this.outputDialog = { kind: 'move', output, name: output.name, targetId: output.folder_id, error: '' };
    this.cd.markForCheck();
  }

  /** @description Opens the move popup of the selected outputs. */
  openBulkMove(): void {
    if (!this.selected.size) return;
    this.outputDialog = { kind: 'bulk-move', output: null, name: '', targetId: this.selectedId, error: '' };
    this.cd.markForCheck();
  }

  /** @description Closes the popup of outputs (not while saving). */
  closeOutputDialog(): void {
    if (!this.busy) this.outputDialog = null;
    this.cd.markForCheck();
  }

  /**
   * @description Target folder chosen in the popup of outputs.
   * @param value Value of the select ('' = top level).
   */
  setOutputTarget(value: string): void {
    if (this.outputDialog) this.outputDialog.targetId = value === '' ? null : Number(value);
  }

  /** @description Saves the popup of outputs: rename, move one or move the selected ones. */
  submitOutputDialog(): void {
    const dialog = this.outputDialog;
    if (!dialog || this.busy) return;
    if (dialog.kind === 'rename' && dialog.name.trim() === '') {
      dialog.error = this.t('error_output_name_required');
      this.cd.markForCheck();
      return;
    }
    if (dialog.kind === 'bulk-move') {
      this.run(this.outputsApi.bulk('move', [...this.selected], dialog.targetId), () => {
        this.outputDialog = null;
        this.selected.clear();
      });
      return;
    }
    const output = dialog.output!;
    const changes = dialog.kind === 'rename' ? { name: dialog.name.trim() } : { folder_id: dialog.targetId };
    this.run(this.outputsApi.update(output.id, changes), updated => {
      this.outputDialog = null;
      if (this.detail?.id === updated.id) this.detail = updated;
    });
  }

  /**
   * @description Moves an output to the trash (after a confirmation).
   * @param output Output.
   */
  async removeOutput(output: CreatorOutput): Promise<void> {
    if (!(await this.confirm.open(this.t('delete_output_title'), `${this.t('delete_output_text')} „${output.name}“`))) return;
    this.run(this.outputsApi.delete(output.id), () => {
      this.selected.delete(output.id);
      if (this.detail?.id === output.id) this.detail = null;
    });
  }

  /** @description Moves the selected outputs to the trash (after a confirmation). */
  async removeSelected(): Promise<void> {
    const count = this.selected.size;
    if (!count || !(await this.confirm.open(this.t('delete_output_title'), `${this.t('delete_selected_text')} ${count}`))) return;
    this.run(this.outputsApi.bulk('delete', [...this.selected]), () => this.selected.clear());
  }

  /**
   * @description Restores an output of the trash (to the top level when its folder is gone).
   * @param output Output.
   */
  restoreOutput(output: CreatorOutput): void {
    this.run(this.outputsApi.restore(output.id), () => undefined);
  }

  /**
   * @description Deletes an output of the trash for good (after a confirmation).
   * @param output Output.
   */
  async destroyOutput(output: CreatorOutput): Promise<void> {
    if (!(await this.confirm.open(this.t('destroy_title'), `${this.t('destroy_output_text')} „${output.name}“`))) return;
    this.run(this.outputsApi.delete(output.id, true), () => undefined);
  }

  /**
   * @description Downloads outputs as one ZIP (the selected ones, or the given ids).
   * @param ids Outputs (default: the selection).
   */
  downloadZip(ids: number[] = [...this.selected]): void {
    if (!ids.length || this.busy) return;
    this.busy = true;
    this.cd.markForCheck();
    this.outputsApi.zip(ids).subscribe({
      next: zip => {
        this.busy = false;
        this.cd.markForCheck();
        const link = document.createElement('a');
        link.href = zip.url;
        link.download = '';
        document.body.appendChild(link);
        link.click();
        link.remove();
      },
      error: () => {
        this.busy = false;
        this.cd.markForCheck();
      },
    });
  }

  /**
   * @description Runs a change, then reloads the folders, the outputs, the trash and the usage.
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
        this.loadOutputs();
        if (this.view === 'folders') this.loadTrashCount();
        this.usage.refresh();
      },
      error: () => {
        this.busy = false;
        this.cd.markForCheck();
      },
    });
  }

  /** @description Loads the folders and the folder trash. */
  private loadFolders(): void {
    this.api.folders().subscribe(folders => {
      this.folders = folders;
      if (this.selectedId !== null && !folders.some(f => f.id === this.selectedId)) {
        this.selectedId = null;
        this.loadOutputs();
      }
      this.cd.markForCheck();
    });
    this.api.folders(true).subscribe(trashed => {
      this.trashed = trashed;
      this.cd.markForCheck();
    });
  }

  /**
   * @description Loads a page of outputs of the current view (folder / search / trash).
   * @param page Page (1 = start again).
   */
  private loadOutputs(page = 1): void {
    this.listSub?.unsubscribe();
    this.loading = true;
    this.cd.markForCheck();
    const search = this.view === 'folders' ? this.search.trim() : '';
    this.listSub = this.outputsApi.list({
      page,
      folderId: this.selectedId,
      search,
      section: this.sectionFilter,
      templateId: this.view === 'folders' && this.templateFilter ? Number(this.templateFilter) : null,
      period: this.view === 'folders' ? this.periodFilter : '',
      trashed: this.view === 'trash',
      ...SORTS[this.view === 'trash' ? 'newest' : this.sort],
    }).subscribe({
      next: result => {
        this.outputs = page === 1 ? result.data : [...this.outputs, ...result.data];
        this.page = result.meta?.current_page ?? page;
        this.lastPage = result.meta?.last_page ?? page;
        this.total = result.meta?.total ?? this.outputs.length;
        this.loading = false;
        if (this.view === 'trash') this.trashedOutputs = this.total;
        this.openPending();
        this.cd.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cd.markForCheck();
      },
    });
  }

  /** @description Loads the number of outputs in the trash (badge of the view switch). */
  private loadTrashCount(): void {
    this.outputsApi.list({ page: 1, folderId: null, trashed: true }).subscribe(result => {
      this.trashedOutputs = result.meta?.total ?? result.data.length;
      this.cd.markForCheck();
    });
  }

  /** @description Opens the detail of the output named by the address once it is listed. */
  private openPending(): void {
    if (this.pendingOutput === null) return;
    const output = this.outputs.find(o => o.id === this.pendingOutput);
    this.pendingOutput = null;
    if (output) this.detail = output;
  }
}
