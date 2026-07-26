/**
 * @file reset-password.component.ts
 * @path src/app/admin/auth/reset-password/reset-password.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Veřejně přístupná stránka (bez auth guardu), na kterou vede odkaz z e-mailu pro
 *              reset hesla. Token se čte z query parametru `token`, backend jej ověřuje
 *              (existence, expirace, jednorázové použití) až při odeslání formuláře.
 * @dependencies
 * - AuthService: volání /forgot-password a /reset-password endpointů.
 * - ActivatedRoute: čtení `token` z URL query parametrů.
 * - Router: přesměrování zpět na přihlášení po úspěšném resetu.
 */

import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
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
   * @description Jednoduchý odhad síly hesla jen pro vizuální zpětnou vazbu (0-4).
   *              Skutečnou validaci síly hesla dělá vždy backend (ResetPasswordRequest).
   */
  get passwordStrength(): number {
    const val = this.password;
    if (!val) return 0;

    let score = 0;
    if (val.length >= 10) score++;
    if (val.length >= 14) score++;
    if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score++;
    if (/\d/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;

    return Math.min(score, 4);
  }

  get passwordStrengthLabel(): string {
    switch (this.passwordStrength) {
      case 0:
      case 1:
        return 'Slabé';
      case 2:
        return 'Dostatečné';
      case 3:
        return 'Silné';
      default:
        return 'Velmi silné';
    }
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

    if (this.password !== this.passwordConfirmation) {
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
          // auth.service.ts mapuje HTTP chybu na hotovou zprávu v error.message (viz handlePasswordResetError).
          this.errorMessage = error?.message || 'Odkaz je neplatný nebo vypršel. Vyžádejte si prosím nový.';
          this.cdr.detectChanges();
        }
      });
  }
}