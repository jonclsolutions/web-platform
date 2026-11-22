/**
 * @file renderer.ts
 * @path src/app/apps/js-creator/admin/shared/render/renderer.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description The renderer of JS Creator (Canvas 2D) - ONE code for the editor, the previews,
 *   the thumbnails and the generated output, so the preview is the output. It draws a page of a
 *   document in the coordinates of the template (the caller sets the scale of the canvas):
 *   the background (fill, image, overlay), then every visible layer (text, image, grid, shape,
 *   icon, block instance) with its anchor, rotation and opacity.
 *   A block instance draws the current document of its block (from the resources) into its box -
 *   the size of the block × scale - clipped to it; the fields of the block are filled with the
 *   values of the keys the form gives them (effectiveFields(): `price`, `price_2` …) and the
 *   report names those keys and the instance.
 *   Values of the fields come from `values` (generating, with the crops of the images) or from
 *   the samples of the fields (editor); an image field without a value - or a library image not
 *   loaded yet - is drawn as a placeholder in the editor (and in the live preview of generating
 *   with `placeholders`). The report tells which texts overflowed and what was missing.
 * @usage `renderPage(ctx, doc, size, resources, { mode: 'editor' })`.
 * @dependencies document.ts, geometry.ts, text-layout.ts, paint.ts, block-fields.ts, IconNode (js-creator.models).
 */

import {
  BlockLayer, CanvasSize, Field, GridLayer, IconLayer, ImageLayer, ImageSource, Layer, Page, ShapeLayer, TemplateDocument, TextLayer,
} from './document';
import { Rect, gridCellRects, layerRect } from './geometry';
import { TextLayout, layoutText } from './text-layout';
import {
  DrawableImage, applyShadow, castShadow, drawImageFit, ellipsePath, fillStyle, roundRectPath,
} from './paint';
import { BlockDef, EffectiveField, effectiveFields, instanceKeys, instanceLayer } from './block-fields';
import { IconNode } from '../js-creator.models';

/** What the renderer needs from outside: loaded images, font names, icons. */
export interface RenderResources {
  /** Loaded library image, or undefined while it is loading / missing. */
  asset(id: number): DrawableImage | undefined;
  /** Registered family name of a font reference (`set:<slug>` / `user:<id>`). */
  fontFamily(ref: string): string;
  /** Nodes of an icon, or undefined. */
  icon(name: string): IconNode[] | undefined;
  /** Block of an instance with its document, or undefined (not loaded / missing). */
  block?(id: number): BlockDef | undefined;
}

/** Crop of the image of a field chosen when generating (replaces the focus of the template). */
export interface ImageCrop {
  /** Focus point 0-1. */
  focusX: number;
  focusY: number;
  /** Extra enlargement (1 = as the template places it). */
  zoom: number;
}

/** Values of the fields when generating. */
export interface RenderValues {
  text: Record<string, string>;
  images: Record<string, DrawableImage | undefined>;
  /** Crops of image fields (by key); a field without one keeps the focus of the template. */
  crops?: Record<string, ImageCrop>;
}

/** How to draw. */
export interface RenderOptions {
  /** editor = samples and placeholders; output = only real values. */
  mode: 'editor' | 'output';
  values?: RenderValues;
  /** Index of the page (0). */
  page?: number;
  /** Output mode with placeholders of image fields without a value (live preview of generating). */
  placeholders?: boolean;
}

/** A text that did not fit. */
export interface TextOverflow {
  layerId: string;
  field: string | null;
  mode: 'ellipsis' | 'block';
}

/** Result of a drawing. */
export interface RenderReport {
  overflows: TextOverflow[];
  /** Missing things: `asset:<id>`, `field:<key>`, `icon:<name>`, `block:<id>`. */
  missing: string[];
}

/** Colours of the placeholder of an empty image (editor only). */
const PLACEHOLDER = { fill: '#e4e4e7', stripe: '#d4d4d8', text: '#52525b' };

/**
 * @description Draws one page of a document.
 * @param ctx Context; its transform maps template px to the canvas (scale of the editor).
 * @param doc Document.
 * @param size Size of the template.
 * @param resources Images, fonts, icons.
 * @param options Mode, values, page.
 * @returns What overflowed or was missing.
 */
