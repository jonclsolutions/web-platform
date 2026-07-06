/**
 * @file personal-info.component.ts
 * @path src/app/admin/pages/personal-info/personal-info.component.ts
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Manages user profile information and security settings, specifically handling password updates.
 * @dependencies
 * - BaseDataComponent: Provides base CRUD logic for user data retrieval.
 * - ReactiveFormsModule: Enables form group management and validation for password change inputs.
 * - AuthService: Used to identify the currently authenticated user for profile requests.
 */

import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { DataHandler } from '../../../core/services/data-handler.service';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import { AuthService } from '../../../core/auth/auth.service';
import { AlertDialogService } from '../../../core/services/alert-dialog.service';
import { UserLogin } from '../../../shared/interfaces/user';
import { GenericTableService } from '../../../core/services/generic-table.service'; 

/**
 * @description Component for managing authenticated user profile and security credentials.
 * @usage Provides a UI to view personal user details and a form to securely update the account password.
 * @note Uses custom cross-field validation to ensure password confirmation matches the new password.
 */
@Component({
  selector: 'app-personal-info',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule
  ],
  templateUrl: './personal-info.component.html',
  styleUrl: './personal-info.component.css'
})
export class PersonalInfoComponent extends BaseDataComponent<UserLogin> implements OnInit, OnDestroy {
  passwordForm: FormGroup;
  override apiEndpoint = 'core/users'; 
  userData: UserLogin | null = null;

  constructor(
    protected override dataHandler: DataHandler,
    protected override cd: ChangeDetectorRef,
    protected override genericTableService: GenericTableService, 
    private fb: FormBuilder,
  ) {
    super(dataHandler, cd, genericTableService);

    this.passwordForm = this.fb.group({
      old_password: ['', [Validators.required]],
      new_password: ['', [Validators.required, Validators.minLength(8)]],
      new_password_confirmation: ['', [Validators.required]]
    }, {
      validator: this.passwordsMatchValidator
    });
  }

  override ngOnInit(): void {
    super.ngOnInit(); 
    this.loadCurrentUserData();
  }

  /**
   * @description Retrieves the current user's details from the server using the active session ID.
   */
  private loadCurrentUserData(): void {
    const userId = this.authService.getUserId();
    if (userId) {
      // Žádné isLoading = true; Interceptor to vyřeší
      this.getItemDetails(parseInt(userId, 10))
        .subscribe({
          next: (data: UserLogin) => { 
            this.userData = data;
            this.cd.markForCheck();
          },
          error: (err) => {
            console.error('Chyba při načítání dat uživatele:', err);
          }
        });
    }
  }

  /**
   * @description Validator that compares the new password and confirmation fields.
   * @param group The FormGroup containing the password fields.
   * @returns Null if passwords match, or a validation error object.
   */
  private passwordsMatchValidator(group: FormGroup): { [key: string]: any } | null {
    const newPassword = group.get('new_password');
    const newPasswordConfirmation = group.get('new_password_confirmation');
    if (!newPassword || !newPasswordConfirmation) return null;

    if (newPassword.value !== newPasswordConfirmation.value) {
      newPasswordConfirmation.setErrors({ passwordsNotMatching: true });
      return { passwordsNotMatching: true };
    } else {
      newPasswordConfirmation.setErrors(null);
      return null;
    }
  }

  /**
   * @description Submits the password change request to the server if form validation passes.
   */
  onSubmit(): void {
    if (this.passwordForm.invalid) return;

    const userId = this.authService.getUserId();
    if (!userId) return;

    const passwordData = {
      old_password: this.passwordForm.get('old_password')?.value,
      new_password: this.passwordForm.get('new_password')?.value,
      new_password_confirmation: this.passwordForm.get('new_password_confirmation')?.value,
    };

    this.updatePassword(parseInt(userId, 10), passwordData)
      .subscribe({
        next: () => {
          this.passwordForm.reset();
          this.alertDialogService.open('Změna hesla', 'Heslo bylo úspěšně změněno.', 'success');
          this.errorMessage = null;
        },
        error: (err) => {
          this.errorMessage = 'Chyba při změně hesla. Zkontrolujte prosím původní heslo.';
          this.cd.markForCheck();
        }
      });
  }
}