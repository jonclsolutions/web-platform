/**
 * @file language-url.ts
 * @path src/app/shared/utils/language-url.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Language prefix of the public URLs (`/cs/services`, `/en/shop/cart`,
 *   `/cs/projects/…`): splitting it off, adding it and the mapping between the code in the URL
 *   (ISO 639-1 - Czech is `cs`) and the code of the translations of this project (Czech is `cz`).
 *   The admin and the sign-in pages (`/admin`, `/auth`) have no prefix - their language is a
 *   setting of the user.
 * @usage `splitLanguagePrefix('/cs/services?x=1')` → `{ language: 'cz', path: '/services?x=1' }`;
 *   `withLanguagePrefix('/services', 'cz')` → `/cs/services`.
 * @dependencies none
 * @note Any first segment that looks like a language (two letters, optionally a region:
 *   `de`, `pt-br`) is taken as the language - no route of the application has such a segment.
 *   Whether the language exists is decided by LocalizationService (an unknown one is replaced
 *   by the current language when the URL is written back).
 */

/** First segments of the URLs without a language prefix (admin and sign-in pages). */
export const NON_LOCALIZED_SEGMENTS: readonly string[] = ['admin', 'auth'];

/** A first URL segment that is a language code (`cs`, `en`, `pt-br`). */
const LANGUAGE_SEGMENT = /^[a-z]{2}(?:-[a-z]{2,4})?$/i;

/** Translation code → code in the URL where they differ. */
const URL_CODE_OF: Readonly<Record<string, string>> = { cz: 'cs' };
/** Code in the URL → translation code where they differ (`cz` accepted as an alias of `cs`). */
const LANGUAGE_OF_URL_CODE: Readonly<Record<string, string>> = { cs: 'cz', cz: 'cz' };

/** A URL split into its language and the rest. */
export interface LanguageSplit {
  /** Translation code of the language in the URL (`cz`, `en`), null without a prefix. */
  language: string | null;
  /** The URL without the prefix, always starting with `/` (query and fragment kept). */
  path: string;
}

/**
 * @description Code of a language in the URL.
 * @param code Translation code (`cz`, `en`, `de`).
 * @returns URL code (`cs`, `en`, `de`), lower case.
 */
export function urlCodeOfLanguage(code: string): string {
  const lower = code.toLowerCase();
  return URL_CODE_OF[lower] ?? lower;
}

/**
 * @description Translation code of a language code from the URL.
 * @param urlCode Code from the URL (`cs`, `cz`, `EN`).
 * @returns Translation code (`cz`, `en`), lower case.
 */
export function languageOfUrlCode(urlCode: string): string {
  const lower = urlCode.toLowerCase();
  return LANGUAGE_OF_URL_CODE[lower] ?? lower;
}

/**
 * @description Splits the language prefix off a URL.
 * @param url Path of a URL with query / fragment (`/cs/services?x=1#a`, `cs`, `/`).
 * @returns The language (null without a prefix) and the rest of the URL.
 */
export function splitLanguagePrefix(url: string): LanguageSplit {
  const normalized = url.startsWith('/') ? url : `/${url}`;
  const match = /^\/([^/?#]+)(.*)$/.exec(normalized);
  if (!match || !LANGUAGE_SEGMENT.test(match[1])) {
    return { language: null, path: normalized };
  }
  const rest = match[2];
  return { language: languageOfUrlCode(match[1]), path: rest.startsWith('/') ? rest : `/${rest}` };
}

/**
 * @description The URL without its language prefix (for comparisons with route paths).
 * @param url Router URL (`/cs/maintenance?return=…`).
 * @returns `/maintenance?return=…`; a URL without a prefix unchanged.
 */
export function stripLanguagePrefix(url: string): string {
  return splitLanguagePrefix(url).path;
}

/**
 * @description Whether a URL (without prefix) is one of the public pages that carry the language.
 * @param path URL without the language prefix (`/services`, `/admin/web`, `/`).
 * @returns false for `/admin…` and `/auth…`, true otherwise.
 */
export function isLocalizedPath(path: string): boolean {
  const first = path.replace(/^\/+/, '').split(/[/?#]/)[0];
  return !NON_LOCALIZED_SEGMENTS.includes(first);
}

/**
 * @description Adds the language prefix to a public URL (admin / sign-in URLs stay as they are).
 * @param path URL without a prefix (`/services`, `/`, `/?x=1`, `/admin`).
 * @param language Translation code of the language (`cz`, `en`).
 * @returns `/cs/services`, `/cs`, `/cs?x=1`, `/admin`.
 */
export function withLanguagePrefix(path: string, language: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (!language || !isLocalizedPath(normalized)) {
    return normalized;
  }
  const prefix = `/${urlCodeOfLanguage(language)}`;
  // The root keeps no trailing slash: `/` → `/cs`, `/?x=1` → `/cs?x=1`.
  return /^\/(?=[?#]|$)/.test(normalized) ? prefix + normalized.slice(1) : prefix + normalized;
}
