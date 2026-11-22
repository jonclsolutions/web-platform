/**
 * @file document.ts
 * @path src/app/apps/js-creator/admin/shared/render/document.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Document of a template or a block (schema version 1) - the JSON the editor saves
 *   and the renderer draws: types, limits, size presets, grid layouts and factories of new layers
 *   with their defaults. A document has fields (filled in when generating, shared by every page)
 *   and pages - a template 1 … maxPages (slides of a carousel), a block exactly one; a page has a
 *   background and layers (layer ids are unique in the whole document). A template may contain
 *   instances of blocks (layer `block`); a block never does (blocks do not nest).
 * @usage `createLayer('text', { width: 1080, height: 1350 })`, `emptyDocument()`.
 * @note The API validates the same shape strictly (api/app/Apps/JsCreator/Support/
 *   TemplateDocument.php) - a new property = both places and the tests of both sides. Every
 *   property is always present (no optional keys), texts are plain text (never HTML) and `**…**`
 *   marks a highlighted part of a text.
 * @dependencies none (pure data).
 */

/** Current schema version. */
export const DOCUMENT_SCHEMA = 1;

/** Limits shared with the API. */
export const DOCUMENT_LIMITS = {
  /** Smallest / largest side of a template (px). */
  minSide: 100,
  maxSide: 3000,
  /** Most layers of a page. */
  maxLayers: 200,
  /** Most pages (slides) of a template; a block has one. */
  maxPages: 20,
  /** Most fields of a template. */
  maxFields: 50,
  /** Longest text of a layer / sample. */
  maxText: 2000,
  /** Longest caption pattern. */
  maxCaption: 5000,
  /** Largest JSON of a document (bytes, UTF-8). */
  maxBytes: 1_048_576,
  /** Smallest / largest scale of a block instance. */
  minScale: 0.05,
  maxScale: 20,
} as const;

/** Anchor of a layer: t / m / b (vertical) + l / c / r (horizontal). */
export type Anchor = 'tl' | 'tc' | 'tr' | 'ml' | 'mc' | 'mr' | 'bl' | 'bc' | 'br';

/** Anchors in reading order (3 × 3 picker). */
export const ANCHORS: readonly Anchor[] = ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br'];

/** Colour `#rrggbb` or `#rrggbbaa`. */
export type Color = string;

/** One stop of a gradient. */
export interface GradientStop {
  offset: number;
  color: Color;
}

/** Fill: a colour or a gradient (linear with an angle - 0° to the top, 90° to the right - or radial). */
export type Fill =
  | { type: 'solid'; color: Color }
  | { type: 'linear'; angle: number; stops: GradientStop[] }
  | { type: 'radial'; stops: GradientStop[] };

/** Outline / border. */
export interface Stroke {
  color: Color;
  width: number;
}

/** Outline of a shape (may be dashed). */
export interface ShapeStroke extends Stroke {
  dash: boolean;
}

/** Drop shadow. */
export interface Shadow {
  color: Color;
  blur: number;
  x: number;
  y: number;
}

/** Source of an image: none, a library image or an image field. */
export type ImageSource =
  | { kind: 'none' }
  | { kind: 'asset'; assetId: number }
  | { kind: 'field'; field: string };

/** How an image fills its box. */
export type ImageFit = 'cover' | 'contain';

/** Properties of every layer. */
export interface LayerBase {
  id: string;
  name: string;
  anchor: Anchor;
  /** Offset of the anchor point of the layer from the same point of the canvas (px). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Degrees, clockwise, around the centre. */
  rotation: number;
  opacity: number;
  hidden: boolean;
  locked: boolean;
}

/** Font of a text: `set:<slug>` (curated set) or `user:<id>` (own font face). */
export interface FontRef {
  family: string;
  weight: number;
  style: 'normal' | 'italic';
}

/** Text layer (fixed text or a text field). */
export interface TextLayer extends LayerBase {
  type: 'text';
  /** Key of a text field (null = fixed text). */
  field: string | null;
  /** Fixed text (`**…**` = highlighted part). */
  text: string;
  font: FontRef;
  size: number;
  fill: Fill;
  lineHeight: number;
  /** Extra space between letters (px). */
  letterSpacing: number;
  align: 'left' | 'center' | 'right';
  valign: 'top' | 'middle' | 'bottom';
  uppercase: boolean;
  /** 0 = no limit. */
  maxLines: number;
  /** Shrink the size down to minSize when the text does not fit. */
  autoShrink: boolean;
  minSize: number;
  /** What happens when the text still does not fit: cut with "…" or refuse to generate. */
  overflow: 'ellipsis' | 'block';
  stroke: Stroke | null;
  shadow: Shadow | null;
  /** Background box ("label"): the whole layer or tight around the text. */
  box: { fill: Fill; padding: number; radius: number; fit: 'element' | 'text' } | null;
  /** Style of the highlighted parts. */
  highlight: { color: Color | null; bold: boolean; background: Color | null };
}

