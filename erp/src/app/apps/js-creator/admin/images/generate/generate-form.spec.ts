/**
 * @file generate-form.spec.ts
 * @path src/app/apps/js-creator/admin/images/generate/generate-form.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the rules of the form of generating: the text of the post from the
 *   pattern, highlighting the selected part, what stops generating and the default name.
 * @dependencies generate-form.ts, document.ts
 */

import { Field, emptyDocument } from '../../shared/render/document';
import { defaultOutputName, fillCaption, formProblems, toggleHighlight, visibleLength } from './generate-form';

/** Fields of a test template. */
const FIELDS: Field[] = [
  { key: 'title', type: 'text', label: 'Nadpis', help: '', required: true, sample: 'Akce', maxLength: 10, multiline: false },
  { key: 'note', type: 'text', label: 'Poznámka', help: '', required: false, sample: '', maxLength: 0, multiline: true },
  { key: 'photo', type: 'image', label: 'Fotka', help: '', required: true, minWidth: 0, minHeight: 0 },
  { key: 'logo', type: 'image', label: 'Logo', help: '', required: false, minWidth: 0, minHeight: 0 },
];

describe('generate-form', () => {
  /**
   * @description The text of the post replaces `{{key}}` of text fields by their values without
   *   the highlight markers; other placeholders stay; no pattern = empty text; an empty field
   *   leaves one empty line at most.
   * @input "{{ title }} – {{note}} {{photo}} {{unknown}}" with title "**50 %** sleva"; a pattern
   *   with an empty note between empty lines
   * @output "50 % sleva – Hi {{photo}} {{unknown}}"; '' for null; "Akce\n\n#tag"
   */
  it('fills the text of the post', () => {
    expect(fillCaption('{{ title }} – {{note}} {{photo}} {{unknown}}', FIELDS, { title: '**50 %** sleva', note: 'Hi' }))
      .toBe('50 % sleva – Hi {{photo}} {{unknown}}');
    expect(fillCaption(null, FIELDS, {})).toBe('');
    expect(fillCaption('{{title}}', FIELDS, {})).toBe('');
    expect(fillCaption('{{title}}\n\n{{note}}\n\n#tag', FIELDS, { title: 'Akce' })).toBe('Akce\n\n#tag');
  });

  /**
   * @description Highlighting wraps the selection, removes markers inside / around it, and does
   *   nothing without a selection; the visible length ignores the markers.
   * @input "Velká sleva" select "sleva"; again the selection with markers; selection inside
   *   markers; empty selection
   * @output "Velká **sleva**" (selection with markers); back to "Velká sleva"; markers removed;
   *   the same text; length 11
   */
  it('toggles highlights', () => {
    const on = toggleHighlight('Velká sleva', 6, 11);
    expect(on).toEqual({ value: 'Velká **sleva**', start: 6, end: 15 });
    expect(toggleHighlight(on.value, on.start, on.end)).toEqual({ value: 'Velká sleva', start: 6, end: 11 });
    expect(toggleHighlight('Velká **sleva**', 8, 13)).toEqual({ value: 'Velká sleva', start: 6, end: 11 });
    expect(toggleHighlight('Velká sleva', 3, 3)).toEqual({ value: 'Velká sleva', start: 3, end: 3 });
    expect(toggleHighlight('a **b** c', 0, 9).value).toBe('**a b c**');
    expect(visibleLength('Velká **sleva**')).toBe(11);
  });

  /**
   * @description Generating stops on an empty required text or image, a too long text, a text of
   *   a field that does not fit where the template refuses, a fixed text that does not fit and a
   *   missing library image; an optional empty field and a cut text do not stop it.
   * @input empty values; then title "12345678901", photo set; overflow block of title / of a
   *   fixed text; overflow ellipsis of note; missing asset:4
   * @output required title + photo; too_long title; overflow title, overflow_fixed, missing_asset;
   *   nothing for a valid form
   */
  it('lists what stops generating', () => {
    const doc = emptyDocument();
    doc.fields = FIELDS;
    const clean = { overflows: [], missing: [] };
    expect(formProblems(doc, {}, new Set(), clean).map(p => [p.kind, p.field])).toEqual([['required', 'title'], ['required', 'photo']]);
    expect(formProblems(doc, { title: '** **' }, new Set(['photo']), clean).map(p => p.kind)).toEqual(['required']);
    expect(formProblems(doc, { title: '12345678901' }, new Set(['photo']), clean).map(p => p.kind)).toEqual(['too_long']);
    expect(formProblems(doc, { title: '**1234567890**' }, new Set(['photo']), clean)).toEqual([]);

    const report = {
      overflows: [
        { layerId: 'a', field: 'title', mode: 'block' as const },
        { layerId: 'b', field: null, mode: 'block' as const },
        { layerId: 'c', field: 'note', mode: 'ellipsis' as const },
      ],
      missing: ['asset:4', 'field:logo'],
    };
    expect(formProblems(doc, { title: 'Akce' }, new Set(['photo']), report).map(p => [p.kind, p.field, p.label])).toEqual([
      ['overflow', 'title', 'Nadpis'], ['overflow_fixed', null, ''], ['missing_asset', null, ''],
    ]);
  });

  /**
   * @description The default name is the template with the local date and time, at most 150
   *   characters.
   * @input "Letní akce", 22. 11. 2026 15:54, cs-CZ; a name of 200 characters
   * @output starts with "Letní akce 22. 11. 2026" and contains "15:54"; 150 characters
   */
  it('makes the default name', () => {
    const name = defaultOutputName('Letní akce', new Date(2026, 10, 22, 15, 54), 'cs-CZ');
    expect(name.startsWith('Letní akce 22. 11. 2026')).toBeTrue();
    expect(name).toContain('15:54');
    expect(defaultOutputName('x'.repeat(200), new Date(), 'cs-CZ').length).toBe(150);
  });
});
