/**
 * @file document.spec.ts
 * @path src/app/apps/js-creator/admin/shared/render/document.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the document model: new layers have exactly the properties the API
 *   validates (the same lists as api/app/Apps/JsCreator/Support/TemplateDocument.php), field keys
 *   from labels, references and used fields, sizes, presets and safe zones.
 * @dependencies document.ts
 */

import {
  DOCUMENT_LIMITS, LayerType, PlainLayerType, SIZE_PRESETS, blockIdsOf, createBlockLayer, createLayer, documentBytes, documentReferences,
  emptyDocument, fieldKeyFrom, gridCells, isValidSize, newLayerId, safeZoneOf, usedFieldKeys,
} from './document';

/** Properties of every layer (TemplateDocument::COMMON). */
const COMMON = ['id', 'type', 'name', 'anchor', 'x', 'y', 'w', 'h', 'rotation', 'opacity', 'hidden', 'locked'];

/** Properties of each kind (TemplateDocument::LAYER_KEYS). */
const LAYER_KEYS: Record<LayerType, string[]> = {
  text: ['field', 'text', 'font', 'size', 'fill', 'lineHeight', 'letterSpacing', 'align', 'valign', 'uppercase', 'maxLines', 'autoShrink',
    'minSize', 'overflow', 'stroke', 'shadow', 'box', 'highlight'],
  image: ['source', 'fit', 'focusX', 'focusY', 'radius', 'mask', 'border', 'shadow', 'overlay', 'flipX'],
  grid: ['layout', 'gap', 'radius', 'fit', 'cells', 'border', 'overlay'],
  shape: ['shape', 'fill', 'radius', 'stroke', 'shadow'],
  icon: ['icon', 'color', 'strokeWidth', 'shadow'],
  block: ['blockId', 'scale'],
};

