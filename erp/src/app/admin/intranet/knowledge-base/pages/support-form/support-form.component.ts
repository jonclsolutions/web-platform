/**
 * @file support-form.component.ts
 * @path src/app/admin/intranet/knowledge-base/pages/support/support-form/support-form.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description A reactive form component enabling users to submit support tickets with optional file attachments.
 * @dependencies
 * - BaseDataComponent: Inherits standard API interaction methods.
 * - ReactiveFormsModule: Provides the form builder and validation infrastructure.
 * - LoadingService: Observes and propagates global loading states.
 */

import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BaseDataComponent } from '../../../../components/base-data/base-data.component';
import { DataHandler } from '../../../../../core/services/data-handler.service';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { GenericTableService } from '../../../../../core/services/generic-table.service';
import { UploadRulesService } from '../../../../../shared/services/upload-rules.service';
import { UploadRule, extensionsLabel, fileExtension, isExtensionAllowed } from '../../../../../shared/utils/upload-rules';
import { takeUntil } from 'rxjs/operators';

/**
 * @description Handles the creation of support tickets, including multi-part data handling for file uploads.
 * @usage Used by administrative users to report technical issues or request assistance.
 * @note Leverages FormData to support file attachments and utilizes Reactive Forms for robust validation.
 */
@Component({
  selector: 'app-support-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './support-form.component.html',
  styleUrl: './support-form.component.css',
})
export class SupportFormComponent extends BaseDataComponent<any> implements OnInit {
  
  override apiEndpoint: string = 'web/support_tickets';
  protected override translationSection: string = 'kb-support-form';

  public override t(key: string): string {
    return this.i18n.getValue(`kb-support-form.${key}`);
  }
  
  supportForm!: FormGroup;
  isSubmitted = false;
  selectedFile: File | null = null;
  lastTicketId: number | null = null;
  /** Attachment rules of the API (profile support_ticket) - null until loaded / when unavailable. */
  attachmentRules: UploadRule | null = null;
  /** Error of a refused file (type or size), shown under the file field. */
  fileError: string | null = null;
  private uploadRules = inject(UploadRulesService);

  constructor(
    protected override dataHandler: DataHandler,
    protected override cd: ChangeDetectorRef,
    protected override genericTableService: GenericTableService, 
    private fb: FormBuilder
  ) {
    super(dataHandler, cd, genericTableService);
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.initForm();
    this.uploadRules.rules('support_ticket')
      .pipe(takeUntil(this.destroy$))
      .subscribe(rules => { this.attachmentRules = rules; this.cd.markForCheck(); });
  }


  /** @description "Allowed types: …, max. N MB" appended to a type error ('' while no rules are known). */
  get allowedTypesText(): string {
    const r = this.attachmentRules;
    return r ? this.t('allowed_types_hint').replace('{types}', extensionsLabel(r.extensions)).replace('{maxMb}', String(r.max_file_size_mb)) : '';
  }

  /**
   * @description Initializes the support request form with default values and required validators.
   */
  initForm(): void {
    this.supportForm = this.fb.group({
      category: ['it', Validators.required],
      priority: ['medium', Validators.required],
      subject: ['', Validators.required],
      description: ['', Validators.required]
    });
  }

  /**
   * @description Handles file selection events from the input element.
   * @param event Native browser event containing the selected file.
   */
  onFileSelected(event: any): void {
    const file: File | undefined = event.target.files[0];
    this.fileError = null;
    if (!file) return;

    const rules = this.attachmentRules;
    if (!isExtensionAllowed(file.name, rules?.extensions ?? [])) {
      const ext = fileExtension(file.name);
      // The allowed types are listed only now, together with the refusal (not up front)
      // (a type error needs a non-empty list, so the types text is never empty here).
      this.fileError = this.t('file_type_error').replace('{filename}', file.name).replace('{ext}', ext ? '.' + ext : '?')
        + ' ' + this.allowedTypesText;
    } else if (rules && file.size > rules.max_file_size_mb * 1024 * 1024) {
      this.fileError = this.t('file_size_error').replace('{filename}', file.name).replace('{maxMb}', String(rules.max_file_size_mb));
    }
    if (this.fileError) {
      // A refused file is never kept - the ticket cannot be sent with it.
      this.selectedFile = null;
      event.target.value = '';
    } else {
      this.selectedFile = file;
    }
    this.cd.markForCheck();
  }


  /**
   * @description Sanitizes form inputs, packages them into FormData, and dispatches the request to the API.
   */
  onSubmit(): void {
    if (this.supportForm.valid) {
      const formData = new FormData();
      Object.keys(this.supportForm.value).forEach(key => {
        formData.append(key, this.supportForm.value[key]);
      });

      if (this.selectedFile) {
        formData.append('attachment', this.selectedFile, this.selectedFile.name);
      }

      this.uploadData<any>(formData).subscribe({
        next: (response: any) => { 
          this.isSubmitted = true;
          this.lastTicketId = response.id;
          this.cd.markForCheck();
        },
        error: (err: any) => {
          console.error('Error submitting support ticket:', err);
          this.cd.markForCheck();
        }
      });
    }
  }
}