/**
 * @file page-titles.model.ts
 * @path src/app/admin/components/page-titles-editor/page-titles.model.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Types of PageTitlesEditorComponent (table `legal_page_titles`; API per area:
 *   `web/page-titles`, `shop/page-titles`, `legal/config/page-titles` for the administration).
 * @dependencies none
 */

/**
 * Language of a public module (`languages/web`, `languages/shop`) - structurally identical to
 * LangMeta of the core settings page, so both are interchangeable.
 */
export interface PageTitleLang {
  code: string;
  name: string;
  iconUrl?: string | null;
  active: boolean;
  isBuiltIn?: boolean;
}

/**
 * Area a page belongs to – also selects the language set and the module that manages it: the id
 * of an application (its texts page, its languages) or 'admin' (core/settings: one shared title
 * for the whole administration, in the languages of every application).
 */
export type PageTitleArea = string;

/** One public page and its browser tab title per language code. */
export interface PageTitleRow {
  id: number;
  area: PageTitleArea;
  page_key: string;
  route_path: string;
  title_i18n: Record<string, string>;
  sort_order: number;
}

/** Payload of PUT of the area's endpoint – only changed rows are sent. */
export interface PageTitlesUpdatePayload {
  titles: { id: number; title_i18n: Record<string, string> }[];
}