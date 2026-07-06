/**
 * @file contact.component.ts
 * @path src/app/pages/contact/contact.component.ts
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Manages the contact page, providing a secure form for user inquiries and commission requests, including file attachment support and dynamic site configuration.
 * @dependencies
 * - ReactiveFormsModule: Handles complex form state, validation, and submission logic.
 * - PublicDataService: Provides connectivity to backend API for site settings and commission submission.
 * - LocalizationService: Supplies translated UI strings.
 * - Angular Signals: Used for managing submission state and loading indicators reactively.
 */

import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { PublicDataService } from '../../../shared/services/public-data.service';
import * as Web from '../../../shared/imports/web-providers';

/**
 * @description Component handling user contact inquiries and file attachments.
 * @usage Provides a multi-field form for users to reach out to the team, with validation and feedback mechanisms.
 * @note Implements OnPush change detection and uses signals for efficient UI state management during asynchronous operations.
 */
@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactComponent implements OnInit, OnDestroy {

  contactForm!: FormGroup;
  isSubmitted = signal(false);
  isLoading   = signal(false);
  selectedFile: File | null = null;

  /** Translation object container */
  f: any = null;

  /** Global site configuration (contact data, links) */
  settings: any    = null;
  socialLinks: any[] = [];

  /** Aggregated statistics displayed in the contact view */
  stats: { value: string; label: string }[] = [];

  private destroy$ = new Web.Subject<void>();

  constructor(
    private fb:                  FormBuilder,
    private cdr:                 ChangeDetectorRef,
    private dataService:         PublicDataService,
    private localizationService: Web.LocalizationService,
  ) {}

  /**
   * @description Lifecycle hook that initializes translation subscriptions and fetches site configuration from the API.
   */
  ngOnInit(): void {
    // Localization: Subscribes to translation updates to sync static text and stats
    this.localizationService.currentTranslations$
      .pipe(Web.takeUntil(this.destroy$))
      .subscribe(translations => {
        if (translations?.contact) {
          this.f = translations.contact;

          // Aggregates home statistics for the contact page display
          const h = translations.home;
          if (h) {
            this.stats = [
              { value: h.stats_projects_count, label: h.stats_projects_text },
              { value: h.stats_years_count,    label: h.stats_years_text    },
              { value: h.stats_solutions_count, label: h.stats_solutions_text },
            ];
          }

          this.cdr.markForCheck();
        }
      });

    // Site Settings: Loads dynamic contact info and social media profile references
    this.dataService.getSiteSettings()
      .pipe(Web.takeUntil(this.destroy$))
      .subscribe(res => {
        this.settings    = res.settings;
        this.socialLinks = res.social_links;
        this.cdr.markForCheck();
      });

    this.initForm();
  }

  /**
   * @description Performs cleanup on component destruction, closing active RxJS subscriptions.
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * @description Constructs the contact form with standard validators.
   */
  private initForm(): void {
    this.contactForm = this.fb.group({
      subject: ['web', Validators.required],
      email:   ['', [Validators.required, Validators.email]],
      phone:   [''],
      message: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(10000)]],
      gdpr:    [false, Validators.requiredTrue],
    });
  }

  /**
   * @description Dynamically selects button text based on submission state and current translations.
   */
  get btnText(): string {
    if (!this.f) return '...';
    return this.isLoading() ? this.f.buttons.sending : this.f.buttons.send;
  }

  /**
   * @description Resolves storage asset URLs.
   * @param path The relative path to the asset.
   */
  getIconUrl(path: string): string {
    return this.dataService.getStorageUrl(path);
  }

  /**
   * @description Handles file input changes, enforcing a 10MB size limit.
   * @param event The DOM event from the file input.
   */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      const file = input.files[0];
      if (file.size > 10 * 1024 * 1024) {
        alert(this.f?.errors?.file_too_large ?? 'File too large. Max 10 MB.');
        return;
      }
      this.selectedFile = file;
      this.cdr.markForCheck();
    }
  }

  /**
   * @description Resets the currently selected file attachment.
   */
  removeFile(): void {
    this.selectedFile = null;
    this.cdr.markForCheck();
  }

  /**
   * @description Processes form data and submits it via FormData to support file uploads.
   */
  onSubmit(): void {
    if (this.contactForm.invalid || this.isLoading()) return;

    this.isLoading.set(true);
    this.cdr.markForCheck();

    const formData   = new FormData();
    const formValues = this.contactForm.value;

    formData.append('thema',             formValues.subject);
    formData.append('contact_email',     formValues.email);
    formData.append('contact_phone',     formValues.phone || '');
    formData.append('order_description', formValues.message);

    if (this.selectedFile) {
      formData.append('attachment', this.selectedFile, this.selectedFile.name);
    }

    this.dataService.postRawRequestCommission(formData)
      .pipe(
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
          console.error('Error submitting contact form:', err);
          const msg = err.error?.message || this.f?.errors?.submit_error || 'Submission failed.';
          alert(msg);
        },
      });
  }

  get fc() { return this.contactForm.controls; }

  /**
   * @description Checks if a specific form field has validation errors that should be displayed.
   * @param name The name of the form control.
   */
  fieldInvalid(name: string): boolean {
    const ctrl = this.contactForm.get(name);
    return !!(ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched));
  }
}