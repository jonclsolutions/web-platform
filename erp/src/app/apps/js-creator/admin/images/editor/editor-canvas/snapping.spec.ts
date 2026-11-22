/**
 * @file snapping.spec.ts
 * @path src/app/apps/js-creator/admin/images/editor/editor-canvas/snapping.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of snapping: targets of the canvas and other boxes, the nearest target
 *   within a distance, snapping of a moved box (guides first, the grid otherwise), of an edge and
 *   of a rotation angle.
 * @dependencies snapping.ts
 */

import { nearest, snapAngle, snapBox, snapEdge, snapTargets } from './snapping';

describe('snapping', () => {
  const canvas = { width: 1000, height: 800 };

  /**
   * @description Targets are the edges and centres of the canvas and of other boxes; the nearest
   *   one within the distance wins.
   * @input canvas 1000 × 800; other box 200,100 100 × 50; values 297 / 352 / 600
   * @output xs contain 0, 500, 1000, 200, 250, 300; nearest of 297 = 300 (+3); 600 → null
   */
  it('finds targets and the nearest one', () => {
    const targets = snapTargets(canvas, [{ x: 200, y: 100, w: 100, h: 50 }]);
    expect(targets.xs).toEqual([0, 500, 1000, 200, 250, 300]);
    expect(targets.ys).toEqual([0, 400, 800, 100, 125, 150]);
    expect(nearest([297, 352], targets.xs, 6)).toEqual({ delta: 3, target: 300 });
    expect(nearest([600], targets.xs, 6)).toBeNull();
  });

  /**
   * @description A moved box snaps its edges / centre to guides (with guide lines), otherwise to
   *   the grid; without guides only the grid applies.
   * @input box 447,10 100 × 100 near the centre line 500 (its centre 497); grid 20
   * @output dx +3 with a vertical guide at 500; dy to the grid (10 → 0 or 20); guides off → x on grid
   */
  it('snaps a moved box', () => {
    const targets = snapTargets(canvas, []);
    const box = { x: 447, y: 13, w: 100, h: 100 };
    const snapped = snapBox(box, targets, canvas, { guides: true, grid: 20, threshold: 6 });
    expect(snapped.dx).toBe(3);
    expect(snapped.guides).toEqual([{ x1: 500, y1: 0, x2: 500, y2: 800 }]);
    expect(snapped.dy).toBe(7);
    const grid = snapBox(box, targets, canvas, { guides: false, grid: 20, threshold: 6 });
    expect([grid.dx, grid.dy, grid.guides.length]).toEqual([-7, 7, 0]);
  });

  /**
   * @description An edge snaps to a guide, otherwise to the grid; angles snap to 15° with Shift
   *   and stick to right angles within 3°.
   * @input edge 997 (canvas edge 1000); edge 33 with grid 10; angles 47 (Shift), 88, 50, 190
   * @output 1000 with a guide; 30; 45; 90; 50; -170
   */
  it('snaps edges and angles', () => {
    const targets = snapTargets(canvas, []);
    expect(snapEdge(997, targets.xs, { guides: true, grid: 0, threshold: 6 })).toEqual({ value: 1000, guide: 1000 });
    expect(snapEdge(33, targets.xs, { guides: true, grid: 10, threshold: 2 })).toEqual({ value: 30, guide: null });
    expect(snapAngle(47, true)).toBe(45);
    expect(snapAngle(88, false)).toBe(90);
    expect(snapAngle(50, false)).toBe(50);
    expect(snapAngle(190, false)).toBe(-170);
  });
});