describe('document', () => {
  /**
   * @description Every new layer has exactly the properties of its kind (no more, no less) and is
   *   centred on the canvas within it.
   * @input each kind on 1080 × 1350
   * @output keys equal to COMMON + LAYER_KEYS; anchor mc, offset 0; size within the canvas
   */
  it('creates layers with the properties the API expects', () => {
    for (const type of Object.keys(LAYER_KEYS) as LayerType[]) {
      const layer = type === 'block'
        ? createBlockLayer({ id: 1, width: 400, height: 200 }, { width: 1080, height: 1350 }, 'x1')
        : createLayer(type as PlainLayerType, { width: 1080, height: 1350 }, 'x1');
      expect(Object.keys(layer).sort()).withContext(type).toEqual([...COMMON, ...LAYER_KEYS[type]].sort());
      expect([layer.anchor, layer.x, layer.y]).toEqual(['mc', 0, 0]);
      expect(layer.w).toBeLessThanOrEqual(1080);
      expect(layer.h).toBeLessThanOrEqual(1350);
    }
  });

  /**
   * @description Field keys are made from labels (no diacritics, a-z0-9_, starting with a letter)
   *   and are unique.
   * @input "Nadpis příspěvku"; "Nadpis příspěvku" with the key taken; "123"; "Cena (Kč)"
   * @output nadpis_prispevku; nadpis_prispevku_2; pole; cena_kc
   */
  it('makes field keys from labels', () => {
    expect(fieldKeyFrom('Nadpis příspěvku', new Set())).toBe('nadpis_prispevku');
    expect(fieldKeyFrom('Nadpis příspěvku', new Set(['nadpis_prispevku']))).toBe('nadpis_prispevku_2');
    expect(fieldKeyFrom('123', new Set())).toBe('pole');
    expect(fieldKeyFrom('Cena (Kč)', new Set())).toBe('cena_kc');
  });

  /**
   * @description References and used fields are collected from layers, grid cells and the
   *   background; grid cells follow their layout keeping the existing ones.
   * @input text field + own font; image asset 5; grid with a field cell; background asset 6
   * @output assets 5, 6; fonts 3; set fonts inter; used fields title, photo; 2x2 → 3x3 keeps cell 0
   */
  it('collects references and used fields', () => {
    const doc = emptyDocument();
    const size = { width: 1080, height: 1080 };
    const text = { ...createLayer('text', size, 't1'), field: 'title', font: { family: 'user:3', weight: 400, style: 'normal' as const } };
    const text2 = createLayer('text', size, 't2');
    const image = { ...createLayer('image', size, 'i1'), source: { kind: 'asset' as const, assetId: 5 } };
    const grid = createLayer('grid', size, 'g1');
    if (grid.type === 'grid') grid.cells[0].source = { kind: 'field', field: 'photo' };
    doc.pages[0].layers = [text, text2, image, grid];
    doc.pages[0].background.image = { source: { kind: 'asset', assetId: 6 }, fit: 'cover', focusX: 0.5, focusY: 0.5, overlay: null };

    const refs = documentReferences(doc);
    expect(refs.assets.sort()).toEqual([5, 6]);
    expect(refs.fonts).toEqual([3]);
    expect(refs.setFonts).toEqual(['inter']);
    expect([...usedFieldKeys(doc)].sort()).toEqual(['photo', 'title']);
    if (grid.type === 'grid') {
      const bigger = gridCells('3x3', grid.cells);
      expect(bigger.length).toBe(9);
      expect(bigger[0].source).toEqual({ kind: 'field', field: 'photo' });
    }
  });

  /**
   * @description Sizes, presets, safe zones, ids and the byte size of a document.
   * @input 1080 × 1920; 720 × 1280; 1080 × 1080; 99 × 100; 3001; taken id set
   * @output preset safe zone; proportional zone; none; invalid sizes; a new unique id; bytes of JSON
   */
  it('checks sizes, presets and ids', () => {
    expect(safeZoneOf({ width: 1080, height: 1920 })).toEqual({ top: 250, bottom: 340 });
    expect(safeZoneOf({ width: 720, height: 1280 })).toEqual({ top: 166, bottom: 227 });
    expect(safeZoneOf({ width: 1080, height: 1080 })).toBeNull();
    expect(isValidSize({ width: 1080, height: 1350 })).toBeTrue();
    expect(isValidSize({ width: 99, height: 100 })).toBeFalse();
    expect(isValidSize({ width: 1080, height: 3001 })).toBeFalse();
    expect(SIZE_PRESETS.every(p => isValidSize(p))).toBeTrue();
    const id = newLayerId(new Set(['a']));
    expect(id).toMatch(/^[A-Za-z0-9_-]{1,32}$/);
    expect(documentBytes(emptyDocument())).toBeLessThan(DOCUMENT_LIMITS.maxBytes);
  });
  /**
   * @description A new block instance is centred and fitted to 80 % of the canvas; the blocks of
   *   a document are listed once; an empty block document is transparent.
   * @input block 600 × 300 on 1080 × 1350; block 2000 × 500; document with two instances of 4 and one of 6
   * @output scale 1 (600 × 300, anchor mc); scale 0.43 (860 × 215); [4, 6]; colour #ffffff00
   */
  it('creates block instances', () => {
    const fit = createBlockLayer({ id: 4, width: 600, height: 300 }, { width: 1080, height: 1350 }, 'b');
    expect([fit.type, fit.anchor, fit.scale, fit.w, fit.h, fit.blockId]).toEqual(['block', 'mc', 1, 600, 300, 4]);
    const wide = createBlockLayer({ id: 6, width: 2000, height: 500 }, { width: 1080, height: 1350 }, 'c');
    expect([wide.scale, wide.w, wide.h]).toEqual([0.43, 860, 215]);
    const doc = emptyDocument();
    doc.pages[0].layers = [fit, wide, { ...fit, id: 'd' }];
    expect(blockIdsOf(doc)).toEqual([4, 6]);
    expect(emptyDocument(true).pages[0].background.fill).toEqual({ type: 'solid', color: '#ffffff00' });
  });
});
