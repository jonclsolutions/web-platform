/**
 * @file order-form.component.ts
 * @path src/app/public/web-pages/order-form/order-form.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Public order form - optionally prefilled from a sales lead link (public_token).
 *   Same split layout and field styles as the contact form (contact.component.css).
 */

import { Component, ChangeDetectionStrategy, ViewChild, inject } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { BasePublicComponent } from '../../base-public.component';
import { MultiFileUploadComponent } from '../../../shared/components/multi-file-upload/multi-file-upload.component';
import { CaptchaComponent } from '../../../shared/components/captcha/captcha.component';
import { UploadRulesService } from '../../../shared/services/upload-rules.service';
import { UploadRule, isAttachmentRejection } from '../../../shared/utils/upload-rules';
import { publicFormErrorKey } from '../../../shared/utils/public-form-errors';
import { switchMap } from 'rxjs';
import * as Web from '../../../shared/imports/web-providers';

/** State of the link check by public_token - decides what the component shows ('expired': VT-10 link validity). */
type LinkState = 'loading' | 'valid' | 'no-token' | 'invalid' | 'used' | 'expired';

/** @description Link state of a 410 answer: an expired link (error_code LINK_EXPIRED) or a used one. */
function goneState(err: any): LinkState {
  return err?.error?.error_code === 'LINK_EXPIRED' ? 'expired' : 'used';
}

/** Safe subset of the lead fields returned by the public showByToken endpoint (no internal id). */
interface LeadPrefill {
  subject_name: string | null;
  contact_person: string | null;
  contact_email: string | null;
  contact_phone: string | null;
}

