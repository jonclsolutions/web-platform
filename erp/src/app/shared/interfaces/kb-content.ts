/**
 * @file kb-content.ts
 * @path src/app/shared/interfaces/kb-content.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Data model of the internal manual (Knowledge Base). The WHOLE manual content is
 * static TS data (see kb-pages.data.ts) - no HTTP fetch, no database table. Editing the manual =
 * editing that data file in code (git diff, code review, deploy) - on purpose, it is the manual
 * of a released product, not user-editable content (unlike `EditLegalComponent`, which handles
 * the database-backed GDPR / TOS text).
 *
 * @architecture One page (`KBPage`) = array of sections (`KBSection`), a section = array of
 * blocks (`KBBlock`). `KbArticleComponent` (see kb-article.component.ts) is the ONLY renderer -
 * it renders any page by `page.sections`, switching on `block.type` (`@switch` in the
 * template). A new manual page = a new object in the `KB_PAGES` array of kb-pages.data.ts, NO
 * new component / route / file.
 *
 * @note The only exception is `support-form` - it stays an explicit component / route (real
 * logic - reactive form, file upload, POST to `web/support_tickets`), not static text, so it
 * does not belong to this block model.
 */

/** @description Text field available in all supported admin languages. */
export interface LocalizedText {
  cz: string;
  en: string;
  /** Index signature for `resolveLoc()` - allows safe access through a dynamic language key
   * (`loc[lang]`) without an `as unknown as Record<...>` cast, which TS otherwise refuses
   * because of insufficient type overlap. */
  [key: string]: string;
}

/**
 * @description Returns the text in the current language, with a fallback to Czech when the key
 * is missing for the language (future languages beyond cz / en).
 */
export function resolveLoc(loc: LocalizedText, lang: string): string {
  return loc[lang] ?? loc.en;
}

/** @description Stable, NOT translated identifier of a left menu section. Lower case on
 * purpose - matches the JSON keys `knowledge-base.nav_group_{key}` (AdminLocalizationService),
 * see KnowledgeBaseComponent.buildNavGroups(). */
export type KBNavGroupKey = 'general' | 'roles' | 'web' | 'core' | 'shop';

/** Plain paragraph of text. */
export interface KBTextBlock {
  type: 'text';
  content: LocalizedText;
}

/** Highlighted lead paragraph (larger font, `--text-muted`) - typically one per page, right below the heading. */
export interface KBLeadBlock {
  type: 'lead';
  content: LocalizedText;
}

/** Colored box for an important notice. */
export interface KBAlertBlock {
  type: 'alert';
  variant: 'info' | 'warning' | 'success' | 'danger';
  content: LocalizedText;
}

/** Image (e.g. a screenshot of the button / modal the text refers to). */
export interface KBImageBlock {
  type: 'image';
  /** Path under `/assets/kb/...` - see the note on KB_PAGES about image placement. The file path
   * itself is NOT text to translate, it stays a plain string. */
  path: string;
  alt: LocalizedText;
  caption?: LocalizedText;
}

/** Link - either an internal `routerLink` (to the admin section it describes) or an external `href`. */
export interface KBLinkBlock {
  type: 'link';
  label: LocalizedText;
  /** Target URL / route - NOT text to translate, it stays a plain string. */
  url: string;
  /** true = opens in a new window (`target="_blank"`, external URL); false / missing = `routerLink` inside the app. */
  external?: boolean;
}

/** Bulleted or numbered list - typically for step-by-step procedures. */
export interface KBListBlock {
  type: 'list';
  ordered?: boolean;
  items: LocalizedText[];
}

/** One card of `KBGridBlock`. */
export interface KBGridCard {
  title: LocalizedText;
  text: LocalizedText;
}

/** Grid of 2-4 cards side by side (same pattern as `.grid-layout .info-card` in introductions). */
export interface KBGridBlock {
  type: 'grid';
  cards: KBGridCard[];
}

/** One step of `KBFlowBlock`. */
export interface KBFlowStep {
  label: LocalizedText;
  text: LocalizedText;
  /** Highlights the step as "current / default" (same pattern as `.flow-item.active`). */
  active?: boolean;
}

/** Horizontal procedure / process (same pattern as `.process-flow` in introductions). */
export interface KBFlowBlock {
  type: 'flow';
  steps: KBFlowStep[];
}

/** Closing note at the end of a page / section (same pattern as `.note-box.highlight-note`). */
export interface KBNoteBlock {
  type: 'note';
  highlight?: boolean;
  content: LocalizedText;
}

export type KBBlock =
  | KBTextBlock
  | KBLeadBlock
  | KBAlertBlock
  | KBImageBlock
  | KBLinkBlock
  | KBListBlock
  | KBGridBlock
  | KBFlowBlock
  | KBNoteBlock;

/** One section of a page - optional heading (`<h2>`) + array of blocks. A section without `heading` = continuation of the previous visual section without a new heading. */
export interface KBSection {
  heading?: LocalizedText;
  blocks: KBBlock[];
}

/**
 * @description One manual page. `id` is the route segment (`/admin/intranet/knowledge-base/:id`)
 * and the unique key in `KB_PAGES` - must be kebab-case and must not change once published
 * (links from other pages would break).
 */
export interface KBPage {
  /** Route slug, e.g. 'introductions', 'external-links'. Must be unique in KB_PAGES. */
  id: string;
  /** Stable (NOT translated) identifier of the group in the side menu - pages with the same
   * `navGroup` are rendered one below another under one heading. The displayed (translated)
   * group name is looked up through `AdminLocalizationService`, key
   * `knowledge-base.nav_group_{navGroup}`. */
  navGroup: KBNavGroupKey;
  /** Link text in the side menu. */
  navLabel: LocalizedText;
  /** Order inside `navGroup` (ascending) - the order of the GROUPS is derived from the lowest `navOrder` inside them. */
  navOrder: number;
  /** Main `<h1>` heading of the page. */
  header: LocalizedText;
  /**
   * @description Optional documentation note VISIBLE ONLY IN CODE (not rendered on the page) -
   * the permission key / role the function relates to. Only for the developer editing this data
   * file later, so they know which permission the described function requires without looking
   * it up in *.config.ts. Deliberately a plain (single-language) string - never rendered in the
   * UI.
   */
  devNote?: string;
  sections: KBSection[];
}