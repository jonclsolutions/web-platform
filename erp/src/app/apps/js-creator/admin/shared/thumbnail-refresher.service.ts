/**
 * @file thumbnail-refresher.service.ts
 * @path src/app/apps/js-creator/admin/shared/thumbnail-refresher.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Draws the thumbnails of templates again after a block they use changed (the API
 *   marks them `thumb_stale`) and the first thumbnails of imported templates and blocks: one
 *   item after another - its document with its blocks, the images, fonts and icons it needs -
 *   drawn as in the editor and uploaded. Started by the editor of a block after a save, by the
 *   lists of templates and blocks for stale thumbnails and by the sets after an import; an item
 *   already being drawn is not drawn twice. A failure keeps the old thumbnail (the item stays
 *   stale and the list tries again later).
 * @usage `await refresher.refresh('images', [3, 7], (id, url) => …)`; blocks:
 *   `refresh('images', [2], done, 'block')`.
 * @dependencies TemplatesApiService, BlocksApiService, JsCreatorApiService (fonts), FontLibraryService, IconSetService,
 *   RenderResourceStore, render/thumbnail.ts, block-fields.ts.
 */

import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TemplatesApiService } from './templates-api.service';
import { BlocksApiService } from './blocks-api.service';
import { JsCreatorApiService } from './js-creator-api.service';
import { FontLibraryService } from './font-library.service';
import { IconSetService } from './icon-set.service';
import { JsCreatorSectionId } from './js-creator-sections';
import { CreatorFont, CuratedFontFamily, IconSet } from './js-creator.models';
import { RenderResourceStore } from './render/resource-store';
import { documentReferences } from './render/document';
import { renderThumbnail } from './render/thumbnail';

/** Fonts and icons shared by the drawings of one run. */
interface Shared {
  fonts: CreatorFont[];
  curated: CuratedFontFamily[];
  icons: IconSet;
}

@Injectable({ providedIn: 'root' })
export class ThumbnailRefresherService {
  private readonly templates = inject(TemplatesApiService);
  private readonly blocks = inject(BlocksApiService);
  private readonly creatorApi = inject(JsCreatorApiService);
  private readonly fontLibrary = inject(FontLibraryService);
  private readonly iconSets = inject(IconSetService);

  /** Items being drawn now (`template:<id>` / `block:<id>`). */
  private readonly running = new Set<string>();

  /**
   * @description Draws and uploads the thumbnails of templates (or blocks), one after another.
   * @param section Section of the items.
   * @param ids Templates / blocks.
   * @param done Called with the new URL of each uploaded thumbnail.
   * @param kind template (default) | block.
   * @returns Number of uploaded thumbnails.
   */
  async refresh(
    section: JsCreatorSectionId, ids: readonly number[], done?: (id: number, thumbUrl: string) => void, kind: 'template' | 'block' = 'template',
  ): Promise<number> {
    const key = (id: number) => `${kind}:${id}`;
    const todo = [...new Set(ids)].filter(id => !this.running.has(key(id)));
    if (!todo.length || typeof document === 'undefined') return 0;
    todo.forEach(id => this.running.add(key(id)));
    let count = 0;
    try {
      const shared: Shared = {
        fonts: await firstValueFrom(this.creatorApi.fonts()),
        curated: await firstValueFrom(this.fontLibrary.curatedFamilies()),
        icons: await firstValueFrom(this.iconSets.iconSet()),
      };
      for (const id of todo) {
        const url = await this.one(section, id, shared, kind).catch(() => null);
        this.running.delete(key(id));
        if (url) {
          count++;
          done?.(id, url);
        }
      }
    } catch {
      // Fonts / icons not available: the thumbnails stay stale and are tried again later.
    } finally {
      todo.forEach(id => this.running.delete(key(id)));
    }
    return count;
  }

  /**
   * @description Draws and uploads the thumbnail of one template / block.
   * @param section Section.
   * @param id Template / block.
   * @param shared Fonts and icons.
   * @param kind template | block.
   * @returns URL of the new thumbnail, or null when something was missing.
   */
  private async one(section: JsCreatorSectionId, id: number, shared: Shared, kind: 'template' | 'block'): Promise<string | null> {
    const api = kind === 'block' ? this.blocks : this.templates;
    const template = await firstValueFrom(api.getQuietly(section, id));
    const resources = new RenderResourceStore(this.fontLibrary, () => undefined);
    resources.setIcons(shared.icons);
    resources.setBlocks(template.blocks ?? []);
    const doc = resources.withBlocks(template.document);
    const assets = documentReferences(doc).assets;
    if (assets.length) {
      const page = await firstValueFrom(this.templates.assetsByIds(assets));
      for (const asset of page.data) resources.loadAsset(asset.id, asset.url);
    }
    await resources.ensureFonts(template.document, shared.fonts, shared.curated);
    if ((await resources.assetsReady(assets)).length) return null;
    const blob = await renderThumbnail(template.document, template, resources);
    if (!blob) return null;
    const result = await firstValueFrom(api.uploadThumbnail(section, id, blob, true));
    return result.thumb_url;
  }
}
