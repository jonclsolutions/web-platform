/**
 * @file editor-store.ts
 * @path src/app/apps/js-creator/admin/images/editor/editor-store.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description State of the editor of a template or a block (one instance per opened design):
 *   name, size, output, caption pattern (templates), document, the selection of layers, the
 *   history of undo / redo (150 steps) and the clipboard. Every change goes through mutate() /
 *   commit(): a step of the history is recorded first (similar changes in a row - typing,
 *   nudging, dragging - become one step), then the document is replaced (never changed in place,
 *   so the signals see every change) and fields no layer uses any more are dropped.
 *   Block instances (templates only): insert, scale, make a block of the selection (the layers
 *   are replaced by an instance) and unpack an instance back to layers; their boxes follow the
 *   current size of their blocks (syncInstances() after loading). A block never gets instances -
 *   pasting skips them.
 *   Pages (slides of a carousel, templates only - 1 … DOCUMENT_LIMITS.maxPages): the editor shows
 *   one page at a time (`page`); layers, selection and every change of layers work on it; pages
 *   can be added (empty with the same background, or a copy), deleted and moved. Fields belong to
 *   the whole document, layer ids are unique in the whole document.
 * @usage `const store = new EditorStore(template, canEdit); store.updateLayer(id, { x: 10 }, 'x')`;
 *   a block: `new EditorStore(blockAsTemplate(block), canEdit, 'block')`.
 * @dependencies render/document.ts, render/geometry.ts (anchors), render/block-fields.ts,
 *   render/block-instances.ts, Angular signals.
 */

import { computed, signal } from '@angular/core';
import {
  BlockLayer, CanvasSize, DOCUMENT_LIMITS, Field, Layer, Page, PlainLayerType, TemplateDocument, cloneJson, createBlockLayer, createLayer, layerSources,
  newLayerId, usedFieldKeys,
} from '../../shared/render/document';
import { Rect, boundingBox, layerRect, offsetFor, unionRect } from '../../shared/render/geometry';
import { BlockDef, BlockResolver, EffectiveField } from '../../shared/render/block-fields';
import { anchorByPlace, unpackInstance } from '../../shared/render/block-instances';
import { BlockSave, CreatorBlockDetail, CreatorTemplateDetail, TemplateSave } from '../../shared/js-creator.models';

/** What the editor edits. */
export type EditorKind = 'template' | 'block';

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
  /** `template:<id>` / `block:<id>` - pasting into the same design shifts the copies. */
  owner: string;
  layers: Layer[];
  fields: Field[];
}

/** Most steps of the history. */
export const HISTORY_LIMIT = 150;

/** Similar changes within this time become one step of the history (ms). */
const COALESCE_MS = 1200;

/** Clipboard shared by the editors of the session (copy in one template, paste in another). */
let clipboard: ClipboardContent | null = null;

/**
 * @description A block in the shape the editor opens (the output and caption of a template are
 *   not used for a block).
 * @param block Block of the API.
 */
export function blockAsTemplate(block: CreatorBlockDetail): CreatorTemplateDetail {
  return {
    id: block.id, section: block.section, name: block.name, width: block.width, height: block.height, output_format: 'png', output_quality: 90,
    caption_template: null, thumb_url: block.thumb_url, version: block.version, created_at: block.created_at, updated_at: block.updated_at,
    deleted_at: block.deleted_at, schema_version: block.schema_version, document: block.document,
  };
}

export class EditorStore {
  /** Id of the template / block. */
  readonly templateId: number;
  /** Changes are allowed (update permission). */
  readonly editable: boolean;
  /** A template or a block. */
  readonly kind: EditorKind;

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
  /** Page (slide) being edited - asked for; see pageIndex. */
  readonly page = signal(0);
  /** Number of pages of the document. */
  readonly pageCount = computed(() => this.state().doc.pages.length);
  /** Index of the page shown (the asked one within the pages of the document). */
  readonly pageIndex = computed(() => Math.max(0, Math.min(this.page(), this.state().doc.pages.length - 1)));
  /** Pages can be added (a template below the limit). */
  readonly canAddPage = computed(() => this.editable && this.kind === 'template' && this.pageCount() < DOCUMENT_LIMITS.maxPages);
  /** Layers of the page shown, bottom first. */
  readonly layers = computed(() => this.state().doc.pages[this.pageIndex()].layers);
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
   * @param template Template loaded from the API (a block through blockAsTemplate()).
   * @param editable Whether the account may save it.
   * @param kind A template or a block.
   */
  constructor(template: CreatorTemplateDetail, editable: boolean, kind: EditorKind = 'template') {
    this.templateId = template.id;
    this.editable = editable;
    this.kind = kind;
    this.load(template);
  }

