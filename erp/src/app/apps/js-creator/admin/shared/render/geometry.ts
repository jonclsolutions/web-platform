/**
 * @file geometry.ts
 * @path src/app/apps/js-creator/admin/shared/render/geometry.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Geometry of the layers of a template:
 *   - anchors: a layer is pinned with one of its 9 points to the same point of the canvas plus an
 *     offset, so it keeps its place when the canvas changes its size ("logo top right, 40 px from
 *     the edges");
 *   - the box of a layer on the canvas, its rotated corners and bounding box, hit testing;
 *   - the cells of an image grid.
 * @usage `layerRect(layer, size)` → { x, y, w, h } (top left corner, before rotation).
 * @dependencies document.ts (types).
 */

import { Anchor, CanvasSize, GridLayout, LayerBase } from './document';

/** Axis-aligned rectangle (px). */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Point (px). */
export interface Point {
  x: number;
  y: number;
}

/**
 * @description Fractions of an anchor: 0 / 0.5 / 1 horizontally and vertically.
 * @param anchor Anchor.
 */
export function anchorFractions(anchor: Anchor): { fx: number; fy: number } {
  const fy = anchor[0] === 't' ? 0 : anchor[0] === 'm' ? 0.5 : 1;
  const fx = anchor[1] === 'l' ? 0 : anchor[1] === 'c' ? 0.5 : 1;
  return { fx, fy };
}

/**
 * @description Box of a layer on the canvas (before its rotation).
 * @param layer Layer (anchor, offset, size).
 * @param canvas Size of the canvas.
 */
export function layerRect(layer: Pick<LayerBase, 'anchor' | 'x' | 'y' | 'w' | 'h'>, canvas: CanvasSize): Rect {
  const { fx, fy } = anchorFractions(layer.anchor);
  return {
    x: fx * canvas.width + layer.x - fx * layer.w,
    y: fy * canvas.height + layer.y - fy * layer.h,
    w: layer.w,
    h: layer.h,
  };
}

/**
 * @description Offset of a layer from its anchor for a wanted box (inverse of layerRect).
 * @param anchor Anchor of the layer.
 * @param rect Wanted box on the canvas.
 * @param canvas Size of the canvas.
 */
export function offsetFor(anchor: Anchor, rect: Rect, canvas: CanvasSize): { x: number; y: number } {
  const { fx, fy } = anchorFractions(anchor);
  return { x: rect.x + fx * rect.w - fx * canvas.width, y: rect.y + fy * rect.h - fy * canvas.height };
}

/**
 * @description Corners of a rotated box (clockwise from the top left).
 * @param rect Box before rotation.
 * @param rotation Degrees, clockwise, around the centre.
 */
export function rotatedCorners(rect: Rect, rotation: number): Point[] {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [
    [rect.x, rect.y], [rect.x + rect.w, rect.y], [rect.x + rect.w, rect.y + rect.h], [rect.x, rect.y + rect.h],
  ].map(([x, y]) => ({ x: cx + (x - cx) * cos - (y - cy) * sin, y: cy + (x - cx) * sin + (y - cy) * cos }));
}

/**
 * @description Axis-aligned bounding box of a rotated box.
 * @param rect Box before rotation.
 * @param rotation Degrees.
 */
