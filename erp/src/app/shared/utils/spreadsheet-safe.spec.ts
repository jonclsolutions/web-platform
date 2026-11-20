/**
 * @file spreadsheet-safe.spec.ts
 * @path src/app/shared/utils/spreadsheet-safe.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of spreadsheetSafe(): values that would start a spreadsheet formula
 *   get an apostrophe, numbers and ordinary texts stay unchanged.
 */

import { spreadsheetSafe } from './spreadsheet-safe';

describe('spreadsheetSafe', () => {
  /**
   * @description Formula starts are neutralised (CSV injection), everything else is kept.
   * @input =HYPERLINK(…), +cmd, -2+3, @SUM(A1), tab / CR start; -5, +3,2, 12.5; plain text,
   *        an inner '=', '', null, undefined, a number value.
   * @output An apostrophe before the first five; the rest unchanged ('' for null / undefined).
   */
  it('neutralises formula starts only', () => {
    expect(spreadsheetSafe('=HYPERLINK("http://x","y")')).toBe(`'=HYPERLINK("http://x","y")`);
    expect(spreadsheetSafe('+cmd')).toBe(`'+cmd`);
    expect(spreadsheetSafe('-2+3')).toBe(`'-2+3`);
    expect(spreadsheetSafe('@SUM(A1)')).toBe(`'@SUM(A1)`);
    expect(spreadsheetSafe('\t=1')).toBe(`'\t=1`);
    expect(spreadsheetSafe('\r=1')).toBe(`'\r=1`);

    expect(spreadsheetSafe('-5')).toBe('-5');
    expect(spreadsheetSafe('+3,2')).toBe('+3,2');
    expect(spreadsheetSafe('12.5')).toBe('12.5');
    expect(spreadsheetSafe('Jan Novák')).toBe('Jan Novák');
    expect(spreadsheetSafe('a=b')).toBe('a=b');
    expect(spreadsheetSafe('')).toBe('');
    expect(spreadsheetSafe(null)).toBe('');
    expect(spreadsheetSafe(undefined)).toBe('');
    expect(spreadsheetSafe(-7)).toBe('-7');
  });
});
