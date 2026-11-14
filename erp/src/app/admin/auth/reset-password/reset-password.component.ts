/**
 * @file reset-password.component.ts
 * @path src/app/admin/auth/reset-password/reset-password.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Public page (no auth guard) opened from the password-reset e-mail link.
 *              The token is read from the `token` query parameter; the backend verifies it
 *              (existence, expiry, single use) only when the form is submitted.
 *
 * @dependencies
 * - AuthService: calls the /forgot-password and /reset-password endpoints.
 * - ActivatedRoute: reads `token` from the URL query parameters.
 * - Router: redirects back to sign-in after a successful reset.
 * - SetPasswordFormComponent: the password form shared with ActivateAccountComponent (policy
 *   checklist, confirmation, submit gate).
 */

import { Component, ChangeDetectorRef, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { SetPasswordFormComponent, SetPasswordValue } from '../set-password-form/set-password-form.component';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';
/** Delay before the automatic redirect to sign-in after a successful reset (ms). */
const REDIRECT_DELAY_MS = 4000;

/**
 * @description Handles the "set a new password" step of the reset flow: the shared form
 *              (SetPasswordFormComponent) checks the input against the password policy, this
 *              page submits token + new password to the API and shows the success / error state.
 * @usage Routed at `/auth/reset-password?token=...` (app.routes.ts, outside AuthGuard).
 * @note Client-side validation is UX only - the token and the password policy are always
 *       re-validated by the Laravel API, which is the security boundary.
 */
@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, RouterModule, SetPasswordFormComponent],
  templateUrl: './reset-password.component.html',
  styleUrls: ['../../shared-styles/theme.css', '../shared-styles/auth.css', '../shared-styles/auth-card.css', './reset-password.component.css']
})
export class ResetPasswordComponent implements OnInit, OnDestroy {
  token = '';
  tokenMissing = false;
  isSubmitting = false;
  success = false;
  /** Translation key (section `reset-password`) of the error shown under the form, '' = none. */
  errorKey = '';

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

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    this.tokenMissing = !this.token;
  }

  ngOnDestroy(): void {
    if (this.redirectTimer) {
      clearTimeout(this.redirectTimer);
    }
  }

  /**
   * @description Sends the new password together with the token to the backend (the form checked
   *   the policy and the confirmation already).
   * @param value Password and its confirmation from SetPasswordFormComponent.
   * @note Backend errors (invalid/expired token, policy violation) are shown to the user.
   */
  onSubmit(value: SetPasswordValue): void {
    this.errorKey = '';
    if (this.tokenMissing || this.isSubmitting) {
      return;
    }

    this.isSubmitting = true;

    this.authService
      .resetPassword(this.token, value.password, value.password_confirmation)
      .subscribe({
        next: (response) => {
          this.isSubmitting = false;
          this.success = true;
          this.changedForEmail = response?.email ?? null;
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
