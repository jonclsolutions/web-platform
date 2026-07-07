/**
 * @file support-form.component.ts
 * @path src/app/admin/pages/support/support-form/support-form.component.ts
 * @project RPSW Web
 * @author RPSW
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
import { LoadingService } from '../../../../../core/services/loading.service';

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
  /** * @description Global service to track and display loading states during API interactions. */
  public override loadingService = inject(LoadingService);
  
  override apiEndpoint: string = 'web/support_tickets';
  
  supportForm!: FormGroup;
  isSubmitted = false;
  selectedFile: File | null = null;
  lastTicketId: number | null = null;

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
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      this.cd.markForCheck();
    }
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