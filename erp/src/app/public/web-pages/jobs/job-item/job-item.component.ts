/**
 * @file job-item.component.ts
 * @path src/app/pages/jobs/job-item/job-item.component.ts
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Handles the specific job application page, managing the application form, file attachments, and data submission.
 * @dependencies
 * - BaseDataComponent: Extends core functionality for handling API communication and state.
 * - ReactiveFormsModule: Manages form group validation and state.
 * - PublicDataService/LocalizationService: Provides configuration and localized content.
 */

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

/**
 * @description Component for displaying a single job posting and its associated application form.
 * @usage Used for candidates to review job details and upload their CV.
 * @note Extends BaseDataComponent to leverage shared administrative data handling patterns while maintaining public-facing logic.
 */
@Component({
  selector: 'app-job-item',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './job-item.component.html',
  styleUrl: './job-item.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class JobItemComponent extends BaseDataComponent<any> implements OnInit, OnDestroy {
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

  /**
   * @description Initializes form controls and subscribes to translation/settings streams.
   */
  override ngOnInit(): void {
    this.initForm();

    this.publicDataService.getSiteSettings()
      .pipe(takeUntil(this.destroy$))
      .subscribe(res => {
        this.settings = res.settings;
        this.cd.markForCheck();
      });

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

  /**
   * @description Sets up the application form structure with validation.
   */
  private initForm(): void {
    this.applicationForm = this.fb.group({
      first_name:              ['', Validators.required],
      last_name:               ['', Validators.required],
      email:                   ['', [Validators.required, Validators.email]],
      phone:                   [''],
      message:                 [''],
      dataProcessingAgreement: [false, Validators.requiredTrue]
    });
  }

  /**
   * @description Captures file selection from the DOM input.
   * @param event File input event.
   */
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      this.cd.markForCheck();
    }
  }

  /**
   * @description Prepares form data and submits the application via Multipart/Form-Data.
   */
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

    this.uploadData<any>(formData).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        this.isSubmitted = true;
        this.cd.markForCheck();
      },
      error: () => {
        this.errorMessage = this.t?.form_error_generic ?? 'An error occurred. Please try again.';
        this.cd.markForCheck();
      }
    });
  }

  /**
   * @description Extracts job-specific content from translation keys based on route parameters.
   */
  private loadJobData(): void {
    const jobId = this.route.snapshot.paramMap.get('id');
    if (jobId && this.t[jobId]) {
      this.job = {
        title:       this.t[jobId].title,
        fullContent: this.t[jobId].content
      };
    }
  }
}