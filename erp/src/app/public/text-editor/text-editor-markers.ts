/**
 * @file text-editor-markers.ts
 * @path src/app/public/text-editor/text-editor-markers.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Invisible markers of the visual text editor: in editor mode every text of the
 *   website gets a start mark with the number of its entry (key of the translation / section of
 *   the content) and an end mark. The marks are default-ignorable Unicode format characters -
 *   the browser draws nothing for them and the templates stay unchanged; the overlay finds them
 *   in the rendered page, also when an animation split the text into word spans.
 * @usage `markText('Kontakt', 7, 'text')` → `⁣<digits>⁢Kontakt⁤`; `scanMarks(node.data)` → the marks of a
 *   text node; `stripMarks(text)` → the text without them.
 * @dependencies none
 * @note Mark = START (U+2063 text / U+2061 content) + number in base 4 (U+200B, U+200C, U+200D,
 *   U+2060) + SEPARATOR (U+2062) … text … END (U+2064). None of them is whitespace for `\s`, so
 *   splitting a text into words keeps the start with the first word and the end with the last.
 */

/** Start of a translation text. */
export const MARK_TEXT_START = '⁣';
/** Start of a content text (FAQ, references…). */
export const MARK_CONTENT_START = '⁡';
/** End of the number of the entry. */
export const MARK_SEPARATOR = '⁢';
/** End of a marked text. */
export const MARK_END = '⁤';
/** Digits of the number of the entry (base 4). */
const MARK_DIGITS = ['​', '‌', '‍', '⁠'];

/** Kind of a marked text. */
export type MarkKind = 'text' | 'content';

/** One mark found in a string. */
export interface FoundMark {
  /** `start` of a marked text (with its entry) or its `end`. */
  type: 'start' | 'end';
  /** Index of the first character of the mark. */
  offset: number;
  /** Length of the mark. */
  length: number;
  /** Start only: number of the entry. */
  index?: number;
  /** Start only: kind of the text. */
  kind?: MarkKind;
}

/** Any start or end mark (global - use lastIndex). */
const MARK_PATTERN = /([⁡⁣])([​‌‍⁠]*)⁢|⁤/g;
/** Quick test whether a string holds a start mark. */
const HAS_START = /[⁡⁣][​‌‍⁠]*⁢/;

/**
 * @description Number of an entry as invisible digits.
 * @param index Non-negative integer.
 * @returns At least one digit character.
 */
export function encodeMarkIndex(index: number): string {
  let value = Math.max(0, Math.floor(index));
  let digits = '';
  do {
    digits = MARK_DIGITS[value % 4] + digits;
    value = Math.floor(value / 4);
  } while (value > 0);
  return digits;
}

/**
 * @description Number of an entry from its invisible digits.
 * @param digits Digit characters of a mark.
 * @returns The number (0 for no digits).
 */
export function decodeMarkIndex(digits: string): number {
  let value = 0;
  for (const char of digits) {
    value = value * 4 + Math.max(0, MARK_DIGITS.indexOf(char));
  }
  return value;
}

/**
 * @description Wraps a text into the marks of its entry.
 * @param value Text shown on the website.
 * @param index Number of the entry (key of the translation / section of the content).
 * @param kind `text` (translation) or `content`.
 * @returns The marked text; an empty / blank text unchanged (it must stay "empty" for the pages).
 */
export function markText(value: string, index: number, kind: MarkKind): string {
  if (!value || !value.trim()) {
    return value;
  }
  const start = kind === 'content' ? MARK_CONTENT_START : MARK_TEXT_START;
  return `${start}${encodeMarkIndex(index)}${MARK_SEPARATOR}${value}${MARK_END}`;
}

/**
 * @description Whether a string holds a start mark.
 * @param value Any string.
 * @returns true when it holds a marked text (or its beginning).
 */
export function hasMarks(value: string | null | undefined): boolean {
  return !!value && HAS_START.test(value);
}

/**
 * @description Every mark of a string in order.
 * @param value Text of a DOM node / attribute.
 * @returns Starts (with entry and kind) and ends.
 */
export function scanMarks(value: string): FoundMark[] {
  const marks: FoundMark[] = [];
  MARK_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MARK_PATTERN.exec(value))) {
    if (match[0] === MARK_END) {
      marks.push({ type: 'end', offset: match.index, length: 1 });
    } else {
      marks.push({
        type: 'start',
        offset: match.index,
        length: match[0].length,
        index: decodeMarkIndex(match[2]),
        kind: match[1] === MARK_CONTENT_START ? 'content' : 'text',
      });
    }
  }
  return marks;
}

/**
 * @description The text without any marks.
 * @param value Marked text.
 * @returns The plain text.
 */
export function stripMarks(value: string): string {
  return value.replace(MARK_PATTERN, '');
}
