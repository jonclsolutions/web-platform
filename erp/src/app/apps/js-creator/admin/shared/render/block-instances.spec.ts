/**
 * @file block-instances.spec.ts
 * @path src/app/apps/js-creator/admin/shared/render/block-instances.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of turning layers into a block and back: the block of selected layers
 *   (its canvas, the offsets of its layers, its fields, refusals), the anchor of a new instance,
 *   unpacking an instance (place, scaled styles, rotation, opacity, field keys, background of
 *   the block) and scaling the styles of a layer.
 * @dependencies block-instances.ts, block-fields.ts, document.ts, geometry.ts
 */

import { BlockLayer, Field, Layer, ShapeLayer, TextLayer, createLayer, emptyDocument } from './document';
import { layerRect } from './geometry';
import { BlockDef, effectiveFields } from './block-fields';
import { anchorByPlace, blockFromSelection, scaleLayerStyle, unpackInstance } from './block-instances';

/** Size of the test template. */
const CANVAS = { width: 1000, height: 1000 };

/**
 * @description Text layer bound to a field.
 * @param id Id.
 * @param overrides Properties.
 */
function text(id: string, overrides: Partial<TextLayer> = {}): TextLayer {
  return { ...(createLayer('text', CANVAS, id) as TextLayer), anchor: 'tl', x: 0, y: 0, w: 100, h: 50, ...overrides };
}

/**
 * @description Shape layer.
 * @param id Id.
 * @param overrides Properties.
 */
function shape(id: string, overrides: Partial<ShapeLayer> = {}): ShapeLayer {
  return { ...(createLayer('shape', CANVAS, id) as ShapeLayer), anchor: 'tl', x: 0, y: 0, w: 100, h: 100, ...overrides };
}

/** Text field "price". */
const PRICE: Field = { key: 'price', type: 'text', label: 'Cena', help: '', required: true, sample: '99', maxLength: 20, multiline: false };

