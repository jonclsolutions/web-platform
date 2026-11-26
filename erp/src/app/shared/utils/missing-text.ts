/**
 * @file missing-text.ts
 * @path src/app/shared/utils/missing-text.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description The text shown in place of a missing one on the public pages (web, e-shop, the
 *   content, the page titles, the visual text editor) - the same as the API puts there
 *   (MissingTranslations::MISSING_TEXT). Never the text of another language: a visitor sees that
 *   something is wrong and is not misled.
 * @usage `import { MISSING_TEXT } from 'shared/utils/missing-text'`
 * @dependencies none
 */

/** Text in place of a missing one (English, always the same). */
export const MISSING_TEXT = 'Cannot load text';
