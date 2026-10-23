/**
 * @file password-policy.spec.ts
 * @path src/app/shared/constants/password-policy.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of the password policy (the single rule set of the app, open finding
 *   #37): the Unicode rule checks (same classes as the Laravel `Password` rule), the checklist
 *   requirements, meetsPasswordRequirements(), passwordPolicyValidator() and the {min} / {max}
 *   placeholder filling.
 */

import { FormControl } from '@angular/forms';
import {
  PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, PASSWORD_REQUIREMENTS, PASSWORD_RULE_CHECKS,
  fillPasswordLimits, getPasswordErrorMessage, meetsPasswordRequirements, passwordPolicyValidator
} from './password-policy';

describe('password-policy', () => {
  /**
   * @description The rules accept every script / symbol the API accepts and count code points.
   * @input 'abcdef1!'; 'žluťoučký1€' (non-ASCII letters, € symbol); 'heslo1§' + 'x'; '密码密码密码密码1!';
   *        8 emoji + 'a1' (10 code points, 18 UTF-16 units); too short / long; no digit / letter / symbol.
   * @output true for the valid ones (also non-ASCII / emoji); false for each broken rule.
   */
  it('checks the rules like the Laravel Password rule', () => {
    expect(meetsPasswordRequirements('abcdef1!')).toBeTrue();
    expect(meetsPasswordRequirements('žluťoučký1€')).toBeTrue();
    expect(meetsPasswordRequirements('heslo1§x')).toBeTrue();
    expect(meetsPasswordRequirements('密码密码密码密码1!')).toBeTrue();
    expect(meetsPasswordRequirements('😀😀😀😀😀😀😀😀a1')).toBeTrue();
    expect(PASSWORD_RULE_CHECKS.length('😀'.repeat(16))).toBeTrue();
    expect(PASSWORD_RULE_CHECKS.length('😀'.repeat(17))).toBeFalse();
    expect(meetsPasswordRequirements('abc1!')).toBeFalse();
    expect(meetsPasswordRequirements('abcdefghijklmn1!x')).toBeFalse();
    expect(meetsPasswordRequirements('abcdefg!')).toBeFalse();
    expect(meetsPasswordRequirements('1234567!')).toBeFalse();
    expect(meetsPasswordRequirements('abcdefg1')).toBeFalse();
  });

  /**
   * @description Each checklist requirement is evaluated on its own; all must pass.
   * @input 'abc'; 'abcdefg1#'; ''; null.
   * @output Per requirement results; label keys; meetsPasswordRequirements false for '' and null.
   */
  it('evaluates the checklist requirements', () => {
    const results = (p: string) => PASSWORD_REQUIREMENTS.map(r => [r.id, r.test(p)]);
    expect(results('abc')).toEqual([['length', false], ['letter', true], ['digit', false], ['special', false]]);
    expect(results('abcdefg1#')).toEqual([['length', true], ['letter', true], ['digit', true], ['special', true]]);
    expect(PASSWORD_REQUIREMENTS.map(r => r.labelKey)).toEqual(['password-policy.length', 'password-policy.letter', 'password-policy.digit', 'password-policy.special']);
    expect(meetsPasswordRequirements('')).toBeFalse();
    expect(meetsPasswordRequirements(null as any)).toBeFalse();
    expect(PASSWORD_RULE_CHECKS.letter(null as any)).toBeFalse();
  });

  /**
   * @description The reactive validator leaves empty values to `required` and reports a policy
   *   breach with the `pattern` error key.
   * @input FormControl '' / null / 'abc' / 'žluťoučký1€'.
   * @output null; null; { pattern: { requiredPattern: 'password-policy' } }; null.
   */
  it('validates reactive form controls', () => {
    const validate = passwordPolicyValidator();
    expect(validate(new FormControl(''))).toBeNull();
    expect(validate(new FormControl(null))).toBeNull();
    expect(validate(new FormControl('abc'))).toEqual({ pattern: { requiredPattern: 'password-policy' } });
    expect(validate(new FormControl('žluťoučký1€'))).toBeNull();
  });

  /**
   * @description Placeholders are filled in one pass from the constants.
   * @input '{min}-{max} {other}'; translate returning 'Min {min}'.
   * @output '8-16 {other}'; 'Min 8' requested from 'password-policy.error_message'.
   */
  it('fills the length placeholders', () => {
    expect(fillPasswordLimits('{min}-{max} {other}')).toBe(`${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} {other}`);
    const translate = jasmine.createSpy('translate').and.returnValue('Min {min}');
    expect(getPasswordErrorMessage(translate)).toBe('Min 8');
    expect(translate).toHaveBeenCalledWith('password-policy.error_message');
  });
});
