/**
 * @file block-fields.ts
 * @path src/app/apps/js-creator/admin/shared/render/block-fields.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Blocks seen from a template: the resolver of the blocks of its instances, the
 *   fields of the form (the fields of the template, then the fields of every instance - a taken
 *   key gets `_2`, `_3` …, its label the name of the instance), the keys of one instance, the
 *   box of an instance (the current size of its block × scale) and the document with the layers
 *   of its blocks (fonts and images to load).
 * @usage `const fields = effectiveFields(doc, id => blocks.get(id)); instanceKeys(fields, layer.id).get('price')`.
 * @note The API has the same rules for the keys (api/app/Apps/JsCreator/Support/EffectiveFields.php -
 *   sets check the kinds of the fields with them). Change both places together.
 * @dependencies document.ts.
 */

import { BlockLayer, Field, Layer, TemplateDocument } from './document';

/** A block as the renderer and the editor need it. */
export interface BlockDef {
  id: number;
  name: string;
  width: number;
  height: number;
  document: TemplateDocument;
}

/** Finds a block of an instance (undefined = not loaded / missing). */
export type BlockResolver = (id: number) => BlockDef | undefined;

/** Where a field of the form comes from: an instance of a block. */
export interface FieldOrigin {
  /** Layer of the instance in the template. */
  layerId: string;
  blockId: number;
  /** Key of the field in the block. */
  key: string;
}

/** Field of the form of a template (its own, or of a block instance). */
export type EffectiveField = Field & { origin: FieldOrigin | null };

/** Longest field key. */
const MAX_KEY = 40;

/**
 * @description The key itself when it is free, otherwise the key with the first free `_<n>` (n ≥ 2)
 *   within 40 characters.
 * @param key Key.
 * @param taken Keys already used.
 */
export function freeFieldKey(key: string, taken: ReadonlySet<string>): string {
  if (!taken.has(key)) return key;
  for (let i = 2; ; i++) {
    const suffix = `_${i}`;
    const candidate = key.slice(0, MAX_KEY - suffix.length) + suffix;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * @description Fields of the form of a template: its fields, then the fields of its block
 *   instances (pages in their order, layers from the bottom). A key already taken gets `_2` … and
 *   the label the name of the instance (its layer name, otherwise the block name - numbered
 *   when the block has more instances). A missing block is skipped.
 * @param doc Document of the template.
 * @param resolve Blocks of the instances.
 */
export function effectiveFields(doc: TemplateDocument, resolve?: BlockResolver): EffectiveField[] {
  const fields: EffectiveField[] = doc.fields.map(f => ({ ...f, origin: null }));
  const instances = doc.pages.flatMap(p => p.layers).filter((l): l is BlockLayer => l.type === 'block');
  if (!instances.length || !resolve) return fields;
  const taken = new Set(fields.map(f => f.key));
  const counts = new Map<number, number>();
  for (const layer of instances) counts.set(layer.blockId, (counts.get(layer.blockId) ?? 0) + 1);
  const seen = new Map<number, number>();
  for (const layer of instances) {
    const block = resolve(layer.blockId);
    if (!block) continue;
    const order = (seen.get(layer.blockId) ?? 0) + 1;
    seen.set(layer.blockId, order);
    const instanceName = layer.name || ((counts.get(layer.blockId) ?? 1) > 1 ? `${block.name} ${order}` : block.name);
    for (const field of block.document.fields) {
      const key = freeFieldKey(field.key, taken);
      taken.add(key);
      fields.push({
        ...field, key, label: key === field.key ? field.label : `${field.label} (${instanceName})`,
        origin: { layerId: layer.id, blockId: layer.blockId, key: field.key },
      });
    }
  }
  return fields;
}

/**
 * @description Keys of the fields of one instance: key in the block → key of the form.
 * @param fields Effective fields of the template.
 * @param layerId Layer of the instance.
 */
export function instanceKeys(fields: readonly EffectiveField[], layerId: string): Map<string, string> {
  const keys = new Map<string, string>();
  for (const field of fields) if (field.origin?.layerId === layerId) keys.set(field.origin.key, field.key);
  return keys;
}

/**
 * @description An instance with the box of its block: w, h = current size of the block × scale.
 * @param layer Instance.
 * @param block Its block (undefined = the box as stored).
 */
export function instanceLayer(layer: BlockLayer, block: Pick<BlockDef, 'width' | 'height'> | undefined): BlockLayer {
  return block ? { ...layer, w: block.width * layer.scale, h: block.height * layer.scale } : layer;
}

/**
 * @description The document with the layers and fields of its blocks added (only to find the
 *   fonts, images and icons to load - never drawn or saved).
 * @param doc Document of a template.
 * @param resolve Blocks of the instances.
 */
export function resourceDocument(doc: TemplateDocument, resolve?: BlockResolver): TemplateDocument {
  if (!resolve) return doc;
  const blocks = new Map<number, BlockDef>();
  for (const page of doc.pages) {
    for (const layer of page.layers) {
      const block = layer.type === 'block' ? resolve(layer.blockId) : undefined;
      if (block) blocks.set(block.id, block);
    }
  }
  if (!blocks.size) return doc;
  const extra: Layer[] = [];
  const fields: Field[] = [...doc.fields];
  const backgrounds = [...blocks.values()].flatMap(b => b.document.pages.map(p => p.background.image?.source));
  for (const block of blocks.values()) {
    for (const page of block.document.pages) extra.push(...page.layers);
    fields.push(...block.document.fields);
  }
  // Background images of blocks as image layers, so documentReferences() finds their library images.
  for (const source of backgrounds) {
    if (source?.kind === 'asset') {
      extra.push({
        id: '', name: '', type: 'image', anchor: 'tl', x: 0, y: 0, w: 1, h: 1, rotation: 0, opacity: 1, hidden: true, locked: false,
        source, fit: 'cover', focusX: 0.5, focusY: 0.5, radius: 0, mask: 'none', border: null, shadow: null, overlay: null, flipX: false,
      });
    }
  }
  return { ...doc, fields, pages: doc.pages.map((page, i) => (i === 0 ? { ...page, layers: [...page.layers, ...extra] } : page)) };
}
