/**
 * @file password-policy.ts
 * @path src/app/shared/constants/password-policy.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Jediný zdroj pravdy pro pravidla hesla napříč celou aplikací (admin
 * vytvoření uživatele, admin reset cizího hesla, self-service změna v personal-info,
 * veřejný "zapomenuté heslo" flow). Backend (Laravel `Password` rule) implementuje
 * stejnou politiku nezávisle, ale se stejnými čísly - viz odpovídající FormRequest třídy.
 *
 * @note `PASSWORD_SPECIAL_CHARS` je čistý řetězec povolených znaků (ne regex) - test na
 * "obsahuje speciální znak" se dělá přes `.includes()`, ne regexem, aby se předešlo
 * chybám s escapováním uvnitř znakové třídy. `PASSWORD_PATTERN` (regex string pro HTML
 * `pattern` atribut / Angular PatternValidator) se z něj odvozuje automaticky přes
 * `escapeForRegexClass()`, takže existuje jen jedno místo, kde se sada znaků definuje.
 *
 * @refactor-note (2026-10-09) i18n: every requirement carries `labelKey` (admin i18n
 * section `password-policy`), translated by PasswordRequirementsChecklistComponent. The
 * `{min}` / `{max}` placeholders are filled from the length constants, so the numbers stay
 * defined only here. The hardcoded Czech `label` and `PASSWORD_ERROR_MESSAGE` were removed
 * (no callers left); use `labelKey` and `getPasswordErrorMessage()`.
 *
 * @bugfix-note (2026-10-23) Open finding #37 - there were TWO rule sets: this file checked ASCII
 *   letters, a fixed list of special characters and the UTF-16 length (`PASSWORD_PATTERN`,
 *   compiled by Angular WITHOUT the `u` flag), `utils/password-validation.ts` the Unicode rules of
 *   the Laravel `Password` rule. Activation, personal info, administrators and the checklist
 *   refused passwords the API accepts (`§`, `€`, `ž`-only letters, …). Now ONE rule set
 *   (`PASSWORD_RULE_CHECKS`, Unicode like Laravel `letters()->numbers()->symbols()`, length in code
 *   points like `mb_strlen`) used everywhere; forms validate with `passwordPolicyValidator()` /
 *   the `appPasswordPolicy` directive instead of a string pattern. `PASSWORD_PATTERN` and
 *   `PASSWORD_SPECIAL_CHARS` were removed.
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
 * @description Jednotlivé požadavky pro live checklist (viz
 * PasswordRequirementsChecklistComponent) - každý se vyhodnocuje nezávisle na regexu,
 * aby šlo v UI zeleně/šedě odlišit KTERÝ konkrétní požadavek je/není splněný.
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
