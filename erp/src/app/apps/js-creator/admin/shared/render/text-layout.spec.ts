/**
 * @file text-layout.spec.ts
 * @path src/app/apps/js-creator/admin/shared/render/text-layout.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the typesetting of texts: highlights, paragraphs, wrapping between
 *   words and inside long words, shrinking, the maximum of lines and cutting with "…". Widths are
 *   measured by a fake monospace measure (every character = 0.5 × size, highlighted 0.6 × size).
 * @dependencies text-layout.ts
 */

import { ELLIPSIS, MeasureText, layoutText, parseRuns, plainText } from './text-layout';

/** Every character is half of the size wide (highlighted 0.6). */
const measure: MeasureText = (text, highlight, size) => Array.from(text).length * size * (highlight ? 0.6 : 0.5);

/** Options of a box 100 × 100 px at 10 px. */
const box = { width: 100, height: 100, size: 10, minSize: 5, autoShrink: false, maxLines: 0, lineHeight: 1 };

/** Text of a laid-out line. */
const lineText = (line: { runs: { text: string }[] }) => line.runs.map(r => r.text).join('');

describe('text-layout', () => {
  /**
   * @description `**…**` marks highlights, line breaks start paragraphs, an unclosed marker stays.
   * @input "Big **50 %** sale\nnext"; "a **b"; "**x**\n\n"
   * @output runs with highlight; literal "**"; empty paragraphs kept; plainText without markers
   */
  it('parses highlights and paragraphs', () => {
    expect(parseRuns('Big **50 %** sale\nnext')).toEqual([
      [{ text: 'Big ', highlight: false }, { text: '50 %', highlight: true }, { text: ' sale', highlight: false }],
      [{ text: 'next', highlight: false }],
    ]);
    expect(parseRuns('a **b')).toEqual([[{ text: 'a **b', highlight: false }]]);
    expect(parseRuns('**x**\n\n')).toEqual([[{ text: 'x', highlight: true }], [], []]);
    expect(plainText('Big **50 %** sale')).toBe('Big 50 % sale');
  });

  /**
   * @description Lines wrap between words; spaces at a line end do not count; runs keep their
   *   positions; a word longer than the line is broken between letters.
   * @input "aaaa bbbb cccc" in 50 px at 10 px (10 characters per line); "x" × 25
   * @output ["aaaa bbbb", "cccc"]; widths 45 and 20; ["xxxxxxxxxx" × 2, "xxxxx"]
   */
  it('wraps lines', () => {
    const layout = layoutText('aaaa bbbb cccc', { ...box, width: 50 }, measure);
    expect(layout.lines.map(lineText)).toEqual(['aaaa bbbb', 'cccc']);
    expect(layout.lines.map(l => l.width)).toEqual([45, 20]);
    expect(layout.height).toBe(20);
    expect(layout.overflow).toBeFalse();

    const long = layoutText('x'.repeat(25), { ...box, width: 50 }, measure);
    expect(long.lines.map(lineText)).toEqual(['xxxxxxxxxx', 'xxxxxxxxxx', 'xxxxx']);
  });

  /**
   * @description Highlighted runs are measured in their own style and placed after the others.
   * @input "ab **cd** ef" at 10 px
   * @output runs at x 0 / 15 / 27; line width 42
   */
  it('places highlighted runs', () => {
    const line = layoutText('ab **cd** ef', box, measure).lines[0];
    expect(line.runs.map(r => [r.text, r.x])).toEqual([['ab ', 0], ['cd', 15], [' ef', 27]]);
    expect(line.width).toBe(42);
  });

  /**
   * @description A text that does not fit is shrunk down to the largest size that fits (in
   *   half pixels); without shrinking it is cut with "…" and reported as overflowing.
   * @input 12 characters in 50 × 10 px at 10 px (two lines needed); with / without autoShrink
   * @output size 8 on one line; without shrinking one line ending with "…", overflow
   */
  it('shrinks or cuts', () => {
    const shrunk = layoutText('abcdefghijkl', { ...box, width: 50, height: 10, autoShrink: true }, measure);
    expect(shrunk.size).toBe(8);
    expect(shrunk.lines.length).toBe(1);
    expect(shrunk.overflow).toBeFalse();

    const cut = layoutText('aaaa bbbb cccc', { ...box, width: 50, height: 10 }, measure);
    expect(cut.lines.length).toBe(1);
    expect(lineText(cut.lines[0]).endsWith(ELLIPSIS)).toBeTrue();
    expect(cut.lines[0].width).toBeLessThanOrEqual(50);
    expect(cut.overflow).toBeTrue();
  });

  /**
   * @description The maximum of lines limits a text even in a tall box; below the minimum size
   *   the text is cut at the minimum.
   * @input 3 paragraphs, maxLines 2; long text that does not fit even at minSize 8
   * @output 2 lines, the second ends with "…", overflow; size 8 and overflow
   */
  it('respects the maximum of lines and the minimum size', () => {
    const limited = layoutText('one\ntwo\nthree', { ...box, maxLines: 2 }, measure);
    expect(limited.lines.map(lineText)).toEqual(['one', 'two' + ELLIPSIS]);
    expect(limited.overflow).toBeTrue();

    const tooLong = layoutText('word '.repeat(40), { ...box, height: 20, autoShrink: true, minSize: 8 }, measure);
    expect(tooLong.size).toBe(8);
    expect(tooLong.overflow).toBeTrue();
  });
});
