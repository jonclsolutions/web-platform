/**
 * @file form-builder.component.ts
 * @path src/app/admin/components/builders/form-builder/form-builder.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description A dynamic, template-driven form generator that maps field definitions to interactive UI controls.
 *
 * @dependencies
 * - FormsModule: Angular template-driven form infrastructure.
 * - AlertDialogService: Provides user feedback for submission outcomes.
 * - InputDefinition: Interface for rendering dynamic form inputs and validation metadata.
 * - PasswordRequirementsChecklistComponent: Live visual checklist of password rules.
 * - MultiFileUploadComponent: Shared drag&drop multi-file upload, see the `'files'` case.
 * - AdminModalComponent: the shared popup frame (page scroll lock, Escape / backdrop / close = cancel).
 * - AdminLocalizationService: Static i18n of the admin UI.
 * - AvatarEditorComponent: `avatar` fields (profile photo, saved by its own endpoint).
 * - DetailsBuilderComponent (embedded): the read-only values of the record popup.
 * - ConfirmDialogService: "discard the unsaved changes?" of the record popup.
 * - RecordActionsComponent: the actions of the record popup (left in the footer).
 * @note Record popup (`recordMode`, 2026-11): one popup opened by a click on a table row is
 *   both the edit form and the detail - read-only values (`detailColumns` that are not editable
 *   fields: ID, created, updated) as plain text above the form, the actions of the record
 *   (`recordActions`, e.g. Delete) on the left of the footer - away from Cancel / Save on the
 *   right; the top right corner is only for the close button; more than two other actions go
 *   under "⋯ More", Delete always stays visible. Save in the footer; `readOnly` (no edit
 *   permission) shows only the values. Closing with unsaved changes asks first.
 */

import { Component, Input, Output, EventEmitter, ChangeDetectorRef, ViewChild, OnInit, OnDestroy, OnChanges, SimpleChanges, inject } from '@angular/core';
import { FormsModule, NgForm, FormControl } from '@angular/forms';
import { AlertDialogService } from '../../../../core/services/alert-dialog.service';
import { InputDefinition } from '../../../../shared/interfaces/input-definiton';
import { PasswordRequirementsChecklistComponent } from '../../../../shared/components/password-requirements-checklist/password-requirements-checklist.component';
import { PasswordPolicyDirective } from '../../../../shared/directives/password-policy.directive';
import { PASSWORD_MAX_LENGTH } from '../../../../shared/constants/password-policy';
import { MultiFileUploadComponent } from '../../../../shared/components/multi-file-upload/multi-file-upload.component';
import { AdminLocalizationService } from '../../../../core/services/admin-localization.service';
import { UploadRulesService } from '../../../../shared/services/upload-rules.service';
import { UploadProfile, UploadRule, extensionsLabel, fileExtension, isExtensionAllowed } from '../../../../shared/utils/upload-rules';
import { Subject, takeUntil } from 'rxjs';
import { AvatarEditorComponent } from '../../avatar-editor/avatar-editor.component';
import { AdminModalComponent } from '../../admin-modal/admin-modal.component';
import { DetailsBuilderComponent } from '../details-builder/details-builder.component';
import { ItemDetailsColumns } from '../../../../shared/interfaces/item-details-columns';
import { TableButtons } from '../../../../shared/interfaces/table-buttons';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { RecordActionsComponent } from '../../record-actions/record-actions.component';

/** Counter of the form ids (the save button in the frame's footer submits the form by its id). */
let nextFormId = 0;

/**
 * @description Renders a dynamic form based on an array of field definitions.
 * @usage Used in create and edit modals across the admin panel for data entry.
 * @note Supports file uploads via FormData auto-detection, password matching validation, multi-value checkbox groups, live field-change notifications and externally forced field overrides; the frame (AdminModalComponent) locks the page scroll.
 */
