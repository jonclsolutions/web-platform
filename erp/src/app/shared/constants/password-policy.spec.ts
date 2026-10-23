/**
 * @file password-policy.spec.ts
 * @path src/app/shared/constants/password-policy.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of the admin password policy constants: PASSWORD_PATTERN (HTML /
 *   Angular pattern string), the per-requirement checks of the checklist,
 *   meetsPasswordRequirements() and the {min} / {max} placeholder filling.
 * @note These checks are ASCII-only (letters A-Z, the listed special characters) while the API
 *   and `utils/password-validation.ts` accept any Unicode letter / symbol - see open finding
 *   "two password rule sets" (claude/open-findings.md). The tests pin the CURRENT behaviour.
 */

import {
  PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, PASSWORD_PATTERN, PASSWORD_REQUIREMENTS, PASSWORD_SPECIAL_CHARS,
  fillPasswordLimits, getPasswordErrorMessage, meetsPasswordRequirements
} from './password-policy';

describe('password-policy', () => {
  /** Same compilation Angular's PatternValidator does for a string pattern. */
  const pattern = new RegExp(PASSWORD_PATTERN);

  /**
   * @description The pattern requires 8-16 chars, a letter, a digit and one of the special
   *   characters - every special character (incl. regex-class meta chars ] \ ^ -) is accepted.
   * @input 'abcdef1!' / too short / too long / no digit / no letter / no special; each special char.
   * @output true / false … ; every 'abcdef1' + char matches.
   */
  it('builds a pattern matching the policy', () => {
    expect(pattern.test('abcdef1!')).toBeTrue();
    expect(pattern.test('abcd1!')).toBeFalse();
    expect(pattern.test('abcdefghijklmn1!x')).toBeFalse();
    expect(pattern.test('abcdefg!')).toBeFalse();
    expect(pattern.test('1234567!')).toBeFalse();
    expect(pattern.test('abcdefg1')).toBeFalse();
    for (const ch of PASSWORD_SPECIAL_CHARS) {
      expect(pattern.test('abcdef1' + ch)).withContext(ch).toBeTrue();
    }
  });

  /**
   * @description Each checklist requirement is evaluated on its own; all must pass.
   * @input '' ; 'abc'; 'abcdefg1'; 'abcdefg1#'.
   * @output Per requirement results; meetsPasswordRequirements false, false, false, true (null → false).
   */
  it('evaluates the checklist requirements', () => {
    const results = (p: string) => PASSWORD_REQUIREMENTS.map(r => [r.id, r.test(p)]);
    expect(results('abc')).toEqual([['length', false], ['letter', true], ['digit', false], ['special', false]]);
    expect(results('abcdefg1#')).toEqual([['length', true], ['letter', true], ['digit', true], ['special', true]]);
    expect(PASSWORD_REQUIREMENTS.map(r => r.labelKey)).toEqual(['password-policy.length', 'password-policy.letter', 'password-policy.digit', 'password-policy.special']);

    expect(meetsPasswordRequirements('')).toBeFalse();
    expect(meetsPasswordRequirements(null as any)).toBeFalse();
    expect(meetsPasswordRequirements('abcdefg1')).toBeFalse();
    expect(meetsPasswordRequirements('abcdefg1#')).toBeTrue();
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
