// public contact
import { Component, ChangeDetectionStrategy, ViewChild, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BasePublicComponent } from '../../../../public/base-public.component';
import { MultiFileUploadComponent } from '../../../../shared/components/multi-file-upload/multi-file-upload.component';
import { CaptchaComponent } from '../../../../shared/components/captcha/captcha.component';
import { UploadRulesService } from '../../../../shared/services/upload-rules.service';
import { UploadRule, isAttachmentRejection } from '../../../../shared/utils/upload-rules';
import { publicFormErrorKey } from '../../../../shared/utils/public-form-errors';
import { switchMap } from 'rxjs';
import * as Web from '../../../../shared/imports/web-providers';
import { AlertDialogService } from '../../../../core/services/alert-dialog.service';

@Component({
selector: 'app-contact',
standalone: true,
imports: [CommonModule, RouterModule, ReactiveFormsModule, MultiFileUploadComponent, CaptchaComponent],
templateUrl: './contact.component.html',
styleUrls: ['../shared-styles/form-fields.css', './contact.component.css'],
changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactComponent extends BasePublicComponent {

  /** Attachment rules of the API (allowed types, limits) - null until loaded / when unavailable. */
  attachmentRules: UploadRule | null = null;
  private uploadRules = inject(UploadRulesService);
protected readonly translationKey = 'contact';
protected override readonly loadSiteSettings = true;

contactForm!: FormGroup;
isSubmitted = signal(false);
isLoading   = signal(false);
selectedFiles: File[] = [];
stats: { value: string; label: string }[] = [];

/** Invisible bot protection (Turnstile + honeypot) - supplies the token on submit. */
@ViewChild(CaptchaComponent) captcha!: CaptchaComponent;

/** Current language of the public page when the form was loaded. */
currentLang = 'cz';

/** Error dialog of a failed submit (was `window.alert()`, finding #45). */
private alertDialogService = inject(AlertDialogService);

constructor(private fb: FormBuilder) {
super();
  }

// Hook called after the initialization in the base class
protected override onInit(): void {
    this.uploadRules.rules('raw_request_commission')
      .pipe(Web.takeUntil(this.destroy$))
      .subscribe(rules => { this.attachmentRules = rules; this.cdr.markForCheck(); });
this.initForm();
this.currentLanguage$
      .pipe(Web.takeUntil(this.destroy$))
      .subscribe(lang => { this.currentLang = lang; });
  }

// Hook called after the translations are loaded
protected override onTranslationsLoaded(translations: any): void {
// Extract the 'home' data for the statistics
const h = translations.home;
if (h) {
this.stats = [
        { value: h.stats_projects_count, label: h.stats_projects_text },
        { value: h.stats_years_count, label: h.stats_years_text },
        { value: h.stats_solutions_count, label: h.stats_solutions_text },
      ];
    }
  }
  /**
   * @description Builds the form. The subject is preselected to 'new_project' (the most common
   * reason of a contact) - the visitor can change it, an empty choice stays invalid.
   */
  private initForm(): void {
this.contactForm = this.fb.group({
subject: ['new_project', Validators.required],
email: ['', [Validators.required, Validators.email]],
phone: ['', [Validators.pattern('^\\+?[0-9 ]*$'), Validators.maxLength(20)]],
message: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(10000)]],
gdpr: [false, Validators.requiredTrue],
    });
  }

get btnText(): string {
if (!this.t) return '...';
return this.isLoading() ? this.t.buttons.sending : this.t.buttons.send;
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
   * is always enforced by the backend (StoreWebRawRequestCommissionRequest).
   */
onFilesChanged(files: File[]): void {
this.selectedFiles = files;
  }

/**
   * @description Sends the inquiry: waits for the token of the background captcha check (usually
   * ready already), then posts the multipart form with the token and the honeypot value.
   */
onSubmit(): void {
if (this.contactForm.invalid || this.isLoading()) return;

this.isLoading.set(true);
this.cdr.markForCheck();

const formData = new FormData();
const formValues = this.contactForm.value;

formData.append('thema', formValues.subject);
formData.append('contact_email', formValues.email);
if (formValues.phone?.trim()) {
formData.append('contact_phone', formValues.phone);
    }
formData.append('order_description', formValues.message);
formData.append('lang', this.currentLang);

this.selectedFiles.forEach(file => {
formData.append('attachments[]', file, file.name);
    });

this.captcha.nextToken()
      .pipe(
switchMap(token => {
this.captcha.appendTo(formData, token);
return this.publicDataService.post('raw_request_commissions', formData);
        }),
Web.finalize(() => {
this.isLoading.set(false);
this.cdr.markForCheck();
        }),
Web.takeUntil(this.destroy$),
      )
      .subscribe({
next: () => {
this.isSubmitted.set(true);
this.cdr.markForCheck();
        },
error: (err) => {
// The token is single-use - the server consumed it, the next attempt needs a new one.
this.captcha.reset();
// Translated text by status, never the (English) API message (findings #45 / #53).
const kind = publicFormErrorKey(err);
const msg = kind === 'captcha' ? (this.t?.errors?.captcha_failed ?? this.t?.errors?.submit_error)
  : kind === 'email_limit' ? (this.t?.errors?.email_limit ?? this.t?.errors?.too_many_requests)
  : err?.status === 429 ? this.t?.errors?.too_many_requests
  : isAttachmentRejection(err) ? (this.t?.errors?.attachment_rejected ?? this.t?.errors?.submit_error)
  : this.t?.errors?.submit_error;
this.alertDialogService.open(this.t?.errors?.submit_error_title, msg, 'danger');
        },
      });
  }

fieldInvalid(name: string): boolean {
const ctrl = this.contactForm.get(name);
return !!(ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched));
  }

}