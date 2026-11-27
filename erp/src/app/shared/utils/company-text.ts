/**
 * @file company-text.ts
 * @path src/app/shared/utils/company-text.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Text of the company profile in the language of the page (tagline, copyright,
 *   footer text - `*_i18n` of `public/legal/config`): the text of that language only, never of
 *   another one. A switched-on text missing in the language is 'Cannot load text' (the admin is
 *   told - the language is not complete); a switched-off one (its map is null) is '' and the
 *   page leaves it out.
 * @usage `companyText(settings?.brand_tagline_i18n, lang)`; SEO passes `''` as the missing text
 *   (no placeholder in the meta tags).
 * @dependencies MISSING_TEXT (./missing-text)
 */

import { MISSING_TEXT } from './missing-text';

/**
 * @description Text of one translated company field in a language.
 * @param texts Texts per language (null / undefined = switched off or no company details).
 * @param lang Language code of the page.
 * @param missing Text for a switched-on field without a text in the language.
 * @returns The text (trimmed), `missing`, or '' when the field is switched off.
 */
export function companyText(texts: Record<string, string> | readonly unknown[] | null | undefined, lang: string, missing: string = MISSING_TEXT): string {
  if (!texts || typeof texts !== 'object') return '';
  const value = (texts as Record<string, unknown>)[lang];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : missing;
}
