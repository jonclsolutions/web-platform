/**
 * @file renderer.spec.ts
 * @path src/app/apps/js-creator/admin/shared/render/renderer.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the renderer on a real canvas (pixels are read back): background,
 *   anchors, hidden layers, opacity, gradients, library images and image fields (placeholder in
 *   the editor, value when generating), grids, icons, text samples / values, block instances
 *   (scaled into their box, fields with the keys of the form) and the report of overflowing
 *   texts and missing resources.
 * @dependencies renderer.ts, document.ts, block-fields.ts
 */

import { IconNode } from '../js-creator.models';
import {
  CanvasSize, GridLayer, ImageLayer, Layer, ShapeLayer, TemplateDocument, TextLayer, createLayer, emptyDocument,
} from './document';
import { DrawableImage } from './paint';
import { RenderResources, renderPage, textValue } from './renderer';
import { BlockDef } from './block-fields';

/** Size of the test canvas. */
const SIZE: CanvasSize = { width: 200, height: 100 };

/**
 * @description Solid colour image (stands for a loaded library image).
 * @param color CSS colour.
 */
function solidImage(color: string): DrawableImage {
  const canvas = document.createElement('canvas');
  canvas.width = 40;
  canvas.height = 40;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 40, 40);
  return { image: canvas, width: 40, height: 40 };
}

/** Resources with one green library image (#7) and one icon. */
const resources: RenderResources = {
  asset: id => id === 7 ? solidImage('#00ff00') : undefined,
  fontFamily: () => 'sans-serif',
  icon: name => name === 'box' ? [['rect', { x: '2', y: '2', width: '20', height: '20' }]] as IconNode[] : undefined,
};

/**
 * @description Draws a document on a new canvas.
 * @param doc Document.
 * @param mode editor | output.
 * @param values Values of the fields.
 */
function draw(doc: TemplateDocument, mode: 'editor' | 'output' = 'editor', values?: Parameters<typeof renderPage>[4]['values']) {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE.width;
  canvas.height = SIZE.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  const report = renderPage(ctx, doc, SIZE, resources, { mode, values });
  const pixel = (x: number, y: number) => Array.from(ctx.getImageData(x, y, 1, 1).data);
  return { report, pixel };
}

/**
 * @description Document with layers.
 * @param layers Layers.
 */
function docWith(...layers: Layer[]): TemplateDocument {
  const doc = emptyDocument();
  doc.pages[0].layers = layers;
  return doc;
}

/**
 * @description Shape layer 40 × 40 at an anchor.
 * @param overrides Properties.
 */
function shape(overrides: Partial<ShapeLayer> = {}): ShapeLayer {
  return { ...(createLayer('shape', SIZE, 's1') as ShapeLayer), w: 40, h: 40, radius: 0, fill: { type: 'solid', color: '#0000ff' }, ...overrides };
}

