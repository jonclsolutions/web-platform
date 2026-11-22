/**
 * @file fields-panel.component.ts
 * @path src/app/apps/js-creator/admin/images/editor/panels/fields-panel.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Panel "Fields" of the editor: the fields filled in when generating, in the order of
 *   the generating form (up / down). For each: label, key (used by sets and by `{{key}}` in the
 *   caption - renaming it changes every use), help, required; a text field its sample, maximum
 *   length and one / more lines; an image field the recommended minimum resolution. A field is
 *   created from a layer (Properties) and disappears with the last layer that uses it.
 *   Fields of block instances follow (read only - they are edited in the editor of the block)
 *   with the key the form gives them.
 * @usage `<app-jc-fields [store]="store" />`
 * @dependencies EditorStore, render/document.ts, AdminLocalizationService (section `js-creator-editor`).
 */

import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { AdminLocalizationService } from '../../../../../../core/services/admin-localization.service';
import { EditorStore } from '../editor-store';
import { Field, ImageField, Layer, TextField, layerSources } from '../../../shared/render/document';
import { BlockDef, EffectiveField } from '../../../shared/render/block-fields';

/** Valid field key. */
const KEY = /^[a-z][a-z0-9_]{0,39}$/;

@Component({
  selector: 'app-jc-fields',
  standalone: true,
  templateUrl: './fields-panel.component.html',
  styleUrls: ['../controls/controls.css', './panels.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FieldsPanelComponent {
  private readonly i18n = inject(AdminLocalizationService);

  /** State of the editor. */
  readonly store = input.required<EditorStore>();
  /** Fields of the generating form (with the fields of block instances). */
  readonly formFields = input<readonly EffectiveField[]>([]);
  /** Blocks of the instances (names). */
  readonly blocks = input<ReadonlyMap<number, BlockDef>>(new Map());

  /** Fields of block instances (read only). */
  readonly instanceFields = computed(() => this.formFields().filter(f => f.origin));

  /** Error of a key being typed (field key → message). */
  readonly keyErrors = signal<Record<string, string>>({});
  /** Fields in the order of the form. */
  readonly fields = computed(() => this.store().doc().fields);
  /** Number of layers using each field. */
  readonly uses = computed(() => {
    const count = new Map<string, number>();
    const add = (key: string) => count.set(key, (count.get(key) ?? 0) + 1);
    const page = this.store().doc().pages[0];
    if (page.background.image?.source.kind === 'field') add(page.background.image.source.field);
    for (const layer of page.layers) {
      if (layer.type === 'text' && layer.field) add(layer.field);
      layerSources(layer).forEach(s => s.kind === 'field' && add(s.field));
    }
    return count;
  });

  /**
   * @description Placeholder of a field in the caption pattern.
   * @param key Field key.
   */
  token(key: string): string {
    return `{{${key}}}`;
  }

  /**
   * @description Text of the editor.
   * @param key Key in `js-creator-editor`.
   */
  t(key: string): string {
    return this.i18n.getValue(`js-creator-editor.${key}`);
  }

  /**
   * @description The field as a text field (template typing).
   * @param field Field.
   */
  asText(field: Field): TextField | null {
    return field.type === 'text' ? field : null;
  }

  /**
   * @description The field as an image field (template typing).
   * @param field Field.
   */
  asImage(field: Field): ImageField | null {
    return field.type === 'image' ? field : null;
  }

  /**
   * @description Changes a field.
   * @param key Field.
   * @param patch Changed properties.
   * @param step Coalescing key (typing).
   */
  update(key: string, patch: Partial<TextField> | Partial<ImageField>, step: string | null = null): void {
    this.store().mutate(doc => {
      const index = doc.fields.findIndex(f => f.key === key);
      if (index >= 0) doc.fields[index] = { ...doc.fields[index], ...patch } as Field;
    }, step ? `field:${key}:${step}` : null);
  }

  /**
   * @description A number of an input within limits (null = invalid).
   * @param event Change event.
   * @param min Minimum.
   * @param max Maximum.
   */
  num(event: Event, min: number, max: number): number | null {
    const value = (event.target as HTMLInputElement).valueAsNumber;
    return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : null;
  }

  /**
   * @description Sets a number property of a field.
   * @param key Field.
   * @param prop Property.
   * @param event Change event.
   * @param min Minimum.
   * @param max Maximum.
   */
  setNum(key: string, prop: 'maxLength' | 'minWidth' | 'minHeight', event: Event, min: number, max: number): void {
    const value = this.num(event, min, max);
    if (value !== null) this.update(key, { [prop]: value });
  }

  /**
   * @description Moves a field in the order of the form.
   * @param index Field.
   * @param step -1 up, 1 down.
   */
  move(index: number, step: -1 | 1): void {
    this.store().mutate(doc => {
      const target = index + step;
      if (target < 0 || target >= doc.fields.length) return;
      [doc.fields[index], doc.fields[target]] = [doc.fields[target], doc.fields[index]];
    });
  }

  /**
   * @description Renames the key of a field and every use (layers, background, `{{key}}` of the
   *   caption); an invalid or taken key is refused with a message.
   * @param field Field.
   * @param input Key input.
   */
  renameKey(field: Field, input: HTMLInputElement): void {
    const next = input.value.trim();
    const errors = { ...this.keyErrors() };
    delete errors[field.key];
    if (next === field.key) {
      this.keyErrors.set(errors);
      return;
    }
    if (!KEY.test(next) || this.fields().some(f => f.key === next)) {
      this.keyErrors.set({ ...errors, [field.key]: this.t(KEY.test(next) ? 'key_taken' : 'key_invalid') });
      input.value = field.key;
      return;
    }
    this.keyErrors.set(errors);
    const old = field.key;
    this.store().commit(draft => {
      const doc = draft.doc;
      const target = doc.fields.find(f => f.key === old);
      if (target) target.key = next;
      const page = doc.pages[0];
      const bg = page.background.image?.source;
      if (bg?.kind === 'field' && bg.field === old) bg.field = next;
      page.layers.forEach((layer: Layer) => {
        if (layer.type === 'text' && layer.field === old) layer.field = next;
        layerSources(layer).forEach(s => { if (s.kind === 'field' && s.field === old) s.field = next; });
      });
      draft.caption = draft.caption.split(`{{${old}}}`).join(`{{${next}}}`);
    });
  }
}
