/**
 * @file properties-panel.component.ts
 * @path src/app/apps/js-creator/admin/images/editor/panels/properties-panel.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Panel "Properties" of the editor:
 *   - for the selection: alignment (to the canvas for one layer, to each other for more),
 *     even spreading, order of the layers, duplicate, delete;
 *   - for one layer: name, anchor (keeps the place) and "move to the edge" with a margin, offset,
 *     size, rotation, opacity, hidden, locked;
 *   - by kind: text (field or fixed text with highlights, font, size, colour / gradient, lines,
 *     alignment, uppercase, shrinking and overflow, outline, shadow, label box, highlight style),
 *     image (source, fit, focus, corners / circle, border, shadow, overlay, mirror), grid
 *     (layout, gap, corners, cells and their sources), shape, icon, block instance (its block,
 *     scale - the size keeps the ratio of the block, edit the block, unpack);
 *   - "Block from the selection" (templates; the editor asks for the name and creates it).
 *   Every change is one step of the history (typing in one input = one step).
 * @usage `<app-jc-properties [store]="store" [curated]="families" [ownFonts]="fonts" [assets]="assets" (assetPicked)="…" />`
 * @dependencies EditorStore, the controls (colour, fill, anchor, source, choosers), render/document.ts,
 *   render/text-layout.ts, AdminLocalizationService (section `js-creator-editor`).
 */

import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, computed, inject, input, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { AdminLocalizationService } from '../../../../../../core/services/admin-localization.service';
import { EditorStore } from '../editor-store';
import {
  Anchor, Fill, GRID_LAYOUTS, GridLayer, GridLayout, ImageField, ImageSource, Layer, Shadow, TextField, TextLayer,
  fieldKeyFrom, gridCells,
} from '../../../shared/render/document';
import { anchorFractions } from '../../../shared/render/geometry';
import { BlockDef } from '../../../shared/render/block-fields';
import { BlockLayer } from '../../../shared/render/document';
import { plainText } from '../../../shared/render/text-layout';
import { CreatorAsset, CreatorFont, CuratedFontFamily, IconSet } from '../../../shared/js-creator.models';
import { CreatorIconComponent } from '../../../shared/creator-icon/creator-icon.component';
import { UiIconName, uiIcon } from '../../../shared/ui-icons';
import { ColorInputComponent } from '../controls/color-input.component';
import { FillEditorComponent } from '../controls/fill-editor.component';
import { AnchorPickerComponent } from '../controls/anchor-picker.component';
import { SourcePickerComponent } from '../controls/source-picker.component';
import { IconChooserComponent } from '../controls/icon-chooser.component';

/** Value of a select that asks for a new field. */
const NEW_FIELD = '__new__';

/** Default shadow when one is switched on. */
const DEFAULT_SHADOW: Shadow = { color: '#00000066', blur: 16, x: 0, y: 6 };

