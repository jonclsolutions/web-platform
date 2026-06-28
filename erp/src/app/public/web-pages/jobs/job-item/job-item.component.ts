import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy, inject } from '@angular/core';
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

@Component({
  selector: 'app-job-item',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './job-item.component.html',
  styleUrl: './job-item.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class JobItemComponent extends BaseDataComponent<any> implements OnInit, OnDestroy {
  // Přímý přístup k loading službě pro HTML šablonu
  public override loadingService = inject(LoadingService);
  
  override apiEndpoint: string = 'job_applications';
  
  applicationForm!: FormGroup;
  job: any = null;
  t: any = null; 
  settings: any = null;
  isSubmitted = false;
  selectedFile: File | null = null;

  constructor(
    protected override dataHandler: DataHandler,
    protected override cd: ChangeDetectorRef,
    protected override genericTableService: GenericTableService, 
    private route: ActivatedRoute,
    private fb: FormBuilder,
    private localizationService: LocalizationService,
    private publicDataService: PublicDataService
  ) {
    super(dataHandler, cd, genericTableService);
  }
  override ngOnInit(): void {
    this.initForm();
    
    // Načtení nastavení webu pro dynamické kontakty
    this.publicDataService.getSiteSettings()
      .pipe(takeUntil(this.destroy$))
      .subscribe(res => {
        this.settings = res.settings;
        this.cd.markForCheck();
      });

    this.localizationService.currentTranslations$
      .pipe(takeUntil(this.destroy$))
      .subscribe(translations => {
        if (translations?.job_detail) {
          this.t = translations.job_detail;
          this.loadJobData();
          this.cd.markForCheck();
        }
      });
  }

  private initForm(): void {
    this.applicationForm = this.fb.group({
      first_name: ['', Validators.required],
      last_name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      message: [''],
      dataProcessingAgreement: [false, Validators.requiredTrue]
    });
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      this.cd.markForCheck();
    }
  }

  onSubmit(): void {
    if (this.applicationForm.invalid || !this.selectedFile) {
      this.applicationForm.markAllAsTouched();
      return;
    }

    this.errorMessage = null;

    const formData = new FormData();
    Object.keys(this.applicationForm.value).forEach(key => {
      const value = this.applicationForm.value[key];
      if (value !== null && value !== undefined) {
        const finalValue = key === 'dataProcessingAgreement' ? (value ? '1' : '0') : value;
        formData.append(key, finalValue);
      }
    });

    if (this.job) formData.append('position_name', this.job.title);
    formData.append('cv_file', this.selectedFile, this.selectedFile.name);

    // Interceptor automaticky spustí globální loading
    this.uploadData<any>(formData).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        this.isSubmitted = true;
        this.cd.markForCheck();
      },
      error: (err) => {
        this.errorMessage = 'Omlouváme se, přihlášku se nepodařilo odeslat. Zkuste to prosím později.';
        this.cd.markForCheck();
      }
    });
  }

  private loadJobData(): void {
    const jobId = this.route.snapshot.paramMap.get('id');
    if (jobId && this.t[jobId]) {
      this.job = { 
        title: this.t[jobId].title, 
        fullContent: this.t[jobId].content 
      };
    }
  }
}