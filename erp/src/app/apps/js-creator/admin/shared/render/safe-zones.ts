/**
 * @file safe-zones.ts
 * @path src/app/apps/js-creator/admin/shared/render/safe-zones.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Safe zones of social networks - the parts of a post the app covers with its own
 *   interface (top bar, caption and controls at the bottom, buttons on the right) or crops away
 *   (the 3:4 preview of the profile grid of Instagram). Only a guide: the apps change their
 *   layout, so the zones are rounded values measured on 1080 × 1920 and scaled to the size of
 *   the template. The editor and the preview of generating draw them over the canvas and list the
 *   layers that reach into them (a warning - generating is not stopped).
 * @usage `const zones = safeZones('tiktok', size); safeZoneHits(doc.pages[0].layers, size, zones)`.
 * @dependencies document.ts (types), geometry.ts.
 */

import { CanvasSize, Layer } from './document';
import { Rect, boundingBox, layerRect } from './geometry';

/** Key of the remembered guide in localStorage. */
const STORAGE_KEY = 'jsc-safe-zone';

/** Networks with a guide. */
export type SafeNetwork = 'tiktok' | 'ig-reels' | 'ig-story' | 'yt-shorts' | 'fb-reels' | 'ig-grid';

/** Networks of vertical (9:16) videos and stories, in the order of the menu. */
export const VERTICAL_NETWORKS: readonly SafeNetwork[] = ['tiktok', 'ig-reels', 'ig-story', 'yt-shorts', 'fb-reels'];

/** Part of a zone (its label). */
export type SafeZonePart = 'top' | 'bottom' | 'side' | 'crop';

/** A covered or cropped part of the canvas (template px). */
export interface SafeZone extends Rect {
  part: SafeZonePart;
}

/** A layer reaching into a zone. */
export interface SafeZoneHit {
  layerId: string;
  name: string;
  type: Layer['type'];
  part: SafeZonePart;
}

/** Zones of the vertical networks on 1080 × 1920: top bar, bottom (caption, controls), buttons on the right. */
const VERTICAL: Record<Exclude<SafeNetwork, 'ig-grid'>, { top: number; bottom: number; side?: { width: number; from: number; to: number } }> = {
  'tiktok': { top: 160, bottom: 480, side: { width: 150, from: 600, to: 1440 } },
  'ig-reels': { top: 220, bottom: 420, side: { width: 130, from: 900, to: 1500 } },
  'ig-story': { top: 250, bottom: 340 },
  'yt-shorts': { top: 150, bottom: 460, side: { width: 160, from: 820, to: 1480 } },
  'fb-reels': { top: 220, bottom: 480, side: { width: 140, from: 860, to: 1460 } },
};

/** A layer bigger than this part of the canvas is a background (a full photo / shape) and not reported. */
const BACKGROUND_SHARE = 0.6;

/**
 * @description Whether a size is vertical 9:16 (stories, reels, TikTok).
 * @param size Size.
 */
export function isVertical(size: CanvasSize): boolean {
  return Math.abs(size.width / size.height - 9 / 16) < 0.01;
}

/**
 * @description Networks that have a guide for a size: vertical networks for 9:16, the profile
 *   grid of Instagram for every portrait or square size.
 * @param size Size.
 */
export function safeNetworks(size: CanvasSize): SafeNetwork[] {
  const networks: SafeNetwork[] = isVertical(size) ? [...VERTICAL_NETWORKS] : [];
  if (size.height >= size.width) networks.push('ig-grid');
  return networks;
}

/**
 * @description Zones of a network for a size (an empty list when it has no guide for it).
 * @param network Network.
 * @param size Size of the template.
 */
export function safeZones(network: SafeNetwork, size: CanvasSize): SafeZone[] {
  const { width: w, height: h } = size;
  if (network === 'ig-grid') {
    if (h < w) return [];
    // The grid shows the middle of the post in 3:4.
    if (w / h > 3 / 4) {
      const side = (w - h * 0.75) / 2;
      return side > 0.5 ? [{ part: 'crop', x: 0, y: 0, w: side, h }, { part: 'crop', x: w - side, y: 0, w: side, h }] : [];
    }
    const band = (h - w * (4 / 3)) / 2;
    return band > 0.5 ? [{ part: 'crop', x: 0, y: 0, w, h: band }, { part: 'crop', x: 0, y: h - band, w, h: band }] : [];
  }
  if (!isVertical(size)) return [];
  const def = VERTICAL[network];
  const sx = w / 1080;
  const sy = h / 1920;
  const zones: SafeZone[] = [
    { part: 'top', x: 0, y: 0, w, h: Math.round(def.top * sy) },
    { part: 'bottom', x: 0, y: h - Math.round(def.bottom * sy), w, h: Math.round(def.bottom * sy) },
  ];
  if (def.side) {
    const sw = Math.round(def.side.width * sx);
    zones.push({ part: 'side', x: w - sw, y: Math.round(def.side.from * sy), w: sw, h: Math.round((def.side.to - def.side.from) * sy) });
  }
  return zones;
}

/**
 * @description Visible layers of a page that reach into the zones (their box, rotation
 *   included); layers covering most of the canvas (backgrounds) are skipped. One hit per layer
 *   (the first zone it reaches).
 * @param layers Layers of the page.
 * @param size Size of the template.
 * @param zones Zones.
 */
export function safeZoneHits(layers: readonly Layer[], size: CanvasSize, zones: readonly SafeZone[]): SafeZoneHit[] {
  if (!zones.length) return [];
  const canvas = size.width * size.height;
  const hits: SafeZoneHit[] = [];
  for (const layer of layers) {
    if (layer.hidden) continue;
    const box = boundingBox(layerRect(layer, size), layer.rotation);
    if (box.w * box.h > canvas * BACKGROUND_SHARE) continue;
    const zone = zones.find(z => overlap(box, z) > 1);
    if (zone) hits.push({ layerId: layer.id, name: layer.name, type: layer.type, part: zone.part });
  }
  return hits;
}

/**
 * @description Area shared by two rectangles.
 * @param a Rectangle.
 * @param b Rectangle.
 */
function overlap(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * @description Network of the guide remembered in this browser (a preference of the user, not
 *   of the template).
 * @param size Size of the template (a network without a guide for it is not used).
 * @returns The network, or null (no guide).
 */
export function rememberedNetwork(size: CanvasSize): SafeNetwork | null {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (stored === 'none') return null;
  const networks = safeNetworks(size);
  if (stored && networks.includes(stored as SafeNetwork)) return stored as SafeNetwork;
  // Default: the first vertical network for 9:16, nothing else.
  return isVertical(size) ? networks[0] : null;
}

/**
 * @description Remembers the chosen guide in this browser.
 * @param network Network, or null (no guide).
 */
export function rememberNetwork(network: SafeNetwork | null): void {
  try {
    localStorage.setItem(STORAGE_KEY, network ?? 'none');
  } catch {
    // Storage not available (private mode) - the choice lasts only for the page.
  }
}
