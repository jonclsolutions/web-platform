/**
 * @file personal-info.component.ts
 * @path src/app/admin/web-pages/personal-info/personal-info.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Manages user profile information and security settings, specifically handling
 * password updates.
 *
 * @refactor-note (2025) Dříve dědil z BaseDataComponent jen kvůli `getItemDetails()` a
 * `updatePassword()` — čímž si zbytečně vláčel celý paginační/koš/cache aparát, který
 * vůbec nepoužíval. Nyní si skládá `EntityCrudService` přímo (stejnou třídu, na kterou
 * i BaseDataComponent interně deleguje) — je to jediné, co tato komponenta potřebuje.
 *
 * @dependencies
 * - EntityCrudService: Jednotlivé CRUD volání (getOne, updatePassword) pro endpoint 'core/users'.
 * - ReactiveFormsModule: Enables form group management and validation for password change inputs.
 * - AuthService: Used to identify the currently authenticated user for profile requests.
 */

import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { EntityCrudService } from '../../../core/services/entitiy-crud.service';
import { DataHandler } from '../../../core/services/data-handler.service';
import { AuthService } from '../../../core/auth/auth.service';
import { AlertDialogService } from '../../../core/services/alert-dialog.service';
import { UserLogin } from '../../../shared/interfaces/user';
import { LoadingService } from '../../../core/services/loading.service'; // Uprav dle cesty
/**
 * @description Component for managing authenticated user profile and security credentials.
 * @usage Provides a UI to view personal user details and a form to securely update the account
 * password.
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
export class PersonalInfoComponent implements OnInit, OnDestroy {
  passwordForm: FormGroup;
  userData: UserLogin | null = null;
  errorMessage: string | null = null;

  public readonly loadingService = inject(LoadingService);

  private readonly authService = inject(AuthService);
  public readonly alertDialogService = inject(AlertDialogService);

  private destroy$ = new Subject<void>();

  /** Sestaveno až v těle konstruktoru (ne jako property initializer) —
   *  parametry konstruktoru (`dataHandler`, `cd`) jsou v JS/TS přiřazeny AŽ PO
   *  doběhnutí property initializerů, takže by v initializeru byly ještě undefined. */
  private crud: EntityCrudService<UserLogin>;

  constructor(
    private dataHandler: DataHandler,
    private cd: ChangeDetectorRef,
    private fb: FormBuilder,
  ) {
    this.passwordForm = this.fb.group({
      old_password: ['', [Validators.required]],
      new_password: ['', [Validators.required, Validators.minLength(8)]],
      new_password_confirmation: ['', [Validators.required]]
    }, {
      validator: this.passwordsMatchValidator
    });

    this.crud = new EntityCrudService<UserLogin>(
      this.dataHandler,
      () => 'core/users',
      this.destroy$,
      () => this.cd.markForCheck()
    );
  }

  ngOnInit(): void {
    this.loadCurrentUserData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * @description Retrieves the current user's details from the server using the active session ID.
   */
  private loadCurrentUserData(): void {
    const userId = this.authService.getUserId();
    if (!userId) return;

    this.crud.getOne(parseInt(userId, 10))
      .pipe(takeUntil(this.destroy$))
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

  /**
   * @description Validator that compares the new password and confirmation fields.
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

    this.errorMessage = null;

    this.crud.updatePassword(parseInt(userId, 10), passwordData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.passwordForm.reset();
          this.alertDialogService.open('Změna hesla', 'Heslo bylo úspěšně změněno.', 'success');
          this.errorMessage = null;
        },
        error: () => {
          this.errorMessage = 'Chyba při změně hesla. Zkontrolujte prosím původní heslo.';
          this.cd.markForCheck();
        }
      });
  }
}