/**
 * @file editor-store.ts
 * @path src/app/apps/js-creator/admin/images/editor/editor-store.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description State of the template editor (one instance per opened template): the template
 *   (name, size, output, caption pattern, document), the selection of layers, the history of
 *   undo / redo (at least 100 steps) and the clipboard. Every change goes through mutate() /
 *   commit(): a step of the history is recorded first (similar changes in a row - typing,
 *   nudging, dragging - become one step), then the document is replaced (never changed in place,
 *   so the signals see every change) and fields no layer uses any more are dropped.
 * @usage `const store = new EditorStore(template, canEdit); store.updateLayer(id, { x: 10 }, 'x')`.
 * @dependencies render/document.ts, render/geometry.ts (anchors), Angular signals.
 */

import { computed, signal } from '@angular/core';
import {
  CanvasSize, Field, Layer, LayerType, TemplateDocument, cloneJson, createLayer, layerSources, newLayerId, usedFieldKeys,
} from '../../shared/render/document';
import { boundingBox, layerRect, offsetFor, unionRect } from '../../shared/render/geometry';
import { CreatorTemplateDetail, TemplateSave } from '../../shared/js-creator.models';

/** Everything of a template that the editor changes (one step of the history). */
export interface EditorSnapshot {
  name: string;
  width: number;
  height: number;
  outputFormat: 'png' | 'jpg';
  outputQuality: number;
  caption: string;
  doc: TemplateDocument;
}

/** Layers copied to the clipboard with the fields they use. */
interface ClipboardContent {
  templateId: number;
  layers: Layer[];
  fields: Field[];
}

/** Most steps of the history. */
export const HISTORY_LIMIT = 150;

/** Similar changes within this time become one step of the history (ms). */
const COALESCE_MS = 1200;

/** Clipboard shared by the editors of the session (copy in one template, paste in another). */
let clipboard: ClipboardContent | null = null;

export class EditorStore {
  /** Id of the template. */
  readonly templateId: number;
  /** Changes are allowed (update permission). */
  readonly editable: boolean;

  /** Current state. */
  readonly state = signal<EditorSnapshot>(null as unknown as EditorSnapshot);
  /** Ids of the selected layers (in the order of selection). */
  readonly selection = signal<string[]>([]);
  /** Version of the template the editor is based on. */
  readonly version = signal(1);
  /** JSON of the last saved state. */
  private readonly savedJson = signal('');

  /** Undo / redo stacks. */
  private readonly undoStack = signal<EditorSnapshot[]>([]);
  private readonly redoStack = signal<EditorSnapshot[]>([]);
  /** Key and time of the last recorded change (coalescing). */
  private lastKey: string | null = null;
  private lastTime = 0;

  /** The document. */
  readonly doc = computed(() => this.state().doc);
  /** Size of the canvas. */
  readonly size = computed<CanvasSize>(() => ({ width: this.state().width, height: this.state().height }));
  /** Layers of the (only) page, bottom first. */
  readonly layers = computed(() => this.state().doc.pages[0].layers);
  /** Selected layers (bottom first). */
  readonly selectedLayers = computed(() => {
    const ids = new Set(this.selection());
    return this.layers().filter(l => ids.has(l.id));
  });
  /** The one selected layer (null for none / several). */
  readonly selectedLayer = computed(() => {
    const selected = this.selectedLayers();
    return selected.length === 1 ? selected[0] : null;
  });
  /** There are unsaved changes. */
  readonly dirty = computed(() => this.editable && JSON.stringify(this.state()) !== this.savedJson());
  /** Undo / redo possible. */
  readonly canUndo = computed(() => this.undoStack().length > 0);
  readonly canRedo = computed(() => this.redoStack().length > 0);

  /**
   * @param template Template loaded from the API.
   * @param editable Whether the account may save it.
   */
  constructor(template: CreatorTemplateDetail, editable: boolean) {
    this.templateId = template.id;
    this.editable = editable;
    this.load(template);
  }

  /**
   * @description Replaces the whole state by a template of the API (open, reload after a
   *   conflict, after a save); clears the history when the template changed elsewhere.
   * @param template Template.
   * @param keepHistory Keep undo / redo (after an own save).
   */
  load(template: CreatorTemplateDetail, keepHistory = false): void {
    const snapshot: EditorSnapshot = {
      name: template.name, width: template.width, height: template.height, outputFormat: template.output_format,
      outputQuality: template.output_quality, caption: template.caption_template ?? '', doc: cloneJson(template.document),
    };
    this.state.set(snapshot);
    this.savedJson.set(JSON.stringify(snapshot));
    this.version.set(template.version);
    if (!keepHistory) {
      this.undoStack.set([]);
      this.redoStack.set([]);
      this.selection.set([]);
    }
    this.lastKey = null;
  }

