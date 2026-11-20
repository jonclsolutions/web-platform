/**
 * @file spreadsheet-safe.ts
 * @path src/app/shared/utils/spreadsheet-safe.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Neutralises spreadsheet formulas in the text exports of the administration (CSV,
 * TXT): a value that starts with `=`, `+`, `-`, `@`, a tab or a carriage return gets an apostrophe
 * in front, so Excel / LibreOffice show it as text instead of evaluating it (CSV / formula
 * injection - the exported data often come from public forms). Plain numbers (`-5`, `+3,2`) stay
 * as they are. The import of the API (ImportFileParser) removes the apostrophe again, so a raw
 * export imports back with the original value.
 * @dependencies none
 */

/** @description First characters a spreadsheet treats as the start of a formula. */
const FORMULA_START = /^[=+\-@\t\r]/;

/** @description A plain (signed) number - never a formula, left unchanged. */
const PLAIN_NUMBER = /^[+-]?\d+([.,]\d+)?$/;

/**
 * @description The text of one exported cell, safe to open in a spreadsheet.
 * @param value Cell value (null / undefined = empty).
 * @returns The text, with a leading apostrophe when it would start a formula.
 */
export function spreadsheetSafe(value: unknown): string {
  const text = String(value ?? '');
  return FORMULA_START.test(text) && !PLAIN_NUMBER.test(text) ? `'${text}` : text;
}