describe('renderer', () => {
  /**
   * @description The background fills the canvas; a shape anchored bottom right is drawn there;
   *   a hidden layer is not drawn; opacity blends with the background.
   * @input red background; blue 40 × 40 at br -10 / -10; hidden copy at tl; 50 % copy at tl 100 px
   * @output red at 5,5; blue at 175,75; red at 20,20 (hidden); purple at 120,20
   */
  it('draws the background, anchors, hidden layers and opacity', () => {
    const doc = docWith(
      shape({ id: 'a', anchor: 'br', x: -10, y: -10 }),
      shape({ id: 'b', anchor: 'tl', x: 0, y: 0, hidden: true }),
      shape({ id: 'c', anchor: 'tl', x: 100, y: 0, opacity: 0.5 }),
    );
    doc.pages[0].background.fill = { type: 'solid', color: '#ff0000' };
    const { pixel } = draw(doc);
    expect(pixel(5, 5)).toEqual([255, 0, 0, 255]);
    expect(pixel(175, 75)).toEqual([0, 0, 255, 255]);
    expect(pixel(20, 20)).toEqual([255, 0, 0, 255]);
    const [r, g, b] = pixel(120, 20);
    expect(r).toBeGreaterThan(100);
    expect(b).toBeGreaterThan(100);
    expect(g).toBe(0);
  });

  /**
   * @description A linear gradient at 90° runs from the left to the right.
   * @input background black → white at 90°
   * @output dark pixel on the left, light on the right
   */
  it('draws gradients', () => {
    const doc = emptyDocument();
    doc.pages[0].background.fill = { type: 'linear', angle: 90, stops: [{ offset: 0, color: '#000000' }, { offset: 1, color: '#ffffff' }] };
    const { pixel } = draw(doc);
    expect(pixel(2, 50)[0]).toBeLessThan(20);
    expect(pixel(197, 50)[0]).toBeGreaterThan(235);
  });

  /**
   * @description A library image is drawn; an image field shows a placeholder in the editor and
   *   its value when generating; a missing value is reported when generating.
   * @input image of asset #7; image of field "photo"; grid 2x1 (asset + field)
   * @output green; placeholder grey in the editor; red value; missing field:photo without a value
   */
  it('draws images, placeholders and values of image fields', () => {
    const asset: ImageLayer = { ...(createLayer('image', SIZE, 'i1') as ImageLayer), anchor: 'tl', x: 0, y: 0, w: 50, h: 50, source: { kind: 'asset', assetId: 7 } };
    const field: ImageLayer = { ...asset, id: 'i2', x: 60, source: { kind: 'field', field: 'photo' } };
    const doc = docWith(asset, field);
    doc.fields = [{ key: 'photo', type: 'image', label: '', help: '', required: true, minWidth: 0, minHeight: 0 }];

    const editor = draw(doc);
    expect(editor.pixel(25, 25)).toEqual([0, 255, 0, 255]);
    expect(editor.pixel(62, 2).slice(0, 3)).not.toEqual([255, 255, 255]);
    expect(editor.report.missing).toEqual([]);

    const output = draw(doc, 'output', { text: {}, images: { photo: solidImage('#ff0000') } });
    expect(output.pixel(85, 25)).toEqual([255, 0, 0, 255]);
    expect(draw(doc, 'output').report.missing).toEqual(['field:photo']);

    const grid: GridLayer = {
      ...(createLayer('grid', SIZE, 'g1') as GridLayer), anchor: 'tl', x: 0, y: 0, w: 100, h: 50, gap: 0, layout: '2x1',
      cells: [{ source: { kind: 'asset', assetId: 7 }, focusX: 0.5, focusY: 0.5 }, { source: { kind: 'asset', assetId: 9 }, focusX: 0.5, focusY: 0.5 }],
    };
    const gridDraw = draw(docWith(grid));
    expect(gridDraw.pixel(25, 25)).toEqual([0, 255, 0, 255]);
    expect(gridDraw.report.missing).toEqual(['asset:9']);
  });

  /**
   * @description The crop of an image field chosen when generating replaces the focus of the
   *   template and zooms; the live preview of generating (output + placeholders) shows a
   *   placeholder for an empty image field and still reports it as missing.
   * @input field image 40 × 20 (left half red, right half blue) in a 20 × 20 box (cover);
   *   crops focus 0 / focus 1 / focus 1 zoom 2; output with placeholders and no value
   * @output red / blue / blue in the middle of the box; placeholder grey (not the white
   *   background) and missing field:photo
   */
  it('uses crops of image fields and placeholders of the preview', () => {
    const halves = document.createElement('canvas');
    halves.width = 40;
    halves.height = 20;
    const hctx = halves.getContext('2d') as CanvasRenderingContext2D;
    hctx.fillStyle = '#ff0000';
    hctx.fillRect(0, 0, 20, 20);
    hctx.fillStyle = '#0000ff';
    hctx.fillRect(20, 0, 20, 20);
    const photo: DrawableImage = { image: halves, width: 40, height: 20 };
    const layer: ImageLayer = { ...(createLayer('image', SIZE, 'i1') as ImageLayer), anchor: 'tl', x: 0, y: 0, w: 20, h: 20, fit: 'cover', source: { kind: 'field', field: 'photo' } };
    const doc = docWith(layer);
    doc.fields = [{ key: 'photo', type: 'image', label: 'Photo', help: '', required: true, minWidth: 0, minHeight: 0 }];

    const left = draw(doc, 'output', { text: {}, images: { photo }, crops: { photo: { focusX: 0, focusY: 0.5, zoom: 1 } } });
    expect(left.pixel(10, 10)).toEqual([255, 0, 0, 255]);
    const right = draw(doc, 'output', { text: {}, images: { photo }, crops: { photo: { focusX: 1, focusY: 0.5, zoom: 1 } } });
    expect(right.pixel(10, 10)).toEqual([0, 0, 255, 255]);
    const zoomed = draw(doc, 'output', { text: {}, images: { photo }, crops: { photo: { focusX: 1, focusY: 0.5, zoom: 2 } } });
    expect(zoomed.pixel(2, 10)).toEqual([0, 0, 255, 255]);

    const canvas = document.createElement('canvas');
    canvas.width = SIZE.width;
    canvas.height = SIZE.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    const report = renderPage(ctx, doc, SIZE, resources, { mode: 'output', placeholders: true, values: { text: {}, images: {} } });
    expect(Array.from(ctx.getImageData(10, 10, 1, 1).data).slice(0, 3)).not.toEqual([255, 255, 255]);
    expect(report.missing).toEqual(['field:photo']);
  });

  /**
   * @description Icons of the set are drawn with their colour; an unknown icon is reported.
   * @input icon "box" (square outline) 100 × 100 at tl; icon "nope"
   * @output coloured pixel on the outline; missing icon:nope
   */
  it('draws icons', () => {
    const icon = { ...createLayer('icon', SIZE, 'c1'), anchor: 'tl' as const, x: 0, y: 0, w: 96, h: 96, icon: 'box', color: '#ff0000', strokeWidth: 2 };
    const { pixel } = draw(docWith(icon as Layer));
    expect(pixel(8, 48)).toEqual([255, 0, 0, 255]);
    expect(draw(docWith({ ...icon, icon: 'nope' } as Layer)).report.missing).toEqual(['icon:nope']);
  });

  /**
   * @description A text field shows its sample in the editor and the value when generating; a
   *   text that cannot fit is reported with the mode of the layer.
   * @input text field "title" with sample "Sample"; tiny layer with a long fixed text and overflow "block"
   * @output "Sample" / "Real" / "" (output without a value); overflow { layerId t2, mode block }
   */
  it('uses samples and values and reports overflowing texts', () => {
    const doc = emptyDocument();
    doc.fields = [{ key: 'title', type: 'text', label: 'Title', help: '', required: true, sample: 'Sample', maxLength: 100, multiline: false }];
    const text = { ...(createLayer('text', SIZE, 't1') as TextLayer), field: 'title' };
    const scene = (mode: 'editor' | 'output', value?: string) => ({
      options: { mode, values: value === undefined ? undefined : { text: { title: value }, images: {} } },
      fields: new Map(doc.fields.map(f => [f.key, f])),
    });
    expect(textValue(scene('editor'), text)).toBe('Sample');
    expect(textValue(scene('output', 'Real'), text)).toBe('Real');
    expect(textValue(scene('output'), text)).toBe('');

    const tiny: TextLayer = {
      ...(createLayer('text', SIZE, 't2') as TextLayer), w: 30, h: 12, size: 12, minSize: 10, autoShrink: true, overflow: 'block',
      text: 'This text never fits into the box',
    };
    const { report } = draw(docWith(tiny));
    expect(report.overflows).toEqual([{ layerId: 't2', field: null, mode: 'block' }]);
  });
  /**
   * @description A block instance draws its block scaled into its box (transparent background,
   *   clipped to the box); its image field takes the value of its form key; overflowing texts
   *   and missing values are reported with the form key and the id of the instance; a missing
   *   block is reported.
   * @input block 40 × 20: blue shape over the left half, image field "logo", fixed text that
   *   never fits; template field "logo" (text) → the block field is logo_2; instance at 100, 50
   *   with scale 2; value of logo_2 = red image
   * @output white outside; blue at 110, 70 (left half), red at 150, 70 (image of the right half);
   *   output report: overflow of the instance; without a value missing field:logo_2; block:99
   */
  it('draws block instances with the fields of the form', () => {
    const block: BlockDef = { id: 5, name: 'Tag', width: 40, height: 20, document: emptyDocument(true) };
    block.document.fields = [{ key: 'logo', type: 'image', label: 'Logo', help: '', required: false, minWidth: 0, minHeight: 0 }];
    block.document.pages[0].layers = [
      shape({ id: 'b1', anchor: 'tl', x: 0, y: 0, w: 20, h: 20 }),
      { ...(createLayer('image', SIZE, 'b2') as ImageLayer), anchor: 'tl', x: 20, y: 0, w: 20, h: 20, source: { kind: 'field', field: 'logo' } },
      { ...(createLayer('text', SIZE, 'b3') as TextLayer), anchor: 'tl', x: 0, y: 0, w: 4, h: 2, size: 12, minSize: 10, overflow: 'block', text: 'Never fits here', fill: { type: 'solid', color: '#ffffff00' } },
    ];
    const withBlocks: RenderResources = { ...resources, block: id => (id === 5 ? block : undefined) };
    const doc = docWith({
      id: 'inst', name: '', type: 'block', anchor: 'tl', x: 100, y: 50, w: 1, h: 1, rotation: 0, opacity: 1, hidden: false, locked: false, blockId: 5, scale: 2,
    } as Layer, { ...(createLayer('text', SIZE, 'own') as TextLayer), field: 'logo', hidden: true });
    doc.fields = [{ key: 'logo', type: 'text', label: 'Logo', help: '', required: false, sample: '', maxLength: 10, multiline: false }];

    const canvas = document.createElement('canvas');
    canvas.width = SIZE.width;
    canvas.height = SIZE.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    const report = renderPage(ctx, doc, SIZE, withBlocks, { mode: 'output', values: { text: {}, images: { logo_2: solidImage('#ff0000') } } });
    const pixel = (x: number, y: number) => Array.from(ctx.getImageData(x, y, 1, 1).data);
    expect(pixel(95, 70)).toEqual([255, 255, 255, 255]);
    expect(pixel(110, 70)).toEqual([0, 0, 255, 255]);
    expect(pixel(150, 70)).toEqual([255, 0, 0, 255]);
    expect(pixel(150, 95)).toEqual([255, 255, 255, 255]);
    expect(report.overflows).toEqual([{ layerId: 'inst', field: null, mode: 'block' }]);
    expect(report.missing).toEqual([]);

    const empty = renderPage(ctx, doc, SIZE, withBlocks, { mode: 'output', values: { text: {}, images: {} } });
    expect(empty.missing).toEqual(['field:logo_2']);
    const missing = { ...doc, pages: [{ ...doc.pages[0], layers: [{ ...doc.pages[0].layers[0], blockId: 99 } as Layer] }] };
    expect(renderPage(ctx, missing, SIZE, withBlocks, { mode: 'output' }).missing).toEqual(['block:99']);
  });
});
