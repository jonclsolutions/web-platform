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
 */

export interface PasswordRequirement {
  id: string;
  /** Full admin i18n path of the requirement text, e.g. `password-policy.letter`. */
  labelKey: string;
  test: (password: string) => boolean;
}

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 16;

/** Povolené speciální znaky - čistý řetězec, žádné regex escapování zde není potřeba. */
export const PASSWORD_SPECIAL_CHARS = `!@#$%^&*()_+-=[]{};:'",.<>/?~`;

/**
 * @description Escapuje znaky, které mají v regex znakové třídě `[...]` speciální
 * význam (`]`, `\`, `^`, `-`), aby šel `PASSWORD_SPECIAL_CHARS` bezpečně vložit do
 * regexu jako literál.
 */
function escapeForRegexClass(chars: string): string {
  return chars.replace(/[\]\\^-]/g, '\\$&');
}

/**
 * @description Regex string pro `[pattern]` binding na `<input>` (HTML5/Angular
 * PatternValidator). Vyžaduje: 8-16 znaků, alespoň jedno písmeno, jednu číslici a
 * jeden speciální znak.
 */
export const PASSWORD_PATTERN =
  `^(?=.*[0-9])(?=.*[A-Za-z])(?=.*[${escapeForRegexClass(PASSWORD_SPECIAL_CHARS)}]).{${PASSWORD_MIN_LENGTH},${PASSWORD_MAX_LENGTH}}$`;

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
  {
    id: 'length',
    labelKey: 'password-policy.length',
    test: (p) => p.length >= PASSWORD_MIN_LENGTH && p.length <= PASSWORD_MAX_LENGTH,
  },
  {
    id: 'letter',
    labelKey: 'password-policy.letter',
    test: (p) => /[A-Za-z]/.test(p),
  },
  {
    id: 'digit',
    labelKey: 'password-policy.digit',
    test: (p) => /[0-9]/.test(p),
  },
  {
    id: 'special',
    labelKey: 'password-policy.special',
    test: (p) => PASSWORD_SPECIAL_CHARS.split('').some(ch => p.includes(ch)),
  },
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