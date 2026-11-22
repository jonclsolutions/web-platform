/**
 * @file editor-test-data.ts
 * @path src/app/apps/js-creator/admin/images/editor/editor-test-data.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Test data of the editor specs: a template of the API with layers and fields, a
 *   library image, own fonts and curated font families.
 * @usage `const template = testTemplate({ layers: [textLayer('t1')] })`
 * @dependencies render/document.ts, js-creator.models.ts.
 */

import { CreatorAsset, CreatorFont, CreatorTemplateDetail, CuratedFontFamily } from '../../shared/js-creator.models';
import { Field, Layer, TextLayer, createLayer, emptyDocument } from '../../shared/render/document';

/** Size of the test templates. */
export const TEST_SIZE = { width: 1000, height: 1000 };

/**
 * @description Template of the API.
 * @param options Layers, fields, caption, version.
 */
export function testTemplate(options: { layers?: Layer[]; fields?: Field[]; caption?: string | null; version?: number; id?: number } = {}): CreatorTemplateDetail {
  const document = emptyDocument();
  document.pages[0].layers = options.layers ?? [];
  document.fields = options.fields ?? [];
  return {
    id: options.id ?? 7, section: 'images', name: 'Post', width: TEST_SIZE.width, height: TEST_SIZE.height, output_format: 'png', output_quality: 90,
    caption_template: options.caption ?? null, thumb_url: null, version: options.version ?? 3, created_at: null, updated_at: null, deleted_at: null,
    schema_version: 1, document,
  };
}

/**
 * @description Text layer at the top left (100 × 50 at 10, 10).
 * @param id Id.
 * @param overrides Properties.
 */
export function textLayer(id: string, overrides: Partial<TextLayer> = {}): TextLayer {
  return { ...(createLayer('text', TEST_SIZE, id) as TextLayer), anchor: 'tl', x: 10, y: 10, w: 100, h: 50, ...overrides };
}

/**
 * @description Shape layer (box at x, y of 100 × 100, top left anchor).
 * @param id Id.
 * @param x Left.
 * @param y Top.
 */
export function shapeLayer(id: string, x = 0, y = 0): Layer {
  return { ...createLayer('shape', TEST_SIZE, id), anchor: 'tl', x, y, w: 100, h: 100 } as Layer;
}

/**
 * @description Text field.
 * @param key Key.
 */
export function textField(key = 'title'): Field {
  return { key, type: 'text', label: 'Title', help: '', required: true, sample: 'Sample', maxLength: 100, multiline: false };
}

/**
 * @description Image field.
 * @param key Key.
 */
export function imageField(key = 'photo'): Field {
  return { key, type: 'image', label: 'Photo', help: '', required: true, minWidth: 0, minHeight: 0 };
}

/**
 * @description Library image.
 * @param id Id.
 */
export function testAsset(id: number): CreatorAsset {
  return { id, name: `img${id}`, mime: 'image/png', width: 10, height: 10, size_bytes: 100, url: `/api/o/${id}`, thumb_url: `/api/t/${id}`, created_at: null, deleted_at: null };
}

/**
 * @description Own font face.
 * @param id Id.
 * @param family Family.
 * @param weight Weight.
 */
export function testFont(id: number, family = 'Brand', weight = 400): CreatorFont {
  return { id, family, weight, style: 'normal', format: 'woff2', size_bytes: 100, url: `/api/f/${id}`, created_at: null, deleted_at: null };
}

/** Curated families (Inter 400 / 700, Anton 400). */
export const TEST_CURATED: CuratedFontFamily[] = [
  { family: 'Inter', slug: 'inter', category: 'sans-serif', license: 'OFL-1.1', source: 'x', faces: [{ weight: 400, style: 'normal', files: [] }, { weight: 700, style: 'normal', files: [] }] },
  { family: 'Anton', slug: 'anton', category: 'display', license: 'OFL-1.1', source: 'x', faces: [{ weight: 400, style: 'normal', files: [] }] },
];
