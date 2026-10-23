/**
 * @file password-validation.spec.ts
 * @path src/app/shared/utils/password-validation.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of the Unicode password rules (same classes as Laravel
 *   `Password::letters()->numbers()->symbols()`): length in code points, any-script letters,
 *   symbols / punctuation / separators, null-safety and isPasswordValid().
 */

import { checkPasswordRules, isPasswordValid } from './password-validation';

describe('password-validation', () => {
  /**
   * @description Each rule separately; Unicode letters / symbols count; emoji count as 1.
   * @input 'žluťák1§'; 'abc'; '12345678'; '😀😀😀😀😀😀😀a1' (9 code points); 17 chars; null.
   * @output all true; length false …; letter false + symbol false; length true; length false; all false.
   */
  it('checks every rule with Unicode classes', () => {
    expect(checkPasswordRules('žluťák1§')).toEqual({ length: true, letter: true, digit: true, symbol: true });
    expect(checkPasswordRules('abc')).toEqual({ length: false, letter: true, digit: false, symbol: false });
    expect(checkPasswordRules('12345678')).toEqual({ length: true, letter: false, digit: true, symbol: false });
    expect(checkPasswordRules('😀😀😀😀😀😀😀a1').length).toBeTrue();
    expect(checkPasswordRules('a'.repeat(17)).length).toBeFalse();
    expect(checkPasswordRules('pass word1').symbol).toBeTrue();
    expect(checkPasswordRules(null as any)).toEqual({ length: false, letter: false, digit: false, symbol: false });
  });

  /**
   * @description Valid only when every rule passes.
   * @input 'Heslo123€'; 'Heslo123'.
   * @output true; false.
   */
  it('validates the whole policy', () => {
    expect(isPasswordValid('Heslo123€')).toBeTrue();
    expect(isPasswordValid('Heslo123')).toBeFalse();
  });
});
