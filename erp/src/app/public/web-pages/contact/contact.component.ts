import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BasePublicComponent } from '../../base-public.component';
import * as Web from '../../../shared/imports/web-providers';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactComponent extends BasePublicComponent {
  
  protected readonly translationKey = 'contact';
  protected override readonly loadSiteSettings = true;

  contactForm!: FormGroup;
  isSubmitted = signal(false);
  isLoading   = signal(false);
  selectedFile: File | null = null;
  
  stats: { value: string; label: string }[] = [];

  constructor(private fb: FormBuilder) {
    super();
  }

  // Hook volaný po inicializaci v bázi
  protected override onInit(): void {
    this.initForm();
  }

  // Hook volaný po načtení překladů
  protected override onTranslationsLoaded(translations: any): void {
    // Extrahujeme 'home' data pro statistiky, která byla původně v ngOnInit
    const h = translations.home;
    if (h) {
      this.stats = [
        { value: h.stats_projects_count, label: h.stats_projects_text },
        { value: h.stats_years_count, label: h.stats_years_text },
        { value: h.stats_solutions_count, label: h.stats_solutions_text },
      ];
    }
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
    if (!this.t) return '...';
    return this.isLoading() ? this.t.buttons.sending : this.t.buttons.send;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      const file = input.files[0];
      if (file.size > 10 * 1024 * 1024) {
        alert(this.t?.errors?.file_too_large ?? 'File too large. Max 10 MB.');
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
    if (formValues.phone?.trim()) {
      formData.append('contact_phone', formValues.phone);
    }
    formData.append('order_description', formValues.message);

    if (this.selectedFile) {
      formData.append('attachment', this.selectedFile, this.selectedFile.name);
    }

    this.publicDataService.post('raw_request_commissions', formData)
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
          const msg = err.error?.message || this.t?.errors?.submit_error || 'Submission failed.';
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