/**
 * @file order-form.component.ts
 * @path src/app/apps/project-portal/public/order-form/order-form.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Public order form of the project portal (/projects/order/:token): the client opens
 *   the link a salesman sent from a sales lead, the form is prefilled with the contact of the lead
 *   and sends the order (with attachments, the consents to the privacy policy and the terms of
 *   service, the invisible captcha). The link is single-use and expires (VT-10) - an unknown, used
 *   or expired link shows its state instead of the form. Light look of the portal, texts of the
 *   portal (ProjectPortalLocalizationService, keys `order_*`), the legal documents open in a window.
 * @dependencies PublicDataService (SKIP_ADMIN_AUTH_CONTEXT), ProjectPortalLocalizationService,
 *   UploadRulesService (profile sales_order), MultiFileUploadComponent, CaptchaComponent,
 *   LegalDocumentDialogComponent, PortalLanguageSwitcherComponent.
 * @security The lead is reached only by its random token (never by the internal id); the API
 *   checks the token again when the order is sent (SalesOrderController::store()).
 */

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, switchMap } from 'rxjs';
import { PublicDataService } from '../../../../shared/services/public-data.service';
import { SKIP_ADMIN_AUTH_CONTEXT } from '../../../../core/interceptors/skip-admin-auth';
import { MultiFileUploadComponent, MultiFileUploadTexts } from '../../../../shared/components/multi-file-upload/multi-file-upload.component';
import { CaptchaComponent } from '../../../../shared/components/captcha/captcha.component';
import { UploadRulesService } from '../../../../shared/services/upload-rules.service';
import { UploadRule, isAttachmentRejection } from '../../../../shared/utils/upload-rules';
import { publicFormErrorKey } from '../../../../shared/utils/public-form-errors';
import { LegalDocumentDialogComponent } from '../../../../public/legal/legal-document-dialog/legal-document-dialog.component';
import { ProjectPortalLocalizationService } from '../project-portal-localization.service';
import { PortalLanguageSwitcherComponent } from '../language-switcher/portal-language-switcher.component';

/** State of the link - decides what the page shows. */
export type OrderLinkState = 'loading' | 'valid' | 'invalid' | 'used' | 'expired';

/** Safe subset of the lead returned by the public endpoint (no internal id). */
interface LeadPrefill {
  subject_name: string | null;
  contact_person: string | null;
  contact_email: string | null;
  contact_phone: string | null;
}

/** Legal document opened from a consent. */
type LegalDoc = 'gdpr' | 'tos';

/**
 * @description State of a refused link: an expired link (error_code LINK_EXPIRED) or a used one.
 * @param err HTTP error of status 410.
 */
function goneState(err: any): OrderLinkState {
  return err?.error?.error_code === 'LINK_EXPIRED' ? 'expired' : 'used';
}

