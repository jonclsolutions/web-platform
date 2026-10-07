/**
 * @file form-builder.component.ts
 * @path src/app/admin/components/builders/form-builder/form-builder.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description A dynamic, template-driven form generator that maps field definitions to interactive UI controls.
 *
 * @dependencies
 * - FormsModule: Angular template-driven form infrastructure.
 * - AlertDialogService: Provides user feedback for submission outcomes.
 * - InputDefinition: Interface for rendering dynamic form inputs and validation metadata.
 * - PasswordRequirementsChecklistComponent: Live visual checklist of password rules.
 * - MultiFileUploadComponent: Shared drag&drop multi-file upload, see the `'files'` case.
 * - ScrollLockService: Shared background scroll lock.
 * - AdminLocalizationService: Statické i18n admin UI.
 */

import { Component, Input, Output, EventEmitter, ChangeDetectorRef, ViewChild, OnInit, OnDestroy, OnChanges, SimpleChanges, inject } from '@angular/core';
import { FormsModule, NgForm, FormControl } from '@angular/forms';
import { AlertDialogService } from '../../../../core/services/alert-dialog.service';
import { InputDefinition } from '../../../../shared/interfaces/input-definiton';
import { PasswordRequirementsChecklistComponent } from '../../../../shared/components/password-requirements-checklist/password-requirements-checklist.component';
import { MultiFileUploadComponent } from '../../../../shared/components/multi-file-upload/multi-file-upload.component';
import { ScrollLockService } from '../../../../core/services/scroll-lock.service';
import { AdminLocalizationService } from '../../../../core/services/admin-localization.service';

/**
 * @description Renders a dynamic form based on an array of field definitions.
 * @usage Used in create and edit modals across the admin panel for data entry.
 * @note Supports file uploads via FormData auto-detection, password matching validation, multi-value checkbox groups, live field-change notifications, externally forced field overrides, and persistent scroll locking.
 */
@Component({
  selector: 'app-form-builder',
  standalone: true,
  imports: [FormsModule, PasswordRequirementsChecklistComponent, MultiFileUploadComponent],
  templateUrl: './form-builder.component.html',
  styleUrl: './form-builder.component.css',
})
export class FormBuilderComponent implements OnInit, OnDestroy, OnChanges {
  @Input() headerText: string = '';
  @Input() inputDefinitions: InputDefinition[] = [];
  @Input() formDataToEdit: any = null;
  /**
   * Optional externally-forced values applied to the live `formData` whenever this
   * input changes (via `ngOnChanges()`) - e.g. a consumer resetting `permission_ids`
   * after the user changes `role_id` mid-edit. Only the listed keys are touched;
   * everything else in `formData` is left as the user left it.
   * @refactor-note (2026-09-06) BACKLOG "who can change roles + role change UX/security".
   */
  @Input() fieldOverrides: Record<string, any> | null = null;

  @Output() formSubmitted = new EventEmitter<any>();
  @Output() formCanceled = new EventEmitter<void>();
  /**
   * Fires whenever a `'select'` field's value changes, carrying `{columnName,
   * value}`. Generic and domain-agnostic - this component doesn't interpret which
   * field changed, it just reports it so a consumer page can react.
   * @refactor-note (2026-09-06) BACKLOG "who can change roles + role change UX/security".
   */
  @Output() fieldChanged = new EventEmitter<{ columnName: string; value: any }>();

  @ViewChild('genericForm') genericForm!: NgForm;

  formData: { [key: string]: any } = {};
  confirmPasswordData: { [key: string]: string } = {};
  isSubmitting = false;
  visibleInputDefinitions: InputDefinition[] = [];

  private scrollLock = inject(ScrollLockService);
  private initialized = false;

  /**
   * @refactor-note (2026-09) BACKLOG "vícejazyčná administrace, žádné hardcoded texty"
   * FormBuilderComponent NEdědí BaseDataComponent (sdílená builder komponenta), proto
   * ruční injection + lokální `strings`/`t()` přesně dle vzoru z ostatních builderů
   * (TableBuilderComponent, ExportPopupBuilderComponent atd.). Komponenta NEMÁ
   * `ChangeDetectionStrategy.OnPush`, takže na rozdíl od TableBuilderComponent zde
   * NENÍ potřeba `translations$.subscribe(() => markForCheck())` - výchozí change
   * detection ji stejně překreslí po přepnutí jazyka.
   */
  public readonly i18n = inject(AdminLocalizationService);
  public get strings(): any { return this.i18n.getMergedSection('form-builder'); }
  public t(key: string): string { return this.i18n.getValue(`form-builder.${key}`); }

