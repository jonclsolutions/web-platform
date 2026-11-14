/**
 * @file set-password-form.component.ts
 * @path src/app/admin/auth/set-password-form/set-password-form.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description The "set a password" form of the pages opened from an e-mail (account activation,
 *   password reset): password + confirmation with visibility toggles, the live checklist of the
 *   password policy, the mismatch hint, the error of the page and the submit button. The button
 *   is enabled only when the password meets the policy and both fields match - invalid input
 *   never reaches the API (which validates again - the security boundary).
 * @usage `<app-set-password-form section="reset-password" [submitting]="…" [errorKey]="…"
 *   (submitted)="save($event)">` - the texts come from the admin translations of `section`
 *   (label_password, placeholder_password, label_confirmation, placeholder_confirmation,
 *   show_password, hide_password, error_mismatch, submit, submitting + the page's error keys).
 * @dependencies PasswordRequirementsChecklistComponent, password-policy (meetsPasswordRequirements,
 *   limits), AdminLocalizationService.
 */

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { PasswordRequirementsChecklistComponent } from '../../../shared/components/password-requirements-checklist/password-requirements-checklist.component';
import {
  PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, fillPasswordLimits, meetsPasswordRequirements,
} from '../../../shared/constants/password-policy';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';

/** @description The entered password, as the API endpoints expect it. */
export interface SetPasswordValue {
  password: string;
  password_confirmation: string;
}

@Component({
  selector: 'app-set-password-form',
  standalone: true,
  imports: [FormsModule, PasswordRequirementsChecklistComponent],
  templateUrl: './set-password-form.component.html',
  styleUrls: ['../../shared-styles/theme.css', '../shared-styles/auth.css', '../shared-styles/auth-card.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetPasswordFormComponent {
  /** Section of the admin translations with the texts of the page. */
  @Input({ required: true }) section!: string;
  /** A request of the page is running (spinner, button disabled). */
  @Input() submitting = false;
  /** Translation key (in `section`) of the error returned to the page, '' = none. */
  @Input() errorKey = '';
  /** The user sent a valid password. */
  @Output() submitted = new EventEmitter<SetPasswordValue>();

  password = '';
  passwordConfirmation = '';
  showPassword = false;
  showPasswordConfirmation = false;
  readonly minLength = PASSWORD_MIN_LENGTH;
  readonly maxLength = PASSWORD_MAX_LENGTH;

  private readonly i18n = inject(AdminLocalizationService);

  constructor() {
    // OnPush: re-render once the admin translations are (re)loaded.
    const cd = inject(ChangeDetectorRef);
    this.i18n.translations$.pipe(takeUntilDestroyed()).subscribe(() => cd.markForCheck());
  }

  /**
   * @description Text of the page section.
   * @param key Key inside `section`.
   */
  t(key: string): string {
    return this.i18n.getValue(`${this.section}.${key}`);
  }

  /** @description Placeholder of the password field with the length limits filled in. */
  get lengthPlaceholder(): string {
    return fillPasswordLimits(this.t('placeholder_password'));
  }

  /**
   * @description Live mismatch of the two fields; an empty confirmation is not a mismatch (no
   *   error until the user starts typing it).
   */
  get passwordsMismatch(): boolean {
    return !!this.passwordConfirmation && this.password !== this.passwordConfirmation;
  }

  /** @description The form may be sent: policy met, confirmation filled in and equal, not sending. */
  get canSubmit(): boolean {
    return !this.submitting
      && meetsPasswordRequirements(this.password)
      && !!this.passwordConfirmation
      && !this.passwordsMismatch;
  }

  /**
   * @description Emits the password; re-checks canSubmit because Enter submits the form even
   *   with the button disabled.
   */
  onSubmit(): void {
    if (!this.canSubmit) return;
    this.submitted.emit({ password: this.password, password_confirmation: this.passwordConfirmation });
  }
}