@Component({
  selector: 'app-jc-properties',
  standalone: true,
  imports: [NgTemplateOutlet, ColorInputComponent, FillEditorComponent, AnchorPickerComponent, SourcePickerComponent, IconChooserComponent, CreatorIconComponent],
  templateUrl: './properties-panel.component.html',
  styleUrls: ['../controls/controls.css', './panels.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PropertiesPanelComponent {
  private readonly i18n = inject(AdminLocalizationService);

  /** State of the editor. */
  readonly store = input.required<EditorStore>();
  /** Families of the curated font set. */
  readonly curated = input<CuratedFontFamily[]>([]);
  /** Own fonts of the account. */
  readonly ownFonts = input<CreatorFont[]>([]);
  /** Known library images (thumbnails of the sources). */
  readonly assets = input<ReadonlyMap<number, CreatorAsset>>(new Map());
  /** Icon set (preview of an icon layer). */
  readonly iconSet = input<IconSet | null>(null);
  /** A library image was chosen (the editor loads it). */
  readonly assetPicked = output<CreatorAsset>();
  /** Blocks of the instances (by id). */
  readonly blocks = input<ReadonlyMap<number, BlockDef>>(new Map());
  /** The selection may become a block (a template and the create permission). */
  readonly canMakeBlock = input(false);
  /** "Block from the selection" clicked. */
  readonly makeBlock = output<void>();
  /** "Edit the block" of an instance (block id). */
  readonly editBlock = output<number>();
  /** "Unpack" of an instance (layer id). */
  readonly unpack = output<string>();

  @ViewChild('textArea') private textArea?: ElementRef<HTMLTextAreaElement>;

  /** The icon popup is open. */
  readonly choosingIcon = signal(false);
  /** Margin of "move to the edge" (px). */
  readonly margin = signal(40);

  /** Value of "new field" in the selects. */
  readonly newField = NEW_FIELD;
  /** Grid layouts. */
  readonly layouts = Object.keys(GRID_LAYOUTS) as GridLayout[];

  /** The one selected layer. */
  readonly layer = computed(() => this.store().selectedLayer());
  /** The selected layer by its kind (typed for the template). */
  readonly textLayer = computed(() => { const l = this.layer(); return l?.type === 'text' ? l : null; });
  readonly imageLayer = computed(() => { const l = this.layer(); return l?.type === 'image' ? l : null; });
  readonly gridLayer = computed(() => { const l = this.layer(); return l?.type === 'grid' ? l : null; });
  readonly shapeLayer = computed(() => { const l = this.layer(); return l?.type === 'shape' ? l : null; });
  readonly iconLayer = computed(() => { const l = this.layer(); return l?.type === 'icon' ? l : null; });
  readonly blockLayer = computed(() => { const l = this.layer(); return l?.type === 'block' ? l : null; });
  /** The selection contains a block instance (it cannot become a block - blocks do not nest). */
  readonly selectionHasBlock = computed(() => this.store().selectedLayers().some(l => l.type === 'block'));
  /** Number of selected layers. */
  readonly count = computed(() => this.store().selection().length);
  /** Changes are disabled (read only, or the layer is locked - only the lock can change). */
  readonly readOnly = computed(() => !this.store().editable);
  /** Text fields of the template. */
  readonly textFields = computed(() => this.store().doc().fields.filter((f): f is TextField => f.type === 'text'));
  /** Image fields of the template. */
  readonly imageFields = computed(() => this.store().doc().fields.filter((f): f is ImageField => f.type === 'image'));
  /** Own font families with their faces. */
  readonly ownFamilies = computed(() => {
    const map = new Map<string, CreatorFont[]>();
    for (const font of this.ownFonts()) map.set(font.family, [...(map.get(font.family) ?? []), font]);
    return [...map.entries()].map(([family, faces]) => ({ family, faces }));
  });
  /** Names of the anchor points. */
  readonly anchorLabels = computed<Record<Anchor, string>>(() => ({
    tl: this.t('anchor_tl'), tc: this.t('anchor_tc'), tr: this.t('anchor_tr'), ml: this.t('anchor_ml'), mc: this.t('anchor_mc'),
    mr: this.t('anchor_mr'), bl: this.t('anchor_bl'), bc: this.t('anchor_bc'), br: this.t('anchor_br'),
  }));

  /**
   * @description Text of the editor.
   * @param key Key in `js-creator-editor`.
   */
  t(key: string): string {
    return this.i18n.getValue(`js-creator-editor.${key}`);
  }

  /**
   * @description Elements of an interface icon.
   * @param name Name.
   */
  icon(name: UiIconName) {
    return uiIcon(name);
  }

  /** @description Focuses the text of the selected text layer (double click on the canvas). */
  focusText(): void {
    setTimeout(() => this.textArea?.nativeElement.focus());
  }

  // ── changes ─────────────────────────────────────────────────────────────────

  /**
   * @description Changes a property of the selected layer.
   * @param prop Property.
   * @param value Value.
   */
  set(prop: string, value: unknown): void {
    const layer = this.layer();
    if (layer) this.store().updateLayer(layer.id, { [prop]: value } as Partial<Layer>, prop);
  }

  /**
   * @description Changes part of an object property (font, highlight, box, stroke, shadow).
   * @param prop Property.
   * @param patch Changed keys.
   */
  patch(prop: string, patch: Record<string, unknown>): void {
    const layer = this.layer() as unknown as Record<string, unknown> | null;
    if (!layer || !layer[prop]) return;
    this.set(prop, { ...(layer[prop] as object), ...patch });
  }

  /**
   * @description A number of an input (null when empty / invalid).
   * @param event Change / input event.
   */
  num(event: Event): number | null {
    const value = (event.target as HTMLInputElement).valueAsNumber;
    return Number.isFinite(value) ? value : null;
  }

  /**
   * @description Changes a number property within limits.
   * @param prop Property.
   * @param event Event of the input.
   * @param min Minimum.
   * @param max Maximum.
   * @param scale Factor of the shown value (e.g. 100 for %).
   */
  setNum(prop: string, event: Event, min: number, max: number, scale = 1): void {
    const value = this.num(event);
    if (value !== null) this.set(prop, Math.min(max, Math.max(min, value / scale)));
  }

  /**
   * @description Block of an instance.
   * @param layer Instance.
   */
  blockOf(layer: BlockLayer): BlockDef | undefined {
    return this.blocks().get(layer.blockId);
  }

  /**
   * @description Scale of an instance typed in % (5-2000).
   * @param layer Instance.
   * @param event Event of the input.
   */
  setScale(layer: BlockLayer, event: Event): void {
    const value = this.num(event);
    const block = this.blockOf(layer);
    if (value !== null && block) this.store().setScale(layer.id, value / 100, block);
  }

  /**
   * @description Width or height of an instance typed: the other side follows the ratio of the block.
   * @param layer Instance.
   * @param side w | h.
   * @param event Event of the input.
   */
  setInstanceSize(layer: BlockLayer, side: 'w' | 'h', event: Event): void {
    const value = this.num(event);
    const block = this.blockOf(layer);
    if (value !== null && value > 0 && block) this.store().setScale(layer.id, value / (side === 'w' ? block.width : block.height), block);
  }

  /**
   * @description Changes a number inside an object property.
   * @param prop Property.
   * @param key Key.
   * @param event Event of the input.
   * @param min Minimum.
   * @param max Maximum.
   */
  patchNum(prop: string, key: string, event: Event, min: number, max: number): void {
    const value = this.num(event);
    if (value !== null) this.patch(prop, { [key]: Math.min(max, Math.max(min, value)) });
  }

  /**
   * @description Switches an optional object property on (with its default) or off.
   * @param prop Property.
   * @param on On.
   * @param value Default value.
   */
  toggle(prop: string, on: boolean, value: unknown): void {
    this.set(prop, on ? value : null);
  }

  /** @description Default shadow. */
  get defaultShadow(): Shadow {
    return { ...DEFAULT_SHADOW };
  }

  /**
   * @description Changes the anchor keeping the place of the layer.
   * @param anchor Anchor.
   */
  setAnchor(anchor: Anchor): void {
    const layer = this.layer();
    if (layer) this.store().setAnchor(layer.id, anchor);
  }

  /**
   * @description Moves the layer to an edge / corner / the centre with the margin and pins it there.
   * @param anchor Point of the canvas.
   */
  placeAt(anchor: Anchor): void {
    const layer = this.layer();
    if (!layer) return;
    const { fx, fy } = anchorFractions(anchor);
    const m = this.margin();
    const along = (f: number) => (f === 0 ? m : f === 1 ? -m : 0);
    this.store().updateLayer(layer.id, { anchor, x: along(fx), y: along(fy) });
  }

  /**
   * @description New margin of "move to the edge".
   * @param event Input event.
   */
  setMargin(event: Event): void {
    const value = this.num(event);
    if (value !== null) this.margin.set(Math.max(0, Math.min(2000, Math.round(value))));
  }

  // ── text ────────────────────────────────────────────────────────────────────

  /**
   * @description Field of a text layer, if any.
   * @param layer Text layer.
   */
  fieldOf(layer: TextLayer): TextField | undefined {
    return this.textFields().find(f => f.key === layer.field);
  }

  /**
   * @description Text shown in the text box: the sample of the field or the fixed text.
   * @param layer Text layer.
   */
  textOf(layer: TextLayer): string {
    return layer.field ? this.fieldOf(layer)?.sample ?? '' : layer.text;
  }

  /**
   * @description Text typed: the sample of the field or the fixed text.
   * @param layer Text layer.
   * @param value Text.
   */
  setText(layer: TextLayer, value: string): void {
    const text = value.slice(0, 2000);
    if (layer.field) this.updateField(layer.field, { sample: text }, 'sample');
    else this.set('text', text);
  }

  /**
   * @description Wraps the selected part of the text in `**…**` (highlight).
   * @param layer Text layer.
   */
  highlightSelection(layer: TextLayer): void {
    const area = this.textArea?.nativeElement;
    if (!area) return;
    const { selectionStart: start, selectionEnd: end, value } = area;
    if (start === end) return;
    this.setText(layer, `${value.slice(0, start)}**${value.slice(start, end)}**${value.slice(end)}`);
    this.store().endStep();
  }

  /**
   * @description Field of a text layer chosen: fixed text, an existing field or a new one.
   * @param layer Text layer.
   * @param value '' (fixed text), a field key or NEW_FIELD.
   */
  setTextField(layer: TextLayer, value: string): void {
    if (!value) {
      const sample = this.fieldOf(layer)?.sample ?? layer.text;
      this.store().updateLayer(layer.id, { field: null, text: sample } as Partial<Layer>);
      return;
    }
    if (value !== NEW_FIELD) {
      this.store().updateLayer(layer.id, { field: value } as Partial<Layer>);
      return;
    }
    const label = (layer.name || plainText(layer.text).split('\n')[0] || this.t('default_text_field')).slice(0, 80);
    this.store().mutate(doc => {
      const key = fieldKeyFrom(label, new Set(doc.fields.map(f => f.key)));
      doc.fields.push({
        key, type: 'text', label, help: '', required: true, sample: layer.text, maxLength: Math.max(200, layer.text.length),
        multiline: layer.text.includes('\n'),
      });
      const target = this.store().pageOf(doc).layers.find(l => l.id === layer.id);
      if (target?.type === 'text') target.field = key;
    });
  }

  /**
   * @description Changes a field (label, sample …).
   * @param key Field.
   * @param patch Changed keys.
   * @param step Coalescing key.
   */
  updateField(key: string, patch: Partial<TextField> | Partial<ImageField>, step: string | null = null): void {
    this.store().mutate(doc => {
      const index = doc.fields.findIndex(f => f.key === key);
      if (index >= 0) doc.fields[index] = { ...doc.fields[index], ...patch } as TextField | ImageField;
    }, step ? `field:${key}:${step}` : null);
  }

  /**
   * @description Value of the font family select.
   * @param layer Text layer.
   */
  familyValue(layer: TextLayer): string {
    if (!layer.font.family.startsWith('user:')) return layer.font.family;
    const font = this.ownFonts().find(f => f.id === Number(layer.font.family.slice(5)));
    return font ? `own:${font.family}` : layer.font.family;
  }

  /**
   * @description Font family chosen: a curated family (closest weight) or an own family (closest face).
   * @param layer Text layer.
   * @param value `set:<slug>` or `own:<family>`.
   */
  setFamily(layer: TextLayer, value: string): void {
    const closest = <T extends { weight: number }>(items: T[]) => [...items].sort((a, b) => Math.abs(a.weight - layer.font.weight) - Math.abs(b.weight - layer.font.weight))[0];
    if (value.startsWith('set:')) {
      const family = this.curated().find(f => f.slug === value.slice(4));
      const face = family ? closest(family.faces) : undefined;
      this.set('font', { family: value, weight: face?.weight ?? 400, style: face?.style ?? 'normal' });
    } else if (value.startsWith('own:')) {
      const face = closest(this.ownFonts().filter(f => f.family === value.slice(4)));
      if (face) this.set('font', { family: `user:${face.id}`, weight: face.weight, style: face.style });
    }
  }

  /**
   * @description Faces of the family of a text layer (value + label).
   * @param layer Text layer.
   */
  faces(layer: TextLayer): { value: string; label: string }[] {
    const name = (weight: number, style: string) => `${weight}${style === 'italic' ? ' ' + this.t('italic') : ''}`;
    if (layer.font.family.startsWith('user:')) {
      const own = this.ownFonts().find(f => f.id === Number(layer.font.family.slice(5)));
      return this.ownFonts().filter(f => f.family === own?.family).map(f => ({ value: `user:${f.id}`, label: name(f.weight, f.style) }));
    }
    const family = this.curated().find(f => f.slug === layer.font.family.slice(4));
    return (family?.faces ?? []).map(f => ({ value: `${f.weight}|${f.style}`, label: name(f.weight, f.style) }));
  }

  /**
   * @description Value of the face select.
   * @param layer Text layer.
   */
  faceValue(layer: TextLayer): string {
    return layer.font.family.startsWith('user:') ? layer.font.family : `${layer.font.weight}|${layer.font.style}`;
  }

  /**
   * @description Face chosen.
   * @param layer Text layer.
   * @param value `user:<id>` or `<weight>|<style>`.
   */
  setFace(layer: TextLayer, value: string): void {
    if (value.startsWith('user:')) {
      const face = this.ownFonts().find(f => f.id === Number(value.slice(5)));
      if (face) this.set('font', { family: value, weight: face.weight, style: face.style });
    } else {
      const [weight, style] = value.split('|');
      this.set('font', { ...layer.font, weight: Number(weight), style: style === 'italic' ? 'italic' : 'normal' });
    }
  }

  // ── images ──────────────────────────────────────────────────────────────────

  /**
   * @description Library image of a source (for its thumbnail).
   * @param source Source.
   */
  assetOf(source: ImageSource): CreatorAsset | undefined {
    return source.kind === 'asset' ? this.assets().get(source.assetId) : undefined;
  }

  /**
   * @description New image field (label from the layer) used by a source of the selected layer.
   * @param apply Puts the key into the layer copy.
   * @param label Label of the field.
   */
  newImageField(apply: (layer: Layer, key: string) => void, label?: string): void {
    const layer = this.layer();
    if (!layer) return;
    const text = (label ?? (layer.name || this.t('default_image_field'))).slice(0, 80);
    this.store().mutate(doc => {
      const key = fieldKeyFrom(text, new Set(doc.fields.map(f => f.key)));
      doc.fields.push({ key, type: 'image', label: text, help: '', required: true, minWidth: 0, minHeight: 0 });
      const target = this.store().pageOf(doc).layers.find(l => l.id === layer.id);
      if (target) apply(target, key);
    });
  }

  /**
   * @description New image field for an image layer.
   */
  newImageLayerField(): void {
    this.newImageField((layer, key) => {
      if (layer.type === 'image') layer.source = { kind: 'field', field: key };
    });
  }

  /**
   * @description New image field for one cell of a grid.
   * @param index Cell.
   */
  newCellField(index: number): void {
    const layer = this.layer();
    const base = layer?.name || this.t('default_image_field');
    this.newImageField((target, key) => {
      if (target.type === 'grid' && target.cells[index]) target.cells[index].source = { kind: 'field', field: key };
    }, `${base} ${index + 1}`);
  }

  /**
   * @description Every cell of a grid becomes its own new image field.
   * @param layer Grid layer.
   */
  cellsAsFields(layer: GridLayer): void {
    const base = (layer.name || this.t('default_image_field')).slice(0, 70);
    this.store().mutate(doc => {
      const target = this.store().pageOf(doc).layers.find(l => l.id === layer.id);
      if (target?.type !== 'grid') return;
      target.cells.forEach((cell, i) => {
        if (doc.fields.length >= 50) return;
        const label = `${base} ${i + 1}`;
        const key = fieldKeyFrom(label, new Set(doc.fields.map(f => f.key)));
        doc.fields.push({ key, type: 'image', label, help: '', required: true, minWidth: 0, minHeight: 0 });
        cell.source = { kind: 'field', field: key };
      });
    });
  }

  /**
   * @description Changes one cell of a grid.
   * @param layer Grid layer.
   * @param index Cell.
   * @param patch Source / focus.
   */
  setCell(layer: GridLayer, index: number, patch: Partial<GridLayer['cells'][number]>): void {
    this.set('cells', layer.cells.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  /**
   * @description New layout of a grid (cells kept in their order).
   * @param layer Grid layer.
   * @param layout Layout.
   */
  setLayout(layer: GridLayer, layout: GridLayout): void {
    this.store().updateLayer(layer.id, { layout, cells: gridCells(layout, layer.cells) } as Partial<Layer>);
  }

  /**
   * @description New icon of an icon layer.
   * @param name Icon.
   */
  setIcon(name: string): void {
    this.choosingIcon.set(false);
    this.set('icon', name);
  }

  /**
   * @description Elements of the icon of a layer (preview).
   * @param name Icon.
   */
  iconNodes(name: string) {
    return this.iconSet()?.icons[name] ?? [];
  }

  /**
   * @description Number shown in an input (rounded).
   * @param value Number.
   * @param digits Decimals.
   */
  show(value: number, digits = 0): number {
    const f = 10 ** digits;
    return Math.round(value * f) / f;
  }

  /**
   * @description Fill of a nullable property changed.
   * @param prop Property.
   * @param fill Fill or null.
   */
  setFill(prop: string, fill: Fill | null): void {
    this.set(prop, fill);
  }
}