/** Image layer. */
export interface ImageLayer extends LayerBase {
  type: 'image';
  source: ImageSource;
  fit: ImageFit;
  /** Focus point of the crop (0-1). */
  focusX: number;
  focusY: number;
  radius: number;
  mask: 'none' | 'circle';
  border: Stroke | null;
  shadow: Shadow | null;
  overlay: Fill | null;
  flipX: boolean;
}

/** Cell of an image grid. */
export interface GridCell {
  source: ImageSource;
  focusX: number;
  focusY: number;
}

/** Layout of an image grid: columns × rows, or one big cell beside / above smaller ones. */
export type GridLayout = '2x1' | '1x2' | '2x2' | '3x1' | '1x3' | '3x2' | '2x3' | '3x3' | '1+2' | '2+1' | '1+3' | '3+1';

/** Layouts of a grid with their number of cells. */
export const GRID_LAYOUTS: Record<GridLayout, number> = {
  '2x1': 2, '1x2': 2, '2x2': 4, '3x1': 3, '1x3': 3, '3x2': 6, '2x3': 6, '3x3': 9,
  '1+2': 3, '2+1': 3, '1+3': 4, '3+1': 4,
};

/** Image grid layer. */
export interface GridLayer extends LayerBase {
  type: 'grid';
  layout: GridLayout;
  gap: number;
  radius: number;
  fit: ImageFit;
  cells: GridCell[];
  border: Stroke | null;
  overlay: Fill | null;
}

/** Shape layer (a line runs through the middle of its box). */
export interface ShapeLayer extends LayerBase {
  type: 'shape';
  shape: 'rect' | 'ellipse' | 'line';
  fill: Fill | null;
  radius: number;
  stroke: ShapeStroke | null;
  shadow: Shadow | null;
}

/** Icon of the icon set. */
export interface IconLayer extends LayerBase {
  type: 'icon';
  icon: string;
  color: Color;
  /** Line width in units of the 24 px icon grid. */
  strokeWidth: number;
  shadow: Shadow | null;
}

/**
 * Instance of a block (templates only). The block is drawn into the box of the layer: its size
 * × scale (w, h follow it - the editor keeps them, the renderer always takes the current size
 * of the block).
 */
export interface BlockLayer extends LayerBase {
  type: 'block';
  blockId: number;
  scale: number;
}

/** Any layer. */
export type Layer = TextLayer | ImageLayer | GridLayer | ShapeLayer | IconLayer | BlockLayer;

/** Kind of a layer. */
export type LayerType = Layer['type'];

/** Kind of a layer made from its defaults (an instance needs its block - createBlockLayer()). */
export type PlainLayerType = Exclude<LayerType, 'block'>;

/** Text field. */
export interface TextField {
  key: string;
  type: 'text';
  label: string;
  help: string;
  required: boolean;
  sample: string;
  maxLength: number;
  multiline: boolean;
}

/** Image field. */
export interface ImageField {
  key: string;
  type: 'image';
  label: string;
  help: string;
  required: boolean;
  /** Recommended resolution (only a warning when generating). */
  minWidth: number;
  minHeight: number;
}

/** Field of a template. */
export type Field = TextField | ImageField;

/** Background of a page. */
export interface Background {
  fill: Fill;
  image: { source: ImageSource; fit: ImageFit; focusX: number; focusY: number; overlay: Fill | null } | null;
}

/** Page of a document. */
export interface Page {
  background: Background;
  layers: Layer[];
}

/** Document of a template. */
export interface TemplateDocument {
  schema: number;
  fields: Field[];
  pages: Page[];
}

/** Size of a canvas (px). */
export interface CanvasSize {
  width: number;
  height: number;
}

/** Preset size of a social network. */
export interface SizePreset {
  id: string;
  /** Translation key (section js-creator-templates). */
  labelKey: string;
  width: number;
  height: number;
}

