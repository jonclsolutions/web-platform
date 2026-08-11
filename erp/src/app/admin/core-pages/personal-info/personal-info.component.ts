/**
 * @file personal-info.component.ts
 * @path src/app/admin/web-pages/personal-info/personal-info.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Manages user profile information and security settings, specifically handling
 * password updates and the self-service 2FA toggle.
 *
 * @refactor-note (2025) Dříve dědil z BaseDataComponent jen kvůli `getItemDetails()` a
 * `updatePassword()` — čímž si zbytečně vláčel celý paginační/koš/cache aparát, který
 * vůbec nepoužíval. Nyní si skládá `EntityCrudService` přímo (stejnou třídu, na kterou
 * i BaseDataComponent interně deleguje) — je to jediné, co tato komponenta potřebuje.
 *
 * @refactor-note (2026-08) Legacy osobní/HR pole odstraněna - viz User.php. Formulář na
 * změnu hesla přesunut do `showPasswordPopup` popupu. Přidán self-service `enable_2fa`
 * toggle a `userRoleName` getter pro zobrazení role.
 *
 * @refactor-note (2026-08-2) `passwordsMatchValidator` přepsán bez `setErrors()`
 * manipulace (mohla přepisovat jiné chyby na `new_password_confirmation` controlu -
 * typicky `required`, pokud běžely validace v nešťastném pořadí) - teď je to čistý
 * group-level validator, chyba se čte přes `passwordForm.errors` v šabloně. Zároveň
 * opraven klíč `{ validator: ... }` → `{ validators: ... }` (jednotné číslo `validator`
 * NENÍ platný klíč `AbstractControlOptions` - Angular ho mohl tiše ignorovat, takže
 * cross-field validace hesel se pravděpodobně nikdy nespouštěla). Přidán `Validators.pattern`
 * na `new_password` dle sdílené `PASSWORD_PATTERN` a live checklist požadavků hesla.
 *
 * @dependencies
 * - EntityCrudService: Jednotlivé CRUD volání (getOne, update, updatePassword) pro endpoint 'core/users'.
 * - ReactiveFormsModule: Enables form group management and validation for password change inputs.
 * - AuthService: Used to identify the currently authenticated user for profile requests.
 * - PasswordRequirementsChecklistComponent: Live vizuální checklist pravidel hesla.
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
import { UserLogin } from '../../../shared/interfaces/user';
import { LoadingService } from '../../../core/services/loading.service';
import { PASSWORD_PATTERN } from '../../../shared/constants/password-policy';
import { PasswordRequirementsChecklistComponent } from '../../../shared/components/password-requirements-checklist/password-requirements-checklist.component';

/** Role s napevno vynuceným 2FA - musí sedět s UserController::FORCED_2FA_ROLE_NAMES. */
const FORCED_2FA_ROLES = ['admin', 'sysadmin'];

/**
 * @description Component for managing authenticated user profile and security credentials.
 * @usage Provides a UI to view personal user details, toggle 2FA, and securely update the
 * account password via a popup form.
 * @note Uses custom cross-field validation to ensure password confirmation matches the new password.
 */
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

  /** Řídí viditelnost popupu se změnou hesla - dřív bylo natvrdo v layoutu. */
  showPasswordPopup = false;

  /** Lokální stav checkboxu, nezávislý na `userData` dokud se uložení nepotvrdí. */
  enable2faValue = false;
  isSaving2fa = false;

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
      new_password: ['', [Validators.required, Validators.pattern(PASSWORD_PATTERN)]],
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
   * @description Retrieves the current user's details from the server using the active session ID.
   */
  private loadCurrentUserData(): void {
    const userId = this.authService.getUserId();
    if (!userId) return;

    this.crud.getOne(parseInt(userId, 10))
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

  get isForced2fa(): boolean {
    const roleName = (this.userData as any)?.roles?.[0]?.role_name;
    return FORCED_2FA_ROLES.includes(roleName);
  }

  get userRoleName(): string | null {
    return (this.userData as any)?.roles?.[0]?.role_name ?? null;
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
          this.cd.markForCheck();
        },
        error: () => {
          this.isSaving2fa = false;
          this.alertDialogService.open('Chyba', 'Nepodařilo se uložit nastavení 2FA.', 'danger');
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

  /**
   * @description Group-level validator: srovnává `new_password` a
   * `new_password_confirmation`. Nemutuje errors na jednotlivých controlech (viz
   * @refactor-note 2026-08-2) - chyba se čte v šabloně přes `passwordForm.errors`.
   * Prázdné potvrzení se nepovažuje za neshodu, ať se chyba neukáže dřív, než ho
   * uživatel začne psát.
   */
  private passwordsMatchValidator(group: AbstractControl): ValidationErrors | null {
    const newPassword = group.get('new_password')?.value;
    const confirmation = group.get('new_password_confirmation')?.value;
    if (!confirmation) return null;
    return newPassword === confirmation ? null : { passwordsNotMatching: true };
  }

  get passwordMismatch(): boolean {
    return !!this.passwordForm.errors?.['passwordsNotMatching'];
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
          this.showPasswordPopup = false;
          this.alertDialogService.open('Změna hesla', 'Heslo bylo úspěšně změněno.', 'success');
          this.errorMessage = null;
          this.cd.markForCheck();
        },
        error: () => {
          this.errorMessage = 'Chyba při změně hesla. Zkontrolujte prosím původní heslo.';
          this.cd.markForCheck();
        }
      });
  }
}