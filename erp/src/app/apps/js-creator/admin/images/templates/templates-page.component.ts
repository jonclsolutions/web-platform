/**
 * @file templates-page.component.ts
 * @path src/app/apps/js-creator/admin/images/templates/templates-page.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Page "Templates" of the section Images: grid of the own templates (thumbnail, name,
 *   size), search, filter by size, sorting, "load more"; the main action of a card is Generate
 *   (the thumbnail and the button), the editor is one click further; new template (name + size)
 *   opens the editor; copy, copy to another size, delete to the trash; the trash with restore,
 *   delete for good and emptying. Thumbnails made stale by a changed block are drawn again in
 *   the background (ThumbnailRefresherService, loaded only when needed).
 *   The same page lists the BLOCKS (`image-blocks`, route data `kind: 'block'`): the main action
 *   is the editor of the block, no size filter, and a block used by templates is not deleted - a
 *   message names the templates.
 *   Templates can be starred (a personal mark, the template stays as it is); above the list are
 *   the starred and the recently used templates (outputs generated from them) - one click opens
 *   generating.
 *   Multiselect: a checkbox on every card and "select all"; the bar of the selection exports the
 *   selected items as one JSON file and moves them to the trash (in the trash: restore, delete
 *   for good); a card exports itself too. Import of a JSON file of an export (ImportDialogComponent).
 * @dependencies TemplatesApiService / BlocksApiService, TransferApiService, CardSelection,
 *   WorkspaceUsageService, Router, ActivatedRoute, AdminModalComponent, SizePickerComponent,
 *   QuotaBarComponent, ImportDialogComponent, ConfirmDialogService, AlertDialogService,
 *   PermissionService, AdminLocalizationService (sections `js-creator-templates`,
 *   `js-creator-blocks`, `js-creator-shared`).
 */

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Injector, OnDestroy, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { AdminLocalizationService } from '../../../../../core/services/admin-localization.service';
import { ConfirmDialogService } from '../../../../../core/services/confirm-dialog.service';
import { AlertDialogService } from '../../../../../core/services/alert-dialog.service';
import { PermissionService } from '../../../../../core/auth/services/permission.service';
import { PageHeaderComponent } from '../../../../../admin/components/page-header/page-header.component';
import { AdminModalComponent } from '../../../../../admin/components/admin-modal/admin-modal.component';
import { RowButtonBuilderComponent } from '../../../../../admin/components/builders/row-button-builder/row-button-builder.component';
import { RowButton, RowButtonItems } from '../../../../../admin/components/builders/row-button-builder/row-button';
import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { TemplateQuery, TemplatesApiService } from '../../shared/templates-api.service';
import { BlocksApiService } from '../../shared/blocks-api.service';
import { WorkspaceUsageService } from '../../shared/workspace-usage.service';
import { BulkAction, BulkResult, CreatorTemplate, ImportSummary, TemplateSizeCount, UsedByTemplate } from '../../shared/js-creator.models';
import { JsCreatorSectionId, sectionPermission } from '../../shared/js-creator-sections';
import { CanvasSize, isValidSize, presetOf } from '../../shared/render/document';
import { QuotaBarComponent } from '../../shared/quota-bar/quota-bar.component';
import { SizePickerComponent } from '../../shared/size-picker/size-picker.component';
import { CreatorIconComponent } from '../../shared/creator-icon/creator-icon.component';
import { uiIcon } from '../../shared/ui-icons';
import { BulkList, MAX_SELECTION, TransferApiService, exportErrorKey, exportFileName } from '../../shared/transfer-api.service';
import { CardSelection } from '../../shared/card-selection';
import { ImportDialogComponent } from '../../shared/import-dialog/import-dialog.component';

/** Open popup: new template, copy, copy to another size. */
interface TemplateDialog {
  kind: 'create' | 'duplicate' | 'format';
  source: CreatorTemplate | null;
  name: string;
  size: CanvasSize;
  error: string;
}

/** Sorting of the list (value of the select). */
type SortKey = 'updated' | 'created' | 'name';

