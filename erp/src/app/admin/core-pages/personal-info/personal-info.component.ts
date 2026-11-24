/**
 * @file personal-info.component.ts
 * @path src/app/admin/core-pages/personal-info/personal-info.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description My account (route core/personal-info, label "Můj účet") in three tabs - Profile:
 * the own profile photo (AvatarEditorComponent) and - for a sysadmin or an account with
 * `core-administrators-update` - the own name and login e-mail (inline fields); Security: the
 * self-service 2FA toggle and the password change; Preferences: the language of the
 * administration and the pop-up notices. The tab is in the address (`?tab=security`,
 * `?tab=preferences`; the profile without it).
 * @note Login e-mail: the API asks for the password first (step-up, handled by the
 * password-confirmation interceptor), ends the other sessions of the account and tells the old
 * and the new address; the header shows the new e-mail at once (AuthService.setUserEmail). Other
 * accounts may change only 2FA here - name and e-mail are changed by an administrator.
 * @note A changed password or login e-mail ends the other sessions of the account (API) and the
 * other tabs of this browser signed in as it (AuthService.endOtherTabs) - this tab stays.
 * @note Three effective 2FA states: (a) the admin / sysadmin role always enforces it; (b) a
 * sysadmin personally enforced `two_fa_forced_by_admin`; (c) the ordinary self-service toggle.
 * The checkbox is disabled in both enforced states (a) + (b).
 * @note The password change is a popup in the shared frame (AdminModalComponent).
 * @note Notifications: the pop-up notices of new records can be switched off here - only in this
 * browser (AdminNotificationsService.setToastsEnabled); the red numbers in the menu stay.
 * @note Language of the administration: kept in this browser (AdminLocalizationService), the
 * same choice as in the account panel of the header - not stored on the server on purpose.
 * @dependencies
 * - RowButtonBuilderComponent: the page tabs and the languages; ActivatedRoute / Router: the tab
 *   in the address.
 */

import { Component, OnInit, OnDestroy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { EntityCrudService } from '../../../core/services/entity-crud.service';
import { DataHandler } from '../../../core/services/data-handler.service';
import { AuthService } from '../../../core/auth/auth.service';
import { AlertDialogService } from '../../../core/services/alert-dialog.service';
import { CurrentUserProfileService } from '../../../core/services/current-user-profile.service';
import { UserLogin } from '../../../shared/interfaces/user';
import { LoadingService } from '../../../core/services/loading.service';
import { PASSWORD_MAX_LENGTH, fillPasswordLimits, passwordPolicyValidator } from '../../../shared/constants/password-policy';
import { PasswordRequirementsChecklistComponent } from '../../../shared/components/password-requirements-checklist/password-requirements-checklist.component';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';
import { AvatarEditorComponent } from '../../components/avatar-editor/avatar-editor.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PermissionService } from '../../../core/auth/services/permission.service';
import { SYSADMIN_ROLE_NAME } from '../../../core/auth/guards/auth.guard';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { AdminModalComponent } from '../../components/admin-modal/admin-modal.component';
import { AdminNotificationsService } from '../../../core/services/admin-notifications.service';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RowButtonBuilderComponent } from '../../components/builders/row-button-builder/row-button-builder.component';
import { RowButton, RowButtonItems, languageRowButtons } from '../../components/builders/row-button-builder/row-button';

/** Tab of My account. */
export type PersonalInfoTab = 'profile' | 'security' | 'preferences';

/** Tabs that have a parameter in the address (the profile has none). */
const ADDRESS_TABS: readonly PersonalInfoTab[] = ['security', 'preferences'];

/** Permission that lets an account change its own name and login e-mail (and edit accounts). */
const PROFILE_EDIT_PERMISSION = 'core-administrators-update';

/** Profile values editable on this page. */
export type ProfileField = 'full_name' | 'user_email';

const FORCED_2FA_ROLES = ['sysadmin'];

@Component({
  selector: 'app-personal-info',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    PasswordRequirementsChecklistComponent,
    AvatarEditorComponent,
    IconComponent,
    PageHeaderComponent,
    AdminModalComponent,
    RowButtonBuilderComponent
  ],
  templateUrl: './personal-info.component.html',
  styleUrls: ['../../shared-styles/modal.css', './personal-info.component.css']
})
export class PersonalInfoComponent implements OnInit, OnDestroy {
  passwordForm: FormGroup;
  userData: UserLogin | null = null;
  errorMessage: string | null = null;

  showPasswordPopup = false;

  enable2faValue = false;
  isSaving2fa = false;

  /** Inline edit of the name / login e-mail: the open field (null = none), its value and save state. */
  editingField: ProfileField | null = null;
  isSavingField = false;
  readonly editControl = new FormControl('', { nonNullable: true });

  public readonly loadingService = inject(LoadingService);
  public readonly i18n = inject(AdminLocalizationService);

  private readonly authService = inject(AuthService);
  public readonly alertDialogService = inject(AlertDialogService);
  private readonly profileService = inject(CurrentUserProfileService);
  private readonly permissionService = inject(PermissionService);
  /** Unread records - the "pop-up notices" choice of this browser. */
  public readonly notifications = inject(AdminNotificationsService);

  private destroy$ = new Subject<void>();

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** Open tab - from the address (`?tab=security` / `?tab=preferences`), the profile without it. */
  activeTab: PersonalInfoTab = 'profile';

