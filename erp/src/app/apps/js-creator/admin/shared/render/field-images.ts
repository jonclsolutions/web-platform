/**
 * @file field-images.ts
 * @path src/app/apps/js-creator/admin/shared/render/field-images.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Places of an image field in a template (background, image layers, cells of grids)
 *   and the crop of its image chosen when generating: the starting crop, moving the image in
 *   its box by dragging (also in rotated and mirrored boxes), zooming, finding the place under
 *   the pointer and how much of the image a place needs (resolution warning, the size the photo
 *   is decoded at for the output).
 * @usage `const boxes = fieldImageBoxes(doc, size, 'photo'); crop = panCrop(crop, boxes[0], image, dx, dy)`.
 * @dependencies document.ts, geometry.ts, paint.ts (fitScale), renderer.ts (ImageCrop).
 */

import { CanvasSize, ImageFit, TemplateDocument } from './document';
import { Point, Rect, gridCellRects, layerRect, toLocal } from './geometry';
import { fitScale } from './paint';
import { ImageCrop } from './renderer';

/** Smallest / largest zoom of a crop. */
export const CROP_ZOOM = { min: 1, max: 4 } as const;

/** One place of an image field. */
export interface FieldImageBox {
  /** Box of the image (template px, before rotation). */
  rect: Rect;
  /** Box of the layer the image belongs to - the rotation turns around its centre. */
  frame: Rect;
  /** Rotation of the layer (degrees). */
  rotation: number;
  fit: ImageFit;
  /** Focus of the template. */
  focusX: number;
  focusY: number;
  flipX: boolean;
}

/** Natural size of an image. */
export interface ImageSize {
  width: number;
  height: number;
}

/**
 * @description Every visible place of an image field on a page, in drawing order (background first).
 * @param doc Document.
 * @param size Size of the template.
 * @param key Key of the field.
 * @param page Index of the page.
 * @returns Places.
 */
export function fieldImageBoxes(doc: TemplateDocument, size: CanvasSize, key: string, page = 0): FieldImageBox[] {
  const current = doc.pages[page];
  if (!current) return [];
  const boxes: FieldImageBox[] = [];
  const canvas: Rect = { x: 0, y: 0, w: size.width, h: size.height };
  const bg = current.background.image;
  if (bg && bg.source.kind === 'field' && bg.source.field === key) {
    boxes.push({ rect: canvas, frame: canvas, rotation: 0, fit: bg.fit, focusX: bg.focusX, focusY: bg.focusY, flipX: false });
  }
  for (const layer of current.layers) {
    if (layer.hidden) continue;
    const frame = layerRect(layer, size);
    if (layer.type === 'image' && layer.source.kind === 'field' && layer.source.field === key) {
      boxes.push({ rect: frame, frame, rotation: layer.rotation, fit: layer.fit, focusX: layer.focusX, focusY: layer.focusY, flipX: layer.flipX });
    } else if (layer.type === 'grid') {
      gridCellRects(layer.layout, frame, layer.gap).forEach((rect, i) => {
        const cell = layer.cells[i];
        if (cell && cell.source.kind === 'field' && cell.source.field === key) {
          boxes.push({ rect, frame, rotation: layer.rotation, fit: layer.fit, focusX: cell.focusX, focusY: cell.focusY, flipX: false });
        }
      });
    }
  }
  return boxes;
}

/**
 * @description Starting crop of a field: the focus of its first place, no zoom.
 * @param boxes Places of the field.
 * @returns Crop.
 */
export function defaultCrop(boxes: readonly FieldImageBox[]): ImageCrop {
  const first = boxes[0];
  return { focusX: first?.focusX ?? 0.5, focusY: first?.focusY ?? 0.5, zoom: 1 };
}

/**
 * @description Whether a point lies in a place (rotation of its layer included).
 * @param box Place.
 * @param point Template px.
 */
export function boxContains(box: FieldImageBox, point: Point): boolean {
  const local = toLocal(point, box.frame, box.rotation);
  return local.x >= box.rect.x && local.x <= box.rect.x + box.rect.w && local.y >= box.rect.y && local.y <= box.rect.y + box.rect.h;
}

/**
 * @description Moves the image in a place by a drag: the image follows the pointer (the focus
 *   changes), never further than its edges allow.
 * @param crop Current crop.
 * @param box Place being dragged.
 * @param image Natural size of the image.
 * @param dx Drag on the canvas (template px).
 * @param dy Drag on the canvas (template px).
 * @returns New crop.
 */
export function panCrop(crop: ImageCrop, box: FieldImageBox, image: ImageSize, dx: number, dy: number): ImageCrop {
  if (!image.width || !image.height) return crop;
  // The drag in the axes of the (rotated) box.
  const rad = (-box.rotation * Math.PI) / 180;
  let lx = dx * Math.cos(rad) - dy * Math.sin(rad);
  const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
  if (box.flipX) lx = -lx;
  const scale = fitScale(box.fit, box.rect, image.width, image.height, crop.zoom);
  const spareX = box.rect.w - image.width * scale;
  const spareY = box.rect.h - image.height * scale;
  return {
    ...crop,
    focusX: Math.abs(spareX) > 0.5 ? clamp01(crop.focusX + lx / spareX) : crop.focusX,
    focusY: Math.abs(spareY) > 0.5 ? clamp01(crop.focusY + ly / spareY) : crop.focusY,
  };
}

/**
 * @description Crop with another zoom (kept within CROP_ZOOM).
 * @param crop Current crop.
 * @param zoom Wanted zoom.
 * @returns New crop.
 */
export function zoomCrop(crop: ImageCrop, zoom: number): ImageCrop {
  return { ...crop, zoom: Math.round(Math.min(CROP_ZOOM.max, Math.max(CROP_ZOOM.min, zoom)) * 100) / 100 };
}

/**
 * @description How many image px the largest place needs per px of the image: above 1 the image
 *   is enlarged in the output (may look blurry), below 1 it is reduced.
 * @param boxes Places of the field.
 * @param image Natural size of the image.
 * @param zoom Zoom of the crop.
 * @returns Largest scale (0 without places).
 */
export function requiredScale(boxes: readonly FieldImageBox[], image: ImageSize, zoom: number): number {
  if (!image.width || !image.height) return 0;
  return boxes.reduce((max, box) => Math.max(max, fitScale(box.fit, box.rect, image.width, image.height, zoom)), 0);
}

/**
 * @description Clamps a number to 0-1.
 * @param value Number.
 */
function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
