/**
 * @file bulk-table.spec.ts
 * @path src/app/apps/js-creator/admin/images/generate/bulk-table.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the rules of bulk generating from a table: CSV parsing (delimiters,
 *   quotes, line breaks, BOM, Windows-1250), XLSX through the xlsx package, limits, mapping of
 *   columns by key / label / special names, rows, matching of images (photos, then the
 *   library) and the sample CSV.
 * @dependencies bulk-table.ts, xlsx (writes a workbook for the test).
 */

import {
  BULK_LIMITS, BulkTableException, CAPTION_COLUMN, NAME_COLUMN, autoMapping, decodeText, detectDelimiter, matchImage, normalizeName, parseCsv,
  readTable, sampleCsv, tableRows, toTable,
} from './bulk-table';
import { Field } from '../../shared/render/document';
import { CreatorAsset } from '../../shared/js-creator.models';

/** Fields of the tests: title (text), Cena (text, label only), photo (image). */
const FIELDS: Field[] = [
  { key: 'title', type: 'text', label: 'Nadpis', help: '', required: true, sample: 'Léto', maxLength: 80, multiline: false },
  { key: 'price', type: 'text', label: 'Cena', help: '', required: false, sample: '', maxLength: 20, multiline: false },
  { key: 'photo', type: 'image', label: 'Fotka', help: '', required: false, minWidth: 0, minHeight: 0 },
];

/**
 * @description Library image of the tests.
 * @param id Id.
 * @param name Name.
 */
function asset(id: number, name: string): CreatorAsset {
  return { id, name, mime: 'image/png', width: 10, height: 10, size_bytes: 1, url: `/a/${id}`, thumb_url: `/t/${id}`, created_at: null, deleted_at: null };
}