  /** Stable buttons of the page tabs and of the languages. */
  private readonly tabButtons = new RowButtonItems();
  private readonly languageButtons = new RowButtonItems();

  private crud: EntityCrudService<UserLogin>;

  /** Maxlength of the new password fields (the password policy). */
  readonly passwordMaxLength = PASSWORD_MAX_LENGTH;

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
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const tab = params.get('tab') as PersonalInfoTab | null;
      this.activeTab = tab && ADDRESS_TABS.includes(tab) ? tab : 'profile';
      this.cd.markForCheck();
    });
  }

  /** @description Page tabs: Profile, Security, Preferences. */
  get tabItems(): RowButton[] {
    return this.tabButtons.update([
      { value: 'profile', label: this.strings.tab_profile, icon: 'user' },
      { value: 'security', label: this.strings.tab_security, icon: 'lock' },
      { value: 'preferences', label: this.strings.tab_preferences, icon: 'settings' },
    ]);
  }

  /**
   * @description Opens a tab through the address (a new history entry - Back returns to the
   *   previous tab); the profile has no parameter.
   * @param tab Tab to open.
   */
  switchTab(tab: PersonalInfoTab): void {
    if (tab === this.activeTab) return;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'profile' ? null : tab },
      queryParamsHandling: 'merge',
    });
  }

  /** @description Languages of the administration (flag + name). */
  get languageItems(): RowButton[] {
    return this.languageButtons.update(languageRowButtons(
      this.i18n.availableLanguages.map(lang => ({ code: lang.code, name: lang.name, iconUrl: lang.icon })),
      { showName: true },
    ));
  }

  /** Code of the language the administration is shown in. */
  get currentLanguageCode(): string {
    return this.i18n.getCurrentLanguage();
  }

  /**
   * @description Switches the language of the administration (kept in this browser).
   * @param code Language code.
   */
  selectLanguage(code: string): void {
    this.i18n.setLanguage(code);
    this.cd.markForCheck();
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

  /** Placeholder of the new password with the limits of the policy ("8-64 characters"). */
  get passwordPlaceholder(): string {
    return fillPasswordLimits(this.strings.password_placeholder_new ?? '');
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
          console.error('Error loading the user data:', err);
        }
      });
  }

  /** @description ID of the signed-in account (target of the photo upload). */
  get ownUserId(): string | null {
    return this.authService.getUserId();
  }

  /** @description Whether this account may change its own name and login e-mail (sysadmin / core-administrators-update). */
  get canEditProfile(): boolean {
    return this.authService.getUserRole() === SYSADMIN_ROLE_NAME || this.permissionService.hasPermission(PROFILE_EDIT_PERMISSION);
  }

  /**
   * @description Opens the inline field of a profile value with its current value.
   * @param field 'full_name' or 'user_email'.
   */
  startEdit(field: ProfileField): void {
    this.editControl.setValidators(field === 'user_email'
      ? [Validators.required, Validators.email, Validators.maxLength(255)]
      : [Validators.required, Validators.maxLength(255)]);
    this.editControl.reset(String(this.userData?.[field] ?? ''));
    this.editingField = field;
    this.cd.markForCheck();
  }

  /** @description Closes the inline field without saving. */
  cancelEdit(): void {
    this.editingField = null;
    this.cd.markForCheck();
  }

  /**
   * @description Saves the open profile value (PUT {field}). An unchanged value just closes the
   *   field. The login e-mail: the API asks for the password first, ends the other sessions of the
   *   account (the other tabs of this browser are told - AuthService.endOtherTabs) and the header
   *   shows the new e-mail at once.
   */
  saveEdit(): void {
    const field = this.editingField;
    const userId = this.authService.getUserId();
    const value = this.editControl.value.trim();
    if (!field || !userId || this.editControl.invalid || !value || this.isSavingField) return;
    const current = String(this.userData?.[field] ?? '');
    if (field === 'user_email' ? value.toLowerCase() === current.toLowerCase() : value === current) {
      this.cancelEdit();
      return;
    }

    this.isSavingField = true;
    this.dataHandler.put(`core/users/${userId}`, { [field]: value })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          const saved = res?.data?.[field] ?? res?.[field] ?? value;
          this.isSavingField = false;
          this.editingField = null;
          if (this.userData) this.userData = { ...this.userData, [field]: saved };
          this.profileService.invalidate();
          if (field === 'user_email') {
            this.authService.setUserEmail(saved);
            this.authService.endOtherTabs();
            this.alertDialogService.open(this.t('email_change_success_title'), this.t('email_change_success_message'), 'success');
          } else {
            this.alertDialogService.open(this.t('name_change_success_title'), this.t('name_change_success_message'), 'success');
          }
          this.cd.markForCheck();
        },
        error: () => {
          // The DataHandler shows the reason (taken e-mail, domain policy, wrong password).
          this.isSavingField = false;
          this.cd.markForCheck();
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

  /**
   * @description Switches the pop-up notices of new records on / off in this browser.
   * @param event Change of the checkbox.
   */
  onToggleToasts(event: Event): void {
    this.notifications.setToastsEnabled((event.target as HTMLInputElement).checked);
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

  /** @description Closes the password popup (cancel, close button, Escape, backdrop). */
  closePasswordPopup(): void {
    this.showPasswordPopup = false;
    this.cd.markForCheck();
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
          // The API ended the other sessions; the other tabs of this browser share this login.
          this.authService.endOtherTabs();
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