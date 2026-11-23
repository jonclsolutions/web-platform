/**
 * @file language-preference.ts
 * @path src/app/shared/utils/language-preference.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Language of a first visit of the public pages (no language chosen yet): the first
 *   language the browser prefers that the public area offers, otherwise English, otherwise the
 *   first language offered. Browser tags are matched by their primary subtag (`en-GB` → `en`);
 *   Czech is `cs` in browsers and `cz` in the translations of this project.
 * @usage `pickInitialLanguage(['cz', 'en'], browserLanguages())` → 'cz' for a Czech browser.
 * @dependencies none
 */

/** Language of a visitor whose browser prefers none of the offered languages. */
export const DEFAULT_PUBLIC_LANGUAGE = 'en';

/** Browser language subtags whose translation code in this project differs (ISO 639-1 → code). */
const BROWSER_TO_CODE: Readonly<Record<string, string>> = { cs: 'cz' };

/**
 * @description Translation code of one browser language tag.
 * @param tag BCP 47 tag of the browser, e.g. `cs-CZ`, `en`, `de-AT`.
 * @returns The code used by the translations ('' for an empty tag), e.g. `cz`, `en`, `de`.
 */
export function languageCodeOfBrowserTag(tag: string): string {
  const primary = (tag || '').trim().toLowerCase().split(/[-_]/)[0];
  return BROWSER_TO_CODE[primary] ?? primary;
}

/**
 * @description Picks the language of a first visit.
 * @param available Codes of the active languages of the public area (in admin order).
 * @param preferred Browser languages in order of preference (`navigator.languages`).
 * @returns The first preferred language offered; else `en` when offered; else the first
 *   language offered; with nothing offered (languages not loaded) `en`.
 */
export function pickInitialLanguage(available: readonly string[], preferred: readonly string[]): string {
  const offered = available.map(code => code.toLowerCase());
  for (const tag of preferred) {
    const code = languageCodeOfBrowserTag(tag);
    const index = code ? offered.indexOf(code) : -1;
    if (index !== -1) {
      return available[index];
    }
  }
  const english = offered.indexOf(DEFAULT_PUBLIC_LANGUAGE);
  if (english !== -1) {
    return available[english];
  }
  return available[0] ?? DEFAULT_PUBLIC_LANGUAGE;
}

/**
 * @description Languages of the browser in order of preference (empty outside a browser).
 * @returns `navigator.languages`, or `[navigator.language]` in older browsers.
 */
export function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') {
    return [];
  }
  if (navigator.languages?.length) {
    return navigator.languages;
  }
  return navigator.language ? [navigator.language] : [];
}