  /**
   * @description Replaces the whole state by a template of the API (open, reload after a
   *   conflict, after a save); clears the history when the template changed elsewhere.
   * @param template Template.
   * @param keepHistory Keep undo / redo (after an own save).
   */
  load(template: CreatorTemplateDetail, keepHistory = false): void {
    const snapshot = snapshotOf(template);
    this.state.set(snapshot);
    this.savedJson.set(JSON.stringify(snapshot));
    this.version.set(template.version);
    if (!keepHistory) {
      this.undoStack.set([]);
      this.redoStack.set([]);
      this.selection.set([]);
      this.page.set(0);
    }
    this.lastKey = null;
  }

  /**
   * @description The current state as JSON (what a save sends - compared when its answer comes).
   */
  stateJson(): string {
    return JSON.stringify(this.state());
  }

  /**
   * @description An own save was answered: the template of the API becomes the saved state.
   *   Changes made while the save was running (the canvas stays editable) are kept as unsaved
   *   changes instead of being replaced by the answer.
   * @param template Saved template (new version).
   * @param sent stateJson() of the state that was sent.
   */
  saved(template: CreatorTemplateDetail, sent: string): void {
    if (this.stateJson() === sent) {
      this.load(template, true);
      return;
    }
    this.savedJson.set(JSON.stringify(snapshotOf(template)));
    this.version.set(template.version);
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
   * @description Body of the save of a block.
   */
  blockSaveBody(): BlockSave {
    const s = this.state();
    return { name: s.name.trim(), width: s.width, height: s.height, version: this.version(), document: s.doc };
  }

  /**
   * @description Boxes of the instances follow the current size of their blocks × scale (after
   *   loading - a block may have changed its size). Not a step of the history; a state without
   *   unsaved changes stays without them.
   * @param resolve Blocks of the instances.
   */
  syncInstances(resolve: BlockResolver): void {
    const state = this.state();
    let changed = false;
    const pages = state.doc.pages.map(page => ({
      ...page,
      layers: page.layers.map(layer => {
        const block = layer.type === 'block' ? resolve(layer.blockId) : undefined;
        if (!block || layer.type !== 'block') return layer;
        const w = block.width * layer.scale;
        const h = block.height * layer.scale;
        if (Math.abs(w - layer.w) < 0.01 && Math.abs(h - layer.h) < 0.01) return layer;
        changed = true;
        return { ...layer, w, h };
      }),
    }));
    if (!changed) return;
    const clean = JSON.stringify(state) === this.savedJson();
    const next = { ...state, doc: { ...state.doc, pages } };
    this.state.set(next);
    if (clean) this.savedJson.set(JSON.stringify(next));
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
    const ids = new Set(this.pageOf(draft.doc).layers.map(l => l.id));
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
      const layers = this.pageOf(doc).layers;
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
    this.mutate(doc => this.pageOf(doc).layers.filter(l => set.has(l.id)).forEach(change), key);
  }

  /**
   * @description Adds a new layer of a kind on top and selects it.
   * @param type Kind.
   * @param patch Further properties.
   * @returns Id of the new layer.
   */
  addLayer(type: PlainLayerType, patch: Partial<Layer> = {}): string {
    const id = newLayerId(this.layerIds());
    const layer = { ...createLayer(type, this.size(), id), ...patch } as Layer;
    this.mutate(doc => this.pageOf(doc).layers.push(layer));
    this.selection.set([id]);
    return id;
  }

  /**
   * @description Adds an instance of a block on top (centred, fitted to the canvas) and selects it
   *   (templates only).
   * @param block Block.
   * @returns Id of the new layer, or null in a block.
   */
  addBlock(block: Pick<BlockDef, 'id' | 'width' | 'height'>): string | null {
    if (this.kind !== 'template') return null;
    const id = newLayerId(this.layerIds());
    const layer = createBlockLayer(block, this.size(), id);
    this.mutate(doc => this.pageOf(doc).layers.push(layer));
    this.selection.set([id]);
    return id;
  }

  /**
   * @description New scale of an instance (its box follows: block size × scale, anchor offset kept).
   * @param id Instance.
   * @param scale Scale (kept within the limits).
   * @param block Its block (size).
   */
  setScale(id: string, scale: number, block: Pick<BlockDef, 'width' | 'height'>): void {
    const value = Math.round(Math.min(DOCUMENT_LIMITS.maxScale, Math.max(DOCUMENT_LIMITS.minScale, scale)) * 10000) / 10000;
    this.updateLayer(id, { scale: value, w: block.width * value, h: block.height * value } as Partial<BlockLayer>, 'scale');
  }

  /**
   * @description Replaces layers by an instance of the block made from them (one step): the
   *   instance takes the place of the lowest of them, scale 1, anchored by where it lies.
   * @param ids Layers that became the block.
   * @param block The new block.
   * @param box Place of the instance (the box around the layers).
   * @returns Id of the instance.
   */
  replaceWithInstance(ids: readonly string[], block: Pick<BlockDef, 'id' | 'width' | 'height'>, box: Rect): string {
    const remove = new Set(ids);
    const layers = this.layers();
    const id = newLayerId(this.layerIds());
    const anchor = anchorByPlace(box, this.size());
    const offset = offsetFor(anchor, { ...box, w: block.width, h: block.height }, this.size());
    const instance: BlockLayer = {
      ...createBlockLayer(block, this.size(), id), anchor, x: Math.round(offset.x), y: Math.round(offset.y), w: block.width, h: block.height, scale: 1,
    };
    const index = layers.findIndex(l => remove.has(l.id));
    this.mutate(doc => {
      const page = this.pageOf(doc);
      const kept = page.layers.filter(l => !remove.has(l.id));
      const before = page.layers.slice(0, Math.max(0, index)).filter(l => !remove.has(l.id)).length;
      kept.splice(before, 0, instance);
      page.layers = kept;
    });
    this.selection.set([id]);
    return id;
  }

  /**
   * @description Unpacks an instance into independent layers in its place (one step); the fields
   *   of the block become fields of the template with the keys they had in the form.
   * @param id Instance.
   * @param block Its block.
   * @param effective Fields of the form of the template.
   * @returns false when the template would exceed the limits of layers / fields (nothing changes).
   */
  unpack(id: string, block: BlockDef, effective: readonly EffectiveField[]): boolean {
    const layers = this.layers();
    const instance = layers.find((l): l is BlockLayer => l.id === id && l.type === 'block');
    if (!instance) return false;
    const unpacked = unpackInstance(instance, block, this.size(), effective, this.layerIds());
    const fields = this.doc().fields;
    const newFields = unpacked.fields.filter(f => !fields.some(existing => existing.key === f.key));
    if (layers.length - 1 + unpacked.layers.length > DOCUMENT_LIMITS.maxLayers || fields.length + newFields.length > DOCUMENT_LIMITS.maxFields) return false;
    this.mutate(doc => {
      const page = this.pageOf(doc);
      const index = page.layers.findIndex(l => l.id === id);
      page.layers.splice(index, 1, ...unpacked.layers);
      doc.fields.push(...newFields);
    });
    this.selection.set(unpacked.layers.map(l => l.id));
    return true;
  }

  /** @description Deletes the selected layers. */
  removeSelected(): void {
    const ids = new Set(this.selection());
    if (!ids.size) return;
    this.mutate(doc => {
      const page = this.pageOf(doc);
      page.layers = page.layers.filter(l => !ids.has(l.id) || l.locked);
    });
  }

  /** @description Copies the selected layers (with their fields) to the clipboard. */
  copySelected(): void {
    const layers = this.selectedLayers();
    if (!layers.length) return;
    const keys = usedFieldKeys({ ...this.doc(), pages: [{ ...this.pageOf(this.doc()), layers }] });
    clipboard = { owner: this.owner(), layers: cloneJson(layers), fields: cloneJson(this.doc().fields.filter(f => keys.has(f.key))) };
  }

  /** @description Whether the clipboard holds layers. */
  hasClipboard(): boolean {
    return !!clipboard?.layers.length;
  }

  /**
   * @description Pastes the clipboard on top (shifted by 20 px in the same design) and selects
   *   it; missing fields are added (a key used by another kind of field gets a new key). A block
   *   skips block instances (blocks do not nest).
   * @returns Number of layers skipped.
   */
  paste(): number {
    const content = clipboard;
    if (!content?.layers.length) return 0;
    const shift = content.owner === this.owner() ? 20 : 0;
    const layers = this.kind === 'block' ? content.layers.filter(l => l.type !== 'block') : content.layers;
    if (layers.length) this.insertCopies(layers, content.fields, shift);
    return content.layers.length - layers.length;
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
      const page = this.pageOf(doc);
      const layers = page.layers;
      const moving = layers.filter(l => ids.has(l.id));
      const rest = layers.filter(l => !ids.has(l.id));
      if (where === 'top') page.layers = [...rest, ...moving];
      else if (where === 'bottom') page.layers = [...moving, ...rest];
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
      const layers = this.pageOf(doc).layers;
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
   * @description Shows another page (the selection is cleared).
   * @param index Page (0 = the first).
   */
  setPage(index: number): void {
    const next = Math.max(0, Math.min(index, this.pageCount() - 1));
    if (next === this.pageIndex()) return;
    this.page.set(next);
    this.selection.set([]);
    this.lastKey = null;
  }

  /**
   * @description Adds a page after the shown one and shows it: an empty page with the same
   *   background, or a copy of the shown page (its layers with new ids). Templates only, at most
   *   DOCUMENT_LIMITS.maxPages.
   * @param copy Copy the shown page.
   * @returns Whether a page was added.
   */
  addPage(copy = false): boolean {
    if (!this.canAddPage()) return false;
    const at = this.pageIndex() + 1;
    this.mutate(doc => {
      const current = this.pageOf(doc);
      const taken = this.layerIds(doc);
      const layers = copy ? current.layers.map(layer => {
        const clone = cloneJson(layer);
        clone.id = newLayerId(taken);
        taken.add(clone.id);
        return clone;
      }) : [];
      doc.pages.splice(at, 0, { background: cloneJson(current.background), layers });
    });
    this.page.set(at);
    this.selection.set([]);
    return true;
  }

  /**
   * @description Deletes the shown page (one step; the last page cannot be deleted) and shows
   *   the page before it.
   */
  removePage(): void {
    if (this.pageCount() < 2) return;
    const at = this.pageIndex();
    this.mutate(doc => {
      doc.pages.splice(at, 1);
    });
    this.page.set(Math.max(0, at - 1));
    this.selection.set([]);
  }

  /**
   * @description Moves the shown page by one place (one step) and keeps it shown.
   * @param step -1 = earlier, 1 = later.
   */
  movePage(step: -1 | 1): void {
    const from = this.pageIndex();
    const to = from + step;
    if (to < 0 || to >= this.pageCount()) return;
    this.mutate(doc => {
      const [page] = doc.pages.splice(from, 1);
      doc.pages.splice(to, 0, page);
    });
    this.page.set(to);
  }

  /**
   * @description The shown page of a document (a draft of a change, or the current one).
   * @param doc Document.
   */
  pageOf(doc: TemplateDocument): Page {
    return doc.pages[Math.max(0, Math.min(this.page(), doc.pages.length - 1))];
  }

  /**
   * @description Ids of the layers of every page (ids are unique in the whole document).
   * @param doc Document (the current one by default).
   */
  layerIds(doc: TemplateDocument = this.doc()): Set<string> {
    return new Set(doc.pages.flatMap(p => p.layers.map(l => l.id)));
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
      const taken = this.layerIds(doc);
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
        this.pageOf(doc).layers.push(copy);
        ids.push(copy.id);
      }
    });
    this.selection.set(ids);
  }

  /** @description Owner key of the clipboard (`template:<id>` / `block:<id>`). */
  private owner(): string {
    return `${this.kind}:${this.templateId}`;
  }

  /** @description Drops ids of layers that no longer exist from the selection. */
  private keepValidSelection(): void {
    const ids = new Set(this.layers().map(l => l.id));
    this.selection.update(sel => sel.filter(id => ids.has(id)));
  }
}

/**
 * @description State of the editor made from a template of the API.
 * @param template Template (a block through blockAsTemplate()).
 */
export function snapshotOf(template: CreatorTemplateDetail): EditorSnapshot {
  return {
    name: template.name, width: template.width, height: template.height, outputFormat: template.output_format,
    outputQuality: template.output_quality, caption: template.caption_template ?? '', doc: cloneJson(template.document),
  };
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
