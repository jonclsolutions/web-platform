/**
 * @file text-layout.ts
 * @path src/app/apps/js-creator/admin/shared/render/text-layout.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Typesetting of a text layer, independent of the canvas (the width of a text is
 *   measured by a function of the caller):
 *   - `**…**` marks highlighted parts (an unclosed `**` stays as it is), `\n` starts a paragraph;
 *   - lines wrap between words; a word longer than the line is broken between letters;
 *   - when the text does not fit (height of the box, maximum of lines) it is shrunk down to the
 *     minimum size (if allowed), then cut with "…" - the result says that it overflowed.
 * @usage `layoutText('Big **50 %** sale', { width, height, size, … }, measure)`.
 * @dependencies none (pure).
 */

/** Part of a text with one style. */
export interface TextRun {
  text: string;
  highlight: boolean;
}

/** Placed part of a line (x from the start of the line). */
export interface LaidOutRun extends TextRun {
  x: number;
  width: number;
}

/** One line. */
export interface LaidOutLine {
  runs: LaidOutRun[];
  width: number;
}

/** Result of the typesetting. */
export interface TextLayout {
  /** Font size used (after shrinking). */
  size: number;
  /** Height of one line (px). */
  lineHeight: number;
  lines: LaidOutLine[];
  /** Height of all lines. */
  height: number;
  /** Width of the widest line. */
  width: number;
  /** The text did not fit even at the minimum size (it was cut). */
  overflow: boolean;
}

/** Rules of the typesetting. */
export interface TextLayoutOptions {
  /** Box of the text (px). */
  width: number;
  height: number;
  /** Wanted size and the minimum for shrinking. */
  size: number;
  minSize: number;
  autoShrink: boolean;
  /** 0 = no limit. */
  maxLines: number;
  /** Line height as a multiple of the size. */
  lineHeight: number;
}

/**
 * Width of a text (px) at a size in the normal or the highlighted style, letter spacing included.
 */
export type MeasureText = (text: string, highlight: boolean, size: number) => number;

/** Character that ends a cut text. */
export const ELLIPSIS = '…';

/**
 * @description Paragraphs of a text with their highlighted parts.
 * @param text Text with `**…**` and line breaks.
 * @returns Paragraphs of runs (an empty paragraph = an empty line).
 */
export function parseRuns(text: string): TextRun[][] {
  const parts = text.split('**');
  if (parts.length % 2 === 0) {
    // An odd number of markers: the last one is plain text.
    const last = parts.pop() as string;
    parts[parts.length - 1] += '**' + last;
  }
  const paragraphs: TextRun[][] = [[]];
  parts.forEach((part, index) => {
    const highlight = index % 2 === 1;
    part.split('\n').forEach((piece, i) => {
      if (i > 0) paragraphs.push([]);
      if (piece) paragraphs[paragraphs.length - 1].push({ text: piece, highlight });
    });
  });
  return paragraphs;
}

/**
 * @description Text without the highlight markers (counting characters, previews).
 * @param text Text with `**…**`.
 */
export function plainText(text: string): string {
  return parseRuns(text).map(p => p.map(r => r.text).join('')).join('\n');
}

/**
 * @description Typesets a text into a box.
 * @param text Text (`**…**`, `\n`).
 * @param options Box, sizes, limits.
 * @param measure Width of a text.
 */
export function layoutText(text: string, options: TextLayoutOptions, measure: MeasureText): TextLayout {
  const paragraphs = parseRuns(text);
  const maxSize = Math.max(1, options.size);
  const minSize = Math.max(1, Math.min(options.minSize, maxSize));

  const fits = (size: number): boolean => {
    const lines = wrap(paragraphs, options.width, size, measure);
    const lineHeight = size * options.lineHeight;
    return (options.maxLines === 0 || lines.length <= options.maxLines) && lines.length * lineHeight <= options.height + 0.5
      && lines.every(line => line.width <= options.width + 0.5);
  };

  let size = maxSize;
  if (!fits(size) && options.autoShrink) {
    if (fits(minSize)) {
      let lo = minSize;
      let hi = maxSize;
      for (let i = 0; i < 14 && hi - lo > 0.25; i++) {
        const mid = (lo + hi) / 2;
        if (fits(mid)) lo = mid; else hi = mid;
      }
      size = Math.floor(lo * 2) / 2;
    } else {
      size = minSize;
    }
  }

  const lineHeight = size * options.lineHeight;
  let lines = wrap(paragraphs, options.width, size, measure);
  const allowed = Math.max(1, Math.min(options.maxLines || Infinity, Math.floor((options.height + 0.5) / lineHeight)));
  const overflow = lines.length > allowed || lines.some(line => line.width > options.width + 0.5);
  if (lines.length > allowed) {
    lines = lines.slice(0, allowed);
    lines[lines.length - 1] = ellipsize(lines[lines.length - 1], options.width, size, measure);
  }
  return {
    size,
    lineHeight,
    lines,
    height: lines.length * lineHeight,
    width: Math.max(0, ...lines.map(l => l.width)),
    overflow,
  };
}

