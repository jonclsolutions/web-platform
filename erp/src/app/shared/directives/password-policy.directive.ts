/**
 * @file password-policy.directive.ts
 * @path src/app/shared/directives/password-policy.directive.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026-10-23
 * @description Template-driven validator of the password policy (`[appPasswordPolicy]` on an
 *   `ngModel` input). Replaces the string `[pattern]` of the password fields: Angular compiles a
 *   string pattern without the `u` flag, so the Unicode rules of the Laravel `Password` rule
 *   (letters / numbers / symbols of any script) cannot be expressed as a pattern (open finding #37).
 * @dependencies
 * - shared/constants/password-policy: passwordPolicyValidator() (the single rule set).
 */

import { Directive, Input, forwardRef } from '@angular/core';
import { AbstractControl, NG_VALIDATORS, ValidationErrors, Validator } from '@angular/forms';
import { passwordPolicyValidator } from '../constants/password-policy';

/**
 * @description Adds the password policy to the control when the input is true.
 * @usage `<input [(ngModel)]="pw" name="pw" [appPasswordPolicy]="true">` - error key `pattern`
 *   (like the replaced pattern validator), so existing error messages keep working.
 */
@Directive({
  selector: '[appPasswordPolicy][ngModel]',
  standalone: true,
  providers: [{ provide: NG_VALIDATORS, useExisting: forwardRef(() => PasswordPolicyDirective), multi: true }],
})
export class PasswordPolicyDirective implements Validator {
  /** Whether the policy is checked (false = no validation, e.g. a non-password field). */
  @Input() appPasswordPolicy: boolean | '' = true;

  private readonly check = passwordPolicyValidator();

  /**
   * @description Validates the control value against the password policy.
   * @param control The bound form control.
   * @returns `{ pattern: … }` for a password breaking the policy, else null.
   */
  validate(control: AbstractControl): ValidationErrors | null {
    return this.appPasswordPolicy === false ? null : this.check(control);
  }
}
