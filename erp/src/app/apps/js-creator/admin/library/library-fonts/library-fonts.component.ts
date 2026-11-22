/**
 * @file library-fonts.component.ts
 * @path src/app/apps/js-creator/admin/library/library-fonts/library-fonts.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Tab "Fonts" of the library: the own fonts of the account (preview, upload of one
 *   face with its family / weight / style, change of the face, delete to the trash; the trash with
 *   restore, delete for good, emptying) and the curated font set of the application (preview of
 *   every family with the Czech characters). Files of a wrong type / size, a face that already
 *   exists or a full quota are refused here with a translated text before sending. A font used by
 *   a template is not deleted - a message names the templates (`used_by` of the list).
 *   Multiselect of the own fonts: a checkbox on every row and "select all"; the selection bar
 *   downloads the selected fonts (one file named after its face, several as one ZIP) and moves
 *   them to the trash (in the trash: restore, delete for good); used fonts and taken faces are
 *   skipped with a message. A row is downloaded by its own button too.
 * @dependencies JsCreatorApiService, FontLibraryService, WorkspaceUsageService, UploadRulesService
 *   (profile js_creator_font), AdminModalComponent, ConfirmDialogService, AlertDialogService,
 *   PermissionService, AdminLocalizationService (section `js-creator-library`).
 */

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, Subscription } from 'rxjs';
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
import { FontLibraryService } from '../../shared/font-library.service';
import { WorkspaceUsageService } from '../../shared/workspace-usage.service';
import { BulkAction, BulkResult, CreatorFont, CuratedFontFamily, FontStyle, UsedByTemplate } from '../../shared/js-creator.models';
import { CardSelection } from '../../shared/card-selection';
import { saveUrl } from '../../shared/save-url';
import { CreatorIconComponent } from '../../shared/creator-icon/creator-icon.component';
import { uiIcon } from '../../shared/ui-icons';
import { can } from '../../shared/js-creator-sections';
import { formatBytes } from '../../shared/workspace-format';

/** Open popup of a font (upload or change of the face). */
interface FontDialog {
  font: CreatorFont | null;
  file: File | null;
  family: string;
  weight: number;
  style: FontStyle;
  error: string;
}