export function renderPage(
  ctx: CanvasRenderingContext2D, doc: TemplateDocument, size: CanvasSize, resources: RenderResources, options: RenderOptions,
): RenderReport {
  const report: RenderReport = { overflows: [], missing: [] };
  const page = doc.pages[options.page ?? 0];
  if (!page) return report;
  const effective = page.layers.some(l => l.type === 'block')
    ? effectiveFields(doc, id => resources.block?.(id))
    : doc.fields.map(f => ({ ...f, origin: null }));
  const fields = new Map(effective.map(f => [f.key, f] as [string, Field]));
  const scene: Scene = { ctx, size, resources, options, fields, effective, report };

  ctx.save();
  drawBackground(scene, page);
  for (const layer of page.layers) {
    if (!layer.hidden) drawLayer(scene, layer);
  }
  ctx.restore();
  return report;
}

/** State of one drawing (of the template, or of the block of an instance). */
interface Scene {
  ctx: CanvasRenderingContext2D;
  size: CanvasSize;
  resources: RenderResources;
  options: RenderOptions;
  /** Fields by the key their layers use. */
  fields: Map<string, Field>;
  /** Fields of the form with the instance keys (template scene only). */
  effective: EffectiveField[];
  report: RenderReport;
}

/**
 * @description Background of a page: fill, image (of the library or of a field) and its overlay.
 * @param scene Drawing.
 * @param page Page.
 */
function drawBackground(scene: Scene, page: Page): void {
  const { ctx, size } = scene;
  const canvas: Rect = { x: 0, y: 0, w: size.width, h: size.height };
  ctx.fillStyle = fillStyle(ctx, page.background.fill, canvas);
  ctx.fillRect(0, 0, size.width, size.height);
  const bg = page.background.image;
  if (bg) {
    const image = resolveImage(scene, bg.source);
    const crop = cropOf(scene, bg.source);
    if (image.drawable) drawImageFit(ctx, image.drawable, canvas, bg.fit, crop?.focusX ?? bg.focusX, crop?.focusY ?? bg.focusY, false, crop?.zoom ?? 1);
    else if (image.label !== null) drawPlaceholder(ctx, canvas, image.label);
    if (bg.overlay) {
      ctx.fillStyle = fillStyle(ctx, bg.overlay, canvas);
      ctx.fillRect(0, 0, size.width, size.height);
    }
  }
}

/**
 * @description Draws one layer with its opacity and rotation.
 * @param scene Drawing.
 * @param layer Layer.
 */
function drawLayer(scene: Scene, layer: Layer): void {
  const { ctx } = scene;
  const rect = layer.type === 'block'
    ? layerRect(instanceLayer(layer, scene.resources.block?.(layer.blockId)), scene.size)
    : layerRect(layer, scene.size);
  if (rect.w <= 0 || rect.h <= 0 || layer.opacity <= 0) return;
  ctx.save();
  ctx.globalAlpha *= layer.opacity;
  if (layer.rotation) {
    ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
    ctx.rotate((layer.rotation * Math.PI) / 180);
    ctx.translate(-(rect.x + rect.w / 2), -(rect.y + rect.h / 2));
  }
  switch (layer.type) {
    case 'text': drawText(scene, layer, rect); break;
    case 'image': drawImageLayer(scene, layer, rect); break;
    case 'grid': drawGrid(scene, layer, rect); break;
    case 'shape': drawShape(scene, layer, rect); break;
    case 'icon': drawIcon(scene, layer, rect); break;
    case 'block': drawBlock(scene, layer, rect); break;
  }
  ctx.restore();
}

/**
 * @description An instance of a block: the background and layers of the block scaled into the
 *   box of the instance (clipped to it). Its fields take the values of their keys in the form;
 *   overflows and missing fields are reported with those keys and the id of the instance.
 *   A block that is not available is reported (`block:<id>`) and shown as a placeholder in the
 *   editor / live preview.
 * @param scene Drawing of the template.
 * @param layer Instance.
 * @param rect Box of the instance.
 */