export function boundingBox(rect: Rect, rotation: number): Rect {
  if (!rotation) return { ...rect };
  const corners = rotatedCorners(rect, rotation);
  const xs = corners.map(c => c.x);
  const ys = corners.map(c => c.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/**
 * @description Union of boxes.
 * @param rects Boxes (at least one).
 */
export function unionRect(rects: readonly Rect[]): Rect {
  const x = Math.min(...rects.map(r => r.x));
  const y = Math.min(...rects.map(r => r.y));
  return { x, y, w: Math.max(...rects.map(r => r.x + r.w)) - x, h: Math.max(...rects.map(r => r.y + r.h)) - y };
}

/**
 * @description Whether a point lies inside a rotated box.
 * @param point Point on the canvas.
 * @param rect Box before rotation.
 * @param rotation Degrees.
 */
export function containsPoint(point: Point, rect: Rect, rotation: number): boolean {
  const local = toLocal(point, rect, rotation);
  return local.x >= rect.x && local.x <= rect.x + rect.w && local.y >= rect.y && local.y <= rect.y + rect.h;
}

/**
 * @description Point turned around a centre (degrees, clockwise - the direction of the canvas).
 * @param point Point.
 * @param center Centre of the rotation.
 * @param rotation Degrees.
 */
export function rotatePoint(point: Point, center: Point, rotation: number): Point {
  if (!rotation) return { ...point };
  const rad = (rotation * Math.PI) / 180;
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return { x: center.x + dx * Math.cos(rad) - dy * Math.sin(rad), y: center.y + dx * Math.sin(rad) + dy * Math.cos(rad) };
}

/**
 * @description Point turned back by the rotation of a box (into its unrotated coordinates).
 * @param point Point on the canvas.
 * @param rect Box before rotation.
 * @param rotation Degrees.
 */
export function toLocal(point: Point, rect: Rect, rotation: number): Point {
  if (!rotation) return point;
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const rad = (-rotation * Math.PI) / 180;
  const dx = point.x - cx;
  const dy = point.y - cy;
  return { x: cx + dx * Math.cos(rad) - dy * Math.sin(rad), y: cy + dx * Math.sin(rad) + dy * Math.cos(rad) };
}

/**
 * @description Whether two boxes overlap (marquee selection).
 * @param a Box.
 * @param b Box.
 */
export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * @description Cells of an image grid inside a box.
 * @param layout Layout.
 * @param rect Box of the grid.
 * @param gap Gap between the cells (px).
 * @returns Cells in the order of GridLayer.cells.
 */
export function gridCellRects(layout: GridLayout, rect: Rect, gap: number): Rect[] {
  const g = Math.max(0, Math.min(gap, rect.w / 3, rect.h / 3));
  const split = (start: number, length: number, parts: number, weights?: number[]): [number, number][] => {
    const w = weights ?? Array(parts).fill(1);
    const total = w.reduce((a, b) => a + b, 0);
    const free = length - g * (parts - 1);
    let pos = start;
    return w.map(part => {
      const size = (free * part) / total;
      const out: [number, number] = [pos, size];
      pos += size + g;
      return out;
    });
  };
  const matrix = (cols: number, rows: number): Rect[] => {
    const xs = split(rect.x, rect.w, cols);
    const ys = split(rect.y, rect.h, rows);
    return ys.flatMap(([y, h]) => xs.map(([x, w]) => ({ x, y, w, h })));
  };

  switch (layout) {
    case '1+2':
    case '2+1': {
      const [[x1, w1], [x2, w2]] = split(rect.x, rect.w, 2);
      const stack = (x: number, w: number) => split(rect.y, rect.h, 2).map(([y, h]) => ({ x, y, w, h }));
      const big = (x: number, w: number) => ({ x, y: rect.y, w, h: rect.h });
      return layout === '1+2' ? [big(x1, w1), ...stack(x2, w2)] : [...stack(x1, w1), big(x2, w2)];
    }
    case '1+3':
    case '3+1': {
      const [[y1, h1], [y2, h2]] = split(rect.y, rect.h, 2, layout === '1+3' ? [2, 1] : [1, 2]);
      const row = (y: number, h: number) => split(rect.x, rect.w, 3).map(([x, w]) => ({ x, y, w, h }));
      const big = (y: number, h: number) => ({ x: rect.x, y, w: rect.w, h });
      return layout === '1+3' ? [big(y1, h1), ...row(y2, h2)] : [...row(y1, h1), big(y2, h2)];
    }
    default: {
      const [cols, rows] = layout.split('x').map(Number);
      return matrix(cols, rows);
    }
  }
}