/** Presets of the size of a template. */
export const SIZE_PRESETS: readonly SizePreset[] = [
  { id: 'ig-square', labelKey: 'preset_ig_square', width: 1080, height: 1080 },
  { id: 'ig-portrait', labelKey: 'preset_ig_portrait', width: 1080, height: 1350 },
  { id: 'ig-story', labelKey: 'preset_ig_story', width: 1080, height: 1920 },
  { id: 'fb-link', labelKey: 'preset_fb_link', width: 1200, height: 630 },
  { id: 'x-post', labelKey: 'preset_x_post', width: 1600, height: 900 },
  { id: 'yt-thumb', labelKey: 'preset_yt_thumb', width: 1280, height: 720 },
  { id: 'pinterest', labelKey: 'preset_pinterest', width: 1000, height: 1500 },
];

/**
 * @description Preset of an exact size.
 * @param size Size.
 * @returns The preset or undefined (custom size).
 */
export function presetOf(size: CanvasSize): SizePreset | undefined {
  return SIZE_PRESETS.find(p => p.width === size.width && p.height === size.height);
}

/**
 * @description Whether a size is within the limits.
 * @param size Size.
 */
export function isValidSize(size: CanvasSize): boolean {
  const ok = (v: number) => Number.isInteger(v) && v >= DOCUMENT_LIMITS.minSide && v <= DOCUMENT_LIMITS.maxSide;
  return ok(size.width) && ok(size.height);
}

/**
 * @description An empty document: white background (a block: transparent), no layers, no fields.
 * @param transparent Transparent background (a block shows the template under it).
 */
export function emptyDocument(transparent = false): TemplateDocument {
  const color = transparent ? '#ffffff00' : '#ffffff';
  return { schema: DOCUMENT_SCHEMA, fields: [], pages: [{ background: { fill: { type: 'solid', color }, image: null }, layers: [] }] };
}

/**
 * @description New unique layer id (letters and digits).
 * @param taken Ids already used in the document.
 */
export function newLayerId(taken: ReadonlySet<string>): string {
  for (;;) {
    const id = 'l' + Math.random().toString(36).slice(2, 10);
    if (!taken.has(id)) return id;
  }
}

/**
 * @description Deep copy of a JSON value (documents, layers).
 * @param value Value.
 */
export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * @description Size of a document as sent to the API (UTF-8 bytes of its JSON).
 * @param doc Document.
 */
export function documentBytes(doc: TemplateDocument): number {
  return new TextEncoder().encode(JSON.stringify(doc)).length;
}

/**
 * @description New layer of a kind with its defaults, centred on the canvas.
 * @param type Kind.
 * @param canvas Size of the canvas.
 * @param id Id of the layer.
 */
export function createLayer(type: PlainLayerType, canvas: CanvasSize, id: string): Layer {
  const short = Math.min(canvas.width, canvas.height);
  const box = (w: number, h: number): Omit<LayerBase, 'id' | 'name'> => ({
    anchor: 'mc', x: 0, y: 0, w: Math.round(w), h: Math.round(h), rotation: 0, opacity: 1, hidden: false, locked: false,
  });
  switch (type) {
    case 'text':
      return {
        id, name: '', type, ...box(canvas.width * 0.8, short * 0.2), field: null, text: 'Text',
        font: { family: 'set:inter', weight: 700, style: 'normal' }, size: Math.round(short * 0.07),
        fill: { type: 'solid', color: '#18181b' }, lineHeight: 1.2, letterSpacing: 0, align: 'center', valign: 'middle',
        uppercase: false, maxLines: 0, autoShrink: true, minSize: Math.max(8, Math.round(short * 0.03)), overflow: 'ellipsis',
        stroke: null, shadow: null, box: null, highlight: { color: '#e11d48', bold: true, background: null },
      };
    case 'image':
      return {
        id, name: '', type, ...box(short * 0.5, short * 0.5), source: { kind: 'none' }, fit: 'cover', focusX: 0.5, focusY: 0.5,
        radius: 0, mask: 'none', border: null, shadow: null, overlay: null, flipX: false,
      };
    case 'grid':
      return {
        id, name: '', type, ...box(canvas.width * 0.8, canvas.width * 0.8), layout: '2x2', gap: Math.round(short * 0.01), radius: 0, fit: 'cover',
        cells: gridCells('2x2', []), border: null, overlay: null,
      };
    case 'shape':
      return {
        id, name: '', type, ...box(short * 0.4, short * 0.25), shape: 'rect', fill: { type: 'solid', color: '#f59e0b' }, radius: 0,
        stroke: null, shadow: null,
      };
    case 'icon':
      return { id, name: '', type, ...box(short * 0.12, short * 0.12), icon: 'star', color: '#18181b', strokeWidth: 2, shadow: null };
  }
}