@Component({
  selector: 'app-form-builder',
  standalone: true,
  imports: [FormsModule, PasswordRequirementsChecklistComponent, MultiFileUploadComponent, PasswordPolicyDirective, AvatarEditorComponent, AdminModalComponent, DetailsBuilderComponent, RecordActionsComponent],
  templateUrl: './form-builder.component.html',
  styleUrls: ['../../../shared-styles/modal.css', './form-builder.component.css'],
})
export class FormBuilderComponent implements OnInit, OnDestroy, OnChanges {
  /**
   * Optional explicit modal title. When empty (every CRUD page), the title is
   * derived from the mode – see the `displayHeader` getter.
   */
  @Input() headerText: string = '';
  @Input() inputDefinitions: InputDefinition[] = [];
  @Input() formDataToEdit: any = null;
  /**
   * Optional externally-forced values applied to the live `formData` whenever this
   * input changes (via `ngOnChanges()`) - e.g. a consumer resetting `permission_ids`
   * after the user changes `role_id` mid-edit. Only the listed keys are touched;
   * everything else in `formData` is left as the user left it.
   */
  @Input() fieldOverrides: Record<string, any> | null = null;

  /** Record popup of a table row: title "Record <id>", read-only values, record actions, unsaved guard. */
  @Input() recordMode = false;
  /** Values of the record (detail columns) - the not editable ones are shown read-only above the form. */
  @Input() detailColumns: ItemDetailsColumns[] = [];
  /** Record popup without the edit permission: only the values (all `detailColumns`), no save. */
  @Input() readOnly = false;
  /** Actions of the record - left in the footer (the row buttons the user may use, e.g. Delete). */
  @Input() recordActions: TableButtons[] = [];

  @Output() formSubmitted = new EventEmitter<any>();
  @Output() formCanceled = new EventEmitter<void>();
  /**
   * Fires whenever a `'select'` field's value changes, carrying `{columnName,
   * value}`. Generic and domain-agnostic - this component doesn't interpret which
   * field changed, it just reports it so a consumer page can react.
   */
  @Output() fieldChanged = new EventEmitter<{ columnName: string; value: any }>();
  /**
   * Fires after an `'avatar'` field saved a new photo / removed it (saved at once by its own
   * endpoint, not by the form) - carries `{columnName, value: new URL | null}`, so the page can
   * refresh its list even when the form is then cancelled.
   */
  @Output() avatarChanged = new EventEmitter<{ columnName: string; value: string | null }>();
  /** An action of the record popup was clicked - carries its `action` (e.g. 'delete'). */
  @Output() recordAction = new EventEmitter<string>();


  @ViewChild('genericForm') genericForm!: NgForm;
  /** Id of the form - the save button in the footer of the frame submits it (`form` attribute). */
  readonly formId = `fb-form-${++nextFormId}`;

  formData: { [key: string]: any } = {};
  confirmPasswordData: { [key: string]: string } = {};
  isSubmitting = false;
  visibleInputDefinitions: InputDefinition[] = [];
  /** Changes outside the template-driven controls (chosen / removed files, multiselect). */
  private extraDirty = false;

  private initialized = false;

  /** Default maxlength of a password field (the password policy). */
  readonly passwordMaxLength = PASSWORD_MAX_LENGTH;

  public readonly i18n = inject(AdminLocalizationService);
  public get strings(): any { return this.i18n.getMergedSection('form-builder'); }
  public t(key: string): string { return this.i18n.getValue(`form-builder.${key}`); }

  private uploadRulesService = inject(UploadRulesService);
  private destroy$ = new Subject<void>();

  /** Loaded attachment rules per upload profile of the fields (see `InputDefinition.uploadProfile`). */
  uploadRules: Partial<Record<UploadProfile, UploadRule | null>> = {};

  private confirmDialog = inject(ConfirmDialogService);

  constructor(
    private cd: ChangeDetectorRef,
    private alertDialogService: AlertDialogService
  ) {}

  /**
   * @description Initializes the form state based on the provided data or default settings.
   */
  ngOnInit(): void {
    this.loadUploadRules();

    if (this.formDataToEdit) {
      this.formData = { ...this.formDataToEdit };
      this.visibleInputDefinitions = this.inputDefinitions.filter(input => input.show_in_edit !== false);
      this.normalizeSelectValues();
      this.resetFileArrayFields();
      this.normalizeMultiselectFields();
    } else {
      this.formData = {};
      this.visibleInputDefinitions = this.inputDefinitions.filter(input => input.show_in_create !== false);
      this.visibleInputDefinitions.forEach(input => {
        this.formData[input.column_name] = (input.type === 'files' || input.type === 'multiselect')
          ? []
          : (input.defaultValue ?? '');
      });
    }

    this.initialized = true;
  }