describe('block-instances', () => {
  /**
   * @description The selected layers become a block: its canvas is the box around them (at least
   *   100 px), the layers keep their anchors with offsets on the new canvas, the fields they use
   *   go with them; instances and too large selections are refused.
   * @input text (price) at 820, 40 (120 × 50, anchor tr, x -60) and a shape at 900, 60 (60 × 30);
   *   an instance; a 3200 px shape
   * @output size 140 × 100 at 820, 40; text anchored tr with x -20 (20 px from the right edge); fields [price]; transparent;
   *   errors has_block / too_large / empty
   */
  it('makes a block of the selection', () => {
    const t = text('t', { anchor: 'tr', x: -60, y: 40, w: 120, h: 50, field: 'price' });
    const s = shape('s', { x: 900, y: 60, w: 60, h: 30 });
    const made = blockFromSelection([t, s], [PRICE, { ...PRICE, key: 'other' }], CANVAS);
    if ('error' in made) throw new Error(made.error);
    expect(made.size).toEqual({ width: 140, height: 100 });
    expect(made.box).toEqual({ x: 820, y: 40, w: 140, h: 100 });
    const [bt, bs] = made.document.pages[0].layers;
    expect([bt.anchor, bt.x, bt.y]).toEqual(['tr', -20, 0]);
    expect(layerRect(bs, made.size)).toEqual({ x: 80, y: 20, w: 60, h: 30 });
    expect(made.document.fields.map(f => f.key)).toEqual(['price']);
    expect(made.document.pages[0].background.fill).toEqual({ type: 'solid', color: '#ffffff00' });

    const block: BlockLayer = { ...(t as unknown as BlockLayer), type: 'block', blockId: 1, scale: 1 };
    expect(blockFromSelection([block], [], CANVAS)).toEqual({ error: 'has_block' });
    expect(blockFromSelection([shape('big', { w: 3200 })], [], CANVAS)).toEqual({ error: 'too_large' });
    expect(blockFromSelection([], [], CANVAS)).toEqual({ error: 'empty' });
    expect(anchorByPlace(made.box, CANVAS)).toBe('tr');
    expect(anchorByPlace({ x: 400, y: 900, w: 200, h: 50 }, CANVAS)).toBe('bc');
  });

  /**
   * @description Unpacking: layers land where the instance draws them (scaled, turned around the
   *   centre of the instance), their styles are scaled, opacity multiplied, anchored like the
   *   instance; fields get the keys of the form; a coloured background becomes a shape at the bottom.
   * @input block 200 × 100 with a red background, a text (price, size 40) at 0, 0 (100 × 50) and
   *   a shape at 100, 50; instance at scale 0.5 anchored br at -10, -10 with opacity 0.5; the
   *   template already has a field price; the same instance rotated by 180°
   * @output background shape 100 × 50 at 890, 940; text at 890, 940 (50 × 25), size 20, field
   *   price_2, opacity 0.5, anchor br; shape at 940, 965; rotated: text at 940, 965 with rotation 180
   */
  it('unpacks an instance', () => {
    const block: BlockDef = { id: 3, name: 'Tag', width: 200, height: 100, document: emptyDocument() };
    block.document.pages[0].background.fill = { type: 'solid', color: '#ff0000' };
    block.document.pages[0].layers = [text('bt', { size: 40, field: 'price' }), shape('bs', { x: 100, y: 50 })];
    block.document.fields = [PRICE];
    const template = emptyDocument();
    const layer: BlockLayer = {
      id: 'inst', name: '', type: 'block', anchor: 'br', x: -10, y: -10, w: 100, h: 50, rotation: 0, opacity: 0.5, hidden: false, locked: false, blockId: 3, scale: 0.5,
    };
    template.pages[0].layers = [layer];
    template.fields = [{ ...PRICE, type: 'text' }];
    const effective = effectiveFields(template, () => block);

    const out = unpackInstance(layer, block, CANVAS, effective, new Set(['inst']));
    expect(out.layers.length).toBe(3);
    const [bg, t, s] = out.layers as [ShapeLayer, TextLayer, ShapeLayer];
    expect(layerRect(bg, CANVAS)).toEqual({ x: 890, y: 940, w: 100, h: 50 });
    expect(bg.fill).toEqual({ type: 'solid', color: '#ff0000' });
    expect(layerRect(t, CANVAS)).toEqual({ x: 890, y: 940, w: 50, h: 25 });
    expect([t.anchor, t.size, t.field, t.opacity]).toEqual(['br', 20, 'price_2', 0.5]);
    expect(layerRect(s, CANVAS)).toEqual({ x: 940, y: 965, w: 50, h: 50 });
    expect(new Set(out.layers.map(l => l.id)).size).toBe(3);
    expect(out.fields.map(f => [f.key, f.label])).toEqual([['price_2', 'Cena (Tag)']]);

    const turned = unpackInstance({ ...layer, rotation: 180 }, block, CANVAS, effective, new Set());
    const tt = turned.layers[1];
    expect(layerRect(tt, CANVAS)).toEqual({ x: 940, y: 965, w: 50, h: 25 });
    expect(tt.rotation).toBe(180);
  });

  /**
   * @description Scaling the style of a layer: sizes and widths times the factor within the limits.
   * @input text with size 40, letter spacing 2, stroke 4, shadow 10 / 6 / 6, box padding 20; factor 0.5;
   *   size 900 times 2
   * @output 20, 1, 2, 5 / 3 / 3, 10; 1000 (limit)
   */
  it('scales the style of a layer', () => {
    const layer = text('x', {
      size: 40, letterSpacing: 2, stroke: { color: '#000000', width: 4 }, shadow: { color: '#000000', blur: 10, x: 6, y: 6 },
      box: { fill: { type: 'solid', color: '#ffffff' }, padding: 20, radius: 8, fit: 'text' },
    });
    const scaled = scaleLayerStyle(layer, 0.5) as TextLayer;
    expect([scaled.size, scaled.letterSpacing, scaled.stroke?.width, scaled.shadow?.blur, scaled.shadow?.x, scaled.box?.padding]).toEqual([20, 1, 2, 5, 3, 10]);
    expect((scaleLayerStyle(text('y', { size: 900 }), 2) as TextLayer).size).toBe(1000);
    expect(scaleLayerStyle(shape('z', { radius: 10 }), 3)).toEqual(jasmine.objectContaining({ radius: 30 }));
    const icon = { ...createLayer('icon', CANVAS, 'i'), strokeWidth: 2 } as Layer;
    expect((scaleLayerStyle(icon, 3) as { strokeWidth: number }).strokeWidth).toBe(2);
  });
});
