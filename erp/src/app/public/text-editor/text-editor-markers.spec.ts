/**
 * @file text-editor-markers.spec.ts
 * @path src/app/public/text-editor/text-editor-markers.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the invisible marks of the visual text editor: numbers, marking,
 *   finding and removing the marks, word splitting of a marked text.
 * @dependencies text-editor-markers
 */

import {
  MARK_END, MARK_SEPARATOR, MARK_TEXT_START, decodeMarkIndex, encodeMarkIndex, hasMarks, markText,
  scanMarks, stripMarks,
} from './text-editor-markers';

describe('text-editor-markers', () => {
  /**
   * @description Numbers survive the invisible base-4 digits (0, small, large).
   * @input 0, 1, 3, 4, 17, 1234
   * @output decode(encode(n)) === n; 0 has one digit
   */
  it('encodes and decodes the numbers of the entries', () => {
    for (const n of [0, 1, 3, 4, 17, 1234]) {
      expect(decodeMarkIndex(encodeMarkIndex(n))).toBe(n);
    }
    expect(encodeMarkIndex(0).length).toBe(1);
  });

  /**
   * @description A text gets a start with its number and kind, the separator and an end; it looks
   *   the same once the marks are removed; an empty / blank text is not marked.
   * @input markText('Kontakt', 5, 'text'), ('Otázka', 2, 'content'), ('', 1), ('  ', 1)
   * @output scanMarks: start 5 text + end; start 2 content; strip → the text; '' and '  ' unchanged
   */
  it('marks a text and finds the marks again', () => {
    const marked = markText('Kontakt', 5, 'text');
    expect(marked.startsWith(MARK_TEXT_START)).toBeTrue();
    expect(marked).toContain(MARK_SEPARATOR);
    expect(marked.endsWith(MARK_END)).toBeTrue();
    expect(hasMarks(marked)).toBeTrue();
    expect(stripMarks(marked)).toBe('Kontakt');

    const marks = scanMarks(marked);
    expect(marks.map(m => m.type)).toEqual(['start', 'end']);
    expect(marks[0]).toEqual(jasmine.objectContaining({ offset: 0, index: 5, kind: 'text' }));
    expect(marks[1].offset).toBe(marked.length - 1);

    const content = scanMarks(markText('Otázka', 2, 'content'));
    expect(content[0]).toEqual(jasmine.objectContaining({ index: 2, kind: 'content' }));

    expect(markText('', 1, 'text')).toBe('');
    expect(markText('  ', 1, 'text')).toBe('  ');
    expect(hasMarks('plain')).toBeFalse();
  });

  /**
   * @description Splitting a marked text into words (the reveal animation) keeps the start with
   *   the first word and the end with the last - the marks are not whitespace.
   * @input markText('Často kladené otázky', 9, 'text').split(/\s+/)
   * @output 3 words; the first holds the start (9), the last the end; stripped words unchanged
   */
  it('keeps the marks at the first and last word of a split text', () => {
    const words = markText('Často kladené otázky', 9, 'text').split(/\s+/);
    expect(words.length).toBe(3);
    expect(scanMarks(words[0])[0]).toEqual(jasmine.objectContaining({ type: 'start', index: 9 }));
    expect(scanMarks(words[1]).length).toBe(0);
    expect(scanMarks(words[2])[0].type).toBe('end');
    expect(words.map(stripMarks)).toEqual(['Často', 'kladené', 'otázky']);
  });
});
