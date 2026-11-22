/**
 * @file paint.ts
 * @path src/app/apps/js-creator/admin/shared/render/paint.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Canvas helpers of the renderer: fills (colour, linear gradient with a CSS-like
 *   angle, radial gradient), paths of rounded boxes and ellipses, shadows (also "only the
 *   shadow" of a box under an image), drawing of an image with cover / contain, a focus point and
 *   an extra zoom.
 * @dependencies document.ts (Fill, Shadow), geometry.ts (Rect).
 */

import { Fill, Shadow } from './document';
import { Rect } from './geometry';

/** Anything the canvas can draw with its natural size. */
export interface DrawableImage {
  image: CanvasImageSource;
  width: number;
  height: number;
}

/** Distance of the shape that casts "only the shadow" (outside any canvas). */
const SHADOW_SHIFT = 100_000;

/**
 * @description Canvas style of a fill over a box.
 * @param ctx Context.
 * @param fill Fill.
 * @param rect Box the gradient spans.
 */
export function fillStyle(ctx: CanvasRenderingContext2D, fill: Fill, rect: Rect): string | CanvasGradient {
  if (fill.type === 'solid') return fill.color;
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  let gradient: CanvasGradient;
  if (fill.type === 'linear') {
    // 0° = to the top, 90° = to the right (like CSS linear-gradient).
    const rad = (fill.angle * Math.PI) / 180;
    const dx = Math.sin(rad);
    const dy = -Math.cos(rad);
    const half = (Math.abs(rect.w * dx) + Math.abs(rect.h * dy)) / 2;
    gradient = ctx.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half);
  } else {
    gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, Math.hypot(rect.w, rect.h) / 2));
  }
  for (const stop of [...fill.stops].sort((a, b) => a.offset - b.offset)) {
    gradient.addColorStop(Math.min(1, Math.max(0, stop.offset)), stop.color);
  }
  return gradient;
}

/**
 * @description Adds the path of a box with rounded corners.
 * @param ctx Context.
 * @param rect Box.
 * @param radius Corner radius (limited to half of the shorter side).
 */
export function roundRectPath(ctx: CanvasRenderingContext2D, rect: Rect, radius: number): void {
  const r = Math.max(0, Math.min(radius, Math.abs(rect.w) / 2, Math.abs(rect.h) / 2));
  const { x, y, w, h } = rect;
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/**
 * @description Adds the path of an ellipse inside a box.
 * @param ctx Context.
 * @param rect Box.
 */
export function ellipsePath(ctx: CanvasRenderingContext2D, rect: Rect): void {
  ctx.ellipse(rect.x + rect.w / 2, rect.y + rect.h / 2, Math.abs(rect.w) / 2, Math.abs(rect.h) / 2, 0, 0, Math.PI * 2);
}

/**
 * @description Sets (or clears) the shadow of the next drawing. Canvas shadows ignore the
 *   transform, so blur and offset are scaled by the zoom of the context (the same look in the
 *   editor and in the output); the offset keeps the axes of the canvas, also for a rotated layer.
 * @param ctx Context.
 * @param shadow Shadow or null.
 * @param shift Extra offset in device pixels (see castShadow).
 */
export function applyShadow(ctx: CanvasRenderingContext2D, shadow: Shadow | null, shift: { x: number; y: number } = { x: 0, y: 0 }): void {
  const t = ctx.getTransform();
  const scale = Math.hypot(t.a, t.b) || 1;
  ctx.shadowColor = shadow ? shadow.color : 'transparent';
  ctx.shadowBlur = shadow ? shadow.blur * scale : 0;
  ctx.shadowOffsetX = shadow ? shadow.x * scale + shift.x : 0;
  ctx.shadowOffsetY = shadow ? shadow.y * scale + shift.y : 0;
}

/**
 * @description Draws only the shadow of a path: the path is drawn far outside the canvas and its
 *   shadow is shifted back (the shadow of a box under an image that may be transparent).
 * @param ctx Context.
 * @param shadow Shadow.
 * @param path Adds the path of the box.
 */
export function castShadow(ctx: CanvasRenderingContext2D, shadow: Shadow, path: () => void): void {
  ctx.save();
  const t = ctx.getTransform();
  // translate(-SHIFT, 0) moves the path by (-SHIFT·a, -SHIFT·b) device pixels; the shadow moves it back.
  applyShadow(ctx, shadow, { x: SHADOW_SHIFT * t.a, y: SHADOW_SHIFT * t.b });
  ctx.translate(-SHADOW_SHIFT, 0);
  ctx.beginPath();
  path();
  ctx.fillStyle = '#000000';
  ctx.fill();
  ctx.restore();
}

/**
 * @description Scale of an image in a box (template px per image px): `cover` fills the box,
 *   `contain` shows the whole image; `zoom` (≥ 1) enlarges it further.
 * @param fit cover | contain.
 * @param rect Box.
 * @param iw Width of the image.
 * @param ih Height of the image.
 * @param zoom Extra enlargement (1 = none).
 * @returns Scale.
 */
export function fitScale(fit: 'cover' | 'contain', rect: Rect, iw: number, ih: number, zoom = 1): number {
  const base = fit === 'cover' ? Math.max(rect.w / iw, rect.h / ih) : Math.min(rect.w / iw, rect.h / ih);
  return base * Math.max(1, zoom);
}

/**
 * @description Draws an image into a box: `cover` fills it (cropped around the focus point),
 *   `contain` shows the whole image (placed by the focus point); `zoom` enlarges the image
 *   around the focus point (the crop chosen when generating).
 * @param ctx Context (clipped by the caller).
 * @param drawable Image.
 * @param rect Box.
 * @param fit cover | contain.
 * @param focusX Focus 0-1.
 * @param focusY Focus 0-1.
 * @param flipX Mirror horizontally.
 * @param zoom Extra enlargement (1 = none).
 */
export function drawImageFit(
  ctx: CanvasRenderingContext2D, drawable: DrawableImage, rect: Rect, fit: 'cover' | 'contain', focusX: number, focusY: number, flipX = false, zoom = 1,
): void {
  const { image, width: iw, height: ih } = drawable;
  if (!iw || !ih || rect.w <= 0 || rect.h <= 0) return;
  ctx.save();
  if (flipX) {
    ctx.translate(rect.x * 2 + rect.w, 0);
    ctx.scale(-1, 1);
  }
  const scale = fitScale(fit, rect, iw, ih, zoom);
  if (fit === 'cover') {
    const sw = rect.w / scale;
    const sh = rect.h / scale;
    ctx.drawImage(image, (iw - sw) * focusX, (ih - sh) * focusY, sw, sh, rect.x, rect.y, rect.w, rect.h);
  } else {
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.drawImage(image, 0, 0, iw, ih, rect.x + (rect.w - dw) * focusX, rect.y + (rect.h - dh) * focusY, dw, dh);
  }
  ctx.restore();
}
