/**
 * @file table-cards.ts
 * @path src/app/admin/components/builders/table-cards.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Phone cards of the admin tables (2026-11, review point 15): which columns of a
 *   table go where on its compact card - shared by the table builder and the trash table builder,
 *   so both show the same cards. A card has 2 lines: the title and the date, then the coloured
 *   labels and up to 2 short values.
 * @usage `cardLayoutOf(columns)` once per column set; `cardMetaNeedsLabel(column)` per value;
 *   `phoneQuery()` for the phone limit. A column may override its place with `mobile`
 *   ('title' - several are joined, 'meta' - always a value, false - never on the card).
 * @dependencies ColumnDefinition (generic-form-column-definiton.ts).
 */
import { ColumnDefinition } from '../../../shared/interfaces/generic-form-column-definiton';

/** Width up to which the rows are cards - the same phone limit as the footer of the table. */
export const PHONE_QUERY = '(max-width: 640px)';

/** At most this many short values on a card (besides the title, labels and the date). */
export const CARD_META_MAX = 2;

/** Columns of a phone card. */
export interface TableCardLayout {
  /** Heading of the card - one column or several joined by a space (e.g. surname + name). */
  titles: ColumnDefinition[];
  /** Picture on the left (the first image / avatar column). */
  thumb: ColumnDefinition | null;
  /** Coloured labels (columns with `tones`). */
  badges: ColumnDefinition[];
  /** Date on the right of the title (the first date column). */
  date: ColumnDefinition | null;
  /** Up to CARD_META_MAX short values under the title. */
  meta: ColumnDefinition[];
}

/**
 * @description The main column of a table: the column marked `primary`, else the first column
 *   that is not the ID or a picture, else the first column.
 * @param columns Columns of the table.
 * @returns The column, null for no columns.
 */
export function primaryColumnOf(columns: ColumnDefinition[]): ColumnDefinition | null {
  const shown = (columns || []).filter(col => !col.hidden);
  return shown.find(col => col.primary)
    ?? shown.find(col => col.key !== 'id' && col.type !== 'avatar' && col.type !== 'image')
    ?? shown[0]
    ?? null;
}

/**
 * @description Which columns go where on the card. `mobile` decides when set; otherwise the
 *   title is the main column, the picture the first image / avatar column, the labels the
 *   columns with `tones`, the date the first date column and the values up to CARD_META_MAX
 *   other columns - not the ID, not yes / no / count columns and not further dates (they need
 *   their header to mean anything; a column with `mobile: 'meta'` is shown anyway, first).
 * @param columns Columns of the table.
 * @returns The layout of the card.
 */
export function cardLayoutOf(columns: ColumnDefinition[]): TableCardLayout {
  const shown = (columns || []).filter(col => !col.hidden && col.mobile !== false);
  const marked = shown.filter(col => col.mobile === 'title');
  const primary = primaryColumnOf(shown);
  const titles = marked.length ? marked : primary ? [primary] : [];
  const rest = shown.filter(col => !titles.includes(col));
  const thumb = rest.find(col => col.type === 'image' || col.type === 'avatar') ?? null;
  const badges = rest.filter(col => !!col.tones);
  const date = rest.find(col => col.type === 'date' && col.mobile !== 'meta') ?? null;
  const used = new Set<ColumnDefinition | null>([thumb, date, ...badges]);
  const forced = rest.filter(col => col.mobile === 'meta' && !used.has(col));
  const automatic = rest.filter(col => col.mobile !== 'meta' && !used.has(col) && col.key !== 'id'
    && !['boolean', 'count', 'image', 'avatar', 'date'].includes(col.type));
  return { titles, thumb, badges, date, meta: [...forced, ...automatic].slice(0, CARD_META_MAX) };
}

/**
 * @description A short value of a card needs its header ("Téma: Podpora") unless the value
 *   tells what it is by itself - an e-mail, a phone, an address, a price, a date.
 * @param column Column of the value.
 * @returns True when the header is shown before the value.
 */
export function cardMetaNeedsLabel(column: ColumnDefinition): boolean {
  if (['date', 'currency', 'link', 'image', 'avatar'].includes(column.type)) return false;
  return !/e-?mail|phone|tel|url|web|www/i.test(column.key);
}

/**
 * @description Media query of the phone limit (null without a browser window - SSR, tests
 *   without matchMedia).
 * @returns The MediaQueryList or null.
 */
export function phoneQuery(): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(PHONE_QUERY) : null;
}
