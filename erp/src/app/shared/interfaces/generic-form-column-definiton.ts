import type { BadgeTones } from '../../admin/components/builders/badge-tones';
/**
 * @file generic-form-column-definiton.ts
 * @path src/app/shared/interfaces/generic-form-column-definiton.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Shape of a single column configuration consumed by `TableBuilderComponent`
 * (table rendering, cell-value resolution) and its export pipeline.
 * @note This file defines ONLY the shape of the column configuration - `exportable` is enforced
 * (filtered on export) by `TableBuilderComponent.buildExportRows()`, not by this interface.
 */
export interface ColumnDefinition {
  key: string;
  header: string;
  /**
   * 'avatar': the value is the signed URL of a profile photo (null = the default image).
   * 'count': a number shown as a highlighted pill when above zero, empty otherwise (e.g. unread messages).
   */
  type: 'text' | 'number' | 'currency' | 'date' | 'boolean' | 'image' | 'link' | 'avatar' | 'count';
  format?: string;
  hidden?: boolean;
  currencyCode?: 'CZK' | 'EUR' | 'USD' | 'GBP' | string;
  exportable?: boolean;
  importable?: boolean;
  /**
   * Main column of a table whose rows open the record popup (`openOnRowClick`): its text is
   * underlined while the row is hovered, as the "title" of the record. Without one, the first
   * shown column after `id` is the main one.
   */
  primary?: boolean;
  /**
   * Coloured label of a status / priority / severity column: value → tone (badge-tones.ts).
   * The cell shows its text in a soft coloured label; tables only (not the detail).
   */
  tones?: BadgeTones;
  /** Field with the raw value of the tone when the cell shows a label of it (e.g. 'status'). */
  toneKey?: string;
  /**
   * Place on the phone card (`mobileCards` of the table builder): 'title' = the heading of the
   * card, 'meta' = always one of its short values, false = never on the card. Unset = chosen
   * automatically (the main column is the title, coloured labels, the first date, up to 2 values).
   */
  mobile?: 'title' | 'meta' | false;
}