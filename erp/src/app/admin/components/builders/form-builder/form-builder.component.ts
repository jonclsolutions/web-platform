import { Component, Input, Output, EventEmitter, ChangeDetectorRef, ViewChild, OnInit, OnDestroy } from '@angular/core';

import { FormsModule, NgForm, FormControl } from '@angular/forms';
import { AlertDialogService } from '../../../../core/services/alert-dialog.service';
import { InputDefinition } from '../../../../shared/interfaces/input-definiton';

@Component({
  selector: 'app-form-builder',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './form-builder.component.html',
  styleUrl: './form-builder.component.css',
})
export class FormBuilderComponent implements OnInit, OnDestroy {
  @Input() headerText: string = 'Vytvořit nový záznam';
  @Input() inputDefinitions: InputDefinition[] = [];
  @Input() formDataToEdit: any = null;

  @Output() formSubmitted = new EventEmitter<any>();
  @Output() formCanceled = new EventEmitter<void>();

  @ViewChild('genericForm') genericForm!: NgForm;

  formData: { [key: string]: any } = {};
  confirmPasswordData: { [key: string]: string } = {}; 
  isSubmitting = false;
  passwordsNotMatching = false;
  visibleInputDefinitions: InputDefinition[] = [];

  constructor(
    private cd: ChangeDetectorRef,
    private alertDialogService: AlertDialogService
  ) {}

  ngOnInit(): void {
    document.body.style.overflow = 'hidden';

    if (this.formDataToEdit) {
      this.formData = { ...this.formDataToEdit };
      this.visibleInputDefinitions = this.inputDefinitions.filter(input => input.show_in_edit !== false);
      
      // Čistá normalizace dat po načtení
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
   * Zajišťuje, aby hodnoty v formData odpovídaly typům v options (string vs number/boolean).
   * Prochází pouze viditelné selecty a mapuje existující hodnoty na stringy, pokud je select tak definován.
   */
  private normalizeSelectValues(): void {
    this.visibleInputDefinitions.forEach(input => {
      if (input.type === 'select' && input.options) {
        const currentValue = this.formData[input.column_name];
        
        // Převedeme boolean/number na string pouze pokud daný string existuje v options
        // To zabrání rozbití formulářů, které pracují s ID (čísly)
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

  checkPasswordMatch(columnName: string): void {
    const original = this.formData[columnName];
    const confirmation = this.confirmPasswordData[columnName];
    this.passwordsNotMatching = (original !== confirmation) && !!confirmation;
  }

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

  getValidationErrorMessage(control: FormControl | null, fieldDefinition: InputDefinition): string | null {
    if (!control || !control.invalid || (!control.dirty && !control.touched)) {
      return null;
    }
    if (control.errors?.['required']) return fieldDefinition.errorMessage || 'Toto pole je povinné.';
    if (control.errors?.['pattern']) return fieldDefinition.errorMessage || 'Neplatný formát.';
    if (control.errors?.['email']) return fieldDefinition.errorMessage || 'Neplatný formát e-mailu.';
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

  onSubmit(form: NgForm, event?: Event): void {
    event?.preventDefault();
    if (this.isSubmitting) return;

    Object.keys(form.controls).forEach(field => {
      form.controls[field]?.markAsTouched();
    });

    this.visibleInputDefinitions.forEach(input => {
      if (input.type === 'confirm-password') {
        this.checkPasswordMatch(input.column_name);
      }
    });

    if (this.passwordsNotMatching) {
      this.alertDialogService.open('Chyba', 'Hesla se neshodují.', 'danger');
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

      const actionText = this.formDataToEdit ? 'aktualizován' : 'vytvořen';
      this.alertDialogService.open('Informace', `Záznam byl úspěšně ${actionText}.`, 'success');
      
      this.isSubmitting = false; 
    } else {
      this.alertDialogService.open('Neplatný formulář', 'Zkontrolujte prosím všechna povinná pole.', 'warning');
    }
  }
}