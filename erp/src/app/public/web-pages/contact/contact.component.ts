/**
 * @file contact.component.ts
 * @path src/app/public/web-pages/contact/contact.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 */

import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PublicDataService } from '../../../shared/services/public-data.service';
import * as Web from '../../../shared/imports/web-providers';

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
  f: any = null;
  settings: any = null;
  socialLinks: any[] = [];
  stats: { value: string; label: string }[] = [];
  private destroy$ = new Web.Subject<void>();

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private dataService: PublicDataService,
    private localizationService: Web.LocalizationService,
  ) {}

  ngOnInit(): void {
    this.localizationService.currentTranslations$
      .pipe(Web.takeUntil(this.destroy$))
      .subscribe(translations => {
        if (translations?.contact) {
          this.f = translations.contact;
          const h = translations.home;
          if (h) {
            this.stats = [
              { value: h.stats_projects_count, label: h.stats_projects_text },
              { value: h.stats_years_count, label: h.stats_years_text },
              { value: h.stats_solutions_count, label: h.stats_solutions_text },
            ];
          }
          this.cdr.markForCheck();
        }
      });

    this.dataService.getSiteSettings()
      .pipe(Web.takeUntil(this.destroy$))
      .subscribe(res => {
        this.settings = res.settings;
        this.socialLinks = res.social_links;
        this.cdr.markForCheck();
      });

    this.initForm();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm(): void {
    this.contactForm = this.fb.group({
      subject: ['web', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      message: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(10000)]],
      gdpr: [false, Validators.requiredTrue],
    });
  }

  get btnText(): string {
    if (!this.f) return '...';
    return this.isLoading() ? this.f.buttons.sending : this.f.buttons.send;
  }

  getIconUrl(path: string): string {
    return this.dataService.getStorageUrl(path);
  }

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

  removeFile(): void {
    this.selectedFile = null;
    this.cdr.markForCheck();
  }

  onSubmit(): void {
    if (this.contactForm.invalid || this.isLoading()) return;

    this.isLoading.set(true);
    this.cdr.markForCheck();

    const formData = new FormData();
    const formValues = this.contactForm.value;

    formData.append('thema', formValues.subject);
    formData.append('contact_email', formValues.email);
    // Prevence 422: Neposílat prázdné stringy, pokud backend vyžaduje formát
    if (formValues.phone && formValues.phone.trim() !== '') {
      formData.append('contact_phone', formValues.phone);
    }
    formData.append('order_description', formValues.message);

    if (this.selectedFile) {
      formData.append('attachment', this.selectedFile, this.selectedFile.name);
    }

    this.dataService.post('raw_request_commissions', formData)
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
          const msg = err.error?.message || this.f?.errors?.submit_error || 'Submission failed.';
          alert(msg);
        },
      });
  }

  get fc() { return this.contactForm.controls; }

  fieldInvalid(name: string): boolean {
    const ctrl = this.contactForm.get(name);
    return !!(ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched));
  }
}