function drawBlock(scene: Scene, layer: BlockLayer, rect: Rect): void {
  const { ctx } = scene;
  const block = scene.resources.block?.(layer.blockId);
  const page = block?.document.pages[0];
  if (!block || !page) {
    scene.report.missing.push(`block:${layer.blockId}`);
    if (scene.options.mode === 'editor' || scene.options.placeholders) drawPlaceholder(ctx, rect, '?');
    return;
  }
  const keys = instanceKeys(scene.effective, layer.id);
  const fields = new Map<string, Field>();
  for (const field of block.document.fields) {
    const outer = scene.fields.get(keys.get(field.key) ?? '');
    fields.set(field.key, outer ? { ...outer, key: field.key } : field);
  }
  const values = scene.options.values;
  const sub: Scene = {
    ctx, size: { width: block.width, height: block.height }, resources: scene.resources, fields, effective: [],
    options: { ...scene.options, values: values && innerValues(values, keys) }, report: { overflows: [], missing: [] },
  };
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.translate(rect.x, rect.y);
  ctx.scale(rect.w / block.width, rect.h / block.height);
  drawBackground(sub, page);
  for (const inner of page.layers) {
    if (!inner.hidden && inner.type !== 'block') drawLayer(sub, inner);
  }
  ctx.restore();
  for (const o of sub.report.overflows) {
    scene.report.overflows.push({ layerId: layer.id, field: o.field ? keys.get(o.field) ?? o.field : null, mode: o.mode });
  }
  for (const m of sub.report.missing) {
    scene.report.missing.push(m.startsWith('field:') ? `field:${keys.get(m.slice(6)) ?? m.slice(6)}` : m);
  }
}

/**
 * @description Values of the form seen from inside an instance (by the keys of the block).
 * @param values Values of the form.
 * @param keys Key in the block → key of the form.
 */
function innerValues(values: RenderValues, keys: ReadonlyMap<string, string>): RenderValues {
  const inner: RenderValues = { text: {}, images: {}, crops: {} };
  for (const [blockKey, formKey] of keys) {
    if (formKey in values.text) inner.text[blockKey] = values.text[formKey];
    if (formKey in values.images) inner.images[blockKey] = values.images[formKey];
    const crop = values.crops?.[formKey];
    if (crop) inner.crops![blockKey] = crop;
  }
  return inner;
}

/**
 * @description Text of a text layer: the value of its field (generating), the sample of the field
 *   (editor), or its fixed text.
 * @param scene Drawing.
 * @param layer Text layer.
 */
export function textValue(scene: Pick<Scene, 'options' | 'fields'>, layer: TextLayer): string {
  if (!layer.field) return layer.text;
  const value = scene.options.values?.text[layer.field];
  if (value !== undefined) return value;
  if (scene.options.mode === 'output') return '';
  const field = scene.fields.get(layer.field);
  return field?.type === 'text' && field.sample ? field.sample : field?.label ?? layer.text;
}

/**
 * @description CSS font of a text layer.
 * @param family Registered family name.
 * @param layer Text layer.
 * @param highlight Highlighted part.
 * @param size Size (px).
 */
export function fontOf(family: string, layer: TextLayer, highlight: boolean, size: number): string {
  const weight = highlight && layer.highlight.bold ? Math.max(700, layer.font.weight) : layer.font.weight;
  return `${layer.font.style} ${weight} ${size}px "${family}"`;
}

/**
 * @description Typesets a text layer in its box (measured on the context).
 * @param ctx Context.
 * @param layer Text layer.
 * @param family Registered family name.
 * @param text Text to set (uppercase already applied).
 * @param inner Box of the text (padding of the box subtracted).
 */
export function layoutTextLayer(ctx: CanvasRenderingContext2D, layer: TextLayer, family: string, text: string, inner: Rect): TextLayout {
  const cache = new Map<string, number>();
  const measure = (value: string, highlight: boolean, size: number): number => {
    const key = `${highlight ? 1 : 0}|${size}|${value}`;
    let width = cache.get(key);
    if (width === undefined) {
      ctx.font = fontOf(family, layer, highlight, size);
      width = ctx.measureText(value).width + layer.letterSpacing * Array.from(value).length;
      cache.set(key, width);
    }
    return width;
  };
  return layoutText(text, {
    width: Math.max(1, inner.w), height: Math.max(1, inner.h), size: layer.size, minSize: layer.minSize,
    autoShrink: layer.autoShrink, maxLines: layer.maxLines, lineHeight: layer.lineHeight,
  }, measure);
}

/**
 * @description Draws a text layer: box, highlight backgrounds, outline, text.
 * @param scene Drawing.
 * @param layer Text layer.
 * @param rect Box of the layer.
 */
