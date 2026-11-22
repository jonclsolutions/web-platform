/**
 * @file generate-form.ts
 * @path src/app/apps/js-creator/admin/images/generate/generate-form.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Rules of the form of generating (pure functions, tested on their own):
 *   - the text of the post from the pattern of the template (`{{key}}` = value of a text field,
 *     without the highlight markers);
 *   - highlighting of the selected part of a text (`**…**` added / removed);
 *   - the fields of a set: one form field per key over all its templates (required if any of
 *     them requires it, the shortest maximum length …); a key with two kinds is a conflict;
 *   - what stops generating: an empty required field, a too long text, a text that does not fit
 *     where the template refuses to generate (`block`), a missing library image, a field with
 *     two kinds in a set;
 *   - the default name of an output (template + date and time);
 *   - the length of a text as the user sees it (without the markers).
 * @dependencies document.ts (Field, TemplateDocument), renderer.ts (RenderReport),
 *   text-layout.ts (plainText).
 */

import { Field } from '../../shared/render/document';
import { RenderReport } from '../../shared/render/renderer';
import { plainText } from '../../shared/render/text-layout';

/** Why generating is not possible yet. */
export type ProblemKind = 'required' | 'too_long' | 'overflow' | 'overflow_fixed' | 'missing_asset' | 'conflict';

/** One reason that stops generating. */
export interface GenerateProblem {
  kind: ProblemKind;
  /** Key of the field (null = a fixed part of the template). */
  field: string | null;
  /** Label of the field (or empty). */
  label: string;
}

/** Text after highlighting with the new selection. */
export interface HighlightResult {
  value: string;
  start: number;
  end: number;
}

/** Longest name of an output (API limit). */
export const MAX_OUTPUT_NAME = 150;

/** Longest text of a post (API limit). */
export const MAX_CAPTION = 5000;

/**
 * @description Length of a text as the user sees it (highlight markers not counted).
 * @param value Text with `**…**`.
 */
export function visibleLength(value: string): number {
  return Array.from(plainText(value)).length;
}

/**
 * @description Text of the post from the pattern of a template: every `{{key}}` of a text field
 *   is replaced by its value without the highlight markers; other placeholders stay as written
 *   (the user sees them and can edit the text); empty fields leave at most one empty line and
 *   no spaces at the ends.
 * @param pattern Pattern of the template (null = no pattern).
 * @param fields Fields of the template.
 * @param texts Values of the text fields.
 * @returns Text of the post.
 */
export function fillCaption(pattern: string | null, fields: readonly Field[], texts: Readonly<Record<string, string>>): string {
  if (!pattern) return '';
  const textKeys = new Set(fields.filter(f => f.type === 'text').map(f => f.key));
  const filled = pattern.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (match: string, key: string) =>
    textKeys.has(key) ? plainText(texts[key] ?? '') : match,
  );
  // An empty field leaves no run of empty lines behind.
  return filled.replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, '\n\n').trim();
}

/**
 * @description Adds or removes the highlight of the selected part of a text: a selection inside
 *   `**…**` (or with the markers) loses them, another selection gets them.
 * @param value Text.
 * @param start Start of the selection.
 * @param end End of the selection.
 * @returns New text and selection; the same text when nothing is selected.
 */
export function toggleHighlight(value: string, start: number, end: number): HighlightResult {
  if (start >= end) return { value, start, end };
  const selected = value.slice(start, end);
  if (selected.startsWith('**') && selected.endsWith('**') && selected.length >= 4) {
    const inner = selected.slice(2, -2);
    return { value: value.slice(0, start) + inner + value.slice(end), start, end: start + inner.length };
  }
  if (value.slice(start - 2, start) === '**' && value.slice(end, end + 2) === '**') {
    return { value: value.slice(0, start - 2) + selected + value.slice(end + 2), start: start - 2, end: end - 2 };
  }
  const clean = selected.replace(/\*\*/g, '');
  return { value: `${value.slice(0, start)}**${clean}**${value.slice(end)}`, start, end: start + clean.length + 4 };
}

