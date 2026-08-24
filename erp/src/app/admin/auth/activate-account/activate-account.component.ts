/**
 * @file activate-account.component.ts
 * @path src/app/admin/auth/activate-account/activate-account.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Veřejná stránka pro nastavení hesla a aktivaci účtu založeného adminem
 * (backlog "workflow zakládání účtů z adminu"). Otevírá se z odkazu v e-mailu
 * (AccountActivationMail). Stejný vzorec jako ResetPasswordComponent - veřejná routa
 * mimo AdminLayoutComponent i AuthGuard, cílová stránka odkazu z e-mailu.
 * @note Po úspěšné aktivaci uživatel NENÍ automaticky přihlášen - přesměruje se na
 * `/auth/login` (rozhodnuto v backlogu: "presmerovat na prihlaseni").
 * @dependencies
 * - DataHandler: HTTP volání na veřejné `account-activation/{token}` endpointy.
 * - PasswordRequirementsChecklistComponent: Live vizuální checklist pravidel hesla -
 *   stejná komponenta jako ResetPasswordComponent/admin vytvoření uživatele.
 * @refactor-note (2026-08-24) SJEDNOCENO s ResetPasswordComponent: vlastní regex
 * validace hesla (PASSWORD_PATTERN) odstraněna - stejně jako u resetu hesla se
 * spoléhá na (a) vizuální checklist pro uživatele PŘED odesláním a (b) backendovou
 * validaci (Password::min()->letters()->numbers()->symbols()) jako jediný zdroj
 * pravdy, jejíž chybová hláška se zobrazí v `fieldError`, pokud přesto neprojde.
 * @bugfix-note (2026-08-24) STRÁNKA SE ZASEKÁVALA NA "Ověřuji odkaz…": komponenta má
 * `ChangeDetectionStrategy.OnPush`, ale změny stavu (`this.state`, `this.email`, ...)
 * prováděné uvnitř `subscribe()` callbacků nikdy nespustily re-render - HTTP request
 * proběhl v pořádku (ověřeno v HAR: 200 OK se správnými daty), ale view zůstalo
 * vykreslené ve starém stavu. Řešení: `ChangeDetectorRef.markForCheck()` po KAŽDÉ
 * asynchronní změně stavu - stejný vzor, jaký důsledně používá zbytek projektu
 * (TableBuilderComponent, AdministratorsComponent, UserRequestComponent, ...).
 */

import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DataHandler } from '../../../core/services/data-handler.service';
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from '../../../shared/constants/password-policy';
import { PasswordRequirementsChecklistComponent } from '../../../shared/components/password-requirements-checklist/password-requirements-checklist.component';

/** Řídí, který blok šablony se vykresluje - ověřování odkazu, formulář, chyba, hotovo. */
type ViewState = 'loading' | 'form' | 'invalid' | 'success';

/** Odpověď z GET account-activation/{token} (AccountActivationController::show()). */
interface ActivationCheckResponse {
  email: string;
  full_name: string;
}

@Component({
  selector: 'app-activate-account',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PasswordRequirementsChecklistComponent],
  templateUrl: './activate-account.component.html',
  styleUrl: './activate-account.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivateAccountComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private dataHandler = inject(DataHandler);
  private cd = inject(ChangeDetectorRef);

  state: ViewState = 'loading';
  errorMessage = '';
  email = '';

  password = '';
  passwordConfirmation = '';
  showPassword = false;
  showPasswordConfirmation = false;
  submitting = false;
  fieldError = '';

  readonly minLength = PASSWORD_MIN_LENGTH;
  readonly maxLength = PASSWORD_MAX_LENGTH;

  /** Sekundy do automatického přesměrování po úspěchu - zobrazeno v UI. */
  redirectCountdown = 4;

  private token = '';

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') || '';

    if (!this.token) {
      this.state = 'invalid';
      this.errorMessage = 'Chybí aktivační token.';
      return;
    }

    this.dataHandler.get<ActivationCheckResponse>(`account-activation/${this.token}`).subscribe({
      next: (res) => {
        this.email = res.email;
        this.state = 'form';
        this.cd.markForCheck();
      },
      error: (err) => {
        this.state = 'invalid';
        this.errorMessage = err?.error?.message || 'Odkaz je neplatný nebo vypršel.';
        this.cd.markForCheck();
      }
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmationVisibility(): void {
    this.showPasswordConfirmation = !this.showPasswordConfirmation;
  }

  /**
   * @description Live neshoda hesel, počítaná z aktuálních hodnot - žádný uložený stav.
   * Prázdné potvrzení se nepovažuje za neshodu (chyba se neukáže, dokud ho uživatel
   * nezačne psát). Stejná logika jako ResetPasswordComponent.passwordsMismatch.
   */
  get passwordsMismatch(): boolean {
    return !!this.passwordConfirmation && this.password !== this.passwordConfirmation;
  }

  onSubmit(): void {
    this.fieldError = '';

    if (this.passwordsMismatch) {
      this.fieldError = 'Zadaná hesla se neshodují.';
      return;
    }

    this.submitting = true;

    this.dataHandler.post(`account-activation/${this.token}`, {
      password: this.password,
      password_confirmation: this.passwordConfirmation
    }).subscribe({
      next: () => {
        this.submitting = false;
        this.state = 'success';
        this.cd.markForCheck();
        this.startRedirectCountdown();
      },
      error: (err) => {
        this.submitting = false;
        this.fieldError = err?.error?.message || 'Nastavení hesla se nezdařilo.';
        this.cd.markForCheck();
      }
    });
  }

  /**
   * @description Odpočet v UI ("Přesměrujeme za N s…") před automatickým přechodem na
   * login - čistě kosmetické, samotné přesměrování by fungovalo i bez něj, ale dává
   * uživateli jasnou zpětnou vazbu, že se něco děje.
   */
  private startRedirectCountdown(): void {
    const interval = setInterval(() => {
      this.redirectCountdown -= 1;
      this.cd.markForCheck();
      if (this.redirectCountdown <= 0) {
        clearInterval(interval);
        this.router.navigate(['/auth/login']);
      }
    }, 1000);
  }
}