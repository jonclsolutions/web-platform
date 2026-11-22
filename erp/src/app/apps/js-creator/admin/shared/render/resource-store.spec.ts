/**
 * @file resource-store.spec.ts
 * @path src/app/apps/js-creator/admin/shared/render/resource-store.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the readiness checks of RenderResourceStore before an output is
 *   drawn: library images that finished loading (failed or never asked = not ready) and fonts
 *   that really loaded (an unregistered family or a failed face would fall back to another font),
 *   characters the fonts do not have (outside the unicode-range of their faces).
 * @dependencies RenderResourceStore, document.ts, the FontFace API of the test browser.
 */

import { FontLibraryService } from '../font-library.service';
import { RenderResourceStore, parseUnicodeRange } from './resource-store';
import { CanvasSize, TemplateDocument, TextLayer, createLayer, emptyDocument } from './document';

/** Size of the test canvas. */
const SIZE: CanvasSize = { width: 400, height: 200 };

/** Font library double: only the registered family names. */
const fonts = {
  ownName: (id: number) => `jsc-test-user-${id}`,
  curatedName: (slug: string) => `jsc-test-${slug}`,
  registerOwn: () => undefined,
  registerCurated: () => undefined,
} as unknown as FontLibraryService;

/** A 1 × 1 PNG. */
const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

/**
 * @description Document with one text layer.
 * @param family Font reference.
 * @param overrides Changes of the layer.
 */
function docWithText(family: string, overrides: Partial<TextLayer> = {}): TemplateDocument {
  const doc = emptyDocument();
  const layer = createLayer('text', SIZE, 't1') as TextLayer;
  doc.pages[0].layers = [{ ...layer, text: 'Žluťoučký', font: { family, weight: 400, style: 'normal' }, ...overrides }];
  return doc;
}

describe('RenderResourceStore readiness', () => {
  const added: FontFace[] = [];

  afterEach(() => {
    added.forEach(face => document.fonts.delete(face));
    added.length = 0;
  });

  /**
   * @description assetsReady() waits for the images and names those that are not available.
   * @input image 1 = valid PNG, image 2 = broken URL, image 3 never asked for
   * @output [2, 3]; image 1 drawable 1 × 1
   */
  it('waits for library images', async () => {
    const store = new RenderResourceStore(fonts, () => undefined);
    store.loadAsset(1, PIXEL);
    store.loadAsset(2, 'data:image/png;base64,broken');
    expect(await store.assetsReady([1, 2, 3])).toEqual([2, 3]);
    expect(store.asset(1)?.width).toBe(1);
    expect(store.failed(2)).toBeTrue();
  });

  /**
   * @description A font is ready only when its family is registered and its face loaded; a
   *   family without a face or with a failed face is missing; hidden texts do not count.
   * @input set:inter loaded from the app assets; user:7 not registered; user:8 with a broken
   *   source; hidden text with user:9
   * @output [] for set:inter; ['user:7']; ['user:8']; [] for the hidden text
   */
  it('checks that fonts really loaded', async () => {
    const store = new RenderResourceStore(fonts, () => undefined);
    const inter = new FontFace('jsc-test-inter', 'url("/assets/apps/js-creator/admin/assets/fonts/inter/inter-latin-400-normal.woff2")', { weight: '400' });
    const interExt = new FontFace('jsc-test-inter', 'url("/assets/apps/js-creator/admin/assets/fonts/inter/inter-latin-ext-400-normal.woff2")', {
      weight: '400', unicodeRange: 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF',
    });
    const broken = new FontFace('jsc-test-user-8', 'url("data:font/woff2;base64,AAAA")');
    [inter, interExt, broken].forEach(face => {
      document.fonts.add(face);
      added.push(face);
    });
    await Promise.all([inter.load(), interExt.load(), broken.load().catch(() => undefined)]);

    expect(store.missingFonts(docWithText('set:inter'), [])).toEqual([]);
    expect(store.missingFonts(docWithText('user:7'), [])).toEqual(['user:7']);
    expect(store.missingFonts(docWithText('user:8'), [])).toEqual(['user:8']);
    expect(store.missingFonts(docWithText('user:9', { hidden: true }), [])).toEqual([]);
  });

  /**
   * @description Characters outside the unicode-range of every face of their font are reported
   *   (they would be drawn with another font); a field layer checks the value of its field,
   *   highlight markers and spaces do not count; an own font (no range) covers everything.
   * @input set:inter with faces latin (U+0000-00FF) and latin-ext (U+0100-017F); fixed text
   *   "Žluť → ok"; field "title" = "**Akce** 😀 ok"; user:5 face without a range with "→"
   * @output ['→']; ['😀']; []; parseUnicodeRange of "U+0041, U+4??, U+0100-017F"
   */
  it('finds characters the fonts do not have', () => {
    const store = new RenderResourceStore(fonts, () => undefined);
    const latin = new FontFace('jsc-test-inter', 'url("/nowhere.woff2")', { weight: '400', unicodeRange: 'U+0000-00FF' });
    const latinExt = new FontFace('jsc-test-inter', 'url("/nowhere.woff2")', { weight: '400', unicodeRange: 'U+0100-017F' });
    const own = new FontFace('jsc-test-user-5', 'url("/nowhere.woff2")');
    [latin, latinExt, own].forEach(face => {
      document.fonts.add(face);
      added.push(face);
    });

    expect(store.unsupportedCharacters(docWithText('set:inter', { text: 'Žluť → ok' }), {})).toEqual(['→']);
    const field = docWithText('set:inter', { field: 'title' });
    expect(store.unsupportedCharacters(field, { title: '**Akce** 😀 ok' })).toEqual(['😀']);
    expect(store.unsupportedCharacters(docWithText('user:5', { text: '→' }), {})).toEqual([]);
    expect(parseUnicodeRange('U+0041, U+4??, U+0100-017F')).toEqual([[0x41, 0x41], [0x400, 0x4ff], [0x100, 0x17f]]);
  });
});