@Component({
  selector: 'app-js-creator-templates-page',
  standalone: true,
  imports: [
    DatePipe, FormsModule, PageHeaderComponent, AdminModalComponent, RowButtonBuilderComponent, IconComponent, QuotaBarComponent, SizePickerComponent,
    CreatorIconComponent, ImportDialogComponent,
  ],
  templateUrl: './templates-page.component.html',
  styleUrls: ['../../../../../admin/shared-styles/modal.css', '../../shared-styles/workspace.css', './templates-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplatesPageComponent implements OnInit, OnDestroy {
  /** Templates or blocks (route data `kind`). */
  readonly kind: 'template' | 'block' = inject(ActivatedRoute, { optional: true })?.snapshot?.data?.['kind'] === 'block' ? 'block' : 'template';
  private readonly api: TemplatesApiService = this.kind === 'block' ? inject(BlocksApiService) : inject(TemplatesApiService);
  private readonly alert = inject(AlertDialogService);
  private readonly transfer = inject(TransferApiService);
  private readonly injector = inject(Injector);
  private readonly usage = inject(WorkspaceUsageService);
  private readonly i18n = inject(AdminLocalizationService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly permissions = inject(PermissionService);
  private readonly router = inject(Router);
  private readonly cd = inject(ChangeDetectorRef);

  /** Icons of the copy actions. */
  readonly copyIcon = uiIcon('copy');
  readonly formatIcon = uiIcon('ratio');
  readonly exportIcon = uiIcon('download');

  /** Section of the page. */
  readonly section: JsCreatorSectionId = 'images';
  /** Id of the form of the popup (submit button in the footer). */
  readonly formId = 'jc-template-form';

  /** View: the templates or their trash. */
  view: 'active' | 'trash' = 'active';
  /** Loaded templates / blocks (a block has no output fields - only the shared ones are shown). */
  items: (CreatorTemplate & { used_by?: UsedByTemplate[] })[] = [];
  /** Total of the view. */
  total = 0;
  /** Last loaded page. */
  page = 1;
  /** Last page of the view. */
  lastPage = 1;
  /** Search in the names. */
  search = '';
  /** Size filter (`<w>x<h>`, '' = all). */
  sizeFilter = '';
  /** Sizes in use. */
  sizes: TemplateSizeCount[] = [];
  /** Sorting. */
  sort: SortKey = 'updated';
  /** A list request is running. */
  loading = false;
  /** A change is running. */
  busy = false;
  /** Open popup. */
  dialog: TemplateDialog | null = null;
  /** Selected cards (multiselect). */
  readonly selection = new CardSelection(MAX_SELECTION);
  /** The import popup is open. */
  importing = false;

  /** May create and copy. */
  readonly canCreate = this.permissions.hasPermission(sectionPermission(this.section, 'create'));
  /** May open the editor to save. */
  readonly canUpdate = this.permissions.hasPermission(sectionPermission(this.section, 'update'));
  /** May delete / restore. */
  readonly canDelete = this.permissions.hasPermission(sectionPermission(this.section, 'delete'));

  private readonly viewButtons = new RowButtonItems();
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  /** @description Loads the first page. */
  ngOnInit(): void {
    this.load(1);
    this.loadStrips();
  }

  /** Starred templates (strip above the list). */
  favorites: CreatorTemplate[] = [];
  /** Recently used templates (strip above the list). */
  recent: CreatorTemplate[] = [];

  /** The strips are shown: templates, the active list, no search. */
  get showStrips(): boolean {
    return this.kind === 'template' && this.view === 'active' && !this.search.trim() && (this.favorites.length > 0 || this.recent.length > 0);
  }

  /**
   * @description Stars / unstars a template and refreshes the strips.
   * @param template Template.
   */
  toggleFavorite(template: CreatorTemplate): void {
    if (this.kind !== 'template') return;
    const favorite = !template.favorite;
    this.api.setFavorite(this.section, template.id, favorite).subscribe(() => {
      this.items = this.items.map(t => (t.id === template.id ? { ...t, favorite } : t));
      this.loadStrips();
      this.cd.markForCheck();
    });
  }

  /** @description Loads the starred and the recently used templates (at most 8 each). */
  private loadStrips(): void {
    if (this.kind !== 'template') return;
    this.api.list(this.section, { page: 1, favorite: true, sortBy: 'name', sortDirection: 'asc' }).subscribe({
      next: result => {
        this.favorites = result.data.slice(0, 8);
        this.cd.markForCheck();
      },
      error: () => undefined,
    });
    this.api.list(this.section, { page: 1, used: true, sortBy: 'last_used_at', sortDirection: 'desc' }).subscribe({
      next: result => {
        this.recent = result.data.slice(0, 8);
        this.cd.markForCheck();
      },
      error: () => undefined,
    });
  }

  /** @description Stops the pending search. */
  ngOnDestroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
  }

  /**
   * @description Text of the page.
   * @param key Key in `js-creator-templates` (blocks: `js-creator-blocks`).
   */
  t(key: string): string {
    return this.i18n.getValue(`js-creator-${this.kind === 'block' ? 'blocks' : 'templates'}.${key}`);
  }

  /**
   * @description Text of the multiselect, export and import (shared by the lists).
   * @param key Key in `js-creator-shared`.
   */
  ts(key: string): string {
    return this.i18n.getValue(`js-creator-shared.${key}`);
  }

  /** @description List of the API of the page (templates / blocks). */
  private get list(): BulkList {
    return this.kind === 'block' ? 'blocks' : 'templates';
  }

  /** @description Base of the editor route (templates / blocks). */
  private get path(): string {
    return this.kind === 'block' ? '/admin/js-creator/image-blocks' : '/admin/js-creator/image-templates';
  }

  /** @description Locale of the dates. */
  get locale(): string {
    return this.i18n.getDateLocale();
  }

  /** @description Buttons of the view switch. */
  get viewItems(): RowButton[] {
    return this.viewButtons.update([
      { value: 'active', label: this.t('view_templates') },
      { value: 'trash', label: this.t('view_trash') },
    ]);
  }

  /**
   * @description Name of the size: the preset or "custom".
   * @param size Size.
   */
  sizeLabel(size: CanvasSize): string {
    const preset = presetOf(size);
    return `${size.width} × ${size.height}${preset ? ' · ' + this.i18n.getValue(`js-creator-templates.${preset.labelKey}`) : ''}`;
  }

  /**
   * @description Aspect ratio of a card preview (CSS).
   * @param template Template.
   */
  aspect(template: CreatorTemplate): string {
    return `${template.width} / ${template.height}`;
  }

  /**
   * @description Switches between the templates and the trash.
   * @param value 'active' | 'trash'.
   */
  switchView(value: string): void {
    this.view = value === 'trash' ? 'trash' : 'active';
    this.selection.clear();
    this.load(1);
  }

  /** @description Searches after a short pause in typing. */
  onSearch(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.selection.clear();
      this.load(1);
    }, 300);
  }

  /** @description Filter or sorting changed. */
  reload(): void {
    this.load(1);
  }

  /** @description Loads the next page and appends it. */
  loadMore(): void {
    if (this.page < this.lastPage) this.load(this.page + 1);
  }

  /**
   * @description Opens a template in the editor.
   * @param template Template.
   */
  open(template: CreatorTemplate): void {
    if (this.view === 'active') this.router.navigate([this.path, template.id, 'edit']);
  }

  /**
   * @description Opens generating from a template (the main action of a card).
   * @param template Template.
   */
  generate(template: CreatorTemplate): void {
    if (this.kind === 'block') return this.open(template);
    if (this.view === 'active') this.router.navigate(['/admin/js-creator/image-templates', template.id, 'generate']);
  }

  /** @description Opens the popup of a new template (Instagram portrait by default) / block (600 × 300). */
  openCreate(): void {
    const size = this.kind === 'block' ? { width: 600, height: 300 } : { width: 1080, height: 1350 };
    this.dialog = { kind: 'create', source: null, name: '', size, error: '' };
    this.cd.markForCheck();
  }

  /**
   * @description Opens the popup of a copy (same size) or of a copy to another size.
   * @param template Template.
   * @param kind duplicate | format.
   */
  openDuplicate(template: CreatorTemplate, kind: 'duplicate' | 'format'): void {
    const size = kind === 'format' && template.width === 1080 && template.height === 1350
      ? { width: 1080, height: 1920 }
      : { width: template.width, height: template.height };
    const name = kind === 'duplicate' ? `${template.name} (${this.t('copy_suffix')})` : template.name;
    this.dialog = { kind, source: template, name: name.slice(0, 120), size, error: '' };
    this.cd.markForCheck();
  }

  /** @description Closes the popup (not while saving). */
  closeDialog(): void {
    if (!this.busy) this.dialog = null;
    this.cd.markForCheck();
  }

  /**
   * @description New size from the picker of the popup.
   * @param size Size.
   */
  setDialogSize(size: CanvasSize): void {
    if (this.dialog) this.dialog = { ...this.dialog, size };
    this.cd.markForCheck();
  }

  /** @description Heading of the popup. */
  get dialogTitle(): string {
    return this.t(this.dialog?.kind === 'create' ? 'new_title' : this.dialog?.kind === 'format' ? 'format_title' : 'duplicate_title');
  }

  /** @description Creates / copies the template of the popup, then opens it in the editor. */
  submitDialog(): void {
    const dialog = this.dialog;
    if (!dialog) return;
    const name = dialog.name.trim();
    dialog.error = !name ? this.t('error_name_required') : dialog.kind !== 'duplicate' && !isValidSize(dialog.size) ? this.t('error_size') : '';
    if (dialog.error) {
      this.cd.markForCheck();
      return;
    }
    const request = dialog.kind === 'create'
      ? this.api.create(this.section, { name, ...dialog.size })
      : this.api.duplicate(this.section, (dialog.source as CreatorTemplate).id, dialog.kind === 'format' ? { name, ...dialog.size } : { name });
    this.busy = true;
    this.cd.markForCheck();
    request.subscribe({
      next: template => {
        this.busy = false;
        this.dialog = null;
        this.usage.refresh();
        if (this.canUpdate) {
          this.router.navigate([this.path, template.id, 'edit']);
        } else {
          this.load(1);
        }
      },
      error: () => {
        this.busy = false;
        this.cd.markForCheck();
      },
    });
  }

  /** @description Every listed card is selected. */
  get allSelected(): boolean {
    return this.selection.allOf(this.items);
  }

  /**
   * @description Selects a card or takes it out of the selection.
   * @param template Template / block.
   */
  toggle(template: CreatorTemplate): void {
    this.selection.toggle(template.id);
    this.cd.markForCheck();
  }

  /** @description Selects every listed card (or none, when all are selected). */
  toggleAll(): void {
    this.selection.toggleAll(this.items);
    this.cd.markForCheck();
  }

  /** @description Empties the selection. */
  clearSelection(): void {
    this.selection.clear();
    this.cd.markForCheck();
  }

  /**
   * @description Exports templates / blocks as one JSON file (with the images, icons, fonts and
   *   blocks they need) saved by the browser.
   * @param one A single card (null = the selection).
   */
  exportItems(one: CreatorTemplate | null = null): void {
    const ids = one ? [one.id] : this.selection.ids();
    if (!ids.length || this.busy) return;
    this.busy = true;
    this.cd.markForCheck();
    this.transfer.export(this.section, this.kind === 'block' ? { block_ids: ids } : { template_ids: ids }).subscribe({
      next: pkg => {
        this.busy = false;
        const single = ids.length === 1 ? (one ?? this.items.find(item => item.id === ids[0]))?.name ?? null : null;
        this.transfer.download(pkg, exportFileName(this.list, single));
        this.cd.markForCheck();
      },
      error: (error: unknown) => {
        this.busy = false;
        this.alert.open(this.ts('export_failed_title'), this.ts(exportErrorKey(error)), 'warning');
        this.cd.markForCheck();
      },
    });
  }

  /**
   * @description Bulk action on the selection (after a confirmation): to the trash, restore,
   *   delete for good. Blocks used by templates are skipped - a message names them.
   * @param action delete | restore | destroy.
   */
  async bulk(action: BulkAction): Promise<void> {
    const ids = this.selection.ids();
    if (!ids.length) return;
    if (action !== 'restore') {
      const key = action === 'delete' ? 'bulk_delete' : 'bulk_destroy';
      if (!(await this.confirm.open(this.ts(`${key}_title`), `${this.ts(`${key}_text`)} ${ids.length}`))) return;
    }
    this.run(this.transfer.bulk(this.section, this.list, action, ids), (result: BulkResult) => {
      this.selection.clear();
      if (result.skipped.length) {
        const names = result.skipped.map(s => `„${s.name}“ (${s.used_by.map(u => u.name).join(', ')})`).join('; ');
        this.alert.open(this.ts('bulk_skipped_title'), `${this.ts('bulk_skipped_text')} ${names}`, 'warning');
      }
    });
  }

  /** @description Opens the import popup. */
  openImport(): void {
    this.importing = true;
    this.cd.markForCheck();
  }

  /** @description Closes the import popup. */
  closeImport(): void {
    this.importing = false;
    this.cd.markForCheck();
  }

  /**
   * @description An import finished: the list is loaded again (new thumbnails are drawn by
   *   refreshStale()).
   * @param _summary Result of the import.
   */
  onImported(_summary: ImportSummary): void {
    this.selection.clear();
    this.load(1);
  }

  /**
   * @description Moves a template to the trash (after a confirmation).
   * @param template Template.
   */
  async remove(template: CreatorTemplate & { used_by?: UsedByTemplate[] }): Promise<void> {
    if (this.refuseUsed(template.used_by)) return;
    if (!(await this.confirm.open(this.t('delete_title'), `${this.t('delete_text')} „${template.name}“`))) return;
    this.run(this.api.delete(this.section, template.id));
  }

  /**
   * @description A block used by templates is not deleted: a message names them.
   * @param usedBy Templates using the block (list of blocks).
   * @returns Whether it was refused.
   */
  private refuseUsed(usedBy: UsedByTemplate[] | undefined): boolean {
    if (this.kind !== 'block' || !usedBy?.length) return false;
    const names = usedBy.map(u => `„${u.name}“${u.trashed ? ` (${this.t('in_use_trashed')})` : ''}`).join(', ');
    this.alert.open(this.t('in_use_title'), `${this.t('in_use_text')} ${names}`, 'warning');
    return true;
  }

  /**
   * @description Restores a template of the trash.
   * @param template Template.
   */
  restore(template: CreatorTemplate): void {
    this.run(this.api.restore(this.section, template.id));
  }

  /**
   * @description Deletes a template of the trash for good (after a confirmation).
   * @param template Template.
   */
  async destroy(template: CreatorTemplate & { used_by?: UsedByTemplate[] }): Promise<void> {
    if (this.refuseUsed(template.used_by)) return;
    if (!(await this.confirm.open(this.t('destroy_title'), `${this.t('destroy_text')} „${template.name}“`))) return;
    this.run(this.api.delete(this.section, template.id, true));
  }

  /** @description Empties the template trash (after a confirmation). */
  async emptyTrash(): Promise<void> {
    if (!(await this.confirm.open(this.t('empty_trash_title'), this.t('empty_trash_text')))) return;
    this.run(this.api.emptyTrash(this.section));
  }

  /**
   * @description Runs a change, then reloads the first page and the usage.
   * @param request Request of the change.
   * @param done Called with the answer after success, before the reload.
   */
  private run<T>(request: Observable<T>, done?: (result: T) => void): void {
    this.busy = true;
    this.cd.markForCheck();
    request.subscribe({
      next: result => {
        this.busy = false;
        done?.(result);
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
   * @description Thumbnails of templates whose block changed (and of imported templates and
   *   blocks) are drawn again in the background (the renderer is loaded only now); each new
   *   thumbnail replaces the old one in the grid.
   * @param loaded Templates / blocks of the loaded page.
   */
  private async refreshStale(loaded: readonly CreatorTemplate[]): Promise<void> {
    const ids = loaded.filter(t => t.thumb_stale && !t.deleted_at).map(t => t.id);
    if (!this.canUpdate || !ids.length) return;
    try {
      const { ThumbnailRefresherService } = await import('../../shared/thumbnail-refresher.service');
      await this.injector.get(ThumbnailRefresherService).refresh(this.section, ids, (id, url) => {
        this.items = this.items.map(item => (item.id === id ? { ...item, thumb_url: url, thumb_stale: false } : item));
        this.cd.markForCheck();
      }, this.kind);
    } catch {
      // The old thumbnails stay; the next visit tries again.
    }
  }

  /**
   * @description Loads a page of the current view (page 1 replaces the list, others append).
   * @param page Page.
   */
  private load(page: number): void {
    const sorting: Record<SortKey, Pick<TemplateQuery, 'sortBy' | 'sortDirection'>> = {
      updated: { sortBy: 'updated_at', sortDirection: 'desc' },
      created: { sortBy: 'created_at', sortDirection: 'desc' },
      name: { sortBy: 'name', sortDirection: 'asc' },
    };
    this.loading = true;
    this.cd.markForCheck();
    this.api.list(this.section, {
      page, search: this.search.trim(), size: this.view === 'active' && this.kind === 'template' ? this.sizeFilter : '', trashed: this.view === 'trash',
      ...sorting[this.sort],
    }).subscribe({
      next: result => {
        this.items = page === 1 ? result.data : [...this.items, ...result.data];
        this.total = result.meta.total;
        this.page = result.meta.current_page;
        this.lastPage = result.meta.last_page;
        this.sizes = result.meta.sizes ?? [];
        this.loading = false;
        this.cd.markForCheck();
        void this.refreshStale(result.data);
      },
      error: () => {
        this.loading = false;
        this.cd.markForCheck();
      },
    });
  }
}
