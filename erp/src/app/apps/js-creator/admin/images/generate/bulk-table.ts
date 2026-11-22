/**
 * @file bulk-table.ts
 * @path src/app/apps/js-creator/admin/images/generate/bulk-table.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Rules of bulk generating from a table (pure functions, no Angular): a CSV or XLSX
 *   file is read ONLY in the browser (never uploaded) - the first row holds the names of the
 *   columns, every further non-empty row is one output (a set: one per template).
 *   - CSV: UTF-8 (with or without BOM) or Windows-1250 (Czech Excel), delimiter `;`, `,` or tab
 *     taken from the first row, quotes and line breaks in quotes (RFC 4180);
 *   - XLSX: the first sheet through the `xlsx` package (loaded only when needed), cells as they
 *     are shown (formatted text);
 *   - columns are mapped to fields by the key or the label of the field (case and diacritics
 *     ignored), the name of the output and the text of the post have their own columns;
 *   - an image cell names a photo chosen from the computer (file name, with or without the
 *     extension), otherwise an image of the library (its name) - matched ignoring case.
 *   Limits: BULK_LIMITS (file size, rows, columns, characters of a cell).
 * @dependencies document.ts (Field), js-creator.models.ts (CreatorAsset), xlsx (lazy).
 */

import { Field } from '../../shared/render/document';
import { CreatorAsset } from '../../shared/js-creator.models';

/** Limits of a table. */
export const BULK_LIMITS = {
  /** Largest file (bytes). */
  fileBytes: 5 * 1024 * 1024,
  /** Most data rows (outputs; a set makes one per template). */
  rows: 200,
  /** Most columns. */
  columns: 60,
  /** Longest cell (characters; longer cells are cut and refused as too long by the form). */
  cell: 5000,
};

/** File types of the picker. */
export const BULK_TABLE_ACCEPT = '.csv,.tsv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Mapping key of the column with the name of the output. */
export const NAME_COLUMN = '__name';
/** Mapping key of the column with the text of the post. */
export const CAPTION_COLUMN = '__caption';

/** Header names recognised as the name of the output / the text of the post (normalised). */
const NAME_HEADERS = ['nazev', 'nazev_vystupu', 'name', 'output', 'output_name'];
const CAPTION_HEADERS = ['text_prispevku', 'prispevek', 'caption', 'post', 'post_text'];

/** Why a table cannot be used. */
export type BulkTableError = 'type' | 'too_large' | 'unreadable' | 'empty' | 'too_many_rows' | 'too_many_columns';

/** A table that cannot be used (the code names the reason). */
export class BulkTableException extends Error {
  /**
   * @param code Reason.
   */
  constructor(readonly code: BulkTableError) {
    super(code);
  }
}

/** A read table: names of the columns and the data rows (cells as text). */
export interface BulkTable {
  headers: string[];
  rows: string[][];
}

/** Column of each field (and of the name / text of the post); null = not used. */
export type BulkMapping = Record<string, number | null>;

/** One data row prepared for generating. */
export interface BulkRow {
  /** Number of the row in the table (1 = the first data row). */
  index: number;
  /** Texts of the text fields. */
  texts: Record<string, string>;
  /** Names of images of the image fields (empty cells left out). */
  imageNames: Record<string, string>;
  /** Name of the output ('' = the default). */
  name: string;
  /** Text of the post (null = filled from the pattern). */
  caption: string | null;
}

/** An image found for a cell: a photo of the computer or an image of the library. */
export type BulkImage = { kind: 'local'; file: File } | { kind: 'asset'; asset: CreatorAsset };

/**
 * @description Reads a table from a file of the computer (only in the browser).
 * @param file CSV / TSV / TXT or XLSX.
 * @returns Header and data rows (empty rows left out).
 * @throws BulkTableException when the file is not a table or over the limits.
 */
export async function readTable(file: File): Promise<BulkTable> {
  const extension = (file.name.split('.').pop() ?? '').toLowerCase();
  if (!['csv', 'tsv', 'txt', 'xlsx'].includes(extension)) throw new BulkTableException('type');
  if (file.size > BULK_LIMITS.fileBytes) throw new BulkTableException('too_large');
  let cells: string[][];
  try {
    const buffer = await file.arrayBuffer();
    cells = extension === 'xlsx' ? await readXlsx(buffer) : parseCsv(decodeText(buffer));
  } catch (error) {
    if (error instanceof BulkTableException) throw error;
    throw new BulkTableException('unreadable');
  }
  return toTable(cells);
}

/**
 * @description Header and data rows of parsed cells: trims the cells, leaves out empty rows,
 *   names empty headers, checks the limits.
 * @param cells Rows of cells (first = header).
 * @throws BulkTableException empty / too many rows / too many columns.
 */
export function toTable(cells: string[][]): BulkTable {
  const rows = cells.map(row => row.map(cell => String(cell ?? '').replace(/\r\n?/g, '\n').trim().slice(0, BULK_LIMITS.cell)))
    .filter(row => row.some(cell => cell !== ''));
  if (rows.length < 2) throw new BulkTableException('empty');
  const width = Math.max(...rows.map(row => row.length));
  if (width > BULK_LIMITS.columns) throw new BulkTableException('too_many_columns');
  if (rows.length - 1 > BULK_LIMITS.rows) throw new BulkTableException('too_many_rows');
  const headers = Array.from({ length: width }, (_, i) => rows[0][i] || `#${i + 1}`);
  return { headers, rows: rows.slice(1).map(row => Array.from({ length: width }, (_, i) => row[i] ?? '')) };
}

