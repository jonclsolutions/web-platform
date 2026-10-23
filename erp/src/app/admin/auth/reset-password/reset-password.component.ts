/**
 * @file reset-password.component.ts
 * @path src/app/admin/auth/reset-password/reset-password.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Public page (no auth guard) opened from the password-reset e-mail link.
 *              The token is read from the `token` query parameter; the backend verifies it
 *              (existence, expiry, single use) only when the form is submitted.
 *
 * @refactor-note (2026-08) `passwordStrength`/`passwordStrengthLabel` (0-4 meter) replaced
 * by the shared `PasswordRequirementsChecklistComponent`. `minlength` aligned with the
 * shared policy (`PASSWORD_MIN_LENGTH`/`MAX`). Live `passwordsMismatch` getter added.
 * @refactor-note (2026-10-01) Client-side policy pre-check via shared `isPasswordValid()`
 * (submit is disabled until the password meets the policy and both fields match), so
 * obviously invalid input no longer reaches the API and produces 422s. The backend
 * (ResetPasswordRequest) stays authoritative. Copy translated to English; redirect timer
 * is now cleared on destroy; double-submit guard added; 422 field errors are surfaced.
 *
 * @dependencies
 * - AuthService: calls the /forgot-password and /reset-password endpoints.
 * - ActivatedRoute: reads `token` from the URL query parameters.
 * - Router: redirects back to sign-in after a successful reset.
 * - PasswordRequirementsChecklistComponent: live visual checklist of the password rules.
 * - shared/utils/password-validation: `isPasswordValid()` - same rules as the backend.
 * @bugfix-note (2026-10-23) Open finding #39: the page was English-only (template texts and the
 *   error messages); everything comes from the admin translations `reset-password` now. API error
 *   texts (English) are no longer shown - the status decides the translated message.
 */

import { Component, ChangeDetectorRef, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from '../../../shared/constants/password-policy';
import { PasswordRequirementsChecklistComponent } from '../../../shared/components/password-requirements-checklist/password-requirements-checklist.component';
import { isPasswordValid } from '../../../shared/utils/password-validation';
import { fillPasswordLimits } from '../../../shared/constants/password-policy';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';
/** Delay before the automatic redirect to sign-in after a successful reset (ms). */
const REDIRECT_DELAY_MS = 4000;


/**
 * @description Handles the "set a new password" step of the reset flow: validates the
 *              input locally against the shared password policy, submits token + new
 *              password to the API and shows the success / error state.
 * @usage Routed at `/auth/reset-password?token=...` (app.routes.ts, outside AuthGuard).
 * @note Client-side validation is UX only - the token and the password policy are always
 *       re-validated by the Laravel API, which is the security boundary.
 */
@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PasswordRequirementsChecklistComponent],
  templateUrl: './reset-password.component.html',
  styleUrls: ['../../shared-styles/theme.css', '../shared-styles/auth.css', '../shared-styles/auth-card.css', './reset-password.component.css']
})
export class ResetPasswordComponent implements OnInit, OnDestroy {
  token = '';
  password = '';
  passwordConfirmation = '';

  showPassword = false;
  showPasswordConfirmation = false;

  tokenMissing = false;
  isSubmitting = false;
  success = false;
  /** Translation key (section `reset-password`) of the error shown under the form, '' = none. */
  errorKey = '';

  readonly minLength = PASSWORD_MIN_LENGTH;
  readonly maxLength = PASSWORD_MAX_LENGTH;

  /** Account e-mail returned by the backend after a successful reset - display only. */
  changedForEmail: string | null = null;

  /** Pending redirect timer - cleared on destroy so it can't fire after leaving the page. */
  private redirectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private i18n: AdminLocalizationService
  ) {}

  /**
   * @description Text of the page in the admin language (finding #39 - was English-only).
   * @param key Key inside the `reset-password` section.
   * @returns Translated text.
   */
  t(key: string): string {
    return this.i18n.getValue(`reset-password.${key}`);
  }

  /** Placeholder of the password field with the length limits filled in. */
  get lengthPlaceholder(): string {
    return fillPasswordLimits(this.t('placeholder_password'));
  }

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    this.tokenMissing = !this.token;
  }

  ngOnDestroy(): void {
    if (this.redirectTimer) {
      clearTimeout(this.redirectTimer);
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  togglePasswordConfirmationVisibility(): void {
    this.showPasswordConfirmation = !this.showPasswordConfirmation;
  }

  /**
   * @description Live password mismatch, computed from current values (no stored state).
   * @returns true only when the confirmation is non-empty and differs from the password.
   * @note Fallback: an empty confirmation is NOT a mismatch, so the error doesn't show
   *       until the user starts typing it.
   */
  get passwordsMismatch(): boolean {
    return !!this.passwordConfirmation && this.password !== this.passwordConfirmation;
  }

  /**
   * @description Whether the password satisfies the shared policy (length, letter,
   *              digit, symbol) - same rules as the backend `ResetPasswordRequest`.
   * @returns true when every rule passes.
   * @note Fallback: an empty password is invalid.
   */
  get passwordValid(): boolean {
    return isPasswordValid(this.password);
  }

  /**
   * @description Gate for the submit button - the form is sendable only when the
   *              password meets the policy, the confirmation is filled in and matches,
   *              a token is present and no request is already in flight.
   * @returns true when the form can be submitted.
   */
  get canSubmit(): boolean {
    return !this.tokenMissing
      && !this.isSubmitting
      && this.passwordValid
      && !!this.passwordConfirmation
      && !this.passwordsMismatch;
  }

  /**
   * @description Sends the new password together with the token to the backend.
   *              Re-checks `canSubmit` first because the form can also be submitted with
   *              Enter, bypassing the disabled button.
   * @note Backend errors (invalid/expired token, policy violation) are shown to the user.
   */
  onSubmit(): void {
    this.errorKey = '';

    if (this.tokenMissing) {
      this.errorKey = 'error_token_missing';
      return;
    }

    if (!this.passwordValid) {
      this.errorKey = 'error_policy';
      return;
    }

    if (!this.passwordConfirmation || this.passwordsMismatch) {
      this.errorKey = 'error_mismatch';
      return;
    }

    if (this.isSubmitting) {
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
          // Clear the secret values from memory as soon as they're no longer needed.
          this.password = '';
          this.passwordConfirmation = '';
          this.cdr.detectChanges();

          this.redirectTimer = setTimeout(() => {
            this.router.navigate(['/auth/login']);
          }, REDIRECT_DELAY_MS);
        },
        error: (error) => {
          this.isSubmitting = false;
          this.errorKey = this.errorKeyFor(error);
          this.cdr.detectChanges();
        }
      });
  }

  /**
   * @description Translation key of the message for a failed reset (finding #39: the API texts are
   *   English, the page shows its own translated messages).
   * @param error HttpErrorResponse (or an already-normalised `{ status, errors }` object).
   * @returns 'error_network' (no connection), 'error_policy' (422 for the password), else
   *   'error_generic' (invalid / expired link, server error).
   */
  private errorKeyFor(error: any): string {
    const body = error?.error ?? error;
    if (error?.status === 0) {
      return 'error_network';
    }
    if (body?.errors?.password) {
      return 'error_policy';
    }
    return 'error_generic';
  }
}