function drawText(scene: Scene, layer: TextLayer, rect: Rect): void {
  const { ctx } = scene;
  let text = textValue(scene, layer);
  if (layer.uppercase) text = text.toLocaleUpperCase('cs-CZ');
  const padding = layer.box ? Math.min(layer.box.padding, rect.w / 2, rect.h / 2) : 0;
  const inner: Rect = { x: rect.x + padding, y: rect.y + padding, w: rect.w - padding * 2, h: rect.h - padding * 2 };
  const family = scene.resources.fontFamily(layer.font.family);
  const layout = layoutTextLayer(ctx, layer, family, text, inner);
  if (layout.overflow) scene.report.overflows.push({ layerId: layer.id, field: layer.field, mode: layer.overflow });

  const top = layer.valign === 'top' ? inner.y : layer.valign === 'middle' ? inner.y + (inner.h - layout.height) / 2 : inner.y + inner.h - layout.height;
  const lineX = (width: number) => layer.align === 'left' ? inner.x : layer.align === 'center' ? inner.x + (inner.w - width) / 2 : inner.x + inner.w - width;

  if (layer.box) {
    const box: Rect = layer.box.fit === 'element' || !layout.lines.length
      ? rect
      : { x: lineX(layout.width) - padding, y: top - padding, w: layout.width + padding * 2, h: layout.height + padding * 2 };
    ctx.save();
    applyShadow(ctx, layer.shadow);
    ctx.beginPath();
    roundRectPath(ctx, box, layer.box.radius);
    ctx.fillStyle = fillStyle(ctx, layer.box.fill, box);
    ctx.fill();
    ctx.restore();
  }

  const textFill = fillStyle(ctx, layer.fill, inner);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const placed = layout.lines.flatMap((line, i) => {
    const y = top + i * layout.lineHeight + layout.lineHeight / 2;
    const x0 = lineX(line.width);
    return line.runs.map(run => ({ run, x: x0 + run.x, y }));
  });

  if (layer.highlight.background) {
    ctx.fillStyle = layer.highlight.background;
    for (const { run, x, y } of placed) {
      if (!run.highlight) continue;
      const pad = layout.size * 0.08;
      ctx.fillRect(x - pad, y - layout.lineHeight * 0.45, run.width + pad * 2, layout.lineHeight * 0.9);
    }
  }

  const draw = (stroke: boolean) => {
    for (const { run, x, y } of placed) {
      ctx.font = fontOf(family, layer, run.highlight, layout.size);
      if (!stroke) ctx.fillStyle = run.highlight && layer.highlight.color ? layer.highlight.color : textFill;
      drawString(ctx, run.text, x, y, layer.letterSpacing, stroke);
    }
  };
  ctx.save();
  if (layer.stroke && layer.stroke.width > 0) {
    // The outline is drawn first at double width - the text covers its inner half.
    applyShadow(ctx, layer.box ? null : layer.shadow);
    ctx.strokeStyle = layer.stroke.color;
    ctx.lineWidth = layer.stroke.width * 2;
    ctx.lineJoin = 'round';
    draw(true);
    applyShadow(ctx, null);
  } else {
    applyShadow(ctx, layer.box ? null : layer.shadow);
  }
  draw(false);
  ctx.restore();
}

/**
 * @description Draws a string, letter by letter when it has extra letter spacing.
 * @param ctx Context (font set).
 * @param text Text.
 * @param x Left edge.
 * @param y Middle of the line.
 * @param spacing Extra space after every letter.
 * @param stroke Outline instead of fill.
 */
function drawString(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number, stroke: boolean): void {
  if (!spacing) {
    if (stroke) ctx.strokeText(text, x, y); else ctx.fillText(text, x, y);
    return;
  }
  let cx = x;
  for (const char of Array.from(text)) {
    if (stroke) ctx.strokeText(char, cx, y); else ctx.fillText(char, cx, y);
    cx += ctx.measureText(char).width + spacing;
  }
}

/**
 * @description Image to draw for a source: the loaded image, or the label of its placeholder
 *   (editor), or nothing.
 * @param scene Drawing.
 * @param source Source.
 */
function resolveImage(scene: Scene, source: ImageSource): { drawable?: DrawableImage; label: string | null } {
  const editor = scene.options.mode === 'editor';
  if (source.kind === 'asset') {
    const drawable = scene.resources.asset(source.assetId);
    if (!drawable) scene.report.missing.push(`asset:${source.assetId}`);
    return { drawable, label: drawable || !editor ? null : '' };
  }
  if (source.kind === 'field') {
    const drawable = scene.options.values?.images[source.field];
    if (!drawable && !editor) scene.report.missing.push(`field:${source.field}`);
    const placeholder = editor || !!scene.options.placeholders;
    return { drawable, label: drawable || !placeholder ? null : scene.fields.get(source.field)?.label ?? source.field };
  }
  return { label: editor ? '' : null };
}