/**
 * @description Text of a CSV file: UTF-8 (a BOM is dropped), or Windows-1250 when the bytes are
 *   not UTF-8 (CSV saved by a Czech Excel).
 * @param buffer Bytes of the file.
 */
export function decodeText(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('windows-1250').decode(buffer);
  }
}

/**
 * @description Parses CSV (RFC 4180): fields in double quotes may hold the delimiter, line breaks
 *   and doubled quotes; the delimiter (`;`, `,`, tab) is the most frequent one of the first row
 *   outside quotes.
 * @param text Text of the file.
 * @returns Rows of cells.
 */
export function parseCsv(text: string): string[][] {
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"' && cell === '') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/**
 * @description Delimiter of a CSV: the most frequent of `;`, `,` and tab in the first row
 *   outside quotes (`;` when none - the Czech default).
 * @param text Text of the file.
 */
export function detectDelimiter(text: string): ';' | ',' | '\t' {
  const counts = { ';': 0, ',': 0, '\t': 0 };
  let quoted = false;
  for (const char of text) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && (char === '\n' || char === '\r')) break;
    else if (!quoted && char in counts) counts[char as keyof typeof counts]++;
  }
  const best = (Object.entries(counts) as [keyof typeof counts, number][]).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : ';';
}

/**
 * @description Comparable form of a name: lower case, without diacritics, other characters as `_`.
 * @param value Header, key or label.
 */
export function normalizeName(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/**
 * @description Columns found for the fields (by the key or the label), for the name of the output
 *   and the text of the post; a column is used once.
 * @param headers Names of the columns.
 * @param fields Fields of the form.
 */
export function autoMapping(headers: readonly string[], fields: readonly Field[]): BulkMapping {
  const normalized = headers.map(normalizeName);
  const used = new Set<number>();
  const find = (names: string[]): number | null => {
    const index = normalized.findIndex((header, i) => !used.has(i) && header !== '' && names.includes(header));
    if (index < 0) return null;
    used.add(index);
    return index;
  };
  const mapping: BulkMapping = {};
  for (const field of fields) mapping[field.key] = find([normalizeName(field.key)]);
  for (const field of fields) mapping[field.key] ??= find([normalizeName(field.label)]);
  mapping[NAME_COLUMN] = find(NAME_HEADERS);
  mapping[CAPTION_COLUMN] = find(CAPTION_HEADERS);
  return mapping;
}

/**
 * @description Data rows with the values of the mapped columns.
 * @param table Read table.
 * @param mapping Column of each field / name / text of the post.
 * @param fields Fields of the form.
 */
export function tableRows(table: BulkTable, mapping: BulkMapping, fields: readonly Field[]): BulkRow[] {
  const cell = (row: string[], key: string): string => {
    const index = mapping[key];
    return index === null || index === undefined ? '' : row[index] ?? '';
  };
  return table.rows.map((row, i) => {
    const texts: Record<string, string> = {};
    const imageNames: Record<string, string> = {};
    for (const field of fields) {
      const value = cell(row, field.key);
      if (field.type === 'text') texts[field.key] = value;
      else if (value) imageNames[field.key] = value;
    }
    const caption = cell(row, CAPTION_COLUMN);
    return { index: i + 1, texts, imageNames, name: cell(row, NAME_COLUMN), caption: caption || null };
  });
}

/**
 * @description Image named by a cell: a chosen photo of the computer (file name, with or without
 *   the extension), otherwise an image of the library (its name, with or without the extension);
 *   case is ignored.
 * @param value Text of the cell.
 * @param files Photos chosen for the table.
 * @param assets Images of the library (null = not loaded).
 */
export function matchImage(value: string, files: readonly File[], assets: readonly CreatorAsset[] | null): BulkImage | null {
  const wanted = comparable(value);
  if (!wanted) return null;
  const same = (name: string) => comparable(name) === wanted || comparable(withoutExtension(name)) === wanted;
  const file = files.find(f => same(f.name));
  if (file) return { kind: 'local', file };
  const asset = assets?.find(a => same(a.name));
  return asset ? { kind: 'asset', asset } : null;
}

/**
 * @description Sample CSV for the fields (header and one row with the samples of the fields),
 *   with `;` as the delimiter and a BOM so Excel opens Czech letters right.
 * @param fields Fields of the form.
 */
export function sampleCsv(fields: readonly Field[]): string {
  const quote = (value: string) => (/[";\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  const header = ['nazev', ...fields.map(f => f.key), 'text_prispevku'];
  const sample = ['', ...fields.map(f => (f.type === 'text' ? f.sample || f.label : 'foto.jpg')), ''];
  return `﻿${header.map(quote).join(';')}\r\n${sample.map(quote).join(';')}\r\n`;
}

/**
 * @description Reads the first sheet of an XLSX workbook (the `xlsx` package is loaded only now).
 * @param buffer Bytes of the file.
 * @returns Rows of cells as they are shown.
 */
async function readXlsx(buffer: ArrayBuffer): Promise<string[][]> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'array', sheetRows: BULK_LIMITS.rows + 50, cellFormula: false, cellHTML: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new BulkTableException('empty');
  return XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '', blankrows: false });
}

/**
 * @description Name for comparing (Unicode NFC, lower case, trimmed).
 * @param value Name.
 */
function comparable(value: string): string {
  return value.normalize('NFC').trim().toLocaleLowerCase('cs-CZ');
}

/**
 * @description Name without its extension (`foto.jpg` → `foto`).
 * @param name File name.
 */
function withoutExtension(name: string): string {
  return name.replace(/\.[a-z0-9]{2,5}$/i, '');
}
