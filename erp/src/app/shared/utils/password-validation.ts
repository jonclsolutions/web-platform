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
 * @dependencies
 * - shared/constants/password-policy: PASSWORD_MIN_LENGTH / PASSWORD_MAX_LENGTH.
 */

import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from '../constants/password-policy';

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

/*
 * Unicode property regexes - identical character classes to Laravel's
 * Illuminate\Validation\Rules\Password, so FE and BE never disagree on e.g. "ž" or "€".
 */
const LETTER_RE = /\p{L}/u;
const DIGIT_RE  = /\p{N}/u;
const SYMBOL_RE = /[\p{Z}\p{S}\p{P}]/u;

/**
 * @description Evaluates each policy rule separately so the UI (checklist, submit
 *              button) can show exactly which rule is still missing.
 * @param password Raw password as typed by the user.
 * @returns Per-rule pass/fail map.
 * @note Length counts Unicode code points (`[...str]`), the same way PHP `mb_strlen`
 *       does in Laravel's `min`/`max` rules - `str.length` would count UTF-16 units and
 *       miscount emoji.
 */
export function checkPasswordRules(password: string): PasswordRuleResult {
  const length = [...(password ?? '')].length;

  return {
    length: length >= PASSWORD_MIN_LENGTH && length <= PASSWORD_MAX_LENGTH,
    letter: LETTER_RE.test(password ?? ''),
    digit:  DIGIT_RE.test(password ?? ''),
    symbol: SYMBOL_RE.test(password ?? ''),
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