/** Word or space of a paragraph with its style. */
interface Piece extends TextRun {
  space: boolean;
}

/**
 * @description Wraps paragraphs into lines of a width. A line breaks only at spaces: a word
 *   whose part is highlighted (`**50 %**!`, `**Kč**?`) stays together - the highlight marker
 *   is not a place to break.
 * @param paragraphs Paragraphs of runs.
 * @param maxWidth Width of a line.
 * @param size Font size.
 * @param measure Width of a text.
 */
function wrap(paragraphs: TextRun[][], maxWidth: number, size: number, measure: MeasureText): LaidOutLine[] {
  const lines: LaidOutLine[] = [];
  for (const paragraph of paragraphs) {
    const pieces: Piece[] = paragraph.flatMap(run => run.text.split(/( +)/).filter(Boolean)
      .map(text => ({ text, highlight: run.highlight, space: text.startsWith(' ') })));
    // Words: neighbouring pieces without a space between them (also across a highlight).
    const tokens: Piece[][] = [];
    for (const piece of pieces) {
      const last = tokens[tokens.length - 1];
      if (!piece.space && last && !last[0].space) last.push(piece); else tokens.push([piece]);
    }
    let current: Piece[] = [];
    const flush = () => {
      lines.push(placeLine(current, size, measure));
      current = [];
    };
    for (const word of tokens) {
      if (word[0].space) {
        if (current.length) current.push(word[0]);
        continue;
      }
      const candidate = placeLine([...current, ...word], size, measure);
      if (candidate.width <= maxWidth || !current.some(p => !p.space)) {
        if (candidate.width > maxWidth) {
          // A word longer than the line: broken between letters.
          for (const chunk of word.flatMap(piece => breakWord(piece, maxWidth, size, measure))) {
            const next = placeLine([...current, chunk], size, measure);
            if (current.some(p => !p.space) && next.width > maxWidth) flush();
            current.push(chunk);
          }
        } else {
          current.push(...word);
        }
      } else {
        flush();
        current.push(...word);
      }
    }
    flush();
  }
  return lines;
}

/**
 * @description Places the pieces of one line: neighbours of the same style become one run,
 *   spaces at the end are dropped.
 * @param pieces Pieces of the line.
 * @param size Font size.
 * @param measure Width of a text.
 */
function placeLine(pieces: Piece[], size: number, measure: MeasureText): LaidOutLine {
  const trimmed = [...pieces];
  while (trimmed.length && trimmed[trimmed.length - 1].space) trimmed.pop();
  const runs: LaidOutRun[] = [];
  let x = 0;
  for (const piece of trimmed) {
    const last = runs[runs.length - 1];
    if (last && last.highlight === piece.highlight) {
      last.text += piece.text;
      last.width = measure(last.text, last.highlight, size);
      x = last.x + last.width;
    } else {
      const width = measure(piece.text, piece.highlight, size);
      runs.push({ text: piece.text, highlight: piece.highlight, x, width });
      x += width;
    }
  }
  return { runs, width: x };
}

/**
 * @description Breaks a word into parts that fit a line.
 * @param piece Word.
 * @param maxWidth Width of a line.
 * @param size Font size.
 * @param measure Width of a text.
 */
function breakWord(piece: Piece, maxWidth: number, size: number, measure: MeasureText): Piece[] {
  const chunks: Piece[] = [];
  let current = '';
  for (const char of Array.from(piece.text)) {
    if (current && measure(current + char, piece.highlight, size) > maxWidth) {
      chunks.push({ ...piece, text: current });
      current = char;
    } else {
      current += char;
    }
  }
  if (current) chunks.push({ ...piece, text: current });
  return chunks;
}

/**
 * @description Ends a line with "…" so that it fits the width.
 * @param line Last kept line.
 * @param maxWidth Width of a line.
 * @param size Font size.
 * @param measure Width of a text.
 */
function ellipsize(line: LaidOutLine, maxWidth: number, size: number, measure: MeasureText): LaidOutLine {
  const pieces: Piece[] = line.runs.map(r => ({ text: r.text, highlight: r.highlight, space: false }));
  for (;;) {
    const last = pieces[pieces.length - 1];
    const candidate = placeLine(
      last ? [...pieces.slice(0, -1), { ...last, text: last.text.trimEnd() + ELLIPSIS }] : [{ text: ELLIPSIS, highlight: false, space: false }],
      size, measure,
    );
    if (candidate.width <= maxWidth || !last) return candidate;
    const chars = Array.from(last.text);
    chars.pop();
    if (chars.length) last.text = chars.join(''); else pieces.pop();
  }
}
