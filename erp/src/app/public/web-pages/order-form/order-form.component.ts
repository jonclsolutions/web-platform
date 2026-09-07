/**
 * @file order-form.component.ts
 * @path src/app/public/web-pages/order-form/order-form.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @refactor-note (2026) Route parametr přejmenován z 'leadParam' na 'token' (viz app.routes.ts)
 *      a přestal se parsovat jako "lead_id=123" (odhalovalo to interní DB ID a strukturu -
 *      IDOR riziko). Nově je to čistý neuhodnutelný `public_token` z web_sales_leads.
 *      Komponenta při načtení zavolá GET /public/sales-leads/{token} (WebSalesLeadController::
 *      showByToken), předvyplní kontaktní pole a ošetří tři stavy: platný odkaz, neplatný
 *      odkaz (404) a už jednou použitý odkaz (410 - backend ho po odeslání invaliduje).
 *      Formulář už neposílá `lead_id` - odesílá `lead_token`, ze kterého si lead dohledá
 *      a napojí backend sám (WebSalesOrderController::store), nikdy ne podle klientem
 *      posílaného ID.
 * @refactor-note (2026-08) `selectedFile: File | null` (jeden soubor) nahrazeno
 * `selectedFiles: File[]` (max 10, viz StoreWebSalesOrderRequest) - `onFileSelected()`
 * nahrazeno `onFilesChanged()`, napojeno na sdílenou `MultiFileUploadComponent`. FormData
 * teď posílá `attachments[]` (pole) místo `attachment` (jeden soubor).
 * @bugfix-note (2026-08-19) Regex validátoru telefonu `^\+?[0-9]*$` NEPOVOLOVAL mezery,
 * takže i validní formát ve stylu vlastního placeholderu ("+420 123 456 789") padal na
 * chybu - opraveno na `^\+?[0-9 ]*$` (číslice i mezery povoleny, `+` jen na začátku).
 * Stejná oprava provedena i v contact.component.ts, který měl identický regex/stejnou chybu.
 */

import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { BasePublicComponent } from '../../base-public.component';
import { MultiFileUploadComponent } from '../../../shared/components/multi-file-upload/multi-file-upload.component';
import * as Web from '../../../shared/imports/web-providers';

/** Stav ověření odkazu podle public_token - řídí, co komponenta zobrazí. */
type LinkState = 'loading' | 'valid' | 'no-token' | 'invalid' | 'used';

/** Bezpečná podmnožina polí leadu, kterou vrací veřejný showByToken endpoint. */
interface LeadPrefill {
  id: number;
  subject_name: string | null;
  contact_person: string | null;
  contact_email: string | null;
  contact_phone: string | null;
}

@Component({
  selector: 'app-order-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterModule, MultiFileUploadComponent],
  templateUrl: './order-form.component.html',
  styleUrl: './order-form.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderFormComponent extends BasePublicComponent {

  protected readonly translationKey = 'order_form';
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);

  orderForm!: FormGroup;

  /** Čistý public_token z URL (/order_form/:token) - nikdy interní DB id. */
  token: string | null = null;
  linkState: LinkState = 'loading';
  leadPrefill: LeadPrefill | null = null;

  isSubmitted = false;
  isLoading = false;
  selectedFiles: File[] = [];
  errorMessage: string | null = null;

  // Hook volaný po základní inicializaci v bázi
  protected override onInit(): void {
    this.initForm();

    const token = this.route.snapshot.paramMap.get('token');
    this.token = token;

    if (!token) {
      // Formulář dostupný i bez tokenu (obecná poptávka mimo obchodní proces) -
      // WebSalesOrderController::store() v takovém případě vytvoří objednávku bez
      // navázání na lead, přesně jako dřív.
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
          // Backend vrací 410 pro už jednou použitý odkaz, 404 pro neplatný/neexistující.
          this.linkState = err?.status === 410 ? 'used' : 'invalid';
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

  get btnText(): string {
    if (!this.t) return '...';
    return this.isLoading ? this.t.buttons.sending : this.t.buttons.send;
  }
    /**
   * @refactor-note (2026-09) BACKLOG "vícejazyčná administrace, žádné hardcoded texty"
   * (public strana) - viz stejná poznámka v contact.component.ts.
   */
  get attachmentUploaderTexts() {
    const s = this.t?.attachment_uploader;
    if (!s) return {};
    return {
      existingSectionTitle: s.existing_section_title,
      removeExistingTitle: s.remove_existing_title,
      dropzoneLabel: s.dropzone_label,
      errorMaxFilesWithExisting: s.error_max_files_with_existing,
      errorMaxFiles: s.error_max_files,
      errorFileTooLarge: s.error_file_too_large,
      errorTotalSizeExceeded: s.error_total_size_exceeded,
      totalLabel: s.total_label,
      totalNewSuffix: s.total_new_suffix,
    };
  }

  /**
   * @description Přijímá aktuální seznam souborů z MultiFileUploadComponent. Komponenta
   * sama hlídá klientský limit (10 souborů / 20 MB / 50 MB celkem) - jde jen o UX
   * pomůcku, skutečnou hranici vždy vynucuje backend (StoreWebSalesOrderRequest).
   */
  onFilesChanged(files: File[]): void {
    this.selectedFiles = files;
  }

  onSubmit(): void {
    if (this.orderForm.invalid) return;

    this.isLoading = true;
    this.errorMessage = null;

    const formData = new FormData();
    Object.keys(this.orderForm.value).forEach(key => {
      const value = this.orderForm.value[key];
      if (value !== null && value !== undefined) {
        formData.append(key, value);
      }
    });

    // Lead se váže výhradně přes token - backend si podle něj dohledá a ověří
    // lead sám (viz WebSalesOrderController::store). Posílá se jen když existuje
    // (formulář může běžet i bez navázání na konkrétní lead).
    if (this.token) {
      formData.append('lead_token', this.token);
    }

    this.selectedFiles.forEach(file => {
      formData.append('attachments[]', file, file.name);
    });

    this.publicDataService.post("sales_orders", formData).pipe(
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
        // 410 může přijít i tady, pokud byl token použit souběžně (dvě otevřené karty) -
        // zobrazíme stejnou hlášku jako při načtení, ať uživatel ví, co se stalo.
        if (err?.status === 410) {
          this.linkState = 'used';
          this.errorMessage = null;
        } else {
          this.errorMessage = this.t?.errors?.submit_error || 'Submission error.';
        }
        console.error('Submission failed:', err);
        this.cdr.markForCheck();
      }
    });
  }
}