@Component({
  selector: 'app-order-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterModule, MultiFileUploadComponent, CaptchaComponent],
  templateUrl: './order-form.component.html',
  styleUrls: ['../shared-styles/form-fields.css', '../contact/contact.component.css', './order-form.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderFormComponent extends BasePublicComponent {

  /** Attachment rules of the API (allowed types, limits) - null until loaded / when unavailable. */
  attachmentRules: UploadRule | null = null;
  private uploadRules = inject(UploadRulesService);

  protected readonly translationKey = 'order_form';
  /** Contact e-mail / phone and social links of the left panel (like the contact page). */
  protected override readonly loadSiteSettings = true;
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);

  orderForm!: FormGroup;

  /** Plain public_token from the URL (/order_form/:token) - never the internal database id. */
  token: string | null = null;
  linkState: LinkState = 'loading';
  leadPrefill: LeadPrefill | null = null;

  isSubmitted = false;
  isLoading = false;
  selectedFiles: File[] = [];
  errorMessage: string | null = null;
  /** Invisible bot protection (Turnstile + honeypot) - supplies the token on submit. */
  @ViewChild(CaptchaComponent) captcha!: CaptchaComponent;

  // Hook called after the base initialization in the base class
  protected override onInit(): void {
    this.uploadRules.rules('sales_order')
      .pipe(Web.takeUntil(this.destroy$))
      .subscribe(rules => { this.attachmentRules = rules; this.cdr.markForCheck(); });
    this.initForm();

    const token = this.route.snapshot.paramMap.get('token');
    this.token = token;

    if (!token) {
      // The form works without a token too (general inquiry outside the sales process) -
      // WebSalesOrderController::store() then creates an order without a link
      // to a lead.
      this.linkState = 'no-token';
      this.cdr.markForCheck();
      return;
    }

    this.publicDataService.get<LeadPrefill>(`public/sales-leads/${token}`)
      .pipe(Web.takeUntil(this.destroy$))
      .subscribe({
        next: (lead) => {
          this.leadPrefill = lead;
          this.orderForm.patchValue({
            client_name: lead.contact_person || lead.subject_name || '',
            client_email: lead.contact_email || '',
            client_phone: lead.contact_phone || '',
          });
          this.linkState = 'valid';
          this.cdr.markForCheck();
        },
        error: (err: any) => {
          // The backend returns 410 for an already used or expired link, 404 for an invalid / unknown one.
          this.linkState = err?.status === 410 ? goneState(err) : 'invalid';
          this.cdr.markForCheck();
        }
      });
  }

  private initForm(): void {
    this.orderForm = this.fb.group({
      client_name: ['', Validators.required],
      ico: ['', [Validators.pattern('^[0-9]*$')]],
      client_address: [''],
      client_phone: ['', [Validators.pattern('^\\+?[0-9 ]*$'), Validators.maxLength(20)]],
      client_email: ['', [Validators.required, Validators.email]],
      order_description: ['', Validators.required],
      dataProcessingAgreement: [false, Validators.requiredTrue],
      tosAgreement: [false, Validators.requiredTrue]
    });
  }

  /**
   * @description Whether the field shows its error - only after the user touched or changed it.
   * @param name Form control name.
   */
  fieldInvalid(name: string): boolean {
    const ctrl = this.orderForm.get(name);
    return !!(ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched));
  }

  get btnText(): string {
    if (!this.t) return '...';
    return this.isLoading ? this.t.buttons.sending : this.t.buttons.send;
  }
  get attachmentUploaderTexts() {
    const s = this.t?.attachment_uploader;
    if (!s) return {};
    return {
      limitsHint: s.limits_hint,
      existingSectionTitle: s.existing_section_title,
      removeExistingTitle: s.remove_existing_title,
      dropzoneLabel: s.dropzone_label,
      errorMaxFilesWithExisting: s.error_max_files_with_existing,
      errorMaxFiles: s.error_max_files,
      errorFileTooLarge: s.error_file_too_large,
      errorTotalSizeExceeded: s.error_total_size_exceeded,
      totalLabel: s.total_label,
      totalNewSuffix: s.total_new_suffix,
      errorFileType: s.error_file_type,
      allowedTypesHint: s.allowed_types_hint,
    };
  }

  /**
   * @description Takes the current file list from MultiFileUploadComponent. The component guards
   * the client-side limit (10 files / 20 MB / 50 MB total) itself - only a UX aid, the real limit
   * is always enforced by the backend (StoreWebSalesOrderRequest).
   */
  onFilesChanged(files: File[]): void {
    this.selectedFiles = files;
  }

  /**
   * @description Sends the order: waits for the token of the background captcha check (usually
   * ready already), then posts the multipart form with the token and the honeypot value.
   */
  onSubmit(): void {
    if (this.orderForm.invalid || this.isLoading) return;

    this.isLoading = true;
    this.errorMessage = null;

    const formData = new FormData();
    Object.keys(this.orderForm.value).forEach(key => {
      const value = this.orderForm.value[key];
      if (value !== null && value !== undefined) {
        formData.append(key, value);
      }
    });

    // The lead is linked only through the token - the backend looks up and checks
    // the lead itself (see WebSalesOrderController::store). Sent only when it exists
    // (the form can run without a link to a specific lead).
    if (this.token) {
      formData.append('lead_token', this.token);
    }

    this.selectedFiles.forEach(file => {
      formData.append('attachments[]', file, file.name);
    });
    // Language of the page - the confirmation e-mail is written in it (VT-15).
    formData.append('lang', this.localizationService.getCurrentLanguage());

    this.captcha.nextToken().pipe(
      switchMap(token => {
        this.captcha.appendTo(formData, token);
        return this.publicDataService.post("sales_orders", formData);
      }),
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
        // The token is single-use - the server consumed it, the next attempt needs a new one.
        this.captcha.reset();
        const kind = publicFormErrorKey(err);
        // 410 can come here too when the token was used concurrently (two open tabs) -
        // the same message as on load is shown, so the user knows what happened.
        if (err?.status === 410) {
          this.linkState = goneState(err);
          this.errorMessage = null;
        } else {
          // Translated by status, no English fallback (findings #44 / #53).
          this.errorMessage = (kind === 'captcha' ? (this.t?.errors?.captcha_failed ?? this.t?.errors?.submit_error)
            : kind === 'email_limit' ? (this.t?.errors?.email_limit ?? this.t?.errors?.too_many_requests)
            : err?.status === 429 ? this.t?.errors?.too_many_requests
            : isAttachmentRejection(err) ? (this.t?.errors?.attachment_rejected ?? this.t?.errors?.submit_error)
            : this.t?.errors?.submit_error) ?? null;
        }
        console.error('Submission failed:', err);
        this.cdr.markForCheck();
      }
    });
  }
}