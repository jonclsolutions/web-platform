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
 */

export interface PasswordRequirement {
  id: string;
  label: string;
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

export const PASSWORD_ERROR_MESSAGE =
  `Heslo musí mít ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} znaků a obsahovat alespoň jedno písmeno, jednu číslici a jeden speciální znak.`;

/**
 * @description Jednotlivé požadavky pro live checklist (viz
 * PasswordRequirementsChecklistComponent) - každý se vyhodnocuje nezávisle na regexu,
 * aby šlo v UI zeleně/šedě odlišit KTERÝ konkrétní požadavek je/není splněný.
 */
export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  {
    id: 'length',
    label: `${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} znaků`,
    test: (p) => p.length >= PASSWORD_MIN_LENGTH && p.length <= PASSWORD_MAX_LENGTH,
  },
  {
    id: 'letter',
    label: 'Alespoň jedno písmeno',
    test: (p) => /[A-Za-z]/.test(p),
  },
  {
    id: 'digit',
    label: 'Alespoň jedna číslice',
    test: (p) => /[0-9]/.test(p),
  },
  {
    id: 'special',
    label: 'Alespoň jeden speciální znak',
    test: (p) => PASSWORD_SPECIAL_CHARS.split('').some(ch => p.includes(ch)),
  },
];