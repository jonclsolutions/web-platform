/**
 * @file page-titles.model.ts
 * @path src/app/admin/components/page-titles-editor/page-titles.model.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Types of PageTitlesEditorComponent (table `legal_page_titles`; API per area:
 *   `web/page-titles`, `shop/page-titles`, `project-portal/page-titles`; the administration has
 *   no editable titles).
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
 * Area a page belongs to – the id of the application that manages it (its texts page, its
 * languages).
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