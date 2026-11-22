/**
 * @file safe-zones.spec.ts
 * @path src/app/apps/js-creator/admin/shared/render/safe-zones.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the safe zones of social networks: networks of a size, zones scaled
 *   to the size, the 3:4 crop of the Instagram grid, layers reaching into the zones (backgrounds
 *   and hidden layers skipped) and the choice remembered in the browser.
 * @dependencies safe-zones.ts, document.ts.
 */

import { createLayer } from './document';
import { rememberNetwork, rememberedNetwork, safeNetworks, safeZoneHits, safeZones } from './safe-zones';

describe('safe zones', () => {
  afterEach(() => localStorage.removeItem('jsc-safe-zone'));

  /**
   * @description Networks of a size and their zones.
   * @input 1080 × 1920; 720 × 1280; 1080 × 1350; 1080 × 1080; 1200 × 630
   * @output 5 vertical networks + grid; TikTok top 160, bottom 480, side 150 × 840 at y 600; scaled
   *   ×2/3 for 720 × 1280; 4:5 grid crops 33.75 px sides; square 135 px; 9:16 grid 240 px bands; landscape none
   */
  it('lists networks and their zones', () => {
    expect(safeNetworks({ width: 1080, height: 1920 })).toEqual(['tiktok', 'ig-reels', 'ig-story', 'yt-shorts', 'fb-reels', 'ig-grid']);
    expect(safeNetworks({ width: 1080, height: 1350 })).toEqual(['ig-grid']);
    expect(safeNetworks({ width: 1200, height: 630 })).toEqual([]);
    expect(safeZones('tiktok', { width: 1080, height: 1920 })).toEqual([
      { part: 'top', x: 0, y: 0, w: 1080, h: 160 },
      { part: 'bottom', x: 0, y: 1440, w: 1080, h: 480 },
      { part: 'side', x: 930, y: 600, w: 150, h: 840 },
    ]);
    expect(safeZones('ig-story', { width: 720, height: 1280 })).toEqual([
      { part: 'top', x: 0, y: 0, w: 720, h: 167 },
      { part: 'bottom', x: 0, y: 1053, w: 720, h: 227 },
    ]);
    expect(safeZones('ig-grid', { width: 1080, height: 1350 })[0]).toEqual({ part: 'crop', x: 0, y: 0, w: 33.75, h: 1350 });
    expect(safeZones('ig-grid', { width: 1080, height: 1080 })[1]).toEqual({ part: 'crop', x: 945, y: 0, w: 135, h: 1080 });
    expect(safeZones('ig-grid', { width: 1080, height: 1920 })[0]).toEqual({ part: 'crop', x: 0, y: 0, w: 1080, h: 240 });
    expect(safeZones('tiktok', { width: 1080, height: 1350 })).toEqual([]);
  });

  /**
   * @description Layers in the zones: a title at the top, a logo under the buttons, a text in the
   *   middle (free), a full background and a hidden layer (skipped).
   * @input TikTok 1080 × 1920
   * @output hits title (top) and logo (side)
   */
  it('finds layers reaching into the zones', () => {
    const size = { width: 1080, height: 1920 };
    const title = { ...createLayer('text', size, 'title'), anchor: 'tl' as const, name: 'Title', x: 40, y: 40, w: 600, h: 200 };
    const logo = { ...createLayer('image', size, 'logo'), anchor: 'tl' as const, name: 'Logo', x: 960, y: 700, w: 100, h: 100 };
    const middle = { ...createLayer('text', size, 'mid'), anchor: 'tl' as const, x: 100, y: 800, w: 600, h: 200 };
    const background = { ...createLayer('shape', size, 'bg'), anchor: 'tl' as const, x: 0, y: 0, w: 1080, h: 1920 };
    const hidden = { ...createLayer('icon', size, 'hid'), anchor: 'tl' as const, x: 0, y: 0, w: 50, h: 50, hidden: true };
    const hits = safeZoneHits([background, title, logo, middle, hidden], size, safeZones('tiktok', size));
    expect(hits.map(h => [h.layerId, h.part])).toEqual([['title', 'top'], ['logo', 'side']]);
  });

  /**
   * @description The chosen guide is remembered; "none" switches it off; a network without a
   *   guide for the size is not used.
   * @input nothing stored (9:16 / 4:5); ig-reels stored; none stored; ig-reels for 4:5
   * @output tiktok / null; ig-reels; null; null
   */
  it('remembers the chosen guide', () => {
    expect(rememberedNetwork({ width: 1080, height: 1920 })).toBe('tiktok');
    expect(rememberedNetwork({ width: 1080, height: 1350 })).toBeNull();
    rememberNetwork('ig-reels');
    expect(rememberedNetwork({ width: 1080, height: 1920 })).toBe('ig-reels');
    expect(rememberedNetwork({ width: 1080, height: 1350 })).toBeNull();
    rememberNetwork(null);
    expect(rememberedNetwork({ width: 1080, height: 1920 })).toBeNull();
  });
});
