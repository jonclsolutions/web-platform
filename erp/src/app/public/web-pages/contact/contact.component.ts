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

  readonly info = {
    email:   'info@studio.cz',
    phone:   '+420 123 456 789',
    address: 'Václavské náměstí 1\n110 00 Praha 1',
    hours:   'Po–Pá  9:00 – 18:00',
    linkedin: 'https://linkedin.com',
    github:   'https://github.com',
    twitter:  'https://twitter.com',
  };

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
      message: ['', [Validators.required, Validators.minLength(10)]],
      gdpr:    [false, Validators.requiredTrue],
    });
  }

  ngOnDestroy(): void {}

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

    // Mapování formuláře na klíče očekávané backendem
    formData.append('thema', formValues.subject);
    formData.append('contact_email', formValues.email);
    formData.append('contact_phone', formValues.phone || '');
    formData.append('order_description', formValues.message);

    if (this.selectedFile) {
      formData.append('attachment', this.selectedFile);
    }

    // Logování dat před odesláním
    console.log('--- ODESÍLANÁ DATA NA SERVER ---');
    formData.forEach((value, key) => {
      console.log(`${key}:`, value);
    });

    this.dataService.postRawRequestCommission(formData).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.isSubmitted.set(true);
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Chyba při odesílání formuláře:', err);
        // Zobrazení detailů validace z backendu, pokud jsou dostupné
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