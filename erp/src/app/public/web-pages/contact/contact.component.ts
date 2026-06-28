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
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

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
  
  settings: any = null;
  socialLinks: any[] = [];
  private destroy$ = new Subject<void>();

  readonly stats = [
    { value: '120+', label: 'projektů' },
    { value: '8',    label: 'let zkušeností' },
    { value: '48h',  label: 'max. odezva' },
  ];

  constructor(
    private fb:  FormBuilder,
    private cdr: ChangeDetectorRef,
    private dataService: PublicDataService
  ) {}

  ngOnInit(): void {
    this.contactForm = this.fb.group({
      subject: ['web', Validators.required],
      email:   ['', [Validators.required, Validators.email]],
      phone:   [''],
      message: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(10000)]],
      gdpr:    [false, Validators.requiredTrue],
    });

    this.dataService.getSiteSettings()
      .pipe(takeUntil(this.destroy$))
      .subscribe(res => {
        this.settings = res.settings;
        this.socialLinks = res.social_links;
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getIconUrl(path: string): string {
    return this.dataService.getStorageUrl(path);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      const file = input.files[0];
      if (file.size > 10 * 1024 * 1024) {
        alert('Soubor je příliš velký. Maximální velikost je 10 MB.');
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
    formData.append('contact_phone', formValues.phone || '');
    formData.append('order_description', formValues.message);

    if (this.selectedFile) {
      formData.append('attachment', this.selectedFile);
    }

    this.dataService.postRawRequestCommission(formData).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.isSubmitted.set(true);
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Chyba při odesílání formuláře:', err);
        const errorMsg = err.error?.message || 'Odeslání se nezdařilo.';
        alert(errorMsg);
        this.isLoading.set(false);
        this.cdr.markForCheck();
      }
    });
  }

  get f() { return this.contactForm.controls; }

  fieldInvalid(name: string): boolean {
    const ctrl = this.contactForm.get(name);
    return !!(ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched));
  }
}