  /**
   * @description Body of the save of the current state.
   */
  saveBody(): TemplateSave {
    const s = this.state();
    return {
      name: s.name.trim(), width: s.width, height: s.height, output_format: s.outputFormat, output_quality: s.outputQuality,
      caption_template: s.caption.trim() ? s.caption : null, version: this.version(), document: s.doc,
    };
  }

  /**
   * @description Changes the state as one step of the history.
   * @param change Changes a copy of the state.
   * @param key Similar changes with the same key in a row become one step (null = always a new step).
   */
  commit(change: (draft: EditorSnapshot) => void, key: string | null = null): void {
    if (!this.editable) return;
    const before = this.state();
    const draft = structuredClone(before);
    change(draft);
    pruneFields(draft.doc);
    const now = Date.now();
    if (!(key && key === this.lastKey && now - this.lastTime < COALESCE_MS)) {
      this.undoStack.update(stack => [...stack, before].slice(-HISTORY_LIMIT));
    }
    this.redoStack.set([]);
    this.lastKey = key;
    this.lastTime = now;
    this.state.set(draft);
    const ids = new Set(draft.doc.pages[0].layers.map(l => l.id));
    this.selection.update(sel => sel.filter(id => ids.has(id)));
  }

  /**
   * @description Changes the document as one step of the history.
   * @param change Changes a copy of the document.
   * @param key Coalescing key (see commit()).
   */
  mutate(change: (doc: TemplateDocument) => void, key: string | null = null): void {
    this.commit(draft => change(draft.doc), key);
  }

  /** @description Ends the current coalesced step (e.g. at the end of a drag). */
  endStep(): void {
    this.lastKey = null;
  }

  /** @description Undo the last step. */
  undo(): void {
    const stack = this.undoStack();
    if (!stack.length) return;
    this.redoStack.update(r => [...r, this.state()]);
    this.undoStack.set(stack.slice(0, -1));
    this.state.set(stack[stack.length - 1]);
    this.lastKey = null;
    this.keepValidSelection();
  }

  /** @description Redo an undone step. */
  redo(): void {
    const stack = this.redoStack();
    if (!stack.length) return;
    this.undoStack.update(u => [...u, this.state()]);
    this.redoStack.set(stack.slice(0, -1));
    this.state.set(stack[stack.length - 1]);
    this.lastKey = null;
    this.keepValidSelection();
  }

  /**
   * @description Selects layers.
   * @param ids Ids.
   * @param add Add to / toggle in the selection (Shift).
   */
  select(ids: string[], add = false): void {
    if (!add) {
      this.selection.set(ids);
      return;
    }
    const current = new Set(this.selection());
    for (const id of ids) {
      if (current.has(id)) current.delete(id); else current.add(id);
    }
    this.selection.set([...current]);
  }

  /** @description Selects every visible unlocked layer. */
  selectAll(): void {
    this.selection.set(this.layers().filter(l => !l.hidden && !l.locked).map(l => l.id));
  }

  /**
   * @description Changes one layer.
   * @param id Layer.
   * @param patch Properties.
   * @param key Coalescing key.
   */
  updateLayer(id: string, patch: Partial<Layer>, key: string | null = null): void {
    this.mutate(doc => {
      const layers = doc.pages[0].layers;
      const index = layers.findIndex(l => l.id === id);
      if (index >= 0) layers[index] = { ...layers[index], ...patch } as Layer;
    }, key ? `${id}:${key}` : null);
  }

  /**
   * @description Changes several layers by a function.
   * @param ids Layers.
   * @param change Changes one layer (a copy).
   * @param key Coalescing key.
   */
  updateLayers(ids: string[], change: (layer: Layer) => void, key: string | null = null): void {
    const set = new Set(ids);
    this.mutate(doc => doc.pages[0].layers.filter(l => set.has(l.id)).forEach(change), key);
  }

  /**
   * @description Adds a new layer of a kind on top and selects it.
   * @param type Kind.
   * @param patch Further properties.
   * @returns Id of the new layer.
   */
  addLayer(type: LayerType, patch: Partial<Layer> = {}): string {
    const id = newLayerId(new Set(this.layers().map(l => l.id)));
    const layer = { ...createLayer(type, this.size(), id), ...patch } as Layer;
    this.mutate(doc => doc.pages[0].layers.push(layer));
    this.selection.set([id]);
    return id;
  }

