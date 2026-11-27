/**
 * @file focus-lang.ts
 * @path src/app/admin/components/translation-editor/focus-lang.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Request of the texts page to an editor of one of its tabs (page titles, FAQ,
 *   positions, references, knowledge base): show this language. Sent when the admin clicks a part
 *   of what a language lacks in the window Jazyky ("FAQ 32") - the tab opens in that language
 *   with its empty fields marked.
 * @usage `<app-faq-editor [focusLang]="focusLang">`; the editor switches to `code` as soon as it
 *   offers the language (after its languages are loaded).
 * @dependencies none
 */

/** One request; `seq` grows with every click, so the same language asked again is applied again. */
export interface FocusLangRequest {
  /** Language code to show. */
  code: string;
  /** Number of the request. */
  seq: number;
}
