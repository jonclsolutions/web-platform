/**
 * @file password-policy.ts
 * @path src/app/shared/constants/password-policy.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Single source of truth of the password rules across the whole application (admin
 * user creation, admin reset of another user's password, self-service change in personal-info,
 * the public "forgotten password" flow). The backend (Laravel `Password` rule) implements the
 * same policy independently with the same numbers - see the matching FormRequest classes.
 *
 * @note `PASSWORD_SPECIAL_CHARS` is a plain string of allowed characters (not a regex) - the
 * "contains a special character" test uses `.includes()`, not a regex, to avoid escaping errors
 * inside a character class. `PASSWORD_PATTERN` (regex string for the HTML `pattern` attribute /
 * Angular PatternValidator) is derived from it through `escapeForRegexClass()`, so the
 * character set is defined in one place only.
 */

import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export interface PasswordRequirement {
  id: string;
  /** Full admin i18n path of the requirement text, e.g. `password-policy.letter`. */
  labelKey: string;
  test: (password: string) => boolean;
}

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 16;

/*
 * Unicode property regexes - the character classes of Laravel's
 * Illuminate\Validation\Rules\Password, so FE and BE never disagree on e.g. "ž" or "€".
 */
const LETTER_RE = /\p{L}/u;
const DIGIT_RE  = /\p{N}/u;
const SYMBOL_RE = /[\p{Z}\p{S}\p{P}]/u;

/**
 * @description Length in Unicode code points (`mb_strlen` of Laravel's min / max), not UTF-16 units.
 * @param password Raw password.
 * @returns Number of code points.
 */
function codePointLength(password: string): number {
  return [...(password ?? '')].length;
}

/**
 * @description The single implementation of every password rule (finding #37).
 * @note `symbol` = separator, symbol or punctuation (Laravel `symbols()`).
 */
export const PASSWORD_RULE_CHECKS = {
  length: (p: string) => codePointLength(p) >= PASSWORD_MIN_LENGTH && codePointLength(p) <= PASSWORD_MAX_LENGTH,
  letter: (p: string) => LETTER_RE.test(p ?? ''),
  digit:  (p: string) => DIGIT_RE.test(p ?? ''),
  symbol: (p: string) => SYMBOL_RE.test(p ?? ''),
} as const;

/**
 * @description Fills the `{min}` / `{max}` placeholders of a translated password text with
 * the length limits. One pass, so a value can never be re-read as another placeholder.
 * @param text Translated text that may contain `{min}` / `{max}`.
 * @returns The text with the limits filled in.
 */
export function fillPasswordLimits(text: string): string {
  const values: Record<string, number> = { min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH };
  return text.replace(/\{(min|max)\}/g, (_match: string, name: string) => String(values[name]));
}

/**
 * @description Password error message in the current admin language.
 * @param translate Lookup by full i18n path, e.g. `path => i18n.getValue(path)`.
 * @returns The error message in the current admin language.
 * @usage `errorMessage: getPasswordErrorMessage(path => i18n.getValue(path))`
 */
export function getPasswordErrorMessage(translate: (path: string) => string): string {
  return fillPasswordLimits(translate('password-policy.error_message'));
}

/**
 * @description Single requirements of the live checklist (see
 * PasswordRequirementsChecklistComponent) - each is evaluated independently of the regex, so
 * the UI can show WHICH requirement is (not) met.
 */
export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  { id: 'length',  labelKey: 'password-policy.length',  test: PASSWORD_RULE_CHECKS.length },
  { id: 'letter',  labelKey: 'password-policy.letter',  test: PASSWORD_RULE_CHECKS.letter },
  { id: 'digit',   labelKey: 'password-policy.digit',   test: PASSWORD_RULE_CHECKS.digit },
  { id: 'special', labelKey: 'password-policy.special', test: PASSWORD_RULE_CHECKS.symbol },
];

/**
 * @description Whether a password meets every requirement above - for enabling a submit
 * button with exactly the rules the checklist shows.
 * @param password The password to check.
 * @returns True when all requirements pass.
 */
export function meetsPasswordRequirements(password: string): boolean {
  return PASSWORD_REQUIREMENTS.every(requirement => requirement.test(password || ''));
}

/**
 * @description Angular validator of the password policy for reactive forms (replaces the string
 *   `Validators.pattern(PASSWORD_PATTERN)`, which cannot express the Unicode rules).
 * @returns Validator: null for an empty value (leave that to `required`) or a valid password,
 *   `{ pattern: { requiredPattern: 'password-policy' } }` otherwise (same error key as before, so
 *   existing error messages keep working).
 */
export function passwordPolicyValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (value === null || value === undefined || value === '') return null;
    return meetsPasswordRequirements(String(value)) ? null : { pattern: { requiredPattern: 'password-policy' } };
  };
}
