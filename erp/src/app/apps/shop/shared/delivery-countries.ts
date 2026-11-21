/**
 * @file delivery-countries.ts
 * @path src/app/apps/shop/shared/delivery-countries.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Countries the e-shop can deliver to (audit U-02): the ISO 3166-1 alpha-2 codes a
 *   shipping method may serve (admin) and the checkout offers, and their names in the language of
 *   the page (Intl.DisplayNames - no translation keys needed).
 * @note Must match App\Apps\Shop\Support\DeliveryCountries::CODES of the API. Orders from before
 *   the countries keep their text ("Czechia") - countryName() returns such a value unchanged.
 * @dependencies none
 */

/** ISO codes a shipping method may deliver to: the EU member states + CH, GB, IS, LI, NO. */
export const DELIVERY_COUNTRIES: readonly string[] = [
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'IT',
  'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
  'CH', 'GB', 'IS', 'LI', 'NO',
];

/** Postal code of Czechia and Slovakia: 3 + 2 digits, optional space (other countries: a general shape). */
const POSTAL_CODE_CZ_SK = /^\d{3}\s?\d{2}$/;
const POSTAL_CODE_GENERAL = /^[A-Za-z0-9][A-Za-z0-9 -]{1,9}$/;

/**
 * @description Name of a country in a language of the application ('cz' = Czech); a value that
 *   is not a known code (legacy text, empty) is returned unchanged.
 * @param code ISO code (or a legacy text).
 * @param lang Language code of the application.
 * @returns The name.
 */
export function countryName(code: string | null | undefined, lang: string): string {
  const value = code ?? '';
  if (!DELIVERY_COUNTRIES.includes(value)) return value;
  try {
    const names = new Intl.DisplayNames([lang === 'cz' ? 'cs' : lang], { type: 'region' });
    return names.of(value) ?? value;
  } catch {
    return value;
  }
}

/**
 * @description Countries as options sorted by their name in the language.
 * @param codes ISO codes.
 * @param lang Language code of the application.
 * @returns `{ code, name }` sorted by name.
 */
export function countryOptions(codes: readonly string[], lang: string): { code: string; name: string }[] {
  return codes
    .map(code => ({ code, name: countryName(code, lang) }))
    .sort((a, b) => a.name.localeCompare(b.name, lang === 'cz' ? 'cs' : lang));
}

/**
 * @description Whether a postal code has the shape of the country (CZ / SK strict, others general).
 * @param postalCode Typed postal code.
 * @param country ISO code of the country.
 */
export function isValidPostalCode(postalCode: string, country: string): boolean {
  const value = postalCode.trim();
  return country === 'CZ' || country === 'SK' ? POSTAL_CODE_CZ_SK.test(value) : POSTAL_CODE_GENERAL.test(value);
}
