/**
 * @file order-form.component.ts
 * @path src/app/pages/order-form/order-form.component.ts
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Manages the business inquiry/order submission form, including validation, file attachments, and API communication.
 * @dependencies
 * - ReactiveFormsModule: Manages form state, complex validation, and user input.
 * - PublicDataService: Facilitates secure transmission of order data to the backend.
 * - LocalizationService: Dynamically translates form labels and error messages.
 */

import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import * as Web from '../../../shared/imports/web-providers';

/**
 * @description Component for processing client orders and project requests.
 * @usage Provides a multi-step form to collect client data and project documentation.
 * @note Implements OnPush change detection to maintain UI responsiveness during high-latency file uploads.
 */
@Component({
  selector: 'app-order-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterModule],
  templateUrl: './order-form.component.html',
  styleUrl: './order-form.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderFormComponent implements OnInit, OnDestroy {
  orderForm!: FormGroup;
  leadId: string | null = null;
  isSubmitted = false;
  isLoading = false; 
  selectedFile: File | null = null;
  errorMessage: string | null = null;
  
  /** Translation container */
  f: any = null;
  private destroy$ = new Web.Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private fb: FormBuilder,
    private cd: ChangeDetectorRef,
    private publicDataService: Web.PublicDataService,
    private localizationService: Web.LocalizationService
  ) {}

  /**
   * @description Initializes translation subscriptions, parses URL lead parameters, and builds the form structure.
   */
  ngOnInit(): void {
    this.localizationService.currentTranslations$
      .pipe(Web.takeUntil(this.destroy$))
      .subscribe(translations => {
        if (translations?.order_form) {
          this.f = translations.order_form;
          this.cd.markForCheck();
        }
      });

    const param = this.route.snapshot.paramMap.get('leadParam');
    if (param && param.includes('=')) {
      this.leadId = param.split('=')[1];
    }
    this.initForm();
  }

  /**
   * @description Unsubscribes from active streams upon destruction.
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * @description Configures the form model with specific validators.
   */
  initForm(): void {
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
  
  /**
   * @description Returns the localized button text based on current loading state.
   */
  get btnText(): string {
    if (!this.f) return '...';
    return this.isLoading ? this.f.buttons.sending : this.f.buttons.send;
  }

  /**
   * @description Updates the attachment object from event input.
   * @param event The file selection event.
   */
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      this.cd.markForCheck();
    }
  }

  /**
   * @description Encapsulates form values into FormData and submits to the backend API.
   */
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

    this.publicDataService.submitOrder(formData).pipe(
      Web.finalize(() => {
        this.isLoading = false;
        this.cd.markForCheck();
      }),
      Web.takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        this.isSubmitted = true;
        this.cd.markForCheck();
      },
      error: (err: any) => {
        this.errorMessage = this.f?.errors?.submit_error || 'Submission error.';
        console.error('Submission failed:', err);
        this.cd.markForCheck();
      }
    });
  }
}