  constructor(
    private cd: ChangeDetectorRef,
    private alertDialogService: AlertDialogService
  ) {}

  /**
   * @description Initializes the form state based on the provided data or default settings.
   */
  ngOnInit(): void {
    this.scrollLock.lock();

    /**
     * @refactor-note (2026-09) `headerText` @Input default zůstává prázdný string
     * (viz deklarace) místo natvrdo anglického 'Create New Record' - konzument by ho
     * měl vždy předat vlastní (resource-specific) text, tohle je jen záchranná síť
     * pro případ, že to zapomene. Řešeno tady, ne jako inline field initializer, aby
     * `i18n` injection nezáviselo na pořadí deklarace polí třídy.
     */
    if (!this.headerText) {
      this.headerText = this.t('default_header');
    }

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
   * @description Reacts to `@Input()` changes that arrive AFTER the form has
   * already initialized (a consumer recomputing field metadata or forcing a value
   * while the modal stays open). `inputDefinitions` re-derives
   * `visibleInputDefinitions` WITHOUT touching `formData` (structure only -
   * options, `editable`, `disabledOptionValues`, etc. - whatever the user already
   * entered is preserved). `fieldOverrides` applies its keys directly onto
   * `formData`, overwriting only those keys.
   * @refactor-note (2026-09-06) BACKLOG "who can change roles + role change UX/security".
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
   * @description Forces an empty array for every `'files'` field WHILE EDITING - see
   * pre-existing note in version history. Unchanged by this update.
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
    this.scrollLock.unlock();
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
  }

  /**
   * @description Whether a specific option of a `'multiselect'` field should be
   * rendered disabled - independent of the whole field's `editable` flag. Driven by
   * `input.disabledOptionValues` (e.g. `AdministratorsComponent` uses this to lock
   * permissions a user's role already grants automatically).
   * @refactor-note (2026-09-05) BACKLOG "role/admin UX improvement".
   */
  isOptionDisabled(input: InputDefinition, optionValue: string | number): boolean {
    const disabledValues = (input as any).disabledOptionValues as (string | number)[] | undefined;
    return Array.isArray(disabledValues) && disabledValues.includes(String(optionValue));
  }

  /**
   * @description Emits `fieldChanged` for a `'select'` field - see `@Output()`
   * doc-comment above. Called via `(ngModelChange)` alongside the field's existing
   * `[(ngModel)]` binding, so this fires AFTER `formData` has already been updated.
   * @refactor-note (2026-09-06) BACKLOG "who can change roles + role change UX/security".
   */
  onFieldChange(columnName: string, value: any): void {
    this.fieldChanged.emit({ columnName, value });
  }

  /**
   * @description Jestli existuje JAKÉKOLIV `confirm-password` pole ve formuláři s
   * neshodujícím se potvrzením - použito v `onSubmit()` k zablokování odeslání a na
   * submit tlačítku k jeho disable.
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
    const file = event.target.files[0];
    if (file) {
      this.formData[columnName] = file;
    }
  }

  onFilesChange(files: File[], columnName: string): void {
    this.formData[columnName] = files;
  }

  onExistingFilesRemoved(removedIds: number[], columnName: string): void {
    this.formData[`${columnName}_removed_ids`] = removedIds;
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

  onCancel(): void {
    this.formCanceled.emit();
  }

  onOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onCancel();
    }
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
            /**
             * @bugfix-note (2026-08-19v2) Empty arrays are skipped (nothing to
             * send); non-empty arrays are serialized as `key[]`, the same
             * PHP/Laravel convention used for the file array above - covers both
             * legacy `..._removed_ids` fields and, since 2026-09-02, `'multiselect'`
             * values like `permission_ids`.
             */
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

      // `isSubmitting` deliberately stays `true` - see version history bugfix-note
      // (duplicate-submit guard).
    } else {
      this.alertDialogService.open(this.t('alert_invalid_form_title'), this.t('alert_invalid_form_message'), 'warning');
    }
  }

  /**
   * @refactor-note (2026-09v2) BUGFIX - viz hlavička souboru. Přepsáno z
   * `getMergedSection()` (tiché `undefined` u chybějících klíčů) na `getValue()` s
   * plnou tečkovanou cestou PRO KAŽDÝ klíč - chybějící klíč/sekce se teď spolehlivě
   * projeví jako `'Cannot load text'`, nikdy ne jako tichý pád na
   * `MultiFileUploadComponent`'s vlastní český default.
   */
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
    };
  }
}