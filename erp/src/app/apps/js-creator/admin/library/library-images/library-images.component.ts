/**
 * @file library-images.component.ts
 * @path src/app/apps/js-creator/admin/library/library-images/library-images.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Tab "Images" of the library: grid of the own images (thumbnail, name, size),
 *   search, "load more", upload (button or drag and drop - one file per request, files of a
 *   wrong type / size or over the quota are refused here with a translated text before sending),
 *   rename, delete to the trash; the trash with restore, delete for good and emptying. An image
 *   used by a template is not deleted - a message names the templates (`used_by` of the list).
 * @dependencies JsCreatorApiService, WorkspaceUsageService, UploadRulesService (profile
 *   js_creator_image), AdminModalComponent, ConfirmDialogService, AlertDialogService,
 *   PermissionService, AdminLocalizationService (section `js-creator-library`).
 */

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, Subscription, catchError, concatMap, from, of, tap, toArray } from 'rxjs';
import { AdminLocalizationService } from '../../../../../core/services/admin-localization.service';
import { AlertDialogService } from '../../../../../core/services/alert-dialog.service';
import { ConfirmDialogService } from '../../../../../core/services/confirm-dialog.service';
import { PermissionService } from '../../../../../core/auth/services/permission.service';
import { AdminModalComponent } from '../../../../../admin/components/admin-modal/admin-modal.component';
import { RowButtonBuilderComponent } from '../../../../../admin/components/builders/row-button-builder/row-button-builder.component';
import { RowButton, RowButtonItems } from '../../../../../admin/components/builders/row-button-builder/row-button';
import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { UploadRulesService } from '../../../../../shared/services/upload-rules.service';
import { UploadRule, extensionsLabel, isExtensionAllowed } from '../../../../../shared/utils/upload-rules';
import { JsCreatorApiService } from '../../shared/js-creator-api.service';
import { WorkspaceUsageService } from '../../shared/workspace-usage.service';
import { CreatorAsset, UsedByTemplate } from '../../shared/js-creator.models';
import { can } from '../../shared/js-creator-sections';
import { formatBytes } from '../../shared/workspace-format';

