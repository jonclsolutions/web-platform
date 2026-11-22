/**
 * @file resource-store.ts
 * @path src/app/apps/js-creator/admin/shared/render/resource-store.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Resources of the renderer in one page (editor, generating): library images
 *   loaded from their signed URLs (same origin - the canvas never gets tainted), the fonts of the
 *   texts (registered through FontLibraryService under `jsc-…` names, loaded with the characters
 *   they need) and the icon set. When something finishes loading, `onChange` asks the page to
 *   draw again. Before an output is drawn, generating waits for the images (assetsReady()) and
 *   checks that every font really loaded (missingFonts()) - a fallback font must never get into
 *   an output.
 * @usage `const store = new RenderResourceStore(fontLibrary, () => redraw()); store.loadAsset(id, url);
 *   await store.ensureFonts(doc, ownFonts, curated)`.
 * @dependencies FontLibraryService, document.ts, renderer.ts (RenderResources).
 */

import { FontLibraryService } from '../font-library.service';
import { CreatorFont, CuratedFontFamily, IconNode, IconSet } from '../js-creator.models';
import { DrawableImage } from './paint';
import { RenderResources } from './renderer';
import { TemplateDocument, TextLayer } from './document';

/** Characters loaded for every font (Czech letters), so a preview never waits for a subset. */
const FONT_SAMPLE = 'AaBbĚěŠšČčŘřŽžÝýÁáÍíÉéŮůÚúŇňŤťĎď0123456789';

export class RenderResourceStore implements RenderResources {
  /** Loaded images (null = failed). */
  private readonly images = new Map<number, DrawableImage | null>();
  /** Images being loaded (resolve when finished, also on failure). */
  private readonly loading = new Map<number, Promise<void>>();
  /** Icons of the set. */
  private icons: Record<string, IconNode[]> = {};

  /**
   * @param fonts Font library (registration of faces, family names).
   * @param onChange Called when an image or font finished loading.
   */
  constructor(private readonly fonts: FontLibraryService, private readonly onChange: () => void) {}

  /** @description Uses an icon set. */
  setIcons(set: IconSet): void {
    this.icons = set.icons;
    this.onChange();
  }

  /** @description See RenderResources.asset(). */
  asset(id: number): DrawableImage | undefined {
    return this.images.get(id) ?? undefined;
  }

  /**
   * @description Whether an image failed to load.
   * @param id Library image.
   */
  failed(id: number): boolean {
    return this.images.get(id) === null;
  }

  /** @description See RenderResources.fontFamily(). */
  fontFamily(ref: string): string {
    return ref.startsWith('user:') ? this.fonts.ownName(Number(ref.slice(5))) : this.fonts.curatedName(ref.replace(/^set:/, ''));
  }

  /** @description See RenderResources.icon(). */
  icon(name: string): IconNode[] | undefined {
    return this.icons[name];
  }

  /**
   * @description Loads a library image once (signed relative URL of the API).
   * @param id Library image.
   * @param url Its URL.
   */
  loadAsset(id: number, url: string): void {
    if (this.images.has(id) || this.loading.has(id)) return;
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    const done = image.decode().then(
      () => { this.images.set(id, { image, width: image.naturalWidth, height: image.naturalHeight }); },
      () => { this.images.set(id, null); },
    ).finally(() => {
      this.loading.delete(id);
      this.onChange();
    });
    this.loading.set(id, done);
  }

  /**
   * @description Waits until the library images finished loading.
   * @param ids Library images (each must have been asked for by loadAsset()).
   * @returns Ids that are not available (failed or never asked for).
   */
  async assetsReady(ids: readonly number[]): Promise<number[]> {
    await Promise.all(ids.map(id => this.loading.get(id) ?? Promise.resolve()));
    return ids.filter(id => !this.images.get(id));
  }

  /**
   * @description Fonts of the texts that are NOT ready for an output: a family without a
   *   registered face, a face that failed, or characters of the texts whose face is not loaded.
   * @param doc Document.
   * @param texts Values of the text fields.
   * @returns Font references (`set:<slug>` / `user:<id>`) that would fall back to another font.
   */
  missingFonts(doc: TemplateDocument, texts: readonly string[]): string[] {
    if (typeof document === 'undefined' || !document.fonts) return [];
    const faces: FontFace[] = [];
    document.fonts.forEach(face => faces.push(face));
    const missing = new Set<string>();
    for (const layer of doc.pages.flatMap(p => p.layers)) {
      if (layer.type !== 'text' || layer.hidden) continue;
      const family = this.fontFamily(layer.font.family);
      const own = faces.filter(face => face.family.replace(/^["']|["']$/g, '') === family);
      const text = (layer.field ? texts.join('') : layer.text) || 'A';
      const font = `${layer.font.style} ${layer.font.weight} 16px "${family}"`;
      if (!own.length || own.every(face => face.status === 'error') || !document.fonts.check(font, text)) {
        missing.add(layer.font.family);
      }
    }
    return [...missing];
  }

  /**
   * @description Registers and loads every font face the texts of a document use (with the
   *   characters of the texts), then asks for a new drawing.
   * @param doc Document.
   * @param own Own fonts of the account.
   * @param curated Families of the curated set.
   * @param texts Extra texts to load characters for (values of fields).
   * @returns Resolves when the faces are loaded (or failed).
   */
  async ensureFonts(doc: TemplateDocument, own: readonly CreatorFont[], curated: readonly CuratedFontFamily[], texts: string[] = []): Promise<void> {
    if (typeof document === 'undefined' || !document.fonts) return;
    const layers = doc.pages.flatMap(p => p.layers).filter((l): l is TextLayer => l.type === 'text');
    const loads: Promise<unknown>[] = [];
    for (const layer of layers) {
      const ref = layer.font.family;
      if (ref.startsWith('user:')) {
        const font = own.find(f => f.id === Number(ref.slice(5)));
        if (font) this.fonts.registerOwn(font);
      } else {
        const family = curated.find(f => f.slug === ref.slice(4));
        if (family) this.fonts.registerCurated(family);
      }
      const sample = FONT_SAMPLE + layer.text + texts.join('') + doc.fields.map(f => f.type === 'text' ? f.sample : '').join('');
      const family = this.fontFamily(ref);
      for (const weight of new Set([layer.font.weight, Math.max(700, layer.font.weight)])) {
        loads.push(document.fonts.load(`${layer.font.style} ${weight} 16px "${family}"`, sample).catch(() => []));
      }
    }
    await Promise.all(loads);
    this.onChange();
  }
}