@Component({
  selector: 'app-library-fonts',
  standalone: true,
  imports: [FormsModule, AdminModalComponent, RowButtonBuilderComponent, IconComponent, CreatorIconComponent],
  templateUrl: './library-fonts.component.html',
  styleUrls: ['../../../../../admin/shared-styles/modal.css', '../../shared-styles/workspace.css', './library-fonts.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryFontsComponent implements OnInit, OnDestroy {
  private readonly api = inject(JsCreatorApiService);
  readonly fonts = inject(FontLibraryService);
  private readonly usage = inject(WorkspaceUsageService);
  private readonly uploadRules = inject(UploadRulesService);
  private readonly i18n = inject(AdminLocalizationService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly alert = inject(AlertDialogService);
  private readonly permissions = inject(PermissionService);
  private readonly cd = inject(ChangeDetectorRef);

  /** Allowed weights of a face. */
  readonly weights = [100, 200, 300, 400, 500, 600, 700, 800, 900];
  /** Allowed styles of a face. */
  readonly styles: FontStyle[] = ['normal', 'italic'];
  /** Id of the font form (submit button in the footer). */
  readonly formId = 'jc-font-form';
  /** Icon of the download of a row. */
  readonly downloadIcon = uiIcon('download');
  /** Selected own fonts (multiselect, at most 200 - the limit of the API). */
  readonly selection = new CardSelection(200);

  /** View of the own fonts: active or the trash. */
  view: 'active' | 'trash' = 'active';
  /** Own fonts of the view. */
  own: CreatorFont[] = [];
  /** Own fonts outside the trash (face checks, also while the trash is shown). */
  active: CreatorFont[] = [];
  /** Families of the curated set. */
  curated: CuratedFontFamily[] = [];
  /** A change is running. */
  busy = false;
  /** Rules of the upload profile (null until loaded). */
  rules: UploadRule | null = null;
  /** Open popup. */
  dialog: FontDialog | null = null;

  /** May upload. */
  readonly canCreate = can(this.permissions, 'create');
  /** May change a face. */
  readonly canUpdate = can(this.permissions, 'update');
  /** May delete / restore. */
  readonly canDelete = can(this.permissions, 'delete');

  private readonly viewButtons = new RowButtonItems();
  private readonly subs = new Subscription();

  /** @description Loads the own fonts, the curated set (registered for the previews) and the rules. */
  ngOnInit(): void {
    this.subs.add(this.uploadRules.rules('js_creator_font').subscribe(rules => {
      this.rules = rules;
      this.cd.markForCheck();
    }));
    this.subs.add(this.fonts.curatedFamilies().subscribe(families => {
      families.forEach(family => this.fonts.registerCurated(family));
      this.curated = families;
      this.cd.markForCheck();
    }));
    this.load();
  }

  /** @description Ends the subscriptions. */
  ngOnDestroy(): void {
    this.subs.unsubscribe();
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
      { value: 'active', label: this.t('view_own_fonts') },
      { value: 'trash', label: this.t('view_trash') },
    ]);
  }

  /** @description Value of the accept attribute of the file input. */
  get accept(): string {
    return (this.rules?.extensions ?? ['ttf', 'otf', 'woff', 'woff2']).map(e => `.${e}`).join(',');
  }

  /** @description Hint of the allowed files. */
  get uploadHint(): string {
    const rules = this.rules;
    return rules ? `${extensionsLabel(rules.extensions)} · ${this.t('max_size')} ${rules.max_file_size_mb} MB` : '';
  }

  /**
   * @description CSS family of an own font (registered by load()).
   * @param font Font.
   */
  ownFamily(font: CreatorFont): string {
    return this.fonts.cssFamily(this.fonts.ownName(font.id));
  }

  /**
   * @description CSS family of a curated family.
   * @param family Family.
   */
  curatedFamily(family: CuratedFontFamily): string {
    return this.fonts.cssFamily(this.fonts.curatedName(family.slug));
  }

  /**
   * @description Weights of a curated family as text.
   * @param family Family.
   */
  weightsOf(family: CuratedFontFamily): string {
    return family.faces.map(face => face.weight).join(', ');
  }

  /**
   * @description Size in the locale of the admin.
   * @param bytes Size.
   */
  size(bytes: number): string {
    return formatBytes(bytes, this.i18n.getDateLocale());
  }

  /**
   * @description Switches between the own fonts and their trash.
   * @param value 'active' | 'trash'.
   */
  switchView(value: string): void {
    this.view = value === 'trash' ? 'trash' : 'active';
    this.selection.clear();
    this.load();
  }

  /**
   * @description Text of the multiselect (shared by the lists).
   * @param key Key in `js-creator-shared`.
   */
  ts(key: string): string {
    return this.i18n.getValue(`js-creator-shared.${key}`);
  }

  /** @description Every listed own font is selected. */
  get allSelected(): boolean {
    return this.selection.allOf(this.own);
  }

  /**
   * @description Selects a font or takes it out of the selection.
   * @param font Font.
   */
  toggle(font: CreatorFont): void {
    this.selection.toggle(font.id);
    this.cd.markForCheck();
  }

  /** @description Selects every listed own font (or none, when all are selected). */
  toggleAll(): void {
    this.selection.toggleAll(this.own);
    this.cd.markForCheck();
  }

  /** @description Empties the selection. */
  clearSelection(): void {
    this.selection.clear();
    this.cd.markForCheck();
  }

  /**
   * @description Downloads fonts: one file named after its face, several as one ZIP.
   * @param one A single font (null = the selection).
   */
  download(one: CreatorFont | null = null): void {
    const ids = one ? [one.id] : this.selection.ids();
    if (!ids.length || this.busy) return;
    const single = ids.length === 1 ? (one ?? this.own.find(font => font.id === ids[0])) : undefined;
    if (single) {
      saveUrl(single.url);
      return;
    }
    this.busy = true;
    this.cd.markForCheck();
    this.api.zipFonts(ids).subscribe({
      next: zip => {
        this.busy = false;
        saveUrl(zip.url);
        this.cd.markForCheck();
      },
      error: () => {
        this.busy = false;
        this.cd.markForCheck();
      },
    });
  }

  /**
   * @description Bulk action on the selected fonts (after a confirmation): to the trash, restore,
   *   delete for good; used fonts and fonts whose face is taken again are skipped - a message
   *   names them.
   * @param action delete | restore | destroy.
   */
  async bulk(action: BulkAction): Promise<void> {
    const ids = this.selection.ids();
    if (!ids.length) return;
    if (action !== 'restore') {
      const key = action === 'delete' ? 'bulk_delete' : 'bulk_destroy';
      if (!(await this.confirm.open(this.ts(`${key}_title`), `${this.ts(`${key}_text`)} ${ids.length}`))) return;
    }
    this.run(this.api.bulkFonts(action, ids), (result: BulkResult) => {
      this.selection.clear();
      const used = result.skipped.filter(s => s.reason !== 'face_taken');
      const taken = result.skipped.filter(s => s.reason === 'face_taken');
      const parts = [
        used.length ? `${this.ts('bulk_skipped_files_text')} ${used.map(s => `„${s.name}“ (${s.used_by.map(u => u.name).join(', ')})`).join('; ')}` : '',
        taken.length ? `${this.t('error_face_taken')} ${taken.map(s => `„${s.name}“`).join(', ')}` : '',
      ].filter(Boolean);
      if (parts.length) this.alert.open(this.ts('bulk_skipped_files_title'), parts.join(' '), 'warning');
    });
  }

  /** @description Opens the upload popup. */
  openUpload(): void {
    this.dialog = { font: null, file: null, family: '', weight: 400, style: 'normal', error: '' };
    this.cd.markForCheck();
  }

  /**
   * @description Opens the popup to change the face of a font.
   * @param font Font.
   */
  openEdit(font: CreatorFont): void {
    this.dialog = { font, file: null, family: font.family, weight: font.weight, style: font.style, error: '' };
    this.cd.markForCheck();
  }

  /** @description Closes the popup (not while saving). */
  closeDialog(): void {
    if (!this.busy) this.dialog = null;
    this.cd.markForCheck();
  }

  /**
   * @description A file was chosen in the popup - its name prefills the family.
   * @param event Change event of the input.
   */
  onFileChosen(event: Event): void {
    const dialog = this.dialog;
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    if (!dialog) return;
    dialog.file = file;
    if (file && !dialog.family.trim()) {
      dialog.family = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+(regular|bold|italic|light|medium|black|thin)$/i, '').replace(/[-_]+/g, ' ').slice(0, 80);
    }
    this.cd.markForCheck();
  }

  /** @description Saves the popup: upload a face, or change the face of a font. */
  submit(): void {
    const dialog = this.dialog;
    if (!dialog || this.busy) return;
    const face = { family: dialog.family.trim(), weight: Number(dialog.weight), style: dialog.style };
    dialog.error = this.validate(dialog, face.family);
    if (dialog.error) {
      this.cd.markForCheck();
      return;
    }
    const request = dialog.font ? this.api.updateFont(dialog.font.id, face) : this.api.uploadFont(dialog.file!, face);
    this.run(request, () => {
      this.dialog = null;
    });
  }

  /**
   * @description Moves a font to the trash (after a confirmation).
   * @param font Font.
   */
  async remove(font: CreatorFont): Promise<void> {
    if (this.refuseUsed(font.used_by)) return;
    if (!(await this.confirm.open(this.t('delete_title'), `${this.t('delete_font_text')} „${font.family}“`))) return;
    this.run(this.api.deleteFont(font.id));
  }

  /**
   * @description Restores a font of the trash (refused here while the same face exists).
   * @param font Font.
   */
  restore(font: CreatorFont): void {
    if (this.faceTaken(font.family, font.weight, font.style, null)) {
      this.alert.open(this.t('restore_title'), this.t('error_face_taken'), 'warning');
      return;
    }
    this.run(this.api.restoreFont(font.id));
  }

  /**
   * @description Deletes a font of the trash for good (after a confirmation).
   * @param font Font.
   */
  async destroy(font: CreatorFont): Promise<void> {
    if (this.refuseUsed(font.used_by)) return;
    if (!(await this.confirm.open(this.t('destroy_title'), `${this.t('destroy_text')} „${font.family}“`))) return;
    this.run(this.api.deleteFont(font.id, true));
  }

  /** @description Empties the font trash (after a confirmation). */
  async emptyTrash(): Promise<void> {
    if (!(await this.confirm.open(this.t('empty_trash_title'), this.t('empty_fonts_trash_text')))) return;
    this.run(this.api.emptyFontTrash());
  }

  /**
   * @description Error of the popup, or '' when it may be sent.
   * @param dialog Popup.
   * @param family Trimmed family.
   */
  private validate(dialog: FontDialog, family: string): string {
    const rules = this.rules;
    if (!dialog.font) {
      if (!dialog.file) return this.t('error_file_required');
      if (rules && !isExtensionAllowed(dialog.file.name, rules.extensions)) return `${this.t('error_file_type')} (${this.uploadHint})`;
      if (rules && dialog.file.size > rules.max_file_size_mb * 1024 * 1024) return `${this.t('error_file_size')} (${this.uploadHint})`;
      if (!this.usage.fits(dialog.file.size)) return this.t('quota_full_text');
    }
    if (!family) return this.t('error_family_required');
    if (!/^[\p{L}\p{N}][\p{L}\p{N} \-_.']*$/u.test(family)) return this.t('error_family_chars');
    if (this.faceTaken(family, Number(dialog.weight), dialog.style, dialog.font?.id ?? null)) return this.t('error_face_taken');
    return '';
  }

  /**
   * @description Whether an own font outside the trash already is the face.
   * @param family Family (case-insensitive).
   * @param weight Weight.
   * @param style Style.
   * @param exceptId Font ignored (the changed one).
   */
  private faceTaken(family: string, weight: number, style: FontStyle, exceptId: number | null): boolean {
    const needle = family.toLocaleLowerCase();
    return this.active.some(f => f.id !== exceptId && f.family.toLocaleLowerCase() === needle && f.weight === weight && f.style === style);
  }

  /**
   * @description Runs a change, then reloads the fonts and the usage.
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
        this.load();
      },
      error: () => {
        this.busy = false;
        this.cd.markForCheck();
      },
    });
  }

  /** @description Loads the own fonts outside the trash and, in the trash view, the trash. */
  private load(): void {
    this.api.fonts().subscribe(fonts => {
      fonts.forEach(font => this.fonts.registerOwn(font));
      this.active = fonts;
      if (this.view === 'active') this.own = fonts;
      this.cd.markForCheck();
    });
    if (this.view === 'trash') {
      this.api.fonts(true).subscribe(fonts => {
        fonts.forEach(font => this.fonts.registerOwn(font));
        this.own = fonts;
        this.cd.markForCheck();
      });
    }
  }

  /**
   * @description Explains that a font used by templates cannot be deleted.
   * @param usedBy Templates and blocks using the font.
   * @returns true when refused.
   */
  private refuseUsed(usedBy: UsedByTemplate[] | undefined): boolean {
    if (!usedBy?.length) return false;
    const names = usedBy.map(u => `${u.kind === 'block' ? this.t('in_use_block') + ' ' : ''}„${u.name}“${u.trashed ? ` (${this.t('in_use_trashed')})` : ''}`).join(', ');
    this.alert.open(this.t('in_use_title'), `${this.t('in_use_font')} ${names}`, 'warning');
    return true;
  }
}
