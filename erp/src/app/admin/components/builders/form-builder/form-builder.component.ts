/**
 * @file form-builder.component.ts
 * @path src/app/admin/components/builders/form-builder/form-builder.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description A dynamic, template-driven form generator that maps field definitions to interactive UI controls.
 *
 * @refactor-note (2026-08) Přepsáno matchování hesel u `confirm-password` typu z
 * imperativního `checkPasswordMatch()` (mutovalo sdílenou `passwordsNotMatching`
 * proměnnou přes `(ngModelChange)` handlery vedle `[(ngModel)]` na TÉŽE inputu - závislé
 * na pořadí, v jakém Angular sloučené listenery na stejný event spouští, křehké a
 * nespolehlivé) na čistou `passwordMismatch(columnName)` metodu, počítanou LIVE při každém
 * change-detection cyklu přímo z `formData`/`confirmPasswordData`, bez uloženého stavu.
 * Díky tomu nemůže dojít k desynchronizaci mezi tím, co je vidět na obrazovce a tím, co
 * `onSubmit()` skutečně vyhodnotí. `[pattern]` navíc nově skutečně aplikováno i na první
 * input `confirm-password` case (dřív tam chybělo úplně, takže `pattern`/`errorMessage`
 * z konfigurace se na hesla nikdy nepoužily). Přidán live checklist požadavků hesla
 * (`PasswordRequirementsChecklistComponent`) pod prvním password inputem.
 *
 * @dependencies
 * - FormsModule: Angular template-driven form infrastructure.
 * - AlertDialogService: Provides user feedback for submission outcomes.
 * - InputDefinition: Interface for rendering dynamic form inputs and validation metadata.
 * - PasswordRequirementsChecklistComponent: Live vizuální checklist pravidel hesla.
 */

import { Component, Input, Output, EventEmitter, ChangeDetectorRef, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { FormsModule, NgForm, FormControl } from '@angular/forms';
import { AlertDialogService } from '../../../../core/services/alert-dialog.service';
import { InputDefinition } from '../../../../shared/interfaces/input-definiton';
import { PasswordRequirementsChecklistComponent } from '../../../../shared/components/password-requirements-checklist/password-requirements-checklist.component';

/**
 * @description Renders a dynamic form based on an array of field definitions.
 * @usage Used in create and edit modals across the admin panel for data entry.
 * @note Supports file uploads via FormData auto-detection, password matching validation, and persistent scroll locking.
 */
@Component({
  selector: 'app-form-builder',
  standalone: true,
  imports: [FormsModule, PasswordRequirementsChecklistComponent],
  templateUrl: './form-builder.component.html',
  styleUrl: './form-builder.component.css',
})
export class FormBuilderComponent implements OnInit, OnDestroy {
  @Input() headerText: string = 'Create New Record';
  @Input() inputDefinitions: InputDefinition[] = [];
  @Input() formDataToEdit: any = null;

  @Output() formSubmitted = new EventEmitter<any>();
  @Output() formCanceled = new EventEmitter<void>();

  @ViewChild('genericForm') genericForm!: NgForm;

  formData: { [key: string]: any } = {};
  confirmPasswordData: { [key: string]: string } = {};
  isSubmitting = false;
  visibleInputDefinitions: InputDefinition[] = [];

  constructor(
    private cd: ChangeDetectorRef,
    private alertDialogService: AlertDialogService
  ) {}

  /**
   * @description Initializes the form state based on the provided data or default settings.
   */
  ngOnInit(): void {
    document.body.style.overflow = 'hidden';

    if (this.formDataToEdit) {
      this.formData = { ...this.formDataToEdit };
      this.visibleInputDefinitions = this.inputDefinitions.filter(input => input.show_in_edit !== false);
      this.normalizeSelectValues();
    } else {
      this.formData = {};
      this.visibleInputDefinitions = this.inputDefinitions.filter(input => input.show_in_create !== false);
      this.visibleInputDefinitions.forEach(input => {
        this.formData[input.column_name] = input.defaultValue ?? '';
      });
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

  ngOnDestroy(): void {
    document.body.style.overflow = 'auto';
  }

  /**
   * @description Zjišťuje, jestli se u daného `confirm-password` pole aktuálně neshoduje
   * hlavní hodnota (`formData[columnName]`) s potvrzením (`confirmPasswordData[columnName]`).
   * Počítá se live při každém CD cyklu - žádný uložený stav, žádná závislost na pořadí
   * event handlerů. Prázdné potvrzení (uživatel ho ještě nezačal psát) se nepovažuje
   * za neshodu - chyba se ukáže, až uživatel do potvrzení něco napíše.
   */
  passwordMismatch(columnName: string): boolean {
    const confirmation = this.confirmPasswordData[columnName];
    if (!confirmation) return false;
    return this.formData[columnName] !== confirmation;
  }

  /**
   * @description Jestli existuje JAKÉKOLIV `confirm-password` pole ve formuláři s
   * neshodujícím se potvrzením - použito v `onSubmit()` k zablokování odeslání a na
   * submit tlačítku k jeho disable.
   */
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
    if (control.errors?.['required']) return fieldDefinition.errorMessage || 'This field is required.';
    if (control.errors?.['pattern']) return fieldDefinition.errorMessage || 'Invalid format.';
    if (control.errors?.['email']) return fieldDefinition.errorMessage || 'Invalid email format.';
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
   * @description Sanitizes and validates form data before emitting the submission event.
   * @note Automatically serializes data into FormData if file inputs are detected.
   */
  onSubmit(form: NgForm, event?: Event): void {
    event?.preventDefault();
    if (this.isSubmitting) return;

    Object.keys(form.controls).forEach(field => {
      form.controls[field]?.markAsTouched();
    });

    if (this.hasPasswordMismatch) {
      this.alertDialogService.open('Error', 'Passwords do not match.', 'danger');
      return;
    }

    if (form.valid) {
      this.isSubmitting = true;
      
      let payload: any;
      const hasFile = Object.values(this.formData).some(val => val instanceof File);

      if (hasFile) {
        payload = new FormData();
        Object.keys(this.formData).forEach(key => {
          const value = this.formData[key];
          if (value instanceof File) {
            payload.append(key, value, value.name);
          } else if (value !== null && value !== undefined) {
            payload.append(key, String(value));
          }
        });
      } else {
        payload = { ...this.formData };
      }

      this.formSubmitted.emit(payload);

      const actionText = this.formDataToEdit ? 'updated' : 'created';
      this.alertDialogService.open('Information', `Record successfully ${actionText}.`, 'success');
      
      this.isSubmitting = false; 
    } else {
      this.alertDialogService.open('Invalid Form', 'Please check all required fields.', 'warning');
    }
  }
}