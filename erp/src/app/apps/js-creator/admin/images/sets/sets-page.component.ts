/**
 * @file sets-page.component.ts
 * @path src/app/apps/js-creator/admin/images/sets/sets-page.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Page "Sets" of the section Images: the own sets - templates of different sizes
 *   filled in by one form (one output per template). A card shows the formats of the set; its
 *   main action is Generate. New / edit in a popup: name, caption pattern (empty = the pattern of
 *   the first template), templates in their order (add by searching the own templates, up /
 *   down, remove). The API refuses a template whose field has another kind than the same key in
 *   another template (422 `field_conflict`) - the popup explains which field and templates.
 *   Trash with restore, delete for good and emptying.
 *   Multiselect: a checkbox on every card and "select all"; the bar of the selection exports the
 *   selected sets (with their templates, blocks, images, icons and fonts) as one JSON file and
 *   moves them to the trash (in the trash: restore, delete for good); a card exports itself too.
 *   Import of a JSON file of an export (ImportDialogComponent) - the thumbnails of the imported
 *   templates and blocks are drawn in the background (ThumbnailRefresherService).
 * @dependencies SetsApiService, TemplatesApiService (adding templates), TransferApiService,
 *   CardSelection, Router, AdminModalComponent, QuotaBarComponent, ImportDialogComponent,
 *   ConfirmDialogService, AlertDialogService, PermissionService, AdminLocalizationService
 *   (sections `js-creator-sets`, `js-creator-shared`).
 */

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Injector, OnDestroy, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
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
import { SetQuery, SetsApiService } from '../../shared/sets-api.service';
import { TemplatesApiService } from '../../shared/templates-api.service';
import { BulkAction, CreatorSet, CreatorTemplate, ImportSummary, SetFieldConflict, SetTemplate } from '../../shared/js-creator.models';
import { JsCreatorSectionId, sectionPermission } from '../../shared/js-creator-sections';
import { presetOf } from '../../shared/render/document';
import { QuotaBarComponent } from '../../shared/quota-bar/quota-bar.component';
import { MAX_SELECTION, TransferApiService, exportErrorKey, exportFileName } from '../../shared/transfer-api.service';
import { CardSelection } from '../../shared/card-selection';
import { ImportDialogComponent } from '../../shared/import-dialog/import-dialog.component';
import { CreatorIconComponent } from '../../shared/creator-icon/creator-icon.component';
import { uiIcon } from '../../shared/ui-icons';

/** Most templates of a set (API limit). */
export const MAX_SET_TEMPLATES = 10;

/** Longest caption pattern (API limit). */
const MAX_CAPTION = 5000;

/** Open popup of a set. */
interface SetDialog {
  /** Set being edited (null = new). */
  set: CreatorSet | null;
  name: string;
  caption: string;
  templates: SetTemplate[];
  /** Search of templates to add. */
  search: string;
  /** Templates found to add. */
  found: CreatorTemplate[];
  error: string;
}

/** Sorting of the list (value of the select). */
type SortKey = 'updated' | 'created' | 'name';

