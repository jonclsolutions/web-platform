/**
 * @file content-editor.model.ts
 * @path src/app/admin/web-pages/edit-website/content-editors/content-editor.model.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Types of the content editors of the public website (web/edit-website, tabs FAQ and
 *   Jobs; API web/faq, web/jobs). Every text is stored per language (`{ cz: '...', en: '...' }`).
 * @dependencies none
 */

/** Text per language code; the editor keeps '' for every language of the module. */
export type I18nText = Record<string, string>;

/** Language of the public web module (`languages/web`). */
export interface ContentLang {
  code: string;
  name: string;
  iconUrl?: string | null;
  active: boolean;
  isBuiltIn?: boolean;
}

/**
 * A text that must exist in every language (`optional: false`), or an optional one (heading,
 * type, place) - that one is missing only when it is filled in another language.
 */
export interface CheckedText {
  text: I18nText;
  optional?: boolean;
}

/** One FAQ question (`key` = client-side identity for the lists, never sent). */
export interface FaqItemDraft {
  key: number;
  id: number | null;
  question_i18n: I18nText;
  answer_i18n: I18nText;
}

/** One FAQ category with its questions; `open` = expanded in the editor (not sent). */
export interface FaqCategoryDraft {
  key: number;
  id: number | null;
  name_i18n: I18nText;
  items: FaqItemDraft[];
  open: boolean;
}

/** One block of a job detail (optional heading + text). */
export interface JobSectionDraft {
  key: number;
  id: number | null;
  heading_i18n: I18nText;
  body_i18n: I18nText;
}

/** One open position; `open` = expanded in the editor (not sent). */
export interface JobDraft {
  key: number;
  id: number | null;
  slug: string;
  is_active: boolean;
  title_i18n: I18nText;
  summary_i18n: I18nText;
  type_i18n: I18nText;
  location_i18n: I18nText;
  sections: JobSectionDraft[];
  open: boolean;
}
