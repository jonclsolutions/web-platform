/**
 * @file password-validation.ts
 * @path src/app/shared/utils/password-validation.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Single client-side source of truth for the password policy rules.
 *              Mirrors the Laravel backend rule
 *              `Password::min(MIN)->max(MAX)->letters()->numbers()->symbols()` so the
 *              frontend can block obviously invalid submits before they hit the API.
 *              The backend remains authoritative - this is a UX pre-check, not security.
 * @refactor-note (2026-10-23) The rules themselves live in `PASSWORD_RULE_CHECKS` of
 *   shared/constants/password-policy (one rule set, finding #37); this file only gives the
 *   per-rule result object used by reset-password.
 * @dependencies
 * - shared/constants/password-policy: PASSWORD_RULE_CHECKS.
 */

import { PASSWORD_RULE_CHECKS } from '../constants/password-policy';

/** Result of checking one password against every policy rule. */
export interface PasswordRuleResult {
  /** Length is within PASSWORD_MIN_LENGTH..PASSWORD_MAX_LENGTH (inclusive). */
  length: boolean;
  /** Contains at least one letter (any script - matches Laravel `letters()` / `\pL`). */
  letter: boolean;
  /** Contains at least one digit (matches Laravel `numbers()` / `\pN`). */
  digit: boolean;
  /** Contains at least one symbol, punctuation or separator (matches Laravel `symbols()`). */
  symbol: boolean;
}

/**
 * @description Evaluates each policy rule separately so the UI (checklist, submit
 *              button) can show exactly which rule is still missing.
 * @param password Raw password as typed by the user.
 * @returns Per-rule pass/fail map.
 * @note Length counts Unicode code points, the same way PHP `mb_strlen` does in Laravel's
 *       `min`/`max` rules (see PASSWORD_RULE_CHECKS).
 */
export function checkPasswordRules(password: string): PasswordRuleResult {
  return {
    length: PASSWORD_RULE_CHECKS.length(password),
    letter: PASSWORD_RULE_CHECKS.letter(password),
    digit:  PASSWORD_RULE_CHECKS.digit(password),
    symbol: PASSWORD_RULE_CHECKS.symbol(password),
  };
}

/**
 * @description Convenience wrapper - true only when every policy rule passes.
 * @param password Raw password as typed by the user.
 * @returns Whether the password satisfies the whole policy.
 */
export function isPasswordValid(password: string): boolean {
  return Object.values(checkPasswordRules(password)).every(Boolean);
}