/**
 * @description Crop chosen for the image of a field (none for library images and fields without one).
 * @param scene Drawing.
 * @param source Source of the image.
 */
function cropOf(scene: Scene, source: ImageSource): ImageCrop | undefined {
  return source.kind === 'field' ? scene.options.values?.crops?.[source.field] : undefined;
}

/**
 * @description Placeholder of an empty image (editor): grey stripes with the label of the field.
 * @param ctx Context (clipped by the caller).
 * @param rect Box.
 * @param label Label (empty = none).
 */
function drawPlaceholder(ctx: CanvasRenderingContext2D, rect: Rect, label: string): void {
  ctx.save();
  ctx.fillStyle = PLACEHOLDER.fill;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.strokeStyle = PLACEHOLDER.stripe;
  const step = Math.max(12, Math.min(rect.w, rect.h) / 8);
  ctx.lineWidth = step / 3;
  ctx.beginPath();
  for (let d = -rect.h; d < rect.w; d += step) {
    ctx.moveTo(rect.x + d, rect.y + rect.h);
    ctx.lineTo(rect.x + d + rect.h, rect.y);
  }
  ctx.stroke();
  if (label) {
    const size = Math.max(10, Math.min(rect.h * 0.12, rect.w * 0.1, 48));
    ctx.font = `600 ${size}px sans-serif`;
    ctx.fillStyle = PLACEHOLDER.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w * 0.9);
  }
  ctx.restore();
}

/**
 * @description Draws one image in a box with its shape (rounded / circle), shadow, overlay and
 *   border.
 * @param scene Drawing.
 * @param rect Box.
 * @param source Source of the image.
 * @param style Shape and effects.
 */
