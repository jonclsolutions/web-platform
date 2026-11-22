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
 *   delete for good and emptying.
 * @dependencies TemplatesApiService, WorkspaceUsageService, Router, AdminModalComponent,
 *   SizePickerComponent, QuotaBarComponent, ConfirmDialogService, PermissionService,
 *   AdminLocalizationService (section `js-creator-templates`).
 */

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { AdminLocalizationService } from '../../../../../core/services/admin-localization.service';
import { ConfirmDialogService } from '../../../../../core/services/confirm-dialog.service';
import { PermissionService } from '../../../../../core/auth/services/permission.service';
import { PageHeaderComponent } from '../../../../../admin/components/page-header/page-header.component';
import { AdminModalComponent } from '../../../../../admin/components/admin-modal/admin-modal.component';
import { RowButtonBuilderComponent } from '../../../../../admin/components/builders/row-button-builder/row-button-builder.component';
import { RowButton, RowButtonItems } from '../../../../../admin/components/builders/row-button-builder/row-button';
import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { TemplateQuery, TemplatesApiService } from '../../shared/templates-api.service';
import { WorkspaceUsageService } from '../../shared/workspace-usage.service';
import { CreatorTemplate, TemplateSizeCount } from '../../shared/js-creator.models';
import { JsCreatorSectionId, sectionPermission } from '../../shared/js-creator-sections';
import { CanvasSize, isValidSize, presetOf } from '../../shared/render/document';
import { QuotaBarComponent } from '../../shared/quota-bar/quota-bar.component';
import { SizePickerComponent } from '../../shared/size-picker/size-picker.component';
import { CreatorIconComponent } from '../../shared/creator-icon/creator-icon.component';
import { uiIcon } from '../../shared/ui-icons';

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
    CreatorIconComponent,
  ],
  templateUrl: './templates-page.component.html',
  styleUrls: ['../../../../../admin/shared-styles/modal.css', '../../shared-styles/workspace.css', './templates-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplatesPageComponent implements OnInit, OnDestroy {
  private readonly api = inject(TemplatesApiService);
  private readonly usage = inject(WorkspaceUsageService);
  private readonly i18n = inject(AdminLocalizationService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly permissions = inject(PermissionService);
  private readonly router = inject(Router);
  private readonly cd = inject(ChangeDetectorRef);

  /** Icons of the copy actions. */
  readonly copyIcon = uiIcon('copy');
  readonly formatIcon = uiIcon('ratio');

  /** Section of the page. */
  readonly section: JsCreatorSectionId = 'images';
  /** Id of the form of the popup (submit button in the footer). */
  readonly formId = 'jc-template-form';

  /** View: the templates or their trash. */
  view: 'active' | 'trash' = 'active';
  /** Loaded templates. */
  items: CreatorTemplate[] = [];
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
  }

  /** @description Stops the pending search. */
  ngOnDestroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
  }

  /**
   * @description Text of the section.
   * @param key Key in `js-creator-templates`.
   */
  t(key: string): string {
    return this.i18n.getValue(`js-creator-templates.${key}`);
  }

  /** @description Locale of the dates. */
  get locale(): string {
    return this.i18n.getDateLocale();
  }

  /** @description Buttons of the view switch. */
  get viewItems(): RowButton[] {
    return this.viewButtons.update([
      { value: 'active', label: this.t('view_templates'), icon: 'layers' },
      { value: 'trash', label: this.t('view_trash'), icon: 'trash' },
    ]);
  }

  /**
   * @description Name of the size: the preset or "custom".
   * @param size Size.
   */
  sizeLabel(size: CanvasSize): string {
    const preset = presetOf(size);
    return `${size.width} × ${size.height}${preset ? ' · ' + this.t(preset.labelKey) : ''}`;
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
    this.load(1);
  }

  /** @description Searches after a short pause in typing. */
  onSearch(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(1), 300);
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
    if (this.view === 'active') this.router.navigate(['/admin/js-creator/image-templates', template.id, 'edit']);
  }

  /**
   * @description Opens generating from a template (the main action of a card).
   * @param template Template.
   */
  generate(template: CreatorTemplate): void {
    if (this.view === 'active') this.router.navigate(['/admin/js-creator/image-templates', template.id, 'generate']);
  }

  /** @description Opens the popup of a new template (Instagram portrait by default). */
  openCreate(): void {
    this.dialog = { kind: 'create', source: null, name: '', size: { width: 1080, height: 1350 }, error: '' };
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
          this.router.navigate(['/admin/js-creator/image-templates', template.id, 'edit']);
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

  /**
   * @description Moves a template to the trash (after a confirmation).
   * @param template Template.
   */
  async remove(template: CreatorTemplate): Promise<void> {
    if (!(await this.confirm.open(this.t('delete_title'), `${this.t('delete_text')} „${template.name}“`))) return;
    this.run(this.api.delete(this.section, template.id));
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
  async destroy(template: CreatorTemplate): Promise<void> {
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
   */
  private run<T>(request: Observable<T>): void {
    this.busy = true;
    this.cd.markForCheck();
    request.subscribe({
      next: () => {
        this.busy = false;
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
    const sorting: Record<SortKey, Pick<TemplateQuery, 'sortBy' | 'sortDirection'>> = {
      updated: { sortBy: 'updated_at', sortDirection: 'desc' },
      created: { sortBy: 'created_at', sortDirection: 'desc' },
      name: { sortBy: 'name', sortDirection: 'asc' },
    };
    this.loading = true;
    this.cd.markForCheck();
    this.api.list(this.section, {
      page, search: this.search.trim(), size: this.view === 'active' ? this.sizeFilter : '', trashed: this.view === 'trash', ...sorting[this.sort],
    }).subscribe({
      next: result => {
        this.items = page === 1 ? result.data : [...this.items, ...result.data];
        this.total = result.meta.total;
        this.page = result.meta.current_page;
        this.lastPage = result.meta.last_page;
        this.sizes = result.meta.sizes ?? [];
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
