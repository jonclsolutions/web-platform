/**
 * @file row-button.ts
 * @path src/app/admin/components/builders/row-button-builder/row-button.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Configuration of one button of a row of buttons (RowButtonBuilderComponent):
 *   page tabs, filters, view switches and language tabs of the administration, a helper that
 *   builds the language tabs from the languages of a page and a stable list for page getters.
 * @dependencies AdminIconName (names of the admin icons)
 */

import { AdminIconName } from '../../admin-icon/admin-icon.component';

/** @description One button of a row. */
export interface RowButton {
  /** Value emitted on click and compared with the `active` input of the builder. */
  value: string;
  /** Visible text. */
  label: string;
  /** Admin icon in front of the text (the preferred look). */
  icon?: AdminIconName;
  /** Small image in front of the text instead of an icon (language flag). */
  imageUrl?: string;
  /** Number after the text (null / undefined = none, 0 is shown). */
  count?: number | string | null;
  /** Colour of the number: neutral grey or attention (amber - something waits / is missing). */
  countTone?: 'neutral' | 'attention';
  /** Small amber dot after the text (unsaved changes, a warning). */
  dot?: boolean;
  /** Tooltip. */
  title?: string;
  /** Router link - kind `nav` renders the buttons as links (sub-pages with their own URL). */
  link?: string | readonly unknown[];
  /** Colour of the active button's text: danger = rose (e.g. the trash), attention = amber (e.g. an internal note). */
  tone?: 'default' | 'danger' | 'attention';
  /** Not rendered (e.g. missing permission). */
  hidden?: boolean;
  /** Rendered but not clickable. */
  disabled?: boolean;
}

/** @description Language as the pages of the administration keep it (code, flag, name). */
export interface RowButtonLanguage {
  code: string;
  iconUrl?: string | null;
  name?: string | null;
}

/**
 * @description Language tabs: flag + upper-case code (or the name), optional count / dot per language.
 * @param languages Languages of the page.
 * @param options showName = the name instead of the code; count / dot / title per language code.
 * @returns Buttons with `value` = the language code.
 */
export function languageRowButtons(
  languages: readonly RowButtonLanguage[],
  options: {
    showName?: boolean;
    count?: (code: string) => number | null;
    dot?: (code: string) => boolean;
    title?: (code: string) => string;
  } = {},
): RowButton[] {
  return languages.map(lang => {
    const count = options.count?.(lang.code) || null;
    return {
      value: lang.code,
      label: options.showName && lang.name ? lang.name : lang.code.toUpperCase(),
      imageUrl: lang.iconUrl || undefined,
      count,
      countTone: 'attention' as const,
      dot: options.dot?.(lang.code) ?? false,
      title: options.title?.(lang.code) || undefined,
    };
  });
}

/**
 * @description Stable list of buttons for a getter of a page: returns the previous array while
 *   the buttons are the same, so a template binding does not get a new array on every check
 *   (the builder is OnPush; a new array each time would also fail the dev-mode check).
 * @usage `private readonly tabButtons = new RowButtonItems();`
 *        `get tabItems(): RowButton[] { return this.tabButtons.update([...]); }`
 */
export class RowButtonItems {
  private current: RowButton[] = [];

  /**
   * @description Keeps the previous array when every button has the same values.
   * @param next Freshly built buttons.
   * @returns The previous array (unchanged) or `next`.
   */
  update(next: RowButton[]): RowButton[] {
    const same = next.length === this.current.length && next.every((item, index) => sameButton(item, this.current[index]));
    if (!same) this.current = next;
    return this.current;
  }
}

/** @description Whether two buttons have the same values (the link compared by its content). */
function sameButton(a: RowButton, b: RowButton): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof RowButton>;
  return [...keys].every(key => key === 'link'
    ? JSON.stringify(a.link) === JSON.stringify(b.link)
    : Object.is(a[key], b[key]));
}