function drawImageBox(
  scene: Scene, rect: Rect, source: ImageSource,
  style: { fit: 'cover' | 'contain'; focusX: number; focusY: number; radius: number; circle: boolean; shadow: ImageLayer['shadow']; overlay: ImageLayer['overlay']; border: ImageLayer['border']; flipX: boolean },
): void {
  const { ctx } = scene;
  const path = () => style.circle ? ellipsePath(ctx, rect) : roundRectPath(ctx, rect, style.radius);
  const image = resolveImage(scene, source);
  const crop = cropOf(scene, source);
  if (style.shadow) castShadow(ctx, style.shadow, path);
  ctx.save();
  ctx.beginPath();
  path();
  ctx.clip();
  if (image.drawable) {
    drawImageFit(ctx, image.drawable, rect, style.fit, crop?.focusX ?? style.focusX, crop?.focusY ?? style.focusY, style.flipX, crop?.zoom ?? 1);
  } else if (image.label !== null) {
    drawPlaceholder(ctx, rect, image.label);
  }
  if (style.overlay) {
    ctx.fillStyle = fillStyle(ctx, style.overlay, rect);
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  }
  ctx.restore();
  if (style.border && style.border.width > 0) {
    ctx.save();
    ctx.beginPath();
    path();
    ctx.strokeStyle = style.border.color;
    ctx.lineWidth = style.border.width;
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * @description Draws an image layer.
 * @param scene Drawing.
 * @param layer Image layer.
 * @param rect Box of the layer.
 */
function drawImageLayer(scene: Scene, layer: ImageLayer, rect: Rect): void {
  drawImageBox(scene, rect, layer.source, {
    fit: layer.fit, focusX: layer.focusX, focusY: layer.focusY, radius: layer.radius, circle: layer.mask === 'circle',
    shadow: layer.shadow, overlay: layer.overlay, border: layer.border, flipX: layer.flipX,
  });
}

/**
 * @description Draws an image grid (every cell as an image box).
 * @param scene Drawing.
 * @param layer Grid layer.
 * @param rect Box of the layer.
 */
function drawGrid(scene: Scene, layer: GridLayer, rect: Rect): void {
  gridCellRects(layer.layout, rect, layer.gap).forEach((cellRect, i) => {
    const cell = layer.cells[i];
    if (!cell) return;
    drawImageBox(scene, cellRect, cell.source, {
      fit: layer.fit, focusX: cell.focusX, focusY: cell.focusY, radius: layer.radius, circle: false,
      shadow: null, overlay: layer.overlay, border: layer.border, flipX: false,
    });
  });
}

/**
 * @description Draws a shape: box with rounded corners, ellipse or a line through the middle.
 * @param scene Drawing.
 * @param layer Shape layer.
 * @param rect Box of the layer.
 */
function drawShape(scene: Scene, layer: ShapeLayer, rect: Rect): void {
  const { ctx } = scene;
  ctx.save();
  applyShadow(ctx, layer.shadow);
  const stroke = layer.stroke && layer.stroke.width > 0 ? layer.stroke : null;
  if (stroke) {
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.setLineDash(stroke.dash ? [stroke.width * 3, stroke.width * 2] : []);
  }
  if (layer.shape === 'line') {
    ctx.beginPath();
    ctx.moveTo(rect.x, rect.y + rect.h / 2);
    ctx.lineTo(rect.x + rect.w, rect.y + rect.h / 2);
    ctx.lineCap = 'round';
    if (!stroke) {
      ctx.strokeStyle = layer.fill ? fillStyle(ctx, layer.fill, rect) : '#000000';
      ctx.lineWidth = Math.max(1, Math.min(rect.h, 8));
    }
    ctx.stroke();
  } else {
    ctx.beginPath();
    if (layer.shape === 'ellipse') ellipsePath(ctx, rect); else roundRectPath(ctx, rect, layer.radius);
    if (layer.fill) {
      ctx.fillStyle = fillStyle(ctx, layer.fill, rect);
      ctx.fill();
      if (stroke) applyShadow(ctx, null);
    }
    if (stroke) ctx.stroke();
  }
  ctx.restore();
}

/**
 * @description Draws an icon of the set (24 × 24 grid scaled into the box, centred).
 * @param scene Drawing.
 * @param layer Icon layer.
 * @param rect Box of the layer.
 */
function drawIcon(scene: Scene, layer: IconLayer, rect: Rect): void {
  const { ctx } = scene;
  const nodes = scene.resources.icon(layer.icon);
  if (!nodes) {
    scene.report.missing.push(`icon:${layer.icon}`);
    return;
  }
  const scale = Math.min(rect.w, rect.h) / 24;
  ctx.save();
  ctx.translate(rect.x + (rect.w - 24 * scale) / 2, rect.y + (rect.h - 24 * scale) / 2);
  ctx.scale(scale, scale);
  applyShadow(ctx, layer.shadow);
  ctx.strokeStyle = layer.color;
  ctx.fillStyle = layer.color;
  ctx.lineWidth = layer.strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [tag, attrs] of nodes) {
    const path = iconPath(tag, attrs);
    if (!path) continue;
    if (attrs['fill'] && attrs['fill'] !== 'none') ctx.fill(path);
    ctx.stroke(path);
  }
  ctx.restore();
}

/**
 * @description Path of one node of a Lucide icon.
 * @param tag path | circle | rect | line | polyline | polygon.
 * @param a Attributes.
 * @returns The path, or null for an unknown node.
 */
export function iconPath(tag: string, a: Record<string, string>): Path2D | null {
  const n = (key: string) => Number(a[key] ?? 0);
  const path = new Path2D();
  switch (tag) {
    case 'path':
      return a['d'] ? new Path2D(a['d']) : null;
    case 'circle':
      path.arc(n('cx'), n('cy'), n('r'), 0, Math.PI * 2);
      return path;
    case 'rect': {
      const r = Math.min(n('rx') || n('ry'), n('width') / 2, n('height') / 2);
      if (r > 0) {
        path.roundRect(n('x'), n('y'), n('width'), n('height'), r);
      } else {
        path.rect(n('x'), n('y'), n('width'), n('height'));
      }
      return path;
    }
    case 'line':
      path.moveTo(n('x1'), n('y1'));
      path.lineTo(n('x2'), n('y2'));
      return path;
    case 'polyline':
    case 'polygon': {
      const points = (a['points'] ?? '').trim().split(/[\s,]+/).map(Number);
      for (let i = 0; i + 1 < points.length; i += 2) {
        if (i === 0) path.moveTo(points[i], points[i + 1]); else path.lineTo(points[i], points[i + 1]);
      }
      if (tag === 'polygon') path.closePath();
      return path;
    }
    default:
      return null;
  }
}
