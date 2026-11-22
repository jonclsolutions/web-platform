/**
 * @file snapping.ts
 * @path src/app/apps/js-creator/admin/images/editor/editor-canvas/snapping.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Snapping of the editor: while a box is moved or resized, its edges and centre stick
 *   to the edges and the centre of the canvas and of the other layers (smart guides, shown as
 *   lines), otherwise to the grid. Pure functions (tested without the canvas).
 * @dependencies render/geometry.ts (Rect).
 */

import { Rect } from '../../../shared/render/geometry';

/** A guide line shown while snapping (template px). */
export interface GuideLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Targets of snapping: positions of lines on both axes. */
export interface SnapTargets {
  xs: number[];
  ys: number[];
}

/** Settings of snapping. */
export interface SnapSettings {
  /** Smart guides on. */
  guides: boolean;
  /** Grid size (px) or 0 = off. */
  grid: number;
  /** Distance that still snaps (template px). */
  threshold: number;
}

/**
 * @description Lines to snap to: edges and centre of the canvas and of other boxes.
 * @param canvas Size of the canvas.
 * @param others Boxes of the other layers.
 */
export function snapTargets(canvas: { width: number; height: number }, others: readonly Rect[]): SnapTargets {
  const xs = [0, canvas.width / 2, canvas.width];
  const ys = [0, canvas.height / 2, canvas.height];
  for (const r of others) {
    xs.push(r.x, r.x + r.w / 2, r.x + r.w);
    ys.push(r.y, r.y + r.h / 2, r.y + r.h);
  }
  return { xs, ys };
}

/**
 * @description Nearest target of some positions within a distance.
 * @param values Positions of the moving box (e.g. left, centre, right).
 * @param targets Positions of the lines.
 * @param threshold Distance.
 * @returns Shift to the target and the target, or null.
 */
export function nearest(values: number[], targets: number[], threshold: number): { delta: number; target: number } | null {
  let best: { delta: number; target: number } | null = null;
  for (const v of values) {
    for (const t of targets) {
      const delta = t - v;
      if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) best = { delta, target: t };
    }
  }
  return best;
}

/**
 * @description Snaps a moved box: guides first (both axes independently), the grid otherwise.
 * @param box Box after the move (before snapping).
 * @param targets Lines to snap to.
 * @param canvas Size of the canvas (length of the guide lines).
 * @param settings Guides, grid, distance.
 * @returns Extra shift and the guides to show.
 */
export function snapBox(box: Rect, targets: SnapTargets, canvas: { width: number; height: number }, settings: SnapSettings): { dx: number; dy: number; guides: GuideLine[] } {
  const guides: GuideLine[] = [];
  let dx = 0;
  let dy = 0;
  const sx = settings.guides ? nearest([box.x, box.x + box.w / 2, box.x + box.w], targets.xs, settings.threshold) : null;
  const sy = settings.guides ? nearest([box.y, box.y + box.h / 2, box.y + box.h], targets.ys, settings.threshold) : null;
  if (sx) {
    dx = sx.delta;
    guides.push({ x1: sx.target, y1: 0, x2: sx.target, y2: canvas.height });
  } else if (settings.grid > 0) {
    dx = Math.round(box.x / settings.grid) * settings.grid - box.x;
  }
  if (sy) {
    dy = sy.delta;
    guides.push({ x1: 0, y1: sy.target, x2: canvas.width, y2: sy.target });
  } else if (settings.grid > 0) {
    dy = Math.round(box.y / settings.grid) * settings.grid - box.y;
  }
  return { dx, dy, guides };
}

/**
 * @description Snaps one moving edge (resizing): to a guide, otherwise to the grid.
 * @param value Position of the edge.
 * @param targets Lines of its axis.
 * @param settings Guides, grid, distance.
 * @returns Snapped position and the target line (null = grid / none).
 */
export function snapEdge(value: number, targets: number[], settings: SnapSettings): { value: number; guide: number | null } {
  const hit = settings.guides ? nearest([value], targets, settings.threshold) : null;
  if (hit) return { value: hit.target, guide: hit.target };
  if (settings.grid > 0) return { value: Math.round(value / settings.grid) * settings.grid, guide: null };
  return { value, guide: null };
}

/**
 * @description Angle of a rotation handle: Shift = steps of 15°, otherwise 0 / 90 / 180 / 270
 *   stick within 3°.
 * @param angle Raw angle (degrees).
 * @param shift Shift held.
 * @returns Angle in (-180, 180], one decimal.
 */
export function snapAngle(angle: number, shift: boolean): number {
  let a = ((angle % 360) + 540) % 360 - 180;
  if (shift) a = Math.round(a / 15) * 15;
  else {
    const right = Math.round(a / 90) * 90;
    if (Math.abs(a - right) <= 3) a = right;
  }
  if (a <= -180) a += 360;
  return Math.round(a * 10) / 10;
}
