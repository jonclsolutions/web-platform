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
 * @refactor-note (2026-08-2) Přidán typ `'files'` (množné číslo, na rozdíl od `'file'`,
 * které zůstává jako jednosouborové pole) - napojuje sdílenou `MultiFileUploadComponent`
 * (max. 10 souborů / 20 MB / 50 MB, stejná politika jako veřejné formuláře). V edit módu
 * se pole VŽDY inicializuje jako prázdné pole (`resetFileArrayFields()`), i kdyby
 * `formDataToEdit` neslo existující `attachments` (pole objektů z API, ne `File`
 * instance) - `'files'` pole slouží jen k PŘIDÁNÍ nových příloh, správa/mazání
 * existujících je mimo scope (viz TableBuilder detail zobrazení). `onSubmit()` upraven,
 * aby detekoval jak jednotlivý `File` (typ `'file'`), tak pole `File[]` (typ `'files'`) a
 * do `FormData` je serializoval odpovídajícím způsobem (`key` vs. `key[]`).
 *
 * @dependencies
 * - FormsModule: Angular template-driven form infrastructure.
 * - AlertDialogService: Provides user feedback for submission outcomes.
 * - InputDefinition: Interface for rendering dynamic form inputs and validation metadata.
 * - PasswordRequirementsChecklistComponent: Live vizuální checklist pravidel hesla.
 * - MultiFileUploadComponent: Sdílený drag&drop multi-file upload, viz `'files'` case.
 */

import { Component, Input, Output, EventEmitter, ChangeDetectorRef, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { FormsModule, NgForm, FormControl } from '@angular/forms';
import { AlertDialogService } from '../../../../core/services/alert-dialog.service';
import { InputDefinition } from '../../../../shared/interfaces/input-definiton';
import { PasswordRequirementsChecklistComponent } from '../../../../shared/components/password-requirements-checklist/password-requirements-checklist.component';
import { MultiFileUploadComponent } from '../../../../shared/components/multi-file-upload/multi-file-upload.component';

/**
 * @description Renders a dynamic form based on an array of field definitions.
 * @usage Used in create and edit modals across the admin panel for data entry.
 * @note Supports file uploads via FormData auto-detection, password matching validation, and persistent scroll locking.
 */
@Component({
  selector: 'app-form-builder',
  standalone: true,
  imports: [FormsModule, PasswordRequirementsChecklistComponent, MultiFileUploadComponent],
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
      this.resetFileArrayFields();
    } else {
      this.formData = {};
      this.visibleInputDefinitions = this.inputDefinitions.filter(input => input.show_in_create !== false);
      this.visibleInputDefinitions.forEach(input => {
        this.formData[input.column_name] = input.type === 'files' ? [] : (input.defaultValue ?? '');
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

  /**
   * @description Vynutí prázdné pole pro každé `'files'` pole PŘI EDITACI - `formDataToEdit`
   * u takového klíče typicky nese existující přílohy jako pole API objektů (`{id, url,
   * original_filename, ...}`), ne `File` instance. Bez tohoto resetu by `onSubmit()`
   * takové pole nerozpoznal jako soubory (neprojde `isFileArray()` testem) a skončilo by
   * jako nesmyslně stringifikované do `FormData`. `'files'` pole slouží výhradně k
   * PŘIDÁNÍ nových příloh - správa/mazání starých je mimo scope tohoto formuláře.
   */
  private resetFileArrayFields(): void {
    this.visibleInputDefinitions.forEach(input => {
      if (input.type === 'files') {
        this.formData[input.column_name] = [];
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

  /**
   * @description Přijímá aktuální seznam souborů z `MultiFileUploadComponent` pro pole
   * typu `'files'`. Komponenta sama hlídá klientský limit (10 souborů / 20 MB / 50 MB
   * celkem) jako UX pomůcku - skutečnou hranici vždy vynucuje backend.
   */
  onFilesChange(files: File[], columnName: string): void {
    this.formData[columnName] = files;
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
   * @note Automatically serializes data into FormData if file inputs (single `File` or
   * `File[]` from a `'files'` field) are detected. Single files se posílají pod svým
   * klíčem beze změny (`key`), pole souborů pod `key[]` (Laravel/PHP konvence pro
   * vícenásobný upload, sedí s `attachments[]` očekávaným backendem).
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
            // Prázdné/nesouborové pole ('files' pole bez vybraného souboru apod.) -
            // nemá smysl posílat, backend ho stejně bere jako 'sometimes'.
            return;
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