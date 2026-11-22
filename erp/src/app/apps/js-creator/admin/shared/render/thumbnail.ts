/**
 * @file thumbnail.ts
 * @path src/app/apps/js-creator/admin/shared/render/thumbnail.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Thumbnail of a template or a block for the lists: the document drawn as in the
 *   editor (samples, placeholders of empty images) at a scale whose longer side is `edge` px,
 *   encoded as WebP (the API re-encodes it).
 * @usage `const blob = await renderThumbnail(doc, { width: 1080, height: 1350 }, resources)`.
 * @dependencies renderer.ts.
 */

import { CanvasSize, TemplateDocument } from './document';
import { RenderResources, renderPage } from './renderer';

/**
 * @description Draws a thumbnail.
 * @param doc Document.
 * @param size Size of the template / block.
 * @param resources Images, fonts, icons, blocks (loaded).
 * @param edge Longest side (px).
 * @returns WebP (or PNG where the browser cannot encode WebP); null without a 2D context.
 */
export async function renderThumbnail(doc: TemplateDocument, size: CanvasSize, resources: RenderResources, edge = 480): Promise<Blob | null> {
  const scale = Math.min(1, edge / Math.max(size.width, size.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(size.width * scale));
  canvas.height = Math.max(1, Math.round(size.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  renderPage(ctx, doc, size, resources, { mode: 'editor' });
  return new Promise(resolve => canvas.toBlob(blob => resolve(blob), 'image/webp', 0.85));
}
