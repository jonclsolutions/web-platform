/**
 * @file page-titles.model.ts
 * @path src/app/admin/core-pages/web-settings/page-titles/page-titles.model.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Types for the "Page titles" tab of Website settings
 *   (table `legal_page_titles`, API `legal/config/page-titles`).
 */

/**
 * Language of a public module (`languages/web`, `languages/shop`). Declared here on
 * purpose instead of importing LangMeta from the parent folder barrel ('../') –
 * that barrel also exports WebSettingsComponent, which imports this component,
 * and the circular import broke Angular's static analysis ("Unknown reference").
 * Structurally identical to LangMeta, so both are interchangeable.
 */
export interface PageTitleLang {
  code: string;
  name: string;
  iconUrl?: string | null;
  active: boolean;
  isBuiltIn?: boolean;
}

/**
 * Area a page belongs to – also selects which language set is used.
 * 'admin' = one shared title for the whole administration (uses web languages).
 */
export type PageTitleArea = 'web' | 'shop' | 'admin';

/** One public page and its browser tab title per language code. */
export interface PageTitleRow {
  id: number;
  area: PageTitleArea;
  page_key: string;
  route_path: string;
  title_i18n: Record<string, string>;
  sort_order: number;
}

/** Response of GET / PUT `legal/config/page-titles`. */
export interface PageTitlesResponse {
  page_titles: PageTitleRow[];
}

/** Payload of PUT `legal/config/page-titles` – only changed rows are sent. */
export interface PageTitlesUpdatePayload {
  titles: { id: number; title_i18n: Record<string, string> }[];
}