/**
 * @description New instance of a block, centred on the canvas: in its own size, or reduced to
 *   fit 80 % of the canvas.
 * @param block Id and size of the block.
 * @param canvas Size of the canvas.
 * @param id Id of the layer.
 */
export function createBlockLayer(block: { id: number; width: number; height: number }, canvas: CanvasSize, id: string): BlockLayer {
  const fit = Math.min(1, (canvas.width * 0.8) / block.width, (canvas.height * 0.8) / block.height);
  const scale = Math.max(DOCUMENT_LIMITS.minScale, Math.floor(fit * 100) / 100);
  return {
    id, name: '', type: 'block', anchor: 'mc', x: 0, y: 0, w: Math.round(block.width * scale), h: Math.round(block.height * scale),
    rotation: 0, opacity: 1, hidden: false, locked: false, blockId: block.id, scale,
  };
}

/**
 * @description Ids of the blocks of the instances of a document.
 * @param doc Document.
 */
export function blockIdsOf(doc: TemplateDocument): number[] {
  const ids = new Set<number>();
  for (const page of doc.pages) for (const layer of page.layers) if (layer.type === 'block') ids.add(layer.blockId);
  return [...ids];
}

/**
 * @description Cells of a grid layout, keeping the existing cells in their order.
 * @param layout Layout.
 * @param cells Current cells.
 */
export function gridCells(layout: GridLayout, cells: readonly GridCell[]): GridCell[] {
  return Array.from({ length: GRID_LAYOUTS[layout] }, (_, i) => cells[i] ? cloneJson(cells[i]) : { source: { kind: 'none' }, focusX: 0.5, focusY: 0.5 });
}

/**
 * @description Image sources of a layer (image, grid cells) - for references and pickers.
 * @param layer Layer.
 */
export function layerSources(layer: Layer): ImageSource[] {
  if (layer.type === 'image') return [layer.source];
  if (layer.type === 'grid') return layer.cells.map(c => c.source);
  return [];
}

/**
 * @description Keys of the fields a document uses (text layers, image sources, background).
 * @param doc Document.
 */
export function usedFieldKeys(doc: TemplateDocument): Set<string> {
  const keys = new Set<string>();
  for (const page of doc.pages) {
    const bg = page.background.image?.source;
    if (bg?.kind === 'field') keys.add(bg.field);
    for (const layer of page.layers) {
      if (layer.type === 'text' && layer.field) keys.add(layer.field);
      for (const source of layerSources(layer)) if (source.kind === 'field') keys.add(source.field);
    }
  }
  return keys;
}

/**
 * @description Library images and own fonts a document uses.
 * @param doc Document.
 */
export function documentReferences(doc: TemplateDocument): { assets: number[]; fonts: number[]; setFonts: string[]; icons: string[] } {
  const assets = new Set<number>();
  const fonts = new Set<number>();
  const setFonts = new Set<string>();
  const icons = new Set<string>();
  const source = (s: ImageSource | undefined) => { if (s?.kind === 'asset') assets.add(s.assetId); };
  for (const page of doc.pages) {
    source(page.background.image?.source);
    for (const layer of page.layers) {
      layerSources(layer).forEach(source);
      if (layer.type === 'text') {
        if (layer.font.family.startsWith('user:')) fonts.add(Number(layer.font.family.slice(5)));
        else setFonts.add(layer.font.family.slice(4));
      }
      if (layer.type === 'icon') icons.add(layer.icon);
    }
  }
  return { assets: [...assets], fonts: [...fonts], setFonts: [...setFonts], icons: [...icons] };
}

/**
 * @description Field key made from a label: lower case a-z, 0-9 and _, starting with a letter,
 *   unique among the taken keys (`nadpis`, `nadpis_2` …).
 * @param label Label of the field.
 * @param taken Keys already used.
 */
export function fieldKeyFrom(label: string, taken: ReadonlySet<string>): string {
  const base = (label.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_')
    .replace(/^[^a-z]+/, '').replace(/_+$/, '').slice(0, 34)) || 'pole';
  let key = base;
  for (let i = 2; taken.has(key); i++) key = `${base}_${i}`;
  return key;
}