/** Fields of the form of several templates (a set). */
export interface UnitedFields {
  /** One field per key, in the order of the first template that has it. */
  fields: Field[];
  /** Keys with a text field in one template and an image field in another. */
  conflicts: string[];
}

/**
 * @description One form for several templates: a key appears once (label, help and sample of
 *   the first template that has it); it is required when any template requires it, a text keeps
 *   the shortest maximum length and is multi-line when any is, an image asks for the largest
 *   recommended resolution. A key with two kinds is reported (generating is refused).
 * @param lists Fields of each template (block instance fields included).
 * @returns United fields and conflicts.
 */
export function unionFields(lists: readonly (readonly Field[])[]): UnitedFields {
  const map = new Map<string, Field>();
  const conflicts = new Set<string>();
  for (const list of lists) {
    for (const field of list) {
      const known = map.get(field.key);
      if (!known) {
        const { key, type, label, help, required } = field;
        map.set(key, field.type === 'text'
          ? { key, type: 'text', label, help, required, sample: field.sample, maxLength: field.maxLength, multiline: field.multiline }
          : { key, type: 'image', label, help, required, minWidth: field.minWidth, minHeight: field.minHeight });
        continue;
      }
      if (known.type !== field.type) {
        conflicts.add(field.key);
        continue;
      }
      known.required = known.required || field.required;
      if (known.type === 'text' && field.type === 'text') {
        // 0 = no limit: the shortest real limit wins.
        known.maxLength = !known.maxLength ? field.maxLength : !field.maxLength ? known.maxLength : Math.min(known.maxLength, field.maxLength);
        known.multiline = known.multiline || field.multiline;
        known.sample = known.sample || field.sample;
      } else if (known.type === 'image' && field.type === 'image') {
        known.minWidth = Math.max(known.minWidth, field.minWidth);
        known.minHeight = Math.max(known.minHeight, field.minHeight);
      }
    }
  }
  return { fields: [...map.values()], conflicts: [...conflicts] };
}

/**
 * @description Reasons that stop generating, in the order of the fields.
 * @param fields Fields of the form.
 * @param texts Values of the text fields.
 * @param images Keys of the image fields that have an image.
 * @param report Report of the drawings (of every template of a set).
 * @param conflicts Keys with two kinds in a set.
 * @returns Problems (empty = ready).
 */
export function formProblems(
  fields: readonly Field[], texts: Readonly<Record<string, string>>, images: ReadonlySet<string>, report: RenderReport,
  conflicts: readonly string[] = [],
): GenerateProblem[] {
  const problems: GenerateProblem[] = [];
  const blocked = new Set(report.overflows.filter(o => o.mode === 'block').map(o => o.field));
  for (const key of conflicts) problems.push({ kind: 'conflict', field: null, label: key });
  for (const field of fields) {
    if (field.type === 'text') {
      const value = texts[field.key] ?? '';
      if (field.required && plainText(value).trim() === '') problems.push({ kind: 'required', field: field.key, label: field.label });
      else if (field.maxLength > 0 && visibleLength(value) > field.maxLength) problems.push({ kind: 'too_long', field: field.key, label: field.label });
      else if (blocked.has(field.key)) problems.push({ kind: 'overflow', field: field.key, label: field.label });
    } else if (field.required && !images.has(field.key)) {
      problems.push({ kind: 'required', field: field.key, label: field.label });
    }
  }
  if (blocked.has(null)) problems.push({ kind: 'overflow_fixed', field: null, label: '' });
  if (report.missing.some(m => m.startsWith('asset:'))) problems.push({ kind: 'missing_asset', field: null, label: '' });
  return problems;
}

/**
 * @description Default name of an output: the template and the date and time of generating.
 * @param template Name of the template.
 * @param at Time of generating.
 * @param locale Locale of the admin (e.g. `cs-CZ`).
 * @returns Name (at most MAX_OUTPUT_NAME characters).
 */
export function defaultOutputName(template: string, at: Date, locale: string): string {
  const stamp = at.toLocaleString(locale, { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return `${template} ${stamp}`.slice(0, MAX_OUTPUT_NAME);
}
