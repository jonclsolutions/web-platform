/**
 * @file kb-content.ts
 * @path src/app/shared/interfaces/kb-content.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Data model of the internal manual (Knowledge Base) as the API delivers it
 * (`GET knowledge-base`, `GET knowledge-base/pages/{id}`). The content lives in JSON files of the
 * API outside the public folder (api/resources/knowledge-base: structure.json + one file per
 * language) and every user gets only the pages / sections of their permissions - see
 * App\Support\KnowledgeBase\KnowledgeBase and api/resources/knowledge-base/README.md (how to edit).
 * Texts arrive already in the requested language.
 *
 * @architecture One page (`KBPage`) = array of sections (`KBSection`), a section = array of
 * blocks (`KBBlock`). `KbArticleComponent` (see kb-article.component.ts) is the ONLY renderer -
 * it renders any page by `page.sections`, switching on `block.type` (`@switch` in the
 * template). A new manual page = a new entry in the JSON files of the API, NO new component /
 * route / file.
 *
 * @note The only exception is `support-form` - it stays an explicit component / route (real
 * logic - reactive form, file upload, POST to `web/support_tickets`), not static text, so it
 * does not belong to this block model.
 */

/** @description Stable, NOT translated identifier of a left menu section. Lower case on
 * purpose - matches the JSON keys `knowledge-base.nav_group_{key}` (AdminLocalizationService),
 * see KnowledgeBaseComponent.buildNavGroups(). */
export type KBNavGroupKey = 'general' | 'roles' | 'web' | 'core' | 'shop';

/** Plain paragraph of text. */
export interface KBTextBlock {
  type: 'text';
  content: string;
}

/** Highlighted lead paragraph (larger font, `--text-muted`) - typically one per page, right below the heading. */
export interface KBLeadBlock {
  type: 'lead';
  content: string;
}

/** Colored box for an important notice. */
export interface KBAlertBlock {
  type: 'alert';
  variant: 'info' | 'warning' | 'success' | 'danger';
  content: string;
}

/** Image (e.g. a screenshot of the button / modal the text refers to). */
export interface KBImageBlock {
  type: 'image';
  /** Path under `/assets/kb/...` (the image file of the frontend). */
  path: string;
  alt: string;
  caption?: string;
}

/** Link - either an internal `routerLink` (to the admin section it describes) or an external `href`. */
export interface KBLinkBlock {
  type: 'link';
  label: string;
  /** Target URL / route. */
  url: string;
  /** true = opens in a new window (`target="_blank"`, external URL); false / missing = `routerLink` inside the app. */
  external?: boolean;
}

/** Bulleted or numbered list - typically for step-by-step procedures. */
export interface KBListBlock {
  type: 'list';
  ordered?: boolean;
  items: string[];
}

/** One card of `KBGridBlock`. */
export interface KBGridCard {
  title: string;
  text: string;
}

/** Grid of 2-4 cards side by side (same pattern as `.grid-layout .info-card` in introductions). */
export interface KBGridBlock {
  type: 'grid';
  cards: KBGridCard[];
}

/** One step of `KBFlowBlock`. */
export interface KBFlowStep {
  label: string;
  text: string;
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
  content: string;
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
  /** Stable key of the section - structure.json can bind a permission to it (e.g. editing chapters). */
  key?: string;
  heading?: string;
  blocks: KBBlock[];
}

/** @description One manual page (`GET knowledge-base/pages/{id}`) - only the allowed sections. */
export interface KBPage {
  /** Route slug (`/intranet/knowledge-base/:id`), kebab-case, stable. */
  id: string;
  /** Menu group (`knowledge-base.nav_group_{group}` of the admin i18n). */
  group: KBNavGroupKey;
  /** Order in the menu. */
  order: number;
  /** Link text in the side menu. */
  navLabel: string;
  /** Main `<h1>` heading of the page. */
  header: string;
  sections: KBSection[];
}

/** @description One item of the side menu (`GET knowledge-base`) - only the pages the user may open. */
export interface KBMenuItem {
  id: string;
  group: KBNavGroupKey;
  order: number;
  label: string;
}