describe('bulk-table', () => {
  /**
   * @description CSV: the delimiter of the first row, quoted cells with the delimiter, doubled
   *   quotes and line breaks, CRLF, a BOM, a last row without a line break.
   * @input `nazev;title\r\n"A; B";"Řádek 1\nŘádek 2"\r\nC;"Mluví ""tiše"""` and a comma / tab file
   * @output rows with the exact cells; delimiters ; , tab; `;` without any
   */
  it('parses CSV', () => {
    const text = 'nazev;title\r\n"A; B";"Řádek 1\nŘádek 2"\r\nC;"Mluví ""tiše"""';
    expect(parseCsv(text)).toEqual([['nazev', 'title'], ['A; B', 'Řádek 1\nŘádek 2'], ['C', 'Mluví "tiše"']]);
    expect(detectDelimiter('a,b,"c;d"\n1;2;3')).toBe(',');
    expect(detectDelimiter('a\tb\tc')).toBe('\t');
    expect(detectDelimiter('single')).toBe(';');
    const utf = new TextEncoder().encode('﻿žluťoučký');
    expect(decodeText(utf.buffer as ArrayBuffer)).toBe('žluťoučký');
    // "žluť" in Windows-1250: ž = 0x9E, l, u, ť = 0x9D
    expect(decodeText(new Uint8Array([0x9e, 0x6c, 0x75, 0x9d]).buffer)).toBe('žluť');
  });

  /**
   * @description A table: trimmed cells, empty rows left out, missing headers named, limits.
   * @input header + rows with spaces and an empty row; only a header; 201 rows; 61 columns
   * @output 2 data rows of equal width; errors empty / too_many_rows / too_many_columns
   */
  it('checks the limits of a table', () => {
    const table = toTable([['title', '', 'x'], [' A ', 'b'], ['', '', ''], ['C', '', 'd']]);
    expect(table.headers).toEqual(['title', '#2', 'x']);
    expect(table.rows).toEqual([['A', 'b', ''], ['C', '', 'd']]);
    const code = (cells: string[][]) => {
      try {
        toTable(cells);
        return null;
      } catch (error) {
        return (error as BulkTableException).code;
      }
    };
    expect(code([['title']])).toBe('empty');
    expect(code([['title'], ...Array.from({ length: BULK_LIMITS.rows + 1 }, () => ['x'])])).toBe('too_many_rows');
    expect(code([Array.from({ length: BULK_LIMITS.columns + 1 }, (_, i) => `c${i}`), ['x']])).toBe('too_many_columns');
  });

  /**
   * @description Reading files: a CSV, an XLSX written by the xlsx package, a wrong type and a
   *   too large file.
   * @input data.csv; data.xlsx with a number cell; notes.pdf; 6 MB csv
   * @output the same table from both; error type; error too_large
   */
  it('reads CSV and XLSX files', async () => {
    const csv = new File(['nazev;Nadpis;cena\nPrvní;Léto **50 %**;199'], 'data.csv', { type: 'text/csv' });
    const expected = { headers: ['nazev', 'Nadpis', 'cena'], rows: [['První', 'Léto **50 %**', '199']] };
    expect(await readTable(csv)).toEqual(expected);

    const XLSX = await import('xlsx');
    const sheet = XLSX.utils.aoa_to_sheet([['nazev', 'Nadpis', 'cena'], ['První', 'Léto **50 %**', 199]]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Data');
    const bytes = XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    expect(await readTable(new File([bytes], 'data.xlsx'))).toEqual(expected);

    await expectAsync(readTable(new File(['x'], 'notes.pdf'))).toBeRejectedWith(new BulkTableException('type'));
    const big = new File([new Uint8Array(BULK_LIMITS.fileBytes + 1)], 'big.csv');
    await expectAsync(readTable(big)).toBeRejectedWith(new BulkTableException('too_large'));
  });

  /**
   * @description Mapping: by the key, then by the label (case and diacritics ignored); the name and
   *   the text of the post by their own headers; rows with the mapped cells.
   * @input headers ["Název", "TITLE", "cena", "Fotka", "Text příspěvku", "jiné"]; two rows
   * @output title 1, price 2, photo 3, name 0, caption 4; rows with texts, image names, name, caption (null when empty)
   */
  it('maps columns and prepares rows', () => {
    expect(normalizeName(' Text příspěvku ')).toBe('text_prispevku');
    const headers = ['Název', 'TITLE', 'cena', 'Fotka', 'Text příspěvku', 'jiné'];
    const mapping = autoMapping(headers, FIELDS);
    expect(mapping).toEqual({ title: 1, price: 2, photo: 3, [NAME_COLUMN]: 0, [CAPTION_COLUMN]: 4 });
    const rows = tableRows({ headers, rows: [['A', 'Léto', '199', 'foto.jpg', 'Ahoj', 'x'], ['', 'Zima', '', '', '', '']] }, mapping, FIELDS);
    expect(rows[0]).toEqual({ index: 1, texts: { title: 'Léto', price: '199' }, imageNames: { photo: 'foto.jpg' }, name: 'A', caption: 'Ahoj' });
    expect(rows[1]).toEqual({ index: 2, texts: { title: 'Zima', price: '' }, imageNames: {}, name: '', caption: null });
    expect(tableRows({ headers, rows: [['A', 'B', 'C', 'D', 'E', 'F']] }, { ...mapping, title: null }, FIELDS)[0].texts['title']).toBe('');
  });

  /**
   * @description Images: a chosen photo by its file name (with or without the extension, any
   *   case), otherwise a library image by its name; nothing else.
   * @input photos [Foto.JPG]; library [logo.png, Pozadí]; cells "foto.jpg", "FOTO", "Logo", "pozadí.webp", "chybí", ""
   * @output local Foto.JPG twice; asset 1; asset 2; null; null
   */
  it('matches images by name', () => {
    const photo = new File(['x'], 'Foto.JPG');
    const library = [asset(1, 'logo.png'), asset(2, 'Pozadí')];
    expect(matchImage('foto.jpg', [photo], library)).toEqual({ kind: 'local', file: photo });
    expect(matchImage('FOTO', [photo], library)).toEqual({ kind: 'local', file: photo });
    expect(matchImage('Logo', [photo], library)).toEqual({ kind: 'asset', asset: library[0] });
    expect(matchImage('pozadí.webp', [], library)).toEqual(null);
    expect(matchImage('Pozadí', [], library)).toEqual({ kind: 'asset', asset: library[1] });
    expect(matchImage('chybí', [photo], null)).toBeNull();
    expect(matchImage('  ', [photo], library)).toBeNull();
  });

  /**
   * @description The sample CSV has a BOM, the header (name, field keys, text of the post) and a
   *   row with the samples.
   * @input FIELDS
   * @output "﻿nazev;title;price;photo;text_prispevku" and ";Léto;Cena;foto.jpg;"
   */
  it('writes a sample CSV', () => {
    expect(sampleCsv(FIELDS)).toBe('﻿nazev;title;price;photo;text_prispevku\r\n;Léto;Cena;foto.jpg;\r\n');
  });
});