@Component({
  selector: 'app-js-creator-sets-page',
  standalone: true,
  imports: [
    DatePipe, FormsModule, PageHeaderComponent, AdminModalComponent, RowButtonBuilderComponent, IconComponent, QuotaBarComponent, ImportDialogComponent,
    CreatorIconComponent,
  ],
  templateUrl: './sets-page.component.html',
  styleUrls: ['../../../../../admin/shared-styles/modal.css', '../../shared-styles/workspace.css', './sets-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetsPageComponent implements OnInit, OnDestroy {
  private readonly api = inject(SetsApiService);
  private readonly templatesApi = inject(TemplatesApiService);
  private readonly i18n = inject(AdminLocalizationService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly alert = inject(AlertDialogService);
  private readonly transfer = inject(TransferApiService);
  private readonly injector = inject(Injector);
  private readonly permissions = inject(PermissionService);
  private readonly router = inject(Router);
  private readonly cd = inject(ChangeDetectorRef);

  /** Section of the page. */
  readonly section: JsCreatorSectionId = 'images';
  /** Id of the form of the popup (submit button in the footer). */
  readonly formId = 'jc-set-form';
  /** Limits shown in the popup. */
  readonly maxTemplates = MAX_SET_TEMPLATES;
  readonly maxCaption = MAX_CAPTION;

  /** View: the sets or their trash. */
  view: 'active' | 'trash' = 'active';
  /** Loaded sets. */
  items: CreatorSet[] = [];
  /** Total of the view. */
  total = 0;
  /** Last loaded page. */
  page = 1;
  /** Last page of the view. */
  lastPage = 1;
  /** Search in the names. */
  search = '';
  /** Sorting. */
  sort: SortKey = 'updated';
  /** A list request is running. */
  loading = false;
  /** A change is running. */
  busy = false;
  /** Open popup. */
  dialog: SetDialog | null = null;
  /** Selected cards (multiselect). */
  readonly selection = new CardSelection(MAX_SELECTION);
  /** The import popup is open. */
  importing = false;
  /** Icon of the export of a card. */
  readonly exportIcon = uiIcon('download');

  /** May create sets and generate. */
  readonly canCreate = this.permissions.hasPermission(sectionPermission(this.section, 'create'));
  /** May change sets. */
  readonly canUpdate = this.permissions.hasPermission(sectionPermission(this.section, 'update'));
  /** May delete / restore. */
  readonly canDelete = this.permissions.hasPermission(sectionPermission(this.section, 'delete'));

  private readonly viewButtons = new RowButtonItems();
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private findTimer: ReturnType<typeof setTimeout> | null = null;

  /** @description Loads the first page. */
  ngOnInit(): void {
    this.load(1);
  }

  /** @description Stops the pending searches. */
  ngOnDestroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    if (this.findTimer) clearTimeout(this.findTimer);
  }

  /**
   * @description Text of the page.
   * @param key Key in `js-creator-sets`.
   */
  t(key: string): string {
    return this.i18n.getValue(`js-creator-sets.${key}`);
  }

  /**
   * @description Text with values (`{name}` placeholders).
   * @param key Key in `js-creator-sets`.
   * @param params Values.
   */
  tf(key: string, params: Record<string, string | number>): string {
    return Object.entries(params).reduce((text, [name, value]) => text.split(`{${name}}`).join(String(value)), this.t(key));
  }

  /** @description Locale of the dates. */
  get locale(): string {
    return this.i18n.getDateLocale();
  }

  /** @description Buttons of the view switch. */
  get viewItems(): RowButton[] {
    return this.viewButtons.update([
      { value: 'active', label: this.t('view_sets') },
      { value: 'trash', label: this.t('view_trash') },
    ]);
  }

  /**
   * @description Short label of a size: W × H (and the preset).
   * @param template Template of a set.
   */
  sizeLabel(template: { width: number; height: number }): string {
    const preset = presetOf(template);
    return `${template.width} × ${template.height}${preset ? ' · ' + this.i18n.getValue(`js-creator-templates.${preset.labelKey}`) : ''}`;
  }

  /**
   * @description Templates of a set that can be generated (outside the trash).
   * @param set Set.
   */
  active(set: CreatorSet): SetTemplate[] {
    return set.templates.filter(t => !t.trashed);
  }

  /**
   * @description Switches between the sets and the trash.
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

  /** @description Sorting changed. */
  reload(): void {
    this.load(1);
  }

  /** @description Loads the next page and appends it. */
  loadMore(): void {
    if (this.page < this.lastPage) this.load(this.page + 1);
  }

  /**
   * @description Opens generating of a set (the main action of a card).
   * @param set Set.
   */
  generate(set: CreatorSet): void {
    if (this.view === 'active' && this.active(set).length) this.router.navigate(['/admin/js-creator/image-sets', set.id, 'generate']);
  }

  // ── popup ───────────────────────────────────────────────────────────────────

  /** @description Opens the popup of a new set. */
  openCreate(): void {
    this.openDialog(null);
  }

  /**
   * @description Opens the popup of a set.
   * @param set Set (null = new).
   */
  openDialog(set: CreatorSet | null): void {
    this.dialog = {
      set, name: set?.name ?? '', caption: set?.caption_template ?? '', templates: set ? [...set.templates] : [], search: '', found: [], error: '',
    };
    this.findTemplates();
  }

  /** @description Closes the popup (not while saving). */
  closeDialog(): void {
    if (!this.busy) this.dialog = null;
    this.cd.markForCheck();
  }

  /** @description Searches templates to add after a short pause. */
  onFind(): void {
    if (this.findTimer) clearTimeout(this.findTimer);
    this.findTimer = setTimeout(() => this.findTemplates(), 300);
  }

  /**
   * @description Templates found that are not in the set yet.
   */
  get candidates(): CreatorTemplate[] {
    const dialog = this.dialog;
    if (!dialog) return [];
    const taken = new Set(dialog.templates.map(t => t.id));
    return dialog.found.filter(t => !taken.has(t.id));
  }

  /**
   * @description Adds a template to the end of the set.
   * @param template Template.
   */
  addTemplate(template: CreatorTemplate): void {
    const dialog = this.dialog;
    if (!dialog || dialog.templates.length >= MAX_SET_TEMPLATES || dialog.templates.some(t => t.id === template.id)) return;
    dialog.templates = [...dialog.templates, {
      id: template.id, name: template.name, width: template.width, height: template.height, output_format: template.output_format,
      thumb_url: template.thumb_url, trashed: false,
    }];
    dialog.error = '';
    this.cd.markForCheck();
  }

  /**
   * @description Moves a template of the set by one place.
   * @param index Index.
   * @param step -1 (up) / 1 (down).
   */
  moveTemplate(index: number, step: -1 | 1): void {
    const dialog = this.dialog;
    const target = index + step;
    if (!dialog || target < 0 || target >= dialog.templates.length) return;
    const list = [...dialog.templates];
    [list[index], list[target]] = [list[target], list[index]];
    dialog.templates = list;
    this.cd.markForCheck();
  }

  /**
   * @description Removes a template from the set.
   * @param index Index.
   */
  removeTemplate(index: number): void {
    const dialog = this.dialog;
    if (!dialog) return;
    dialog.templates = dialog.templates.filter((_, i) => i !== index);
    dialog.error = '';
    this.cd.markForCheck();
  }

  /** @description Saves the set of the popup (new / changed). */
  submitDialog(): void {
    const dialog = this.dialog;
    if (!dialog) return;
    const name = dialog.name.trim();
    dialog.error = !name ? this.t('error_name_required') : '';
    if (dialog.error) {
      this.cd.markForCheck();
      return;
    }
    const body = { name, caption_template: dialog.caption.trim() ? dialog.caption : null, template_ids: dialog.templates.map(t => t.id) };
    const request = dialog.set ? this.api.save(this.section, dialog.set.id, body) : this.api.create(this.section, body);
    this.busy = true;
    this.cd.markForCheck();
    request.subscribe({
      next: () => {
        this.busy = false;
        this.dialog = null;
        this.load(1);
      },
      error: (error: HttpErrorResponse) => {
        this.busy = false;
        dialog.error = this.saveError(dialog, error);
        this.cd.markForCheck();
      },
    });
  }

  /**
   * @description Explains a refused save: a field of another kind (names the field and the
   *   templates), a template that is not available, or another error.
   * @param dialog Popup.
   * @param error Error of the API.
   */
  saveError(dialog: SetDialog, error: HttpErrorResponse): string {
    const conflict = error.error?.conflict as SetFieldConflict | undefined;
    if (error.status === 422 && error.error?.error_code === 'field_conflict' && conflict) {
      const name = (id: number) => dialog.templates.find(t => t.id === id)?.name ?? `#${id}`;
      return this.tf('error_conflict', {
        key: conflict.key, template: name(conflict.template_id), type: this.t(`kind_${conflict.type}`),
        other: name(conflict.other_id), other_type: this.t(`kind_${conflict.other_type}`),
      });
    }
    if (error.status === 422) {
      const index = Object.keys(error.error?.errors ?? {}).map(k => /^template_ids\.(\d+)$/.exec(k)).find(m => m)?.[1];
      const template = index !== undefined ? dialog.templates[Number(index)] : undefined;
      return template ? this.tf('error_template', { template: template.name }) : this.t('error_invalid');
    }
    return `${this.t('error_save')} (${error.status || this.t('network')})`;
  }

  // ── trash ───────────────────────────────────────────────────────────────────

  /**
   * @description Text of the multiselect, export and import (shared by the lists).
   * @param key Key in `js-creator-shared`.
   */
  ts(key: string): string {
    return this.i18n.getValue(`js-creator-shared.${key}`);
  }

  /** @description Every listed card is selected. */
  get allSelected(): boolean {
    return this.selection.allOf(this.items);
  }

  /**
   * @description Selects a card or takes it out of the selection.
   * @param set Set.
   */
  toggle(set: CreatorSet): void {
    this.selection.toggle(set.id);
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
   * @description Exports sets as one JSON file with their templates (not those in the trash)
   *   and everything the templates need; the browser saves it.
   * @param one A single card (null = the selection).
   */
  exportSets(one: CreatorSet | null = null): void {
    const ids = one ? [one.id] : this.selection.ids();
    if (!ids.length || this.busy) return;
    this.busy = true;
    this.cd.markForCheck();
    this.transfer.export(this.section, { set_ids: ids }).subscribe({
      next: pkg => {
        this.busy = false;
        const single = ids.length === 1 ? (one ?? this.items.find(item => item.id === ids[0]))?.name ?? null : null;
        this.transfer.download(pkg, exportFileName('sets', single));
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
   * @description Bulk action on the selected sets (after a confirmation): to the trash, restore,
   *   delete for good (their templates stay).
   * @param action delete | restore | destroy.
   */
  async bulk(action: BulkAction): Promise<void> {
    const ids = this.selection.ids();
    if (!ids.length) return;
    if (action !== 'restore') {
      const key = action === 'delete' ? 'bulk_delete' : 'bulk_destroy';
      if (!(await this.confirm.open(this.ts(`${key}_title`), `${this.ts(`${key}_text`)} ${ids.length}`))) return;
    }
    this.run(this.transfer.bulk(this.section, 'sets', action, ids), () => this.selection.clear());
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
   * @description An import finished: the list is loaded again and the thumbnails of the new
   *   blocks and templates are drawn in the background (each new one replaces the size label).
   * @param summary Result of the import.
   */
  onImported(summary: ImportSummary): void {
    this.selection.clear();
    this.load(1);
    if (this.canUpdate && (summary.template_ids.length || summary.block_ids.length)) void this.drawThumbnails(summary);
  }

  /**
   * @description Draws the thumbnails of imported blocks and templates (renderer loaded now).
   * @param summary Result of the import.
   */
  private async drawThumbnails(summary: ImportSummary): Promise<void> {
    try {
      const { ThumbnailRefresherService } = await import('../../shared/thumbnail-refresher.service');
      const refresher = this.injector.get(ThumbnailRefresherService);
      await refresher.refresh(this.section, summary.block_ids, undefined, 'block');
      await refresher.refresh(this.section, summary.template_ids, (id, url) => {
        this.items = this.items.map(set => set.templates.some(t => t.id === id)
          ? { ...set, templates: set.templates.map(t => (t.id === id ? { ...t, thumb_url: url } : t)) }
          : set);
        this.cd.markForCheck();
      });
    } catch {
      // The thumbnails stay missing; the lists of templates and blocks draw them later.
    }
  }

  /**
   * @description Moves a set to the trash (after a confirmation; its templates stay).
   * @param set Set.
   */
  async remove(set: CreatorSet): Promise<void> {
    if (!(await this.confirm.open(this.t('delete_title'), `${this.t('delete_text')} „${set.name}“`))) return;
    this.run(this.api.delete(this.section, set.id));
  }

  /**
   * @description Restores a set of the trash.
   * @param set Set.
   */
  restore(set: CreatorSet): void {
    this.run(this.api.restore(this.section, set.id));
  }

  /**
   * @description Deletes a set of the trash for good (after a confirmation).
   * @param set Set.
   */
  async destroy(set: CreatorSet): Promise<void> {
    if (!(await this.confirm.open(this.t('destroy_title'), `${this.t('destroy_text')} „${set.name}“`))) return;
    this.run(this.api.delete(this.section, set.id, true));
  }

  /** @description Empties the set trash (after a confirmation). */
  async emptyTrash(): Promise<void> {
    if (!(await this.confirm.open(this.t('empty_trash_title'), this.t('empty_trash_text')))) return;
    this.run(this.api.emptyTrash(this.section));
  }

  /**
   * @description Runs a change, then reloads the first page.
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
        this.load(1);
      },
      error: () => {
        this.busy = false;
        this.cd.markForCheck();
      },
    });
  }

  /** @description Searches the own templates of the section to add (first page, by name). */
  private findTemplates(): void {
    const dialog = this.dialog;
    if (!dialog) return;
    this.templatesApi.list(this.section, { page: 1, search: dialog.search.trim(), sortBy: 'name', sortDirection: 'asc' }).subscribe({
      next: result => {
        if (this.dialog === dialog) dialog.found = result.data;
        this.cd.markForCheck();
      },
      error: () => this.cd.markForCheck(),
    });
    this.cd.markForCheck();
  }

  /**
   * @description Loads a page of the current view (page 1 replaces the list, others append).
   * @param page Page.
   */
  private load(page: number): void {
    const sorting: Record<SortKey, Pick<SetQuery, 'sortBy' | 'sortDirection'>> = {
      updated: { sortBy: 'updated_at', sortDirection: 'desc' },
      created: { sortBy: 'created_at', sortDirection: 'desc' },
      name: { sortBy: 'name', sortDirection: 'asc' },
    };
    this.loading = true;
    this.cd.markForCheck();
    this.api.list(this.section, { page, search: this.search.trim(), trashed: this.view === 'trash', ...sorting[this.sort] }).subscribe({
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
