/**
 * @file reset-password.component.ts
 * @path src/app/admin/auth/reset-password/reset-password.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Veřejně přístupná stránka (bez auth guardu), na kterou vede odkaz z e-mailu pro
 *              reset hesla. Token se čte z query parametru `token`, backend jej ověřuje
 *              (existence, expirace, jednorázové použití) až při odeslání formuláře.
 *
 * @refactor-note (2026-08) `passwordStrength`/`passwordStrengthLabel` (0-4 bar-meter)
 * nahrazeny sdíleným `PasswordRequirementsChecklistComponent`, stejný jako všude jinde
 * v appce (admin vytvoření uživatele, admin reset hesla, personal-info). `minlength`
 * sníženo z 10 na 8, sjednoceno se sdílenou politikou (`PASSWORD_MIN_LENGTH`/`MAX`).
 * Přidán live `passwordsMismatch` getter pro zobrazení neshody hesel PŘED odesláním
 * (dřív se to zjistilo až v `onSubmit()`).
 *
 * @dependencies
 * - AuthService: volání /forgot-password a /reset-password endpointů.
 * - ActivatedRoute: čtení `token` z URL query parametrů.
 * - Router: přesměrování zpět na přihlášení po úspěšném resetu.
 * - PasswordRequirementsChecklistComponent: Live vizuální checklist pravidel hesla.
 */

import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from '../../../shared/constants/password-policy';
import { PasswordRequirementsChecklistComponent } from '../../../shared/components/password-requirements-checklist/password-requirements-checklist.component';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PasswordRequirementsChecklistComponent],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.css']
})
export class ResetPasswordComponent implements OnInit {
  token = '';
  password = '';
  passwordConfirmation = '';

  showPassword = false;
  showPasswordConfirmation = false;

  tokenMissing = false;
  isSubmitting = false;
  success = false;
  errorMessage = '';

  readonly minLength = PASSWORD_MIN_LENGTH;
  readonly maxLength = PASSWORD_MAX_LENGTH;

  /** E-mail účtu vrácený backendem po úspěšném resetu - jen pro zobrazení potvrzení uživateli. */
  changedForEmail: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    this.tokenMissing = !this.token;
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  togglePasswordConfirmationVisibility(): void {
    this.showPasswordConfirmation = !this.showPasswordConfirmation;
  }

  /**
   * @description Live neshoda hesel, počítaná z aktuálních hodnot - žádný uložený stav.
   * Prázdné potvrzení se nepovažuje za neshodu (chyba se neukáže, dokud ho uživatel
   * nezačne psát).
   */
  get passwordsMismatch(): boolean {
    return !!this.passwordConfirmation && this.password !== this.passwordConfirmation;
  }

  /**
   * @description Odešle nové heslo spolu s tokenem na backend. Chybové hlášky z backendu
   *              (neplatný/expirovaný token, slabé heslo, neshoda hesel) se zobrazí uživateli.
   */
  onSubmit(): void {
    this.errorMessage = '';

    if (this.tokenMissing) {
      this.errorMessage = 'Odkaz je neplatný. Vyžádejte si prosím nový reset hesla z přihlašovací stránky.';
      return;
    }

    if (this.passwordsMismatch) {
      this.errorMessage = 'Zadaná hesla se neshodují.';
      return;
    }

    this.isSubmitting = true;
    this.authService
      .resetPassword(this.token, this.password, this.passwordConfirmation)
      .subscribe({
        next: (response) => {
          this.isSubmitting = false;
          this.success = true;
          this.changedForEmail = response?.email ?? null;
          this.cdr.detectChanges();

          setTimeout(() => {
            this.router.navigate(['/auth/login']);
          }, 4000);
        },
        error: (error) => {
          this.isSubmitting = false;
          this.errorMessage = error?.message || 'Odkaz je neplatný nebo vypršel. Vyžádejte si prosím nový.';
          this.cdr.detectChanges();
        }
      });
  }
}