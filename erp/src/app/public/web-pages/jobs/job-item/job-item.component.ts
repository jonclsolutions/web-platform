import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { takeUntil } from 'rxjs/operators';
import { BaseDataComponent } from '../../../../admin/components/base-data/base-data.component';
import { DataHandler } from '../../../../core/services/data-handler.service';
import { GenericTableService } from '../../../../core/services/generic-table.service';
import { LocalizationService } from '../../../../shared/services/localization.service';
import { LoadingService } from '../../../../core/services/loading.service';
import { PublicDataService } from '../../../../shared/services/public-data.service';

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
  styleUrl: './job-item.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class JobItemComponent extends BaseDataComponent<any> implements OnInit {
  public override loadingService = inject(LoadingService);
  // Endpoint pro PublicDataService
  override apiEndpoint: string = 'job_applications';

  applicationForm!: FormGroup;
  job: any = null;
  t: any = null;
  settings: any = null;
  isSubmitted = false;
  selectedFile: File | null = null;
  /** Nastaveno, pokud uživatel vybere soubor přes limit MAX_FILE_SIZE_BYTES. */
  fileSizeError = false;

  private localizationService = inject(LocalizationService);
  private publicDataService = inject(PublicDataService);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);

  constructor(
    protected override dataHandler: DataHandler,
    protected override cd: ChangeDetectorRef,
    protected override genericTableService: GenericTableService
  ) {
    super(dataHandler, cd, genericTableService);
  }

  override ngOnInit(): void {
    super.ngOnInit(); 
    this.initForm();
    this.loadPublicData();
  }

  private loadPublicData(): void {
    this.publicDataService.get<{settings: any}>('public/legal/config')
      .pipe(takeUntil(this.destroy$))
      .subscribe(res => { this.settings = res.settings; this.cd.markForCheck(); });

    this.localizationService.currentTranslations$
      .pipe(takeUntil(this.destroy$))
      .subscribe(translations => {
        if (translations?.jobs) {
          this.t = translations.jobs;
          this.loadJobData();
          this.cd.markForCheck();
        }
      });
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
      this.cd.markForCheck();
      return;
    }

    this.fileSizeError = false;
    this.selectedFile = file;
    this.cd.markForCheck();
  }

  // ZDE POUŽÍVÁME PUBLIC DATA SERVICE MÍSTO BASEDATACOMPONENT
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
          this.cd.markForCheck();
        },
        error: (err) => {
          this.errorMessage = err.error?.message || this.t?.form_error_generic || 'Error';
          this.loadingService.hide();
          this.cd.markForCheck();
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