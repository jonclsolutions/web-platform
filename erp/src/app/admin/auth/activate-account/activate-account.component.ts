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
 * - HttpClient: HTTP volání na veřejné `account-activation/{token}` endpointy.
 * - environment: Base URL of the API.
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
 * @bugfix-note (2026-10-09) An expired / invalid link also opened a "Cannot load text"
 * error popup on top of the page. It came from DataHandler's global error dialog, whose
 * texts belong to the admin translations that are not loaded on this public page. This
 * page reports every error inline, so both public calls now use HttpClient directly
 * (no global dialog); DataHandler itself is unchanged. Fallback messages are in English
 * like the rest of the page.
 * @refactor-note (2026-10-09) UX: the submit button stays disabled until the password meets
 * every rule of the password policy (`meetsPasswordRequirements()`, the same rules the checklist shows) and both fields
 * match. `fieldError` no longer repeats the password rules - it is only used for a lost
 * connection or an unexpected failure; an invalid / expired link switches to the
 * 'invalid' state.
 * @bugfix-note (2026-10-23) Open finding #39: the page was English-only; every text comes from the
 *   admin translations `activate-account` now. API error texts (English) are no longer shown - the
 *   status decides the translated message.
 * @refactor-note (2026-10-24) Open finding #6 (one API envelope `{data, meta?}`): GET
 *  account-activation/{token} answers `{data: {email, full_name}}` - the payload is read.
 */

import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { map } from 'rxjs';
import { ApiEnvelope } from '../../../shared/interfaces/api-envelope';
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, meetsPasswordRequirements, fillPasswordLimits } from '../../../shared/constants/password-policy';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';
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
  styleUrls: ['../../shared-styles/theme.css', '../shared-styles/auth.css', '../shared-styles/auth-card.css', './activate-account.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivateAccountComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private cd = inject(ChangeDetectorRef);
  private i18n = inject(AdminLocalizationService);

  /** JSON-only headers; the endpoints are public, so no Authorization header is needed. */
  private readonly headers = new HttpHeaders({ 'Accept': 'application/json' });

  state: ViewState = 'loading';
  /** Translation key (section `activate-account`) of the invalid-link reason. */
  errorKey = '';
  email = '';

  password = '';
  passwordConfirmation = '';
  showPassword = false;
  showPasswordConfirmation = false;
  submitting = false;
  /** Translation key of the error under the form, '' = none. */
  fieldErrorKey = '';

  readonly minLength = PASSWORD_MIN_LENGTH;
  readonly maxLength = PASSWORD_MAX_LENGTH;

  /** Sekundy do automatického přesměrování po úspěchu - zobrazeno v UI. */
  redirectCountdown = 4;

  private token = '';

  constructor() {
    // OnPush: re-render once the admin translations are (re)loaded.
    this.i18n.translations$.pipe(takeUntilDestroyed()).subscribe(() => this.cd.markForCheck());
  }

  /**
   * @description Text of the page in the admin language (finding #39 - was English-only).
   * @param key Key inside the `activate-account` section.
   * @returns Translated text.
   */
  t(key: string): string {
    return this.i18n.getValue(`activate-account.${key}`);
  }

  /** Placeholder of the password field with the length limits filled in. */
  get lengthPlaceholder(): string {
    return fillPasswordLimits(this.t('placeholder_password'));
  }

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') || '';

    if (!this.token) {
      this.state = 'invalid';
      this.errorKey = 'error_token_missing';
      return;
    }

    this.http.get<ApiEnvelope<ActivationCheckResponse>>(this.activationUrl(), { headers: this.headers }).pipe(map(r => r.data)).subscribe({
      next: (res) => {
        this.email = res.email;
        this.state = 'form';
        this.cd.markForCheck();
      },
      error: (err) => {
        this.state = 'invalid';
        this.errorKey = 'error_invalid_link';
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

  /**
   * @description Whether the form may be submitted: every password rule is met and the
   * confirmation is filled in and matches. Drives the submit button's `[disabled]`.
   * @returns True when the form is ready to submit.
   */
  get canSubmit(): boolean {
    return meetsPasswordRequirements(this.password)
      && !!this.passwordConfirmation
      && this.password === this.passwordConfirmation;
  }

  onSubmit(): void {
    this.fieldErrorKey = '';

    // The button is disabled in this case; this also covers a submit by the Enter key.
    if (!this.canSubmit || this.submitting) {
      return;
    }

    this.submitting = true;

    this.http.post(this.activationUrl(), {
      password: this.password,
      password_confirmation: this.passwordConfirmation
    }, { headers: this.headers }).subscribe({
      next: () => {
        this.submitting = false;
        this.state = 'success';
        this.cd.markForCheck();
        this.startRedirectCountdown();
      },
      error: (err) => {
        this.submitting = false;
        // The link expired or was used while the form was open: same view as on entry.
        if ([403, 404, 410].includes(err?.status)) {
          this.state = 'invalid';
          this.errorKey = 'error_invalid_link';
        } else {
          this.fieldErrorKey = this.submitErrorKey(err);
        }
        this.cd.markForCheck();
      }
    });
  }

  /**
   * @description Absolute URL of the public activation endpoint for the current token.
   * @returns `{api}/account-activation/{token}`; the token is URL-encoded.
   */
  private activationUrl(): string {
    return `${environment.base_api_url}/account-activation/${encodeURIComponent(this.token)}`;
  }

  /**
   * @description Message shown under the form when setting the password fails for a reason
   * other than an invalid link. Never lists the password rules - the checklist above already
   * shows them, and the button is disabled until they are met.
   * @param err The HttpErrorResponse of the failed request.
   * @returns Translation key of the message.
   */
  private submitErrorKey(err: any): string {
    if (err?.status === 0) {
      return 'error_network';
    }
    if (err?.status === 422) {
      // Only reachable if the server's rules differ from the checklist (e.g. a stale app version).
      return 'error_password_rejected';
    }
    return 'error_generic';
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