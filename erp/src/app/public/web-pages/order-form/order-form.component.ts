/**
 * @file order-form.component.ts
 * @path src/app/public/web-pages/order-form/order-form.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 */

import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { BasePublicComponent } from '../../base-public.component';
import * as Web from '../../../shared/imports/web-providers';

@Component({
  selector: 'app-order-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterModule],
  templateUrl: './order-form.component.html',
  styleUrl: './order-form.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderFormComponent extends BasePublicComponent {

  protected readonly translationKey = 'order_form';
  
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);

  orderForm!: FormGroup;
  leadId: string | null = null;
  isSubmitted = false;
  isLoading = false; 
  selectedFile: File | null = null;
  errorMessage: string | null = null;

  // Hook volaný po základní inicializaci v bázi
  protected override onInit(): void {
    const param = this.route.snapshot.paramMap.get('leadParam');
    if (param && param.includes('=')) {
      this.leadId = param.split('=')[1];
    }
    this.initForm();
  }

  private initForm(): void {
    this.orderForm = this.fb.group({
      lead_id: [this.leadId],
      client_name: ['', Validators.required],
      ico: ['', [Validators.pattern('^[0-9]*$')]],
      client_address: [''],
      client_phone: ['', [Validators.pattern('^\\+?[0-9]*$'), Validators.maxLength(20)]],
      client_email: ['', [Validators.required, Validators.email]],
      order_description: ['', Validators.required],
      dataProcessingAgreement: [false, Validators.requiredTrue],
      tosAgreement: [false, Validators.requiredTrue]
    });
  }
  
  get btnText(): string {
    if (!this.t) return '...';
    return this.isLoading ? this.t.buttons.sending : this.t.buttons.send;
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      this.cdr.markForCheck();
    }
  }

  onSubmit(): void {
    if (this.orderForm.invalid) return;

    this.isLoading = true;
    this.errorMessage = null;

    const formData = new FormData();
    Object.keys(this.orderForm.value).forEach(key => {
      const value = this.orderForm.value[key];
      if (value !== null && value !== undefined) {
        formData.append(key, value);
      }
    });

    if (this.selectedFile) {
      formData.append('attachment', this.selectedFile, this.selectedFile.name);
    }

    this.publicDataService.post("sales_orders", formData).pipe(
      Web.finalize(() => {
        this.isLoading = false;
        this.cdr.markForCheck();
      }),
      Web.takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        this.isSubmitted = true;
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        this.errorMessage = this.t?.errors?.submit_error || 'Submission error.';
        console.error('Submission failed:', err);
        this.cdr.markForCheck();
      }
    });
  }
}