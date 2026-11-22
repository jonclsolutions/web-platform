/**
 * @file geometry.spec.ts
 * @path src/app/apps/js-creator/admin/shared/render/geometry.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the geometry of layers: anchors (a layer keeps its corner when the
 *   canvas changes its size), inverse offsets, rotation, hit testing and the cells of grids.
 * @dependencies geometry.ts, document.ts
 */

import { boundingBox, containsPoint, gridCellRects, layerRect, offsetFor, rotatedCorners } from './geometry';

describe('geometry', () => {
  /**
   * @description A layer anchored top right 40 px from the edges stays there on another canvas;
   *   a centred layer stays centred; offsetFor() inverts layerRect().
   * @input anchor tr, x -40, y 40, 200 × 100 on 1080 × 1350 and 1080 × 1920; anchor mc on 1000 × 500
   * @output x 840 / y 40 on both; centred box; the same offset back
   */
  it('keeps layers at their anchors', () => {
    const logo = { anchor: 'tr' as const, x: -40, y: 40, w: 200, h: 100 };
    expect(layerRect(logo, { width: 1080, height: 1350 })).toEqual({ x: 840, y: 40, w: 200, h: 100 });
    expect(layerRect(logo, { width: 1080, height: 1920 })).toEqual({ x: 840, y: 40, w: 200, h: 100 });
    const footer = { anchor: 'bc' as const, x: 0, y: -40, w: 400, h: 60 };
    expect(layerRect(footer, { width: 1080, height: 1920 })).toEqual({ x: 340, y: 1820, w: 400, h: 60 });
    expect(layerRect({ anchor: 'mc', x: 0, y: 0, w: 100, h: 50 }, { width: 1000, height: 500 })).toEqual({ x: 450, y: 225, w: 100, h: 50 });
    expect(offsetFor('tr', { x: 840, y: 40, w: 200, h: 100 }, { width: 1080, height: 1350 })).toEqual({ x: -40, y: 40 });
  });

  /**
   * @description Rotation turns the corners around the centre; hit testing follows the rotation.
   * @input box 0,0 100 × 20 rotated 90°
   * @output bounding box 40,-40 20 × 100; (50, -30) inside, (90, 10) outside
   */
  it('rotates and hit tests', () => {
    const rect = { x: 0, y: 0, w: 100, h: 20 };
    const bbox = boundingBox(rect, 90);
    expect(bbox.x).toBeCloseTo(40);
    expect(bbox.y).toBeCloseTo(-40);
    expect(bbox.w).toBeCloseTo(20);
    expect(bbox.h).toBeCloseTo(100);
    expect(rotatedCorners(rect, 0)[2]).toEqual({ x: 100, y: 20 });
    expect(containsPoint({ x: 50, y: -30 }, rect, 90)).toBeTrue();
    expect(containsPoint({ x: 90, y: 10 }, rect, 90)).toBeFalse();
    expect(containsPoint({ x: 90, y: 10 }, rect, 0)).toBeTrue();
  });

  /**
   * @description Cells of grids fill the box with the gaps between them.
   * @input 2x2 in 0,0 210 × 210 gap 10; 1+2 in 0,0 310 × 310 and 1+3 in 0,0 320 × 310, gap 10
   * @output 4 cells of 100; big left + 2 stacked right; big top (2/3) + 3 below
   */
  it('splits grids into cells', () => {
    expect(gridCellRects('2x2', { x: 0, y: 0, w: 210, h: 210 }, 10)).toEqual([
      { x: 0, y: 0, w: 100, h: 100 }, { x: 110, y: 0, w: 100, h: 100 },
      { x: 0, y: 110, w: 100, h: 100 }, { x: 110, y: 110, w: 100, h: 100 },
    ]);
    const side = gridCellRects('1+2', { x: 0, y: 0, w: 310, h: 310 }, 10);
    expect(side[0]).toEqual({ x: 0, y: 0, w: 150, h: 310 });
    expect(side[2]).toEqual({ x: 160, y: 160, w: 150, h: 150 });
    const top = gridCellRects('1+3', { x: 0, y: 0, w: 320, h: 310 }, 10);
    expect(top.length).toBe(4);
    expect(top[0]).toEqual({ x: 0, y: 0, w: 320, h: 200 });
    expect(top[3]).toEqual({ x: 220, y: 210, w: 100, h: 100 });
  });
});
