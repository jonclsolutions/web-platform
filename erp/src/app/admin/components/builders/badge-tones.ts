/**
 * @file badge-tones.ts
 * @path src/app/admin/components/builders/badge-tones.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Coloured labels ("badges") of the status / priority / severity columns of the
 *   admin tables (2026-11, review point 9). A column config maps every value to a TONE - what
 *   the value means for the person reading the table - never to a colour; the colours are in
 *   one place (table-style.css, soft pastel tones). Rule of the tones: danger = act now,
 *   warning = waiting / in progress, success = done well, info = new, neutral = closed / no
 *   attention needed. The text of the label stays (the colour is only an extra hint - WCAG 1.4.1).
 * @usage In a column config: `{ key: 'priority', …, tones: IMPORTANCE_TONES }`; when the cell
 *   shows a label of another field (orders: `status_label`), `toneKey: 'status'` names the field
 *   with the value. Shown only in the tables (not in the detail).
 */

/** Meaning of a value for the reader: neutral, new, done, waiting / in progress, act now. */
export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

/** Value → tone of one column (values not listed are neutral). */
export type BadgeTones = Readonly<Record<string, BadgeTone>>;

/**
 * Shared scale of importance - the priority of inquiries and leads and the severity of the
 * security events are the same idea: only what needs attention has a colour (normal is grey).
 */
export const IMPORTANCE_TONES: BadgeTones = {
  low: 'neutral',
  below_average: 'neutral',
  neutral: 'neutral',
  normal: 'neutral',
  info: 'neutral',
  high: 'warning',
  warning: 'warning',
  critical: 'danger',
};

/**
 * @description Tone of a value; a value without a tone (an own text, a new value of the API) is
 *   neutral, an empty value has no label.
 * @param tones Tones of the column.
 * @param value Raw value.
 * @returns The tone, null for an empty value.
 */
export function badgeToneOf(tones: BadgeTones, value: unknown): BadgeTone | null {
  if (value === null || value === undefined || value === '') return null;
  return tones[String(value)] ?? 'neutral';
}
