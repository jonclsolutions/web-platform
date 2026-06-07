import {
  Component, Input, Output, EventEmitter, OnInit, OnDestroy, ViewChild, ChangeDetectionStrategy,
  ChangeDetectorRef, OnChanges, SimpleChanges
} from '@angular/core';

import { FormsModule, NgForm } from '@angular/forms';
import { FormFieldConfig, FormFieldOption } from '../../../../shared/interfaces/form-field-config';
import { LocalizationService } from '../../../../shared/services/localization.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { RouterModule } from '@angular/router'; 

@Component({
  selector: 'app-generic-form',
  standalone: true,
  imports: [FormsModule, RouterModule],
  templateUrl: './generic-form.component.html',
  styleUrl: './generic-form.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GenericFormComponent implements OnInit, OnDestroy, OnChanges {
  @Input() form_header: string = '';
  @Input() form_description: string = '';
  @Input() form_button: string = '';
  @Input() formConfig: FormFieldConfig[] = [];
  @Output() formSubmitted = new EventEmitter<any>();
  @Output() formReset = new EventEmitter<void>();

  @Input() isOpen: boolean = true;
  @Input() closedMessage: string = '';
  @Input() closedTitle: string = '';

  formData: { [key: string]: any } = {};
  @ViewChild('dynamicForm') dynamicForm!: NgForm;

  isLoading: boolean = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  // Jeden objekt pro všechny překlady (včetně validací)
  t: any = null;

  private destroy$ = new Subject<void>();
  closed_form_icon_link: string = 'assets/images/icons/closed-form-icon.png';
  translatedFormConfig: FormFieldConfig[] = [];

  constructor(private cd: ChangeDetectorRef, private localizationService: LocalizationService) {}

  ngOnInit(): void {
    this.localizationService.currentTranslations$
      .pipe(takeUntil(this.destroy$))
      .subscribe(translations => {
        if (translations?.form) {
          this.t = translations.form;
          this.translateFormConfig();
          this.initializeFormData();
          this.cd.markForCheck(); // Šetrnější než detectChanges, řeší lagování
        }
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] || changes['closedMessage'] || changes['formConfig']) {
      if (this.t) this.translateFormConfig();
      this.cd.markForCheck();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private translateFormConfig(): void {
    this.translatedFormConfig = this.formConfig.map(field => {
      const translatedField: FormFieldConfig = { ...field };
      if (field.isLocalizedLabel) {
        translatedField.label = this.localizationService.getText(field.label);
      }
      if (field.isLocalizedPlaceholder && field.placeholder) {
        translatedField.placeholder = this.localizationService.getText(field.placeholder);
      }
      if (field.options && field.options.length > 0) {
        translatedField.options = field.options.map(option => {
          const translatedOption: FormFieldOption = { ...option };
          if (option.isLocalizedLabel) {
            translatedOption.label = this.localizationService.getText(option.label);
          }
          return translatedOption;
        });
      }
      return translatedField;
    });
  }

  private initializeFormData(): void {
    this.formData = {};
    this.translatedFormConfig.forEach(field => {
      this.formData[field.name] = field.value ?? null;
      if (field.type === 'checkbox' && field.value === undefined) {
        this.formData[field.name] = false;
      }
    });
    this.formData['dataProcessingAgreement'] = false;
  }

  onSubmit(): void {
    if (!this.isOpen || this.isLoading) return;

    if (this.dynamicForm.valid) {
      this.isLoading = true;
      this.errorMessage = null;
      this.successMessage = null;

      // Simulace odeslání
      setTimeout(() => {
        this.isLoading = false;
        const success = Math.random() > 0.1;

        if (success) {
          this.successMessage = this.t.success_message;
          this.formSubmitted.emit(this.formData);
          this.initializeFormData();
        } else {
          this.errorMessage = this.t.error_submit_generic;
        }
        this.cd.markForCheck();
      }, 1500);
    } else {
      this.errorMessage = this.t.error_validation_generic;
      this.cd.markForCheck();
    }
  }

  onReset(): void {
    this.initializeFormData();
    if (this.dynamicForm) {
      this.dynamicForm.resetForm(this.formData);
    }
    this.errorMessage = null;
    this.successMessage = null;
    this.isLoading = false;
    this.formReset.emit();
    this.cd.markForCheck();
  }

  getValidationErrors(fieldName: string): string | null {
    const control = this.dynamicForm?.controls[fieldName];
    if (control && control.invalid && (control.dirty || control.touched)) {
      if (control.errors?.['required']) return this.t.validation_required;
      if (control.errors?.['email']) return this.t.validation_email;
      if (control.errors?.['pattern']) return this.t.validation_pattern;
      
      if (control.errors?.['minlength']) {
        return `${this.t.validation_minlength_prefix} ${control.errors['minlength'].requiredLength} ${this.t.validation_minlength_suffix}`;
      }
      if (control.errors?.['maxlength']) {
        return `${this.t.validation_maxlength_prefix} ${control.errors['maxlength'].requiredLength} ${this.t.validation_maxlength_suffix}`;
      }
      if (control.errors?.['min']) {
        return `${this.t.validation_min_prefix} ${control.errors['min'].min}${this.t.validation_min_suffix}`;
      }
      if (control.errors?.['max']) {
        return `${this.t.validation_max_prefix} ${control.errors['max'].max}${this.t.validation_max_suffix}`;
      }
      return this.t.validation_invalid_value;
    }
    return null;
  }
}