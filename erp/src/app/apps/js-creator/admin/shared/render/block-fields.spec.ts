/**
 * @file block-fields.spec.ts
 * @path src/app/apps/js-creator/admin/shared/render/block-fields.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of blocks seen from a template: the fields of the form with the keys of
 *   block instances (the same keys as the API - EffectiveFieldsTest.php), the keys of one
 *   instance, the box of an instance and the document with the layers of its blocks.
 * @dependencies block-fields.ts, document.ts
 */

import { BlockLayer, Field, Layer, TemplateDocument, createLayer, documentReferences, emptyDocument } from './document';
import { BlockDef, effectiveFields, freeFieldKey, instanceKeys, instanceLayer, resourceDocument } from './block-fields';

/**
 * @description Text / image field.
 * @param key Key.
 * @param type Kind.
 */
function field(key: string, type: 'text' | 'image' = 'text'): Field {
  return type === 'text'
    ? { key, type, label: key.toUpperCase(), help: '', required: false, sample: '', maxLength: 100, multiline: false }
    : { key, type, label: key.toUpperCase(), help: '', required: false, minWidth: 0, minHeight: 0 };
}

/**
 * @description Instance of a block.
 * @param id Layer id.
 * @param blockId Block.
 * @param overrides Properties.
 */
function instance(id: string, blockId: number, overrides: Partial<BlockLayer> = {}): BlockLayer {
  return { id, name: '', type: 'block', anchor: 'tl', x: 0, y: 0, w: 400, h: 200, rotation: 0, opacity: 1, hidden: false, locked: false, blockId, scale: 1, ...overrides };
}

/**
 * @description Document with layers and fields.
 * @param layers Layers.
 * @param fields Fields.
 */
function doc(layers: Layer[], fields: Field[] = []): TemplateDocument {
  const d = emptyDocument();
  d.pages[0].layers = layers;
  d.fields = fields;
  return d;
}

/** Price tag: a text field "price" and an image field "logo" (own font 5, library image 9). */
const TAG: BlockDef = {
  id: 4, name: 'Štítek', width: 400, height: 200,
  document: doc([
    { ...createLayer('text', { width: 400, height: 200 }, 'p'), field: 'price', font: { family: 'user:5', weight: 400, style: 'normal' } } as Layer,
    { ...createLayer('image', { width: 400, height: 200 }, 'i'), source: { kind: 'asset', assetId: 9 } } as Layer,
  ], [field('price'), field('logo', 'image')]),
};

describe('block-fields', () => {
  /**
   * @description Keys of instance fields are the same as in the API: a free key stays, a taken
   *   one gets `_2`, `_3` … within 40 characters; labels of renamed fields name the instance.
   * @input template fields title (text), price (image); instances: block 4, missing block 99,
   *   block 4 again (named "Dole")
   * @output title, price, price_2, logo, price_3, logo_2; labels "PRICE (Štítek 1)" and "PRICE (Dole)"
   */
  it('gives instance fields their keys of the form', () => {
    const template = doc([instance('a', 4), instance('b', 99), instance('c', 4, { name: 'Dole' })], [field('title'), field('price', 'image')]);
    const fields = effectiveFields(template, id => (id === 4 ? TAG : undefined));
    expect(fields.map(f => [f.key, f.type])).toEqual([
      ['title', 'text'], ['price', 'image'], ['price_2', 'text'], ['logo', 'image'], ['price_3', 'text'], ['logo_2', 'image'],
    ]);
    expect(fields[2].label).toBe('PRICE (Štítek 1)');
    expect(fields[3].label).toBe('LOGO');
    expect(fields[4].label).toBe('PRICE (Dole)');
    expect(fields[2].origin).toEqual({ layerId: 'a', blockId: 4, key: 'price' });
    expect([...instanceKeys(fields, 'c')]).toEqual([['price', 'price_3'], ['logo', 'logo_2']]);
    expect(effectiveFields(template).length).toBe(2);
    expect(freeFieldKey('a'.repeat(40), new Set(['a'.repeat(40)]))).toBe('a'.repeat(38) + '_2');
  });

  /**
   * @description The box of an instance follows the current size of its block × scale; the
   *   document for loading resources adds the layers and fields of its blocks.
   * @input instance at scale 0.5 of the 400 × 200 block; template with the instance
   * @output w 200 / h 100; references with library image 9 and own font 5; the template unchanged
   */
  it('sizes instances and collects the resources of blocks', () => {
    expect(instanceLayer(instance('a', 4, { scale: 0.5, w: 1, h: 1 }), TAG)).toEqual(jasmine.objectContaining({ w: 200, h: 100 }));
    expect(instanceLayer(instance('a', 4, { w: 7 }), undefined).w).toBe(7);
    const template = doc([instance('a', 4)]);
    const refs = documentReferences(resourceDocument(template, () => TAG));
    expect(refs.assets).toEqual([9]);
    expect(refs.fonts).toEqual([5]);
    expect(template.pages[0].layers.length).toBe(1);
    expect(resourceDocument(template)).toBe(template);
  });
});
