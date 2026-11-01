/**
 * @file personal-info.component.ts
 * @path src/app/admin/core-pages/personal-info/personal-info.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Manages user profile information and security settings, specifically handling
 * password updates and the self-service 2FA toggle.
 * @note Three effective 2FA states: (a) the admin / sysadmin role always enforces it; (b) a
 * sysadmin personally enforced `two_fa_forced_by_admin`; (c) the ordinary self-service toggle.
 * The checkbox is disabled in both enforced states (a) + (b).
 */

import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { EntityCrudService } from '../../../core/services/entitiy-crud.service';
import { DataHandler } from '../../../core/services/data-handler.service';
import { AuthService } from '../../../core/auth/auth.service';
import { AlertDialogService } from '../../../core/services/alert-dialog.service';
import { CurrentUserProfileService } from '../../../core/services/current-user-profile.service';
import { UserLogin } from '../../../shared/interfaces/user';
import { LoadingService } from '../../../core/services/loading.service';
import { passwordPolicyValidator } from '../../../shared/constants/password-policy';
import { PasswordRequirementsChecklistComponent } from '../../../shared/components/password-requirements-checklist/password-requirements-checklist.component';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';

const FORCED_2FA_ROLES = ['sysadmin'];

@Component({
  selector: 'app-personal-info',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    PasswordRequirementsChecklistComponent,
  ],
  templateUrl: './personal-info.component.html',
  styleUrl: './personal-info.component.css'
})
export class PersonalInfoComponent implements OnInit, OnDestroy {
  passwordForm: FormGroup;
  userData: UserLogin | null = null;
  errorMessage: string | null = null;

  showPasswordPopup = false;

  enable2faValue = false;
  isSaving2fa = false;

  public readonly loadingService = inject(LoadingService);
  public readonly i18n = inject(AdminLocalizationService);

  private readonly authService = inject(AuthService);
  public readonly alertDialogService = inject(AlertDialogService);
  private readonly profileService = inject(CurrentUserProfileService);

  private destroy$ = new Subject<void>();

  private crud: EntityCrudService<UserLogin>;

  constructor(
    private dataHandler: DataHandler,
    private cd: ChangeDetectorRef,
    private fb: FormBuilder,
  ) {
    this.passwordForm = this.fb.group({
      old_password: ['', [Validators.required]],
      // Unicode rules of the API (finding #37) - was Validators.pattern(PASSWORD_PATTERN), ASCII only.
      new_password: ['', [Validators.required, passwordPolicyValidator()]],
      new_password_confirmation: ['', [Validators.required]]
    }, {
      validators: [this.passwordsMatchValidator]
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
   * @description Merged `shared` + `personal-info` i18n section - same pattern as
   * `BaseDataComponent.strings`, replicated manually because this component does not extend
   * `BaseDataComponent`.
   * @note Type `any` on purpose - see the same note on
   * `AdminLocalizationService.getMergedSection()`.
   */
  get strings(): any {
    return this.i18n.getMergedSection('personal-info');
  }

  t(key: string): string {
    return this.i18n.getValue(`personal-info.${key}`);
  }

  private loadCurrentUserData(): void {
    this.profileService.getProfile()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data: any) => {
          this.userData = data;
          this.enable2faValue = !!data.enable_2fa;
          this.cd.markForCheck();
        },
        error: (err) => {
          console.error('Chyba při načítání dat uživatele:', err);
        }
      });
  }

  get isRoleForced2fa(): boolean {
    const roleName = (this.userData as any)?.roles?.[0]?.role_name;
    return FORCED_2FA_ROLES.includes(roleName);
  }

  get isAdminForced2fa(): boolean {
    return !!(this.userData as any)?.two_fa_forced_by_admin;
  }

  get isForced2fa(): boolean {
    return this.isRoleForced2fa || this.isAdminForced2fa;
  }

  get userRoleName(): string | null {
    return (this.userData as any)?.roles?.[0]?.role_name ?? null;
  }

  get security2faStatusMessage(): string {
    if (this.isRoleForced2fa) {
      return this.t('security_2fa_role_forced').replace('{role}', this.userRoleName ?? '');
    }
    if (this.isAdminForced2fa) {
      return this.t('security_2fa_admin_forced');
    }
    return this.enable2faValue
      ? this.t('security_2fa_enabled')
      : this.t('security_2fa_disabled');
  }

  get security2faStatusType(): 'forced' | 'enabled' | 'disabled' {
    if (this.isForced2fa) return 'forced';
    return this.enable2faValue ? 'enabled' : 'disabled';
  }

  onToggle2fa(): void {
    if (this.isForced2fa || this.isSaving2fa) return;

    const userId = this.authService.getUserId();
    if (!userId) return;

    const newValue = !this.enable2faValue;
    this.isSaving2fa = true;

    this.dataHandler.put(`core/users/${userId}`, { enable_2fa: newValue })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.enable2faValue = newValue;
          this.isSaving2fa = false;
          this.profileService.invalidate();
          this.cd.markForCheck();
        },
        error: () => {
          this.isSaving2fa = false;
          this.cd.markForCheck();
        }
      });
  }

  openPasswordPopup(): void {
    this.passwordForm.reset();
    this.errorMessage = null;
    this.showPasswordPopup = true;
    this.cd.markForCheck();
  }

  closePasswordPopup(): void {
    this.showPasswordPopup = false;
    this.cd.markForCheck();
  }

  onOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closePasswordPopup();
    }
  }

  private passwordsMatchValidator(group: AbstractControl): ValidationErrors | null {
    const newPassword = group.get('new_password')?.value;
    const confirmation = group.get('new_password_confirmation')?.value;
    if (!confirmation) return null;
    return newPassword === confirmation ? null : { passwordsNotMatching: true };
  }

  get passwordMismatch(): boolean {
    return !!this.passwordForm.errors?.['passwordsNotMatching'];
  }

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
          this.showPasswordPopup = false;
          this.profileService.invalidate();
          this.alertDialogService.open(this.t('password_change_success_title'), this.t('password_change_success_message'), 'success');
          this.errorMessage = null;
          this.cd.markForCheck();
        },
        error: () => {
          this.errorMessage = this.t('password_change_error');
          this.cd.markForCheck();
        }
      });
  }

get effective2faChecked(): boolean {
  return this.isForced2fa || this.enable2faValue;
}
}