  /**
   * @description Modal title. An explicit `headerText` always wins (e.g. the
   * reset-password dialog). Otherwise the mode decides, using the same signal as
   * the rest of the component (`formDataToEdit` set = edit): "Create new record"
   * or "Edit record: <id>" ("Edit record" when the record has no `id`).
   * @return the translated title for the active admin language
   */
  get displayHeader(): string {
    if (this.headerText) {
      return this.headerText;
    }
    const recordId = this.formDataToEdit?.['id'];
    if (this.recordMode && recordId !== undefined && recordId !== null && recordId !== '') {
      return this.t('record_header_with_id').replace('{id}', String(recordId));
    }
    if (!this.formDataToEdit) {
      return this.t('create_header');
    }
    const id = this.formDataToEdit['id'];
    return id !== undefined && id !== null && id !== ''
      ? this.t('edit_header_with_id').replace('{id}', String(id))
      : this.t('edit_header');
  }

  /**
   * @description Reacts to `@Input()` changes that arrive AFTER the form has
   * already initialized (a consumer recomputing field metadata or forcing a value
   * while the modal stays open). `inputDefinitions` re-derives
   * `visibleInputDefinitions` WITHOUT touching `formData` (structure only -
   * options, `editable`, `disabledOptionValues`, etc. - whatever the user already
   * entered is preserved). `fieldOverrides` applies its keys directly onto
   * `formData`, overwriting only those keys.
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (!this.initialized) return;

    if (changes['inputDefinitions'] && !changes['inputDefinitions'].firstChange) {
      this.visibleInputDefinitions = this.formDataToEdit
        ? this.inputDefinitions.filter(input => input.show_in_edit !== false)
        : this.inputDefinitions.filter(input => input.show_in_create !== false);
    }

    if (changes['fieldOverrides'] && this.fieldOverrides) {
      Object.keys(this.fieldOverrides).forEach(key => {
        this.formData[key] = this.fieldOverrides![key];
      });
      this.cd.markForCheck();
    }
  }

  /**
   * @description Normalizes existing data for select inputs to ensure consistent type matching.
   * @note Prevents type mismatch issues when mapping numeric IDs to string-based option values.
   */
  private normalizeSelectValues(): void {
    this.visibleInputDefinitions.forEach(input => {
      if (input.type === 'select' && input.options) {
        const currentValue = this.formData[input.column_name];
        const valueAsString = String(currentValue === true ? '1' : currentValue === false ? '0' : currentValue);
        const optionExists = input.options.some(opt => String(opt.value) === valueAsString);

        if (optionExists) {
          this.formData[input.column_name] = valueAsString;
        }
      }
    });
  }

  /**
   * @description Forces an empty array for every `'files'` field WHILE EDITING - existing
   * attachments are shown separately, new files always start from an empty selection.
   */
  private resetFileArrayFields(): void {
    this.visibleInputDefinitions.forEach(input => {
      if (input.type === 'files') {
        this.formData[input.column_name] = [];
      }
    });
  }

