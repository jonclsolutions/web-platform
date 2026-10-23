/**
 * @file job-item.component.ts
 * @path src/app/public/web-pages/jobs/job-item/job-item.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Job detail page with the public application form (CV upload).
 * @refactor-note (2026-10-23) Open finding #47: the public page extended the admin
 *   `BaseDataComponent` - the public job page loaded the admin i18n JSON and admin services
 *   (DataHandler, GenericTableService, auth / permission services). It extends BasePublicComponent
 *   now (web translations `jobs`, site settings from the startup cache) like every public page.
 * @bugfix-note (2026-10-23) Open finding #44: hardcoded Czech / English fallbacks of the form
 *   errors were removed - the texts are in the `jobs` translations; the API error text (English)
 *   is no longer shown, the translated generic error is.
 * @dependencies
 * - BasePublicComponent (translations, site settings), PublicDataService (submit), LoadingService.
 */

import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { takeUntil } from 'rxjs/operators';
import { BasePublicComponent } from '../../../base-public.component';
import { LoadingService } from '../../../../core/services/loading.service';

/**
 * @description Povolené znaky pro jméno/příjmení - písmena (včetně diakritiky přes \p{L}
 *              unicode property), mezery, pomlčky a apostrofy (např. "Marie-Anne", "O'Brien").
 *              Záměrně žádné číslice - jméno s číslem je vždy chyba vstupu, ne legitimní hodnota.
 * @note Vyžaduje 'u' (unicode) flag, jinak \p{L} funguje jen jako doslovné "p", "L" apod.
 */
const NAME_PATTERN = /^[\p{L}\s'-]+$/u;

/**
 * @description Povolené znaky pro telefonní číslo - číslice, mezery, +, závorky a pomlčky
 *              (pokrývá běžné zápisy typu "+420 733 188 328", "(420) 733-188-328").
 *              Min. 6 znaků, ať projde i extrémně krátké testovací číslo, ale ne prázdné/1 znak.
 */
const PHONE_PATTERN = /^[0-9+()\s-]{6,20}$/;

/**
 * @description Maximální povolená velikost přiloženého CV v bytech - zrcadlí limit
 *              `max:20480` (20 480 KB = 20 MB) ze `StoreWebJobApplicationRequest` na
 *              backendu. Kontrola zde je jen UX pojistka (rychlá zpětná vazba bez
 *              čekání na server) - autoritativní limit zůstává vynucený na backendu.
 */
const MAX_FILE_SIZE_BYTES = 20480 * 1024;

@Component({
  selector: 'app-job-item',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
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
  job: any = null;
  isSubmitted = false;
  selectedFile: File | null = null;
  /** Nastaveno, pokud uživatel vybere soubor přes limit MAX_FILE_SIZE_BYTES. */
  fileSizeError = false;
  /** Translated error of a failed submit (null = none). */
  errorMessage: string | null = null;

  public loadingService = inject(LoadingService);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);

  /**
   * @description Builds the form (the base class loads translations and site settings).
   */
  protected override onInit(): void {
    this.initForm();
  }

  /**
   * @description Resolves the job of the route id from the `jobs` translations.
   */
  protected override onTranslationsLoaded(): void {
    this.loadJobData();
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
   * @description Zpracuje výběr souboru z file inputu a ověří jeho velikost proti
   *              MAX_FILE_SIZE_BYTES. Soubor přes limit se do selectedFile vůbec
   *              neuloží (formulář ho tedy nejde odeslat), místo toho se nastaví
   *              fileSizeError pro zobrazení chybové hlášky v šabloně.
   */
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_BYTES) {
      this.selectedFile = null;
      this.fileSizeError = true;
      event.target.value = '';
      this.cdr.markForCheck();
      return;
    }

    this.fileSizeError = false;
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
    this.publicDataService.post<any>(this.apiEndpoint, formData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.isSubmitted = true;
          this.loadingService.hide();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.errorMessage = (err?.status === 429 ? this.t?.form_too_many_requests : this.t?.form_error_generic) ?? null;
          this.loadingService.hide();
          this.cdr.markForCheck();
        }
      });
  }

  private loadJobData(): void {
    const jobId = this.route.snapshot.paramMap.get('id');
    if (jobId && this.t[jobId]) {
      this.job = { title: this.t[jobId].title, fullContent: this.t[jobId].content };
    }
  }
}