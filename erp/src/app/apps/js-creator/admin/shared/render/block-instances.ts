/**
 * @file block-instances.ts
 * @path src/app/apps/js-creator/admin/shared/render/block-instances.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Turning layers into a block and back (pure functions of the template editor):
 *   - blockFromSelection(): the selected layers as the document of a new block - its canvas is the
 *     box around them (at least 100 px, at most 3000 px a side), every layer keeps its anchor and
 *     look, the fields they use go with them; the instance then takes their place at scale 1;
 *   - unpackInstance(): the layers of a block as independent layers of the template - scaled,
 *     turned and faded with the instance, anchored like the instance, the background of the block
 *     as a shape / image at the bottom, the fields with the keys the instance had in the form;
 *   - scaleLayerStyle(): sizes of a layer (font, strokes, shadows, radii, gaps) times a factor.
 * @usage `const made = blockFromSelection(layers, doc.fields, size); if ('error' in made) …`.
 * @dependencies document.ts, geometry.ts, block-fields.ts.
 */

import {
  BlockLayer, CanvasSize, DOCUMENT_LIMITS, DOCUMENT_SCHEMA, Field, Layer, LayerBase, TemplateDocument, cloneJson, layerSources, newLayerId,
  usedFieldKeys,
} from './document';
import { Rect, boundingBox, layerRect, offsetFor, rotatePoint, unionRect } from './geometry';
import { BlockDef, EffectiveField, instanceKeys, instanceLayer } from './block-fields';

/** A block made from selected layers. */
export interface BlockFromSelection {
  /** Size of the block (its canvas). */
  size: CanvasSize;
  /** Document of the block (transparent background, the layers, their fields). */
  document: TemplateDocument;
  /** Place of the instance on the template (scale 1). */
  box: Rect;
}

/** Why the selected layers cannot become a block. */
export type BlockFromSelectionError = 'empty' | 'has_block' | 'too_large';

/** Layers of an unpacked instance. */
export interface UnpackedInstance {
  /** New layers (bottom first) in place of the instance. */
  layers: Layer[];
  /** Fields of the block with their keys in the template. */
  fields: Field[];
}

/**
 * @description Rounds to 2 decimals (positions and sizes stay readable in the document).
 * @param value Number.
 */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * @description Clamps a number.
 * @param value Number.
 * @param min Smallest.
 * @param max Largest.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * @description Sizes of a layer times a factor: font size, smallest size, letter spacing, strokes,
 *   borders, shadows, radii, gaps and the padding of a text box (within the limits of the
 *   document). Proportional values (line height, focus, icon line width) stay.
 * @param layer Layer (changed in place).
 * @param factor Factor.
 * @returns The same layer.
 */
export function scaleLayerStyle(layer: Layer, factor: number): Layer {
  const s = (value: number, min: number, max: number) => clamp(round2(value * factor), min, max);
  const shadow = (sh: { blur: number; x: number; y: number } | null) => {
    if (sh) { sh.blur = s(sh.blur, 0, 200); sh.x = s(sh.x, -500, 500); sh.y = s(sh.y, -500, 500); }
  };
  const stroke = (st: { width: number } | null) => { if (st) st.width = s(st.width, 0, 200); };
  switch (layer.type) {
    case 'text':
      layer.size = s(layer.size, 4, 1000);
      layer.minSize = s(layer.minSize, 4, 1000);
      layer.letterSpacing = s(layer.letterSpacing, -100, 500);
      stroke(layer.stroke);
      shadow(layer.shadow);
      if (layer.box) {
        layer.box.padding = s(layer.box.padding, 0, 500);
        layer.box.radius = s(layer.box.radius, 0, 1000);
      }
      break;
    case 'image':
      layer.radius = s(layer.radius, 0, 10000);
      stroke(layer.border);
      shadow(layer.shadow);
      break;
    case 'grid':
      layer.gap = s(layer.gap, 0, 500);
      layer.radius = s(layer.radius, 0, 10000);
      stroke(layer.border);
      break;
    case 'shape':
      layer.radius = s(layer.radius, 0, 10000);
      stroke(layer.stroke);
      shadow(layer.shadow);
      break;
    case 'icon':
      shadow(layer.shadow);
      break;
    case 'block':
      break;
  }
  return layer;
}

/**
 * @description The selected layers as a new block: the canvas of the block is the box around
 *   them (rotations included; at least 100 px a side - padded right / bottom), each layer keeps
 *   its anchor (offset recomputed on the block canvas) and look, the fields they use go with them.
 * @param layers Selected layers (bottom first).
 * @param fields Fields of the template.
 * @param canvas Size of the template.
 * @returns The block, or why it cannot be made.
 */
