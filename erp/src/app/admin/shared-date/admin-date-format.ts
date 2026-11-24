/**
 * @file admin-date-format.ts
 * @path src/app/admin/shared-date/admin-date-format.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description The ONE date format of the administration (2026-11, the review point 10 - the
 *   tables showed "20.11.26 22:51", the header "24. 11. 2026"): three kinds - a date, a date
 *   with time, a date with time and seconds (details, logs) - whose patterns come from the admin
 *   texts (`shared.date_format`, `shared.datetime_format`, `shared.datetime_seconds_format`), so
 *   every language has its own order; Czech "24. 11. 2026", "24. 11. 2026 22:51",
 *   "24. 11. 2026 22:51:08". Older column formats (Angular 'short' / 'medium', own patterns)
 *   are mapped to the kind they mean.
 * @usage `adminDateFormat(i18n, adminDateKind(column.format, 'date'))` in code,
 *   `{{ value | adminDate:'datetime' }}` (AdminDatePipe) in templates.
 * @dependencies AdminLocalizationService (getValue) - any object with `getValue(path)`.
 */

/** Kind of a shown date: day only, with time, with time and seconds. */
export type AdminDateKind = 'date' | 'datetime' | 'datetime_seconds';

/** Patterns used while the texts are not loaded (and in unit tests) - the Czech ones. */
export const ADMIN_DATE_FALLBACK: Readonly<Record<AdminDateKind, string>> = {
  date: 'd. M. yyyy',
  datetime: 'd. M. yyyy HH:mm',
  datetime_seconds: 'd. M. yyyy HH:mm:ss',
};

/**
 * @description Kind a column format means: 'date' / 'datetime' / 'datetime_seconds' as they are;
 *   Angular 'shortDate' / 'mediumDate' … = date, 'short' = with time, 'medium' / 'long' / 'full'
 *   = with seconds; an own pattern by its letters (seconds `s`, hours `H` / `h`).
 * @param format Format of the column (undefined = the fallback kind).
 * @param fallback Kind without a format.
 * @returns The kind.
 */
export function adminDateKind(format: string | null | undefined, fallback: AdminDateKind = 'date'): AdminDateKind {
  if (!format) return fallback;
  if (format === 'date' || format === 'datetime' || format === 'datetime_seconds') return format;
  if (/Date$/.test(format)) return 'date';
  if (format === 'short') return 'datetime';
  if (format === 'medium' || format === 'long' || format === 'full') return 'datetime_seconds';
  if (/s/.test(format)) return 'datetime_seconds';
  if (/[Hh]/.test(format)) return 'datetime';
  return 'date';
}

/**
 * @description Pattern of a kind in the admin language (`shared.<kind>_format`); the Czech
 *   pattern while the texts are not loaded.
 * @param i18n Admin localization (anything with `getValue(path)`).
 * @param kind Kind of the date.
 * @returns Angular DatePipe pattern.
 */
export function adminDateFormat(i18n: { getValue(path: string): string }, kind: AdminDateKind): string {
  const path = `shared.${kind}_format`;
  const value = i18n.getValue(path);
  return value && value !== path && value !== 'Cannot load text' ? value : ADMIN_DATE_FALLBACK[kind];
}