  /** @description Deletes the selected layers. */
  removeSelected(): void {
    const ids = new Set(this.selection());
    if (!ids.size) return;
    this.mutate(doc => {
      doc.pages[0].layers = doc.pages[0].layers.filter(l => !ids.has(l.id) || l.locked);
    });
  }

  /** @description Copies the selected layers (with their fields) to the clipboard. */
  copySelected(): void {
    const layers = this.selectedLayers();
    if (!layers.length) return;
    const keys = usedFieldKeys({ ...this.doc(), pages: [{ ...this.doc().pages[0], layers }] });
    clipboard = { templateId: this.templateId, layers: cloneJson(layers), fields: cloneJson(this.doc().fields.filter(f => keys.has(f.key))) };
  }

  /** @description Whether the clipboard holds layers. */
  hasClipboard(): boolean {
    return !!clipboard?.layers.length;
  }

  /**
   * @description Pastes the clipboard on top (shifted by 20 px in the same template) and selects
   *   it; missing fields are added (a key used by another kind of field gets a new key).
   */
  paste(): void {
    const content = clipboard;
    if (!content?.layers.length) return;
    const shift = content.templateId === this.templateId ? 20 : 0;
    this.insertCopies(content.layers, content.fields, shift);
  }

  /** @description Duplicates the selected layers (shifted by 20 px). */
  duplicateSelected(): void {
    const layers = this.selectedLayers();
    if (layers.length) this.insertCopies(layers, [], 20);
  }

  /**
   * @description Moves the selected layers in the order of drawing.
   * @param where up / down (one step), top / bottom.
   */
  arrange(where: 'up' | 'down' | 'top' | 'bottom'): void {
    const ids = new Set(this.selection());
    if (!ids.size) return;
    this.mutate(doc => {
      const layers = doc.pages[0].layers;
      const moving = layers.filter(l => ids.has(l.id));
      const rest = layers.filter(l => !ids.has(l.id));
      if (where === 'top') doc.pages[0].layers = [...rest, ...moving];
      else if (where === 'bottom') doc.pages[0].layers = [...moving, ...rest];
      else {
        const order = where === 'up' ? [...layers.keys()].reverse() : [...layers.keys()];
        for (const i of order) {
          const j = where === 'up' ? i + 1 : i - 1;
          if (ids.has(layers[i].id) && j >= 0 && j < layers.length && !ids.has(layers[j].id)) {
            [layers[i], layers[j]] = [layers[j], layers[i]];
          }
        }
      }
    });
  }

  /**
   * @description Moves one layer to a position of the list (drag in the layer panel).
   * @param id Layer.
   * @param index New index (bottom = 0).
   */
  moveLayerTo(id: string, index: number): void {
    this.mutate(doc => {
      const layers = doc.pages[0].layers;
      const from = layers.findIndex(l => l.id === id);
      if (from < 0) return;
      const [layer] = layers.splice(from, 1);
      layers.splice(Math.max(0, Math.min(index, layers.length)), 0, layer);
    });
  }

  /**
   * @description Moves the selected unlocked layers by a distance.
   * @param dx Px.
   * @param dy Px.
   * @param key Coalescing key (nudging with arrows = one step).
   */
  nudge(dx: number, dy: number, key = 'nudge'): void {
    const ids = this.selectedLayers().filter(l => !l.locked).map(l => l.id);
    if (ids.length) this.updateLayers(ids, l => { l.x += dx; l.y += dy; }, key);
  }

  /**
   * @description Aligns the selected layers to the canvas (one layer) or to their common box.
   * @param edge left | hcenter | right | top | vcenter | bottom.
   */
  align(edge: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom'): void {
    const layers = this.selectedLayers().filter(l => !l.locked);
    if (!layers.length) return;
    const size = this.size();
    const boxes = new Map(layers.map(l => [l.id, boundingBox(layerRect(l, size), l.rotation)]));
    const target = layers.length === 1 && this.selectedLayers().length === 1
      ? { x: 0, y: 0, w: size.width, h: size.height }
      : unionRect([...boxes.values()]);
    this.updateLayers(layers.map(l => l.id), l => {
      const box = boxes.get(l.id)!;
      const dx = edge === 'left' ? target.x - box.x : edge === 'right' ? target.x + target.w - (box.x + box.w)
        : edge === 'hcenter' ? target.x + target.w / 2 - (box.x + box.w / 2) : 0;
      const dy = edge === 'top' ? target.y - box.y : edge === 'bottom' ? target.y + target.h - (box.y + box.h)
        : edge === 'vcenter' ? target.y + target.h / 2 - (box.y + box.h / 2) : 0;
      l.x = Math.round(l.x + dx);
      l.y = Math.round(l.y + dy);
    });
  }