export function blockFromSelection(
  layers: readonly Layer[], fields: readonly Field[], canvas: CanvasSize,
): BlockFromSelection | { error: BlockFromSelectionError } {
  if (!layers.length) return { error: 'empty' };
  if (layers.some(l => l.type === 'block')) return { error: 'has_block' };
  const around = unionRect(layers.map(l => boundingBox(layerRect(l, canvas), l.rotation)));
  const x = Math.floor(around.x);
  const y = Math.floor(around.y);
  const width = Math.max(DOCUMENT_LIMITS.minSide, Math.ceil(around.x + around.w) - x);
  const height = Math.max(DOCUMENT_LIMITS.minSide, Math.ceil(around.y + around.h) - y);
  if (width > DOCUMENT_LIMITS.maxSide || height > DOCUMENT_LIMITS.maxSide) return { error: 'too_large' };
  const size = { width, height };
  const moved = layers.map(layer => {
    const rect = layerRect(layer, canvas);
    const offset = offsetFor(layer.anchor, { ...rect, x: rect.x - x, y: rect.y - y }, size);
    return { ...cloneJson(layer), x: round2(offset.x), y: round2(offset.y), locked: false } as Layer;
  });
  const document: TemplateDocument = {
    schema: DOCUMENT_SCHEMA,
    fields: [],
    pages: [{ background: { fill: { type: 'solid', color: '#ffffff00' }, image: null }, layers: moved }],
  };
  const used = usedFieldKeys(document);
  document.fields = cloneJson(fields.filter(f => used.has(f.key)));
  return { size, document, box: { x, y, w: width, h: height } };
}

/**
 * @description Anchor of a new instance by where its box lies on the canvas (thirds), so it stays
 *   in its corner / edge when the template is copied to another size.
 * @param box Box of the instance.
 * @param canvas Size of the template.
 */
export function anchorByPlace(box: Rect, canvas: CanvasSize): LayerBase['anchor'] {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const col = cx < canvas.width / 3 ? 'l' : cx > (canvas.width * 2) / 3 ? 'r' : 'c';
  const row = cy < canvas.height / 3 ? 't' : cy > (canvas.height * 2) / 3 ? 'b' : 'm';
  return `${row}${col}` as LayerBase['anchor'];
}

/**
 * @description The layers of a block as independent layers of the template in the place of its
 *   instance: positions and sizes scaled, turned around the centre of the instance, opacity and
 *   hiding of the instance applied, anchored like the instance; a visible background of the block
 *   becomes a shape (fill) and an image layer at the bottom; fields get the keys the instance had
 *   in the form (their labels too).
 * @param instance Instance.
 * @param block Its block.
 * @param canvas Size of the template.
 * @param effective Fields of the form of the template.
 * @param taken Layer ids of the template (new ids are added to it).
 */
export function unpackInstance(
  instance: BlockLayer, block: BlockDef, canvas: CanvasSize, effective: readonly EffectiveField[], taken: Set<string>,
): UnpackedInstance {
  const box = layerRect(instanceLayer(instance, block), canvas);
  const scale = box.w / block.width;
  const centre = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
  const keys = instanceKeys(effective, instance.id);
  const page = block.document.pages[0];
  const rename = (key: string) => keys.get(key) ?? key;

  const place = (layer: Layer, rect: Rect): Layer => {
    const scaled = { x: box.x + rect.x * scale, y: box.y + rect.y * scale, w: rect.w * scale, h: rect.h * scale };
    const middle = { x: scaled.x + scaled.w / 2, y: scaled.y + scaled.h / 2 };
    const moved = rotatePoint(middle, centre, instance.rotation);
    const final = { ...scaled, x: scaled.x + moved.x - middle.x, y: scaled.y + moved.y - middle.y };
    const offset = offsetFor(instance.anchor, final, canvas);
    let rotation = layer.rotation + instance.rotation;
    if (rotation > 360) rotation -= 360;
    if (rotation < -360) rotation += 360;
    const id = newLayerId(taken);
    taken.add(id);
    return {
      ...layer, id, anchor: instance.anchor, x: round2(offset.x), y: round2(offset.y), w: Math.max(1, round2(final.w)), h: Math.max(1, round2(final.h)),
      rotation: round2(rotation), opacity: round2(layer.opacity * instance.opacity), hidden: layer.hidden || instance.hidden, locked: false,
    } as Layer;
  };

  const layers: Layer[] = [];
  const whole: Rect = { x: 0, y: 0, w: block.width, h: block.height };
  const fill = page.background.fill;
  const transparent = fill.type === 'solid' && /^#[0-9a-f]{6}00$/i.test(fill.color);
  const base = { name: '', anchor: 'tl' as const, x: 0, y: 0, w: block.width, h: block.height, rotation: 0, opacity: 1, hidden: false, locked: false };
  if (!transparent) {
    layers.push(place({ ...base, id: '', type: 'shape', shape: 'rect', fill: cloneJson(fill), radius: 0, stroke: null, shadow: null }, whole));
  }
  const bg = page.background.image;
  if (bg) {
    const source = cloneJson(bg.source);
    if (source.kind === 'field') source.field = rename(source.field);
    layers.push(place({
      ...base, id: '', type: 'image', source, fit: bg.fit, focusX: bg.focusX, focusY: bg.focusY, radius: 0, mask: 'none',
      border: null, shadow: null, overlay: bg.overlay ? cloneJson(bg.overlay) : null, flipX: false,
    }, whole));
  }
  for (const original of page.layers) {
    if (original.type === 'block') continue;
    const copy = scaleLayerStyle(cloneJson(original), scale);
    if (copy.type === 'text' && copy.field) copy.field = rename(copy.field);
    for (const source of layerSources(copy)) if (source.kind === 'field') source.field = rename(source.field);
    layers.push(place(copy, layerRect(original, block)));
  }

  const fields = block.document.fields.map(field => {
    const key = rename(field.key);
    const label = effective.find(f => f.key === key)?.label ?? field.label;
    return { ...cloneJson(field), key, label } as Field;
  });
  return { layers, fields };
}