@Component({
  selector: 'app-portal-order-form',
  standalone: true,
  imports: [ReactiveFormsModule, MultiFileUploadComponent, CaptchaComponent, LegalDocumentDialogComponent, PortalLanguageSwitcherComponent],
  templateUrl: './order-form.component.html',
  styleUrls: ['../../../../admin/shared-styles/theme.css', './order-form.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderFormComponent implements OnInit {
  readonly portalI18n = inject(ProjectPortalLocalizationService);
  private readonly publicData = inject(PublicDataService);
  private readonly uploadRules = inject(UploadRulesService);
  private readonly route = inject(ActivatedRoute);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly orderForm = inject(FormBuilder).nonNullable.group({
    client_name: ['', Validators.required],
    ico: ['', Validators.pattern('^[0-9]*$')],
    client_address: [''],
    client_phone: ['', [Validators.pattern('^\\+?[0-9 ]*$'), Validators.maxLength(20)]],
    client_email: ['', [Validators.required, Validators.email]],
    order_description: ['', Validators.required],
    dataProcessingAgreement: [false, Validators.requiredTrue],
    tosAgreement: [false, Validators.requiredTrue],
  });

  /** Token of the link (/projects/order/:token) - never the internal id of the lead. */
  token = '';
  linkState: OrderLinkState = 'loading';
  isSubmitted = false;
  isLoading = false;
  errorMessage: string | null = null;
  selectedFiles: File[] = [];
  /** Attachment rules of the API (types, limits) - null until loaded. */
  attachmentRules: UploadRule | null = null;
  /** Legal document shown in the window (null = closed). */
  openDoc: LegalDoc | null = null;
  /** Contact of the supplier (core site settings) for questions. */
  contact: { email?: string | null; phone?: string | null } | null = null;

  /** Invisible bot protection (Turnstile + honeypot) - supplies the token on submit. */
  @ViewChild(CaptchaComponent) captcha!: CaptchaComponent;

  /**
   * @description Text of the portal by key (`order_*`).
   * @param key Key of the portal texts.
   */
  t(key: string): string {
    return this.portalI18n.getValue(key);
  }

  /** @description Loads the rules, the contact and the lead of the token; follows the language. */
  ngOnInit(): void {
    this.portalI18n.translations$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.cdr.markForCheck());
    this.uploadRules.rules('sales_order').pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(rules => { this.attachmentRules = rules; this.cdr.markForCheck(); });
    this.publicData.getSiteSettings().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res: any) => { this.contact = { email: res?.settings?.contact_email, phone: res?.settings?.contact_phone }; this.cdr.markForCheck(); },
      error: () => { /* no contact line */ },
    });

    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    this.publicData.get<LeadPrefill>(`project-portal/public/sales-leads/${encodeURIComponent(this.token)}`, undefined, undefined, SKIP_ADMIN_AUTH_CONTEXT)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (lead) => {
          this.orderForm.patchValue({
            client_name: lead?.contact_person || lead?.subject_name || '',
            client_email: lead?.contact_email || '',
            client_phone: lead?.contact_phone || '',
          });
          this.linkState = 'valid';
          this.cdr.markForCheck();
        },
        // 410 = used or expired link, anything else (404) = unknown link.
        error: (err) => {
          this.linkState = err?.status === 410 ? goneState(err) : 'invalid';
          this.cdr.markForCheck();
        },
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

  /** @description Texts of the uploader (placeholders filled by the uploader itself). */
  get uploaderTexts(): Partial<MultiFileUploadTexts> {
    return {
      limitsHint: this.t('order_upload_limits_hint'),
      dropzoneLabel: this.t('order_upload_dropzone'),
      errorMaxFiles: this.t('order_upload_error_max_files'),
      errorFileTooLarge: this.t('order_upload_error_file_too_large'),
      errorTotalSizeExceeded: this.t('order_upload_error_total_size'),
      totalLabel: this.t('order_upload_total_label'),
      errorFileType: this.t('order_upload_error_file_type'),
      allowedTypesHint: this.t('order_upload_allowed_types'),
    };
  }

  /**
   * @description Takes the files chosen in the uploader (it checks the limits for the user; the
   *   API always validates again - StoreSalesOrderRequest).
   * @param files Chosen files.
   */
  onFilesChanged(files: File[]): void {
    this.selectedFiles = files;
  }

  /**
   * @description Opens / closes a legal document window.
   * @param doc Document, null closes.
   */
  showDoc(doc: LegalDoc | null): void {
    this.openDoc = doc;
  }

  /**
   * @description Sends the order: waits for the token of the background captcha check, then posts
   *   the multipart form with the lead token, the files, the language of the page and the captcha.
   */
  onSubmit(): void {
    if (this.orderForm.invalid || this.isLoading) return;
    this.isLoading = true;
    this.errorMessage = null;

    const formData = new FormData();
    Object.entries(this.orderForm.getRawValue()).forEach(([key, value]) => formData.append(key, String(value)));
    formData.append('lead_token', this.token);
    this.selectedFiles.forEach(file => formData.append('attachments[]', file, file.name));
    // Language of the page - the confirmation e-mail is written in it (VT-15).
    formData.append('lang', this.portalI18n.getCurrentLanguage());

    this.captcha.nextToken().pipe(
      switchMap(token => {
        this.captcha.appendTo(formData, token);
        return this.publicData.post('project-portal/public/sales-orders', formData, undefined, SKIP_ADMIN_AUTH_CONTEXT);
      }),
      finalize(() => { this.isLoading = false; this.cdr.markForCheck(); }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => { this.isSubmitted = true; this.cdr.markForCheck(); },
      error: (err) => {
        // The captcha token is single-use - the next attempt needs a new one.
        this.captcha.reset();
        if (err?.status === 410) {
          // Used in another tab meanwhile / expired: the same state as on load.
          this.linkState = goneState(err);
        } else {
          const kind = publicFormErrorKey(err);
          this.errorMessage = this.t(kind === 'captcha' ? 'order_error_captcha'
            : kind === 'email_limit' ? 'order_error_email_limit'
            : err?.status === 429 ? 'order_error_too_many'
            : isAttachmentRejection(err) ? 'order_error_attachment'
            : 'order_error_submit');
        }
        this.cdr.markForCheck();
      },
    });
  }
}