  /**
   * @description Spreads 3+ selected layers evenly (equal gaps between their boxes).
   * @param axis horizontal | vertical.
   */
  distribute(axis: 'horizontal' | 'vertical'): void {
    const layers = this.selectedLayers().filter(l => !l.locked);
    if (layers.length < 3) return;
    const size = this.size();
    const h = axis === 'horizontal';
    const items = layers.map(l => ({ l, box: boundingBox(layerRect(l, size), l.rotation) }))
      .sort((a, b) => (h ? a.box.x - b.box.x : a.box.y - b.box.y));
    const first = items[0].box;
    const last = items[items.length - 1].box;
    const span = h ? last.x + last.w - first.x : last.y + last.h - first.y;
    const total = items.reduce((sum, i) => sum + (h ? i.box.w : i.box.h), 0);
    const gap = (span - total) / (items.length - 1);
    const shifts = new Map<string, number>();
    let pos = h ? first.x : first.y;
    for (const item of items) {
      shifts.set(item.l.id, pos - (h ? item.box.x : item.box.y));
      pos += (h ? item.box.w : item.box.h) + gap;
    }
    this.updateLayers(layers.map(l => l.id), l => {
      if (h) l.x = Math.round(l.x + (shifts.get(l.id) ?? 0)); else l.y = Math.round(l.y + (shifts.get(l.id) ?? 0));
    });
  }

  /**
   * @description Changes the anchor of a layer keeping its place on the canvas.
   * @param id Layer.
   * @param anchor New anchor.
   */
  setAnchor(id: string, anchor: Layer['anchor']): void {
    const layer = this.layers().find(l => l.id === id);
    if (!layer) return;
    const offset = offsetFor(anchor, layerRect(layer, this.size()), this.size());
    this.updateLayer(id, { anchor, x: Math.round(offset.x), y: Math.round(offset.y) });
  }

  /**
   * @description Changes the size of the canvas (layers keep their anchors and offsets).
   * @param size New size.
   */
  resize(size: CanvasSize): void {
    this.commit(draft => {
      draft.width = size.width;
      draft.height = size.height;
    });
  }

  /**
   * @description Inserts copies of layers with new ids on top and selects them.
   * @param layers Layers to copy.
   * @param fields Fields of the copied layers (from another template).
   * @param shift Offset of the copies (px).
   */
  private insertCopies(layers: Layer[], fields: Field[], shift: number): void {
    const ids: string[] = [];
    this.mutate(doc => {
      const taken = new Set(doc.pages[0].layers.map(l => l.id));
      const renamed = new Map<string, string>();
      for (const field of fields) {
        const existing = doc.fields.find(f => f.key === field.key);
        if (existing?.type === field.type) continue;
        let key = field.key;
        for (let i = 2; doc.fields.some(f => f.key === key); i++) key = `${field.key.slice(0, 36)}_${i}`;
        renamed.set(field.key, key);
        if (doc.fields.length < 50) doc.fields.push({ ...cloneJson(field), key });
      }
      for (const original of layers) {
        const copy = cloneJson(original);
        copy.id = newLayerId(taken);
        taken.add(copy.id);
        copy.x += shift;
        copy.y += shift;
        copy.locked = false;
        if (copy.type === 'text' && copy.field) copy.field = renamed.get(copy.field) ?? copy.field;
        for (const source of layerSources(copy)) {
          if (source.kind === 'field') source.field = renamed.get(source.field) ?? source.field;
        }
        doc.pages[0].layers.push(copy);
        ids.push(copy.id);
      }
    });
    this.selection.set(ids);
  }

  /** @description Drops ids of layers that no longer exist from the selection. */
  private keepValidSelection(): void {
    const ids = new Set(this.layers().map(l => l.id));
    this.selection.update(sel => sel.filter(id => ids.has(id)));
  }
}

/**
 * @description Drops the fields no layer uses (in place) - a field lives as long as a layer
 *   refers to it.
 * @param doc Document.
 */
export function pruneFields(doc: TemplateDocument): void {
  const used = usedFieldKeys(doc);
  if (doc.fields.some(f => !used.has(f.key))) doc.fields = doc.fields.filter(f => used.has(f.key));
}