  /**
   * @description Coerces every `'multiselect'` field's incoming value into a string
   * array while editing. `formDataToEdit` is expected to already carry an array of
   * option-value strings (e.g. `AdministratorsComponent.handleEditFormOpened()` maps
   * `user_permissions` to `permission_ids` this way), but this normalization protects
   * the template's checkbox rendering (`isMultiselectChecked()`) against `undefined`/
   * non-array values from any other consumer that doesn't pre-map its data the same way.
   */
  private normalizeMultiselectFields(): void {
    this.visibleInputDefinitions.forEach(input => {
      if (input.type === 'multiselect') {
        const current = this.formData[input.column_name];
        this.formData[input.column_name] = Array.isArray(current)
          ? current.map((v: string | number) => String(v))
          : [];
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * @description Loads the attachment rules of every upload profile used by the fields (the
   *   service caches them, so this costs one request per session).
   */
  private loadUploadRules(): void {
    const profiles = new Set(this.inputDefinitions.map(i => i.uploadProfile).filter((p): p is UploadProfile => !!p));
    profiles.forEach(profile => {
      this.uploadRulesService.rules(profile)
        .pipe(takeUntil(this.destroy$))
        .subscribe(rules => { this.uploadRules[profile] = rules; this.cd.markForCheck(); });
    });
  }

  /**
   * @description Attachment rules of a field - null when it has no profile or they are not loaded.
   * @param input Field definition.
   */
  rulesFor(input: InputDefinition): UploadRule | null {
    return input.uploadProfile ? (this.uploadRules[input.uploadProfile] ?? null) : null;
  }


  /**
   * @description "Allowed types: …" appended to the type error of a single `'file'` field ('' without rules).
   * @param input Field definition.
   */
  allowedTypesFor(input: InputDefinition): string {
    const rules = this.rulesFor(input);
    return rules ? this.i18n.getValue('file-upload.allowed_types_hint').replace('{types}', extensionsLabel(rules.extensions)) : '';
  }

  /**
   * @description Whether the given option is currently selected for a `'multiselect'`
   * field - used by the template to drive each checkbox's `[checked]` binding.
   */
  isMultiselectChecked(columnName: string, optionValue: string | number): boolean {
    const current = this.formData[columnName];
    return Array.isArray(current) && current.includes(String(optionValue));
  }

  /**
   * @description Adds/removes a single option from a `'multiselect'` field's array in
   * `formData`, based on the checkbox's own checked state. A new array is written
   * (rather than mutating in place) so `OnPush` consumers watching `formData` by
   * reference still pick up the change.
   */
  onMultiselectToggle(columnName: string, optionValue: string | number, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const value = String(optionValue);
    const current: string[] = Array.isArray(this.formData[columnName]) ? [...this.formData[columnName]] : [];

    const index = current.indexOf(value);
    if (checked && index === -1) {
      current.push(value);
    } else if (!checked && index !== -1) {
      current.splice(index, 1);
    }

    this.formData[columnName] = current;
    this.extraDirty = true;
  }

  /**
   * @description Whether a specific option of a `'multiselect'` field should be
   * rendered disabled - independent of the whole field's `editable` flag. Driven by
   * `input.disabledOptionValues` (e.g. `AdministratorsComponent` uses this to lock
   * permissions a user's role already grants automatically).
   */
  isOptionDisabled(input: InputDefinition, optionValue: string | number): boolean {
    const disabledValues = (input as any).disabledOptionValues as (string | number)[] | undefined;
    return Array.isArray(disabledValues) && disabledValues.includes(String(optionValue));
  }

  /**
   * @description Keeps the new photo URL of an `'avatar'` field and reports it (avatarChanged).
   * @param columnName Field of the photo URL (e.g. 'avatar_url').
   * @param url New signed URL, null after the removal.
   */
  onAvatarChange(columnName: string, url: string | null): void {
    this.formData[columnName] = url;
    this.avatarChanged.emit({ columnName, value: url });
    this.cd.markForCheck();
  }

  /**
   * @description Emits `fieldChanged` for a `'select'` field - see `@Output()`
   * doc-comment above. Called via `(ngModelChange)` alongside the field's existing
   * `[(ngModel)]` binding, so this fires AFTER `formData` has already been updated.
   */
  onFieldChange(columnName: string, value: any): void {
    this.fieldChanged.emit({ columnName, value });
  }

  /**
   * @description Whether ANY `confirm-password` field of the form has a non-matching
   * confirmation - used in `onSubmit()` to block the submit and to disable the submit button.
   */
  passwordMismatch(columnName: string): boolean {
    const confirmation = this.confirmPasswordData[columnName];
    if (!confirmation) return false;
    return this.formData[columnName] !== confirmation;
  }

  get hasPasswordMismatch(): boolean {
    return this.visibleInputDefinitions.some(
      input => input.type === 'confirm-password' && this.passwordMismatch(input.column_name)
    );
  }

  /**
   * @description Updates form data with file inputs for multi-part submission.
   */
  onFileChange(event: any, columnName: string): void {
    const file: File | undefined = event.target.files[0];
    if (!file) return;

    // Same rules as the API (uploadProfile) - a refused file is never put into the form data.
    const input = this.inputDefinitions.find(i => i.column_name === columnName);
    const rules = input ? this.rulesFor(input) : null;
    let error: string | null = null;
    if (!isExtensionAllowed(file.name, rules?.extensions ?? [])) {
      const ext = fileExtension(file.name);
      // The allowed types are listed only now, together with the refusal (not up front)
      // (a type error needs a non-empty list, so the types text is never empty here).
      error = this.i18n.getValue('file-upload.error_file_type').replace('{filename}', file.name).replace('{ext}', ext ? '.' + ext : '?')
        + ' ' + this.allowedTypesFor(input!);
    } else if (rules && file.size > rules.max_file_size_mb * 1024 * 1024) {
      error = this.i18n.getValue('file-upload.error_file_too_large').replace('{filename}', file.name).replace('{maxMb}', String(rules.max_file_size_mb));
    }
    if (error) {
      event.target.value = '';
      delete this.formData[columnName];
      this.alertDialogService.open(this.i18n.getValue('file-upload.alert_file_refused_title'), error, 'warning');
      return;
    }
    this.formData[columnName] = file;
    this.extraDirty = true;
  }

  onFilesChange(files: File[], columnName: string): void {
    this.formData[columnName] = files;
    if (files?.length) this.extraDirty = true;
  }

  onExistingFilesRemoved(removedIds: number[], columnName: string): void {
    this.formData[`${columnName}_removed_ids`] = removedIds;
    if (removedIds?.length) this.extraDirty = true;
  }

  private isFileArray(value: any): value is File[] {
    return Array.isArray(value) && value.length > 0 && value.every(v => v instanceof File);
  }

  getControl(columnName: string): FormControl | null {
    if (!this.genericForm) return null;
    return this.genericForm.controls[columnName] as FormControl || null;
  }

  /**
   * @description Maps validation errors to human-readable strings based on field definition.
   */
  getValidationErrorMessage(control: FormControl | null, fieldDefinition: InputDefinition): string | null {
    if (!control || !control.invalid || (!control.dirty && !control.touched)) {
      return null;
    }
    if (control.errors?.['required']) return fieldDefinition.errorMessage || this.t('validation_required');
    if (control.errors?.['pattern']) return fieldDefinition.errorMessage || this.t('validation_pattern');
    if (control.errors?.['email']) return fieldDefinition.errorMessage || this.t('validation_email');
    return null;
  }

  /**
   * @description Read-only values above the form of the record popup: the detail columns that
   *   are not an editable field of the form (e.g. ID, created, updated).
   */
  get infoColumns(): ItemDetailsColumns[] {
    if (!this.recordMode || this.readOnly) return [];
    const editable = new Set(this.visibleInputDefinitions.filter(input => input.editable !== false).map(input => input.column_name));
    return this.detailColumns.filter(column => !editable.has(column.key) && !this.isStructuredValue(column));
  }

  /**
   * @description Whether a value is a list / technical data (an object, an array or JSON text) -
   *   it would show as raw JSON in the short read-only block, so it stays in the detail only
   *   (e.g. the extra permissions of an account, edited in the form under another field).
   *   Attachments (`file` / `files`) are shown.
   * @param column Detail column.
   */
  private isStructuredValue(column: ItemDetailsColumns): boolean {
    if (column.type === 'files' || column.type === 'file') return false;
    const value = column.key.split('.').reduce((obj: any, key) => obj?.[key], this.formData);
    if (value === null || value === undefined) return false;
    if (typeof value === 'object') return true;
    return typeof value === 'string' && /^\s*[\[{]/.test(value);
  }

  /** @description Whether the form has changes that are not saved yet. */
  get isDirty(): boolean {
    return !this.readOnly && (!!this.genericForm?.dirty || this.extraDirty);
  }

  /**
   * @description Asks whether to discard the unsaved changes of the record popup (true at once
   *   when there are none) - also used by the page when the browser Back closes the popup.
   * @returns Whether the popup may close.
   */
  confirmDiscard(): Promise<boolean> {
    if (!this.recordMode || !this.isDirty) return Promise.resolve(true);
    return this.confirmDialog.open(this.t('discard_confirm_title'), this.t('discard_confirm_message'), {
      confirm: this.t('discard_confirm_button'),
      cancel: this.t('discard_keep_button'),
    });
  }

  /** @description Cancel / close / Escape / backdrop: the record popup asks first when there are unsaved changes. */
  onCancel(): void {
    if (!this.recordMode || !this.isDirty) {
      this.formCanceled.emit();
      return;
    }
    this.confirmDiscard().then(close => { if (close) this.formCanceled.emit(); });
  }

  /**
   * @description Click on an action of the record popup (RecordActionsComponent).
   * @param action `action` of the button.
   */
  onRecordAction(action: string): void {
    this.recordAction.emit(action);
  }

  /** @description Allows another submit after a failed save (the page keeps the popup open). */
  resetSubmitting(): void {
    this.isSubmitting = false;
    this.cd.markForCheck();
  }

  /**
   * @description Sanitizes and validates form data before emitting the submission
   * event. `'multiselect'` fields are plain string arrays in `formData` (see
   * `onMultiselectToggle()`) and flow through both branches below unchanged: the
   * plain-object branch spreads them as-is, and the existing generic array handling
   * in the `FormData` (multipart) branch already serializes any non-empty array as
   * `key[]` - no `'multiselect'`-specific branch was needed there.
   */
  onSubmit(form: NgForm, event?: Event): void {
    event?.preventDefault();
    if (this.isSubmitting) return;

    Object.keys(form.controls).forEach(field => {
      form.controls[field]?.markAsTouched();
    });

    if (this.hasPasswordMismatch) {
      this.alertDialogService.open(this.i18n.getValue('shared.error'), this.t('alert_password_mismatch_message'), 'danger');
      return;
    }

    if (form.valid) {
      this.isSubmitting = true;

      let payload: any;
      const hasFile = Object.values(this.formData).some(val => val instanceof File || this.isFileArray(val));

      if (hasFile) {
        payload = new FormData();
        Object.keys(this.formData).forEach(key => {
          const value = this.formData[key];
          if (value instanceof File) {
            payload.append(key, value, value.name);
          } else if (this.isFileArray(value)) {
            value.forEach((file: File) => payload.append(`${key}[]`, file, file.name));
          } else if (Array.isArray(value)) {
            if (value.length === 0) return;
            value.forEach((item: any) => payload.append(`${key}[]`, String(item)));
          } else if (value !== null && value !== undefined) {
            payload.append(key, String(value));
          }
        });

        if (this.formData['id'] !== undefined && this.formData['id'] !== null) {
          (payload as any).id = this.formData['id'];
        }
      } else {
        payload = { ...this.formData };
      }

      this.formSubmitted.emit(payload);

      // `isSubmitting` deliberately stays `true`
      // (duplicate-submit guard).
    } else {
      this.alertDialogService.open(this.t('alert_invalid_form_title'), this.t('alert_invalid_form_message'), 'warning');
    }
  }

    get fileUploadTexts() {
    return {
      limitsHint: this.i18n.getValue('file-upload.limits_hint'),
      existingSectionTitle: this.i18n.getValue('file-upload.existing_section_title'),
      removeExistingTitle: this.i18n.getValue('file-upload.remove_existing_title'),
      dropzoneLabel: this.i18n.getValue('file-upload.dropzone_label'),
      errorMaxFilesWithExisting: this.i18n.getValue('file-upload.error_max_files_with_existing'),
      errorMaxFiles: this.i18n.getValue('file-upload.error_max_files'),
      errorFileTooLarge: this.i18n.getValue('file-upload.error_file_too_large'),
      errorTotalSizeExceeded: this.i18n.getValue('file-upload.error_total_size_exceeded'),
      totalLabel: this.i18n.getValue('file-upload.total_label'),
      totalNewSuffix: this.i18n.getValue('file-upload.total_new_suffix'),
      errorFileType: this.i18n.getValue('file-upload.error_file_type'),
      allowedTypesHint: this.i18n.getValue('file-upload.allowed_types_hint'),
    };
  }
}