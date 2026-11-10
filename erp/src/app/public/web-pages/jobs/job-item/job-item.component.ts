/**
 * @file job-item.component.ts
 * @path src/app/public/web-pages/jobs/job-item/job-item.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Job detail page with the public application form (CV upload). The position
 *   (title, type, place of work and the blocks of the description) comes from the database
 *   (admin: web/edit-website, tab Jobs) in all languages; the static texts from `jobs`.
 * @note A text missing in the current language shows 'Cannot load text'; an optional field (type,
 *   place, heading of a block) empty in every language is not shown. Texts are plain text - their
 *   line breaks are kept (CSS `white-space: pre-line`), never HTML.
 * @dependencies
 * - BasePublicComponent (translations, site settings), PublicDataService (submit), LoadingService,
 *   WebContentService (the position).
 */

import { Component, ChangeDetectionStrategy, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { takeUntil } from 'rxjs/operators';
import { BasePublicComponent } from '../../../base-public.component';
import { LoadingService } from '../../../../core/services/loading.service';
import { UploadRulesService } from '../../../../shared/services/upload-rules.service';
import { UploadRule, extensionsLabel, isAttachmentRejection, isExtensionAllowed } from '../../../../shared/utils/upload-rules';
import { publicFormErrorKey } from '../../../../shared/utils/public-form-errors';
import { CaptchaComponent } from '../../../../shared/components/captcha/captcha.component';
import { combineLatest, switchMap } from 'rxjs';
import { WebContentService, localizedText, optionalText } from '../../../../shared/services/web-content.service';

/** One position of the detail page in the current language. */
export interface JobDetail {
  title: string;
  /** Type of the job (null = none in any language - not shown). */
  type: string | null;
  /** Place of work (null = none in any language - not shown). */
  location: string | null;
  sections: { heading: string | null; body: string }[];
}

/**
 * @description Allowed characters of the first / last name - letters (incl. diacritics through
 *              the \p{L} unicode property), spaces, hyphens and apostrophes (e.g. "Marie-Anne",
 *              "O'Brien"). Deliberately no digits - a name with a digit is always an input error.
 * @note Needs the 'u' (unicode) flag, otherwise \p{L} matches only a literal "p", "L" etc.
 */
const NAME_PATTERN = /^[\p{L}\s'-]+$/u;

/**
 * @description Allowed characters of the phone number - digits, spaces, +, brackets and hyphens
 *              (covers common forms like "+420 733 188 328", "(420) 733-188-328").
 *              At least 6 characters, so even a very short test number passes, but not an
 *              empty / 1-character value.
 */
const PHONE_PATTERN = /^[0-9+()\s-]{6,20}$/;

/**
 * @description Fallback size limit of the CV (20 MB) while the rules of the API are not loaded -
 *              the real values come from `GET upload-rules` (profile job_application). The check
 *              here is only a UX aid - the authoritative limit stays enforced by the backend.
 */
const DEFAULT_MAX_FILE_SIZE_MB = 20;

@Component({
  selector: 'app-job-item',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, CaptchaComponent],
  templateUrl: './job-item.component.html',
  styleUrls: ['../../shared-styles/theme.css', '../../shared-styles/form-fields.css', '../../../../shared/styles/base.css', '../../shared-styles/animations.css', './job-item.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class JobItemComponent extends BasePublicComponent {
  protected readonly translationKey = 'jobs';
  protected override readonly loadSiteSettings = true;

  /** Public endpoint of the application form. */
  private readonly apiEndpoint = 'job_applications';

  applicationForm!: FormGroup;
  /** The position of the route (null = not found / not loaded yet). */
  job: JobDetail | null = null;
  /** Whether the positions were loaded (the "not found" text waits for them). */
  jobsLoaded = false;
  isSubmitted = false;
  selectedFile: File | null = null;
  /** Set when the user chooses a file over the size limit. */
  fileSizeError = false;
  /** Set when the user chooses a file of a type that is not allowed. */
  fileTypeError = false;
  /** CV rules of the API (allowed types, size) - null until loaded / when unavailable. */
  cvRules: UploadRule | null = null;
  /** Translated error of a failed submit (null = none). */
  errorMessage: string | null = null;
  /** Invisible bot protection (Turnstile + honeypot) - supplies the token on submit. */
  @ViewChild(CaptchaComponent) captcha!: CaptchaComponent;

  public loadingService = inject(LoadingService);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private uploadRules = inject(UploadRulesService);
  private webContent = inject(WebContentService);

  /**
   * @description Builds the form (the base class loads translations and site settings).
   */
  protected override onInit(): void {
    this.initForm();
    this.loadJobData();
    this.uploadRules.rules('job_application')
      .pipe(takeUntil(this.destroy$))
      .subscribe(rules => { this.cvRules = rules; this.cdr.markForCheck(); });
  }


  /** @description Error text of a refused CV type with the allowed types filled in. */
  get cvTypeErrorText(): string {
    return (this.t?.form_cv_type_error ?? 'This file type cannot be uploaded. Allowed types: {types}')
      .replace('{types}', extensionsLabel(this.cvRules?.extensions ?? []));
  }

  private initForm(): void {
    this.applicationForm = this.fb.group({
      first_name: ['', [Validators.required, Validators.pattern(NAME_PATTERN)]],
      last_name: ['', [Validators.required, Validators.pattern(NAME_PATTERN)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.pattern(PHONE_PATTERN)]],
      message: [''],
      dataProcessingAgreement: [false, Validators.requiredTrue]
    });
  }

  /**
   * @description Handles the file choice of the file input and checks its type and size against
   *              the CV rules of the API. A refused file is never stored in selectedFile (so the
   *              form cannot be sent), fileTypeError / fileSizeError is set instead for the error
   *              message of the template.
   */
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    this.fileTypeError = !isExtensionAllowed(file.name, this.cvRules?.extensions ?? []);
    this.fileSizeError = !this.fileTypeError
      && file.size > (this.cvRules?.max_file_size_mb ?? DEFAULT_MAX_FILE_SIZE_MB) * 1024 * 1024;
    if (this.fileTypeError || this.fileSizeError) {
      this.selectedFile = null;
      event.target.value = '';
      this.cdr.markForCheck();
      return;
    }

    this.selectedFile = file;
    this.cdr.markForCheck();
  }

  /**
   * @description Sends the application (multipart, CV attached) to the public endpoint.
   */
  onSubmit(): void {
    if (this.applicationForm.invalid || !this.selectedFile) {
      this.applicationForm.markAllAsTouched();
      return;
    }

    const formData = new FormData();
    Object.keys(this.applicationForm.value).forEach(key => {
      const value = this.applicationForm.value[key];
      if (value !== null && value !== undefined) {
        formData.append(key, key === 'dataProcessingAgreement' ? (value ? '1' : '0') : value);
      }
    });

    if (this.job) formData.append('position_name', this.job.title);
    formData.append('cv_file', this.selectedFile, this.selectedFile.name);

    this.loadingService.show();
    // The token of the background captcha check is usually ready already; otherwise it is awaited.
    this.captcha.nextToken()
      .pipe(
        switchMap(token => {
          this.captcha.appendTo(formData, token);
          return this.publicDataService.post<any>(this.apiEndpoint, formData);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: () => {
          this.isSubmitted = true;
          this.loadingService.hide();
          this.cdr.markForCheck();
        },
        error: (err) => {
          // The token is single-use - the server consumed it, the next attempt needs a new one.
          this.captcha.reset();
          const kind = publicFormErrorKey(err);
          if (isAttachmentRejection(err)) {
            // The server refused the CV (content of another type than the name says) - show it at
            // the file field and let the user choose another file.
            this.fileTypeError = true;
            this.selectedFile = null;
            this.errorMessage = null;
          } else {
            this.errorMessage = (kind === 'captcha' ? (this.t?.form_captcha_failed ?? this.t?.form_error_generic)
              : kind === 'email_limit' ? (this.t?.form_email_limit ?? this.t?.form_too_many_requests)
              : err?.status === 429 ? this.t?.form_too_many_requests
              : this.t?.form_error_generic) ?? null;
          }
          this.loadingService.hide();
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * @description Resolves the position of the route (slug) and follows the current language.
   */
  private loadJobData(): void {
    const slug = this.route.snapshot.paramMap.get('id');
    combineLatest([this.webContent.jobs(), this.currentLanguage$])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([jobs, lang]) => {
        const job = (Array.isArray(jobs) ? jobs : []).find(j => j.slug === slug);
        this.job = job ? {
          title: localizedText(job.title, lang),
          type: optionalText(job.type, lang),
          location: optionalText(job.location, lang),
          sections: job.sections.map(section => ({
            heading: optionalText(section.heading, lang),
            body: localizedText(section.body, lang),
          })),
        } : null;
        this.jobsLoaded = true;
        this.cdr.markForCheck();
      });
  }
}