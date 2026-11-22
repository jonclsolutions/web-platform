/**
 * @file field-images.spec.ts
 * @path src/app/apps/js-creator/admin/shared/render/field-images.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the places of image fields and their crop: places on the background,
 *   in image layers and in cells of grids (hidden layers skipped), hit testing with rotation,
 *   dragging (also mirrored and rotated), zoom limits and the scale a place needs.
 * @dependencies field-images.ts, document.ts
 */

import { CanvasSize, GridLayer, ImageLayer, TemplateDocument, createLayer, emptyDocument } from './document';
import { CROP_ZOOM, boxContains, defaultCrop, fieldImageBoxes, panCrop, requiredScale, zoomCrop } from './field-images';

/** Size of the test canvas. */
const SIZE: CanvasSize = { width: 1000, height: 500 };

/**
 * @description Document with a background field, an image layer and a 2x1 grid of the field `photo`.
 * @param overrides Changes of the image layer.
 */
function documentWithPlaces(overrides: Partial<ImageLayer> = {}): TemplateDocument {
  const doc = emptyDocument();
  doc.pages[0].background.image = { source: { kind: 'field', field: 'photo' }, fit: 'cover', focusX: 0.2, focusY: 0.3, overlay: null };
  const image: ImageLayer = {
    ...(createLayer('image', SIZE, 'i1') as ImageLayer), anchor: 'tl', x: 100, y: 100, w: 200, h: 100, fit: 'cover', focusX: 0.5, focusY: 0.5,
    source: { kind: 'field', field: 'photo' }, ...overrides,
  };
  const grid: GridLayer = {
    ...(createLayer('grid', SIZE, 'g1') as GridLayer), anchor: 'tl', x: 500, y: 0, w: 400, h: 200, gap: 0, layout: '2x1',
    cells: [{ source: { kind: 'asset', assetId: 3 }, focusX: 0.5, focusY: 0.5 }, { source: { kind: 'field', field: 'photo' }, focusX: 0.9, focusY: 0.1 }],
  };
  doc.pages[0].layers = [image, grid, { ...image, id: 'hidden', hidden: true }];
  return doc;
}

describe('field-images', () => {
  /**
   * @description Every visible place of a field is found: background, image layer, grid cell; a
   *   hidden layer and other fields are skipped; the starting crop is the focus of the first place.
   * @input background + image layer + 2x1 grid (asset + photo) + hidden copy
   * @output 3 places (canvas, 100,100 200×100, cell 700,0 200×200); crop 0.2 / 0.3 / 1; none for "other"
   */
  it('finds the places of a field', () => {
    const boxes = fieldImageBoxes(documentWithPlaces(), SIZE, 'photo');
    expect(boxes.map(b => b.rect)).toEqual([
      { x: 0, y: 0, w: 1000, h: 500 },
      { x: 100, y: 100, w: 200, h: 100 },
      { x: 700, y: 0, w: 200, h: 200 },
    ]);
    expect(boxes[2].frame).toEqual({ x: 500, y: 0, w: 400, h: 200 });
    expect(defaultCrop(boxes)).toEqual({ focusX: 0.2, focusY: 0.3, zoom: 1 });
    expect(fieldImageBoxes(documentWithPlaces(), SIZE, 'other')).toEqual([]);
    expect(defaultCrop([])).toEqual({ focusX: 0.5, focusY: 0.5, zoom: 1 });
  });

  /**
   * @description Hit testing follows the rotation of the layer.
   * @input image layer 200 × 100 at 100,100 rotated 90° (now 50 wide, 200 tall around 200,150)
   * @output (200, 70) inside, (120, 150) outside
   */
  it('hit tests rotated places', () => {
    const [, box] = fieldImageBoxes(documentWithPlaces({ rotation: 90 }), SIZE, 'photo');
    expect(boxContains(box, { x: 200, y: 70 })).toBeTrue();
    expect(boxContains(box, { x: 120, y: 150 })).toBeFalse();
  });

  /**
   * @description Dragging moves the image with the pointer within its edges; a mirrored box
   *   inverts the horizontal drag; a rotated box turns the drag into its axes; without spare
   *   image in an axis the focus stays.
   * @input image 400 × 100 in the box 200 × 100 (cover: 200 px spare horizontally, none vertically)
   * @output drag +50 → focus 0.25; drag far → 0; mirrored → 0.75; rotated 90°, drag down +50 →
   *   0.25; vertical drag keeps 0.5
   */
  it('pans the crop', () => {
    const [, box] = fieldImageBoxes(documentWithPlaces(), SIZE, 'photo');
    const crop = { focusX: 0.5, focusY: 0.5, zoom: 1 };
    const image = { width: 400, height: 100 };
    expect(panCrop(crop, box, image, 50, 0).focusX).toBeCloseTo(0.25);
    expect(panCrop(crop, box, image, 500, 0).focusX).toBe(0);
    expect(panCrop(crop, box, image, 0, 40).focusY).toBe(0.5);

    const [, mirrored] = fieldImageBoxes(documentWithPlaces({ flipX: true }), SIZE, 'photo');
    expect(panCrop(crop, mirrored, image, 50, 0).focusX).toBeCloseTo(0.75);

    const [, rotated] = fieldImageBoxes(documentWithPlaces({ rotation: 90 }), SIZE, 'photo');
    expect(panCrop(crop, rotated, image, 0, 50).focusX).toBeCloseTo(0.25);
    expect(panCrop(crop, box, { width: 0, height: 0 }, 50, 0)).toBe(crop);
  });

  /**
   * @description Zoom stays within its limits; a zoom adds spare image in both axes.
   * @input zoom 0.5, 9, 2.345; zoom 2 then a vertical drag of +25
   * @output 1, 4, 2.35; focusY 0.25 (100 px spare vertically)
   */
  it('zooms the crop', () => {
    const crop = { focusX: 0.5, focusY: 0.5, zoom: 1 };
    expect(zoomCrop(crop, 0.5).zoom).toBe(CROP_ZOOM.min);
    expect(zoomCrop(crop, 9).zoom).toBe(CROP_ZOOM.max);
    expect(zoomCrop(crop, 2.345).zoom).toBe(2.35);
    const [, box] = fieldImageBoxes(documentWithPlaces(), SIZE, 'photo');
    expect(panCrop(zoomCrop(crop, 2), box, { width: 400, height: 100 }, 0, 25).focusY).toBeCloseTo(0.25);
  });

  /**
   * @description The scale a field needs is the largest of its places (with the zoom).
   * @input image 2000 × 1000; places canvas 1000 × 500, 200 × 100, 200 × 200; zoom 1 and 3
   * @output 0.5 (the background); 1.5
   */
  it('reports the scale the places need', () => {
    const boxes = fieldImageBoxes(documentWithPlaces(), SIZE, 'photo');
    expect(requiredScale(boxes, { width: 2000, height: 1000 }, 1)).toBeCloseTo(0.5);
    expect(requiredScale(boxes, { width: 2000, height: 1000 }, 3)).toBeCloseTo(1.5);
    expect(requiredScale([], { width: 2000, height: 1000 }, 1)).toBe(0);
  });
});
