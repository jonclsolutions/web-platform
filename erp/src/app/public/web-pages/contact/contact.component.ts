// public contact
/**
 * @refactor-note (2026-08) `selectedFile: File | null` (jeden soubor) nahrazeno
 * `selectedFiles: File[]` (max 10, viz StoreWebRawRequestCommissionRequest) -
 * `onFileSelected()`/`removeFile()` (vlastní klientská validace) nahrazeny
 * `onFilesChanged()`, napojeno na sdílenou `MultiFileUploadComponent`, která si klientský
 * limit hlídá sama. FormData teď posílá `attachments[]` (pole) místo `attachment`.
 * @refactor-note (2026-08-19) BACKLOG "real-time validace jako order-form": pole `phone`
 * dřív nemělo ŽÁDNÝ validátor (`phone: ['']`), takže telefon s písmeny/diakritikou
 * formulář v UI vůbec neoznačil jako chybný - jediná kontrola byla implicitní na
 * backendu (`StoreWebRawRequestCommissionRequest`), bez jakékoliv zpětné vazby v
 * reálném čase. Přidán `Validators.pattern('^\\+?[0-9 ]*$')` +
 * `Validators.maxLength(20)`, jaký už používá `order-form.component.ts` na
 * `client_phone`. Šablona (contact.component.html) teď stejně jako u email/message polí
 * zvýrazní pole červeně a zobrazí chybovou hlášku přes existující `fieldInvalid()`
 * helper.
 * @bugfix-note (2026-08-19v2) Původní regex `^\\+?[0-9]*$` NEPOVOLOVAL mezery, takže i
 * validní formát ve stylu placeholderu ("+420 123 456 789") padal na chybu - opraveno
 * na `^\\+?[0-9 ]*$` (číslice i mezery povoleny, `+` jen na začátku). Stejná oprava
 * provedena i v order-form.component.ts, který měl identický regex/stejnou chybu.
 * @refactor-note (2026-08-19v3) BACKLOG "editovatelný obsah potvrzovacího e-mailu":
 * formulář teď posílá i `lang` (aktuální jazyk veřejné stránky v okamžiku odeslání,
 * viz `BasePublicComponent.currentLanguage$`) - backend (`WebRawRequestCommission::lang`)
 * podle něj vybere odpovídající jazykovou variantu potvrzovacího e-mailu
 * (nadpis/úvod/závěr), viz `App\Support\Mail\RawRequestEmailTemplate`. Jazyk se
 * zachytává JEDNOU při inicializaci komponenty (`onInit()`), ne až při submitu -
 * `currentLanguage$` je observable, potřebujeme lokální snapshot hodnoty k FormData.
 */
import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BasePublicComponent } from '../../base-public.component';
import { MultiFileUploadComponent } from '../../../shared/components/multi-file-upload/multi-file-upload.component';
import * as Web from '../../../shared/imports/web-providers';

@Component({
selector: 'app-contact',
standalone: true,
imports: [CommonModule, RouterModule, ReactiveFormsModule, MultiFileUploadComponent],
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
selectedFiles: File[] = [];
stats: { value: string; label: string }[] = [];

/** Aktuální jazyk veřejné stránky v okamžiku načtení formuláře - viz refactor-note. */
currentLang = 'cz';

constructor(private fb: FormBuilder) {
super();
  }

// Hook volaný po inicializaci v bázi
protected override onInit(): void {
this.initForm();
this.currentLanguage$
      .pipe(Web.takeUntil(this.destroy$))
      .subscribe(lang => { this.currentLang = lang; });
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
phone: ['', [Validators.pattern('^\\+?[0-9 ]*$'), Validators.maxLength(20)]],
message: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(10000)]],
gdpr: [false, Validators.requiredTrue],
    });
  }

get btnText(): string {
if (!this.t) return '...';
return this.isLoading() ? this.t.buttons.sending : this.t.buttons.send;
  }

/**
   * @description Přijímá aktuální seznam souborů z MultiFileUploadComponent. Komponenta
   * sama hlídá klientský limit (10 souborů / 20 MB / 50 MB celkem) - jde jen o UX
   * pomůcku, skutečnou hranici vždy vynucuje backend (StoreWebRawRequestCommissionRequest).
   */
onFilesChanged(files: File[]): void {
this.selectedFiles = files;
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
formData.append('lang', this.currentLang);

this.selectedFiles.forEach(file => {
formData.append('attachments[]', file, file.name);
    });

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

// get emailHref(): string {
//   return 'mailto:' + (this.settings?.contact_email ?? '');
// }

// get phoneHref(): string {
//   return 'tel:' + (this.settings?.contact_phone?.replace(/\s/g, '') ?? '');
// }
}