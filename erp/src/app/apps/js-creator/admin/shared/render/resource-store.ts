/**
 * @file resource-store.ts
 * @path src/app/apps/js-creator/admin/shared/render/resource-store.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Resources of the renderer in one page (editor, later generating): library images
 *   loaded from their signed URLs (same origin - the canvas never gets tainted), the fonts of the
 *   texts (registered through FontLibraryService under `jsc-…` names, loaded with the characters
 *   they need) and the icon set. When something finishes loading, `onChange` asks the page to
 *   draw again.
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
  /** Images being loaded. */
  private readonly loading = new Set<number>();
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
    this.loading.add(id);
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    image.decode().then(
      () => this.images.set(id, { image, width: image.naturalWidth, height: image.naturalHeight }),
      () => this.images.set(id, null),
    ).finally(() => {
      this.loading.delete(id);
      this.onChange();
    });
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