@Component({
  selector: 'app-library-images',
  standalone: true,
  imports: [FormsModule, AdminModalComponent, RowButtonBuilderComponent, IconComponent],
  templateUrl: './library-images.component.html',
  styleUrls: ['../../../../../admin/shared-styles/modal.css', '../../shared-styles/workspace.css', './library-images.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryImagesComponent implements OnInit, OnDestroy {
  private readonly api = inject(JsCreatorApiService);
  private readonly usage = inject(WorkspaceUsageService);
  private readonly uploadRules = inject(UploadRulesService);
  private readonly i18n = inject(AdminLocalizationService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly alert = inject(AlertDialogService);
  private readonly permissions = inject(PermissionService);
  private readonly cd = inject(ChangeDetectorRef);

  /** Id of the rename form (submit button in the footer). */
  readonly formId = 'jc-asset-form';

  /** View: the library or its trash. */
  view: 'active' | 'trash' = 'active';
  /** Loaded images. */
  items: CreatorAsset[] = [];
  /** Total number of images of the view. */
  total = 0;
  /** Last loaded page. */
  page = 1;
  /** Last page of the view. */
  lastPage = 1;
  /** Search in the names. */
  search = '';
  /** A list request is running. */
  loading = false;
  /** A change is running. */
  busy = false;
  /** Upload in progress: done / all files (null = none). */
  uploading: { done: number; total: number } | null = null;
  /** A file is dragged over the grid. */
  dragOver = false;
  /** Rules of the upload profile (null until loaded). */
  rules: UploadRule | null = null;
  /** Open rename popup. */
  renaming: { asset: CreatorAsset; name: string; error: string } | null = null;

  /** May upload. */
  readonly canCreate = can(this.permissions, 'create');
  /** May rename. */
  readonly canUpdate = can(this.permissions, 'update');
  /** May delete / restore. */
  readonly canDelete = can(this.permissions, 'delete');

  private readonly viewButtons = new RowButtonItems();
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private rulesSub?: Subscription;

  /** @description Loads the rules of the upload and the first page. */
  ngOnInit(): void {
    this.rulesSub = this.uploadRules.rules('js_creator_image').subscribe(rules => {
      this.rules = rules;
      this.cd.markForCheck();
    });
    this.load(1);
  }

  /** @description Stops the pending search. */
  ngOnDestroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.rulesSub?.unsubscribe();
  }

  /**
   * @description Text of the section.
   * @param key Key in `js-creator-library`.
   */
  t(key: string): string {
    return this.i18n.getValue(`js-creator-library.${key}`);
  }

  /** @description Buttons of the view switch. */
  get viewItems(): RowButton[] {
    return this.viewButtons.update([
      { value: 'active', label: this.t('view_library') },
      { value: 'trash', label: this.t('view_trash') },
    ]);
  }

  /** @description Value of the accept attribute of the file input. */
  get accept(): string {
    return (this.rules?.extensions ?? ['jpg', 'jpeg', 'png', 'webp']).map(e => `.${e}`).join(',');
  }

  /** @description Hint of the allowed files. */
  get uploadHint(): string {
    const rules = this.rules;
    return rules ? `${extensionsLabel(rules.extensions)} · ${this.t('max_size')} ${rules.max_file_size_mb} MB` : '';
  }

  /**
   * @description Size in the locale of the admin.
   * @param bytes Size.
   */
  size(bytes: number): string {
    return formatBytes(bytes, this.i18n.getDateLocale());
  }

  /**
   * @description Switches between the library and its trash.
   * @param value 'active' | 'trash'.
   */
  switchView(value: string): void {
    this.view = value === 'trash' ? 'trash' : 'active';
    this.load(1);
  }

  /** @description Searches after a short pause in typing. */
  onSearch(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(1), 300);
  }

  /** @description Loads the next page and appends it. */
  loadMore(): void {
    if (this.page < this.lastPage) this.load(this.page + 1);
  }

  /**
   * @description Files chosen in the file input.
   * @param event Change event of the input.
   */
  onFilesChosen(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.upload(Array.from(input.files ?? []));
    input.value = '';
  }

  /**
   * @description A file is dragged over the grid.
   * @param event Drag event.
   */
  onDragOver(event: DragEvent): void {
    if (!this.canCreate || this.view !== 'active' || !event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    this.dragOver = true;
  }

  /** @description The dragged file left the grid. */
  onDragLeave(): void {
    this.dragOver = false;
  }

  /**
   * @description Files dropped on the grid.
   * @param event Drop event.
   */
  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = false;
    if (this.canCreate && this.view === 'active') this.upload(Array.from(event.dataTransfer?.files ?? []));
  }

  /**
   * @description Uploads files one after another; refuses (with a message) files of a wrong type
   *   or size, or that do not fit into the quota.
   * @param files Chosen files.
   */
  upload(files: File[]): void {
    if (!files.length || this.uploading) return;
    const rules = this.rules;
    const refused = files.filter(f => (rules && !isExtensionAllowed(f.name, rules.extensions)) || (rules && f.size > rules.max_file_size_mb * 1024 * 1024));
    const accepted = files.filter(f => !refused.includes(f));
    if (refused.length) {
      this.alert.open(this.t('upload_refused_title'), `${this.t('upload_refused_text')} ${refused.map(f => f.name).join(', ')} (${this.uploadHint})`, 'warning');
    }
    if (!accepted.length) return;
    if (!this.usage.fits(accepted.reduce((sum, f) => sum + f.size, 0))) {
      this.alert.open(this.t('quota_full_title'), this.t('quota_full_text'), 'warning');
      return;
    }

    this.uploading = { done: 0, total: accepted.length };
    this.cd.markForCheck();
    // One file after another; a refused file (dialog of DataHandler) does not stop the others.
    from(accepted).pipe(
      concatMap(file => this.api.uploadAsset(file).pipe(catchError(() => of(null)))),
      tap(() => {
        if (this.uploading) this.uploading = { ...this.uploading, done: this.uploading.done + 1 };
        this.cd.markForCheck();
      }),
      toArray(),
    ).subscribe({
      next: () => this.afterUpload(),
      error: () => this.afterUpload(),
    });
  }

  /**
   * @description Opens the rename popup.
   * @param asset Image.
   */
  openRename(asset: CreatorAsset): void {
    this.renaming = { asset, name: asset.name, error: '' };
    this.cd.markForCheck();
  }

  /** @description Closes the rename popup (not while saving). */
  closeRename(): void {
    if (!this.busy) this.renaming = null;
    this.cd.markForCheck();
  }

  /** @description Saves the new name. */
  submitRename(): void {
    const renaming = this.renaming;
    if (!renaming) return;
    const name = renaming.name.trim();
    if (!name) {
      renaming.error = this.t('error_name_required');
      this.cd.markForCheck();
      return;
    }
    this.run(this.api.renameAsset(renaming.asset.id, name), () => {
      this.renaming = null;
    });
  }

  /**
   * @description Moves an image to the trash (after a confirmation).
   * @param asset Image.
   */
  async remove(asset: CreatorAsset): Promise<void> {
    if (this.refuseUsed(asset.used_by)) return;
    if (!(await this.confirm.open(this.t('delete_title'), `${this.t('delete_image_text')} „${asset.name}“`))) return;
    this.run(this.api.deleteAsset(asset.id));
  }

  /**
   * @description Restores an image of the trash.
   * @param asset Image.
   */
  restore(asset: CreatorAsset): void {
    this.run(this.api.restoreAsset(asset.id));
  }

  /**
   * @description Deletes an image of the trash for good (after a confirmation).
   * @param asset Image.
   */
  async destroy(asset: CreatorAsset): Promise<void> {
    if (this.refuseUsed(asset.used_by)) return;
    if (!(await this.confirm.open(this.t('destroy_title'), `${this.t('destroy_text')} „${asset.name}“`))) return;
    this.run(this.api.deleteAsset(asset.id, true));
  }

  /** @description Empties the image trash (after a confirmation). */
  async emptyTrash(): Promise<void> {
    if (!(await this.confirm.open(this.t('empty_trash_title'), this.t('empty_images_trash_text')))) return;
    this.run(this.api.emptyAssetTrash());
  }

  /**
   * @description Explains that an image used by templates cannot be deleted.
   * @param usedBy Templates and blocks using the image.
   * @returns true when refused.
   */
  private refuseUsed(usedBy: UsedByTemplate[] | undefined): boolean {
    if (!usedBy?.length) return false;
    const names = usedBy.map(u => `${u.kind === 'block' ? this.t('in_use_block') + ' ' : ''}„${u.name}“${u.trashed ? ` (${this.t('in_use_trashed')})` : ''}`).join(', ');
    this.alert.open(this.t('in_use_title'), `${this.t('in_use_image')} ${names}`, 'warning');
    return true;
  }

  /** @description End of an upload: reload the list and the usage. */
  private afterUpload(): void {
    this.uploading = null;
    this.usage.refresh();
    this.load(1);
  }

  /**
   * @description Runs a change, then reloads the first page and the usage.
   * @param request Request of the change.
   * @param done Called after success, before the reload.
   */
  private run<T>(request: Observable<T>, done?: () => void): void {
    this.busy = true;
    this.cd.markForCheck();
    request.subscribe({
      next: () => {
        this.busy = false;
        done?.();
        this.usage.refresh();
        this.load(1);
      },
      error: () => {
        this.busy = false;
        this.cd.markForCheck();
      },
    });
  }

  /**
   * @description Loads a page of the current view (page 1 replaces the list, others append).
   * @param page Page.
   */
  private load(page: number): void {
    this.loading = true;
    this.cd.markForCheck();
    this.api.assets({ page, search: this.search.trim(), trashed: this.view === 'trash' }).subscribe({
      next: result => {
        this.items = page === 1 ? result.data : [...this.items, ...result.data];
        this.total = result.meta.total;
        this.page = result.meta.current_page;
        this.lastPage = result.meta.last_page;
        this.loading = false;
        this.cd.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cd.markForCheck();
      },
    });
  }
}
