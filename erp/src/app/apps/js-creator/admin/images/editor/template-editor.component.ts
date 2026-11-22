/**
 * @file template-editor.component.ts
 * @path src/app/apps/js-creator/admin/images/editor/template-editor.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Page "Template editor" of the section Images (`image-templates/:id/edit`) - and the
 *   same editor for a block (`image-blocks/:id/edit`, route data `kind: 'block'`):
 *   - loads the template / block, the own fonts, the curated font set, the icon set, the blocks
 *     of its instances and the library images they use; fonts are loaded with the characters of
 *     the texts before drawing;
 *   - top bar: back, name, undo / redo, zoom (fit, 100 %, ±), grid with snapping, smart guides,
 *     safe zone, state of the save, Save and Generate (templates - opens generating);
 *   - left: adding layers (text, image, grid, shape, icon; a template also a block instance) and
 *     the layers; middle: the canvas; right: Properties, Fields, Template;
 *   - blocks (templates): insert a block, scale an instance, open its block, unpack it, make a
 *     block of the selection (asks for its name, creates it, replaces the layers by an instance);
 *     a saved block draws the thumbnails of the templates using it again (in the background);
 *   - keyboard: Ctrl+S save, Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y, Ctrl+C / Ctrl+V / Ctrl+D, Ctrl+A,
 *     Delete, arrows (Shift = 10 px), Escape, Space + drag = pan;
 *   - save: version check (409 → offer to load the current state), invalid document (422 → the
 *     reasons), then a thumbnail of the template is uploaded; leaving with unsaved changes asks.
 *   The editor is made for screens of 1024 px and more; a smaller screen shows a message.
 *   Without the update permission the template is shown read only.
 * @dependencies TemplatesApiService, BlocksApiService, JsCreatorApiService (fonts), FontLibraryService,
 *   IconSetService, ThumbnailRefresherService, EditorStore, RenderResourceStore, block-fields.ts,
 *   block-instances.ts, EditorCanvasComponent, the panels, BlockChooserComponent,
 *   AdminModalComponent, ConfirmDialogService, AlertDialogService, PermissionService,
 *   AdminLocalizationService (section `js-creator-editor`).
 */

import {
  ChangeDetectionStrategy, Component, DestroyRef, HostListener, OnInit, ViewChild, computed, effect, inject, signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, forkJoin } from 'rxjs';
import { AdminLocalizationService } from '../../../../../core/services/admin-localization.service';
import { AlertDialogService } from '../../../../../core/services/alert-dialog.service';
import { ConfirmDialogService } from '../../../../../core/services/confirm-dialog.service';
import { PermissionService } from '../../../../../core/auth/services/permission.service';
import { TemplatesApiService } from '../../shared/templates-api.service';
import { BlocksApiService } from '../../shared/blocks-api.service';
import { ThumbnailRefresherService } from '../../shared/thumbnail-refresher.service';
import { AdminModalComponent } from '../../../../../admin/components/admin-modal/admin-modal.component';
import { JsCreatorApiService } from '../../shared/js-creator-api.service';
import { FontLibraryService } from '../../shared/font-library.service';
import { IconSetService } from '../../shared/icon-set.service';
import { WorkspaceUsageService } from '../../shared/workspace-usage.service';
import { CreatorAsset, CreatorBlock, CreatorBlockDetail, CreatorFont, CreatorTemplateDetail, CuratedFontFamily, IconSet } from '../../shared/js-creator.models';
import { JsCreatorSectionId, sectionPermission } from '../../shared/js-creator-sections';
import { DOCUMENT_LIMITS, PlainLayerType, documentBytes, documentReferences, safeZoneOf } from '../../shared/render/document';
import { BlockDef, effectiveFields } from '../../shared/render/block-fields';
import { blockFromSelection } from '../../shared/render/block-instances';
import { renderThumbnail } from '../../shared/render/thumbnail';
import { RenderReport } from '../../shared/render/renderer';
import { RenderResourceStore } from '../../shared/render/resource-store';
import { CreatorIconComponent } from '../../shared/creator-icon/creator-icon.component';
import { UiIconName, uiIcon } from '../../shared/ui-icons';
import { EditorKind, EditorStore, blockAsTemplate } from './editor-store';
import { EditorCanvasComponent, ZOOM_MAX, ZOOM_MIN } from './editor-canvas/editor-canvas.component';
import { LayersPanelComponent } from './panels/layers-panel.component';
import { PropertiesPanelComponent } from './panels/properties-panel.component';
import { FieldsPanelComponent } from './panels/fields-panel.component';
import { TemplatePanelComponent } from './panels/template-panel.component';
import { LeavablePage } from './unsaved-template.guard';
import { BlockChooserComponent } from './controls/block-chooser.component';

/** Tabs of the right panel. */
type PanelTab = 'properties' | 'fields' | 'template';

/** Grid sizes offered (0 = off). */
const GRID_SIZES = [0, 5, 10, 20, 40, 60];

/** Narrowest screen of the editor (px). */
const MIN_WIDTH = 1024;

@Component({
  selector: 'app-js-creator-template-editor',
  standalone: true,
  imports: [
    CreatorIconComponent, EditorCanvasComponent, LayersPanelComponent, PropertiesPanelComponent, FieldsPanelComponent, TemplatePanelComponent,
    BlockChooserComponent, AdminModalComponent,
  ],
  templateUrl: './template-editor.component.html',
  styleUrls: ['../../../../../admin/shared-styles/modal.css', './controls/controls.css', './panels/panels.css', './template-editor.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplateEditorComponent implements OnInit, LeavablePage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(TemplatesApiService);
  private readonly blocksApi = inject(BlocksApiService);
  private readonly refresher = inject(ThumbnailRefresherService);
  private readonly creatorApi = inject(JsCreatorApiService);
  private readonly fontLibrary = inject(FontLibraryService);
  private readonly iconSets = inject(IconSetService);
  private readonly usage = inject(WorkspaceUsageService);
  private readonly i18n = inject(AdminLocalizationService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly alert = inject(AlertDialogService);
  private readonly permissions = inject(PermissionService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild(EditorCanvasComponent) private canvas?: EditorCanvasComponent;
  @ViewChild(PropertiesPanelComponent) private properties?: PropertiesPanelComponent;

  /** Section of the editor. */
  readonly section: JsCreatorSectionId = 'images';
  /** A template or a block (route data `kind`). */
  readonly kind: EditorKind = this.route.snapshot.data?.['kind'] === 'block' ? 'block' : 'template';
  /** May save. */
  readonly canUpdate = this.permissions.hasPermission(sectionPermission(this.section, 'update'));
  /** May create blocks ("block from the selection" in a template). */
  readonly canCreate = this.permissions.hasPermission(sectionPermission(this.section, 'create'));

  /** State of the opened template (null while loading). */
  readonly store = signal<EditorStore | null>(null);
  /** Resources of the renderer. */
  readonly resources = new RenderResourceStore(this.fontLibrary, () => this.redraw.update(v => v + 1));
  /** Changes when a resource finished loading. */
  readonly redraw = signal(0);
  /** Curated font families. */
  readonly curated = signal<CuratedFontFamily[]>([]);
  /** Own fonts. */
  readonly ownFonts = signal<CreatorFont[]>([]);
  /** Icon set. */
  readonly iconSet = signal<IconSet | null>(null);
  /** Known library images (by id). */
  readonly assets = signal<ReadonlyMap<number, CreatorAsset>>(new Map());
  /** The template could not be loaded. */
  readonly failed = signal(false);
  /** Blocks of the instances (by id, with their documents). */
  readonly blocks = signal<ReadonlyMap<number, BlockDef>>(new Map());
  /** The block chooser is open. */
  readonly choosingBlock = signal(false);
  /** Name typed for "block from the selection" (null = the popup is closed). */
  readonly blockName = signal<string | null>(null);
  /** A block is being created / loaded. */
  readonly blockBusy = signal(false);

  /** Zoom of the canvas. */
  readonly zoom = signal(1);
  /** Grid size (0 = off). */
  readonly grid = signal(0);
  /** Smart guides on. */
  readonly guides = signal(true);
  /** Safe zone shown. */
  readonly safeZone = signal(true);
  /** Space held (pan). */
  readonly panMode = signal(false);
  /** Tab of the right panel. */
  readonly tab = signal<PanelTab>('properties');
  /** A save runs. */
  readonly saving = signal(false);
  /** Time of the last save. */
  readonly savedAt = signal<Date | null>(null);
  /** Report of the last drawing. */
  readonly report = signal<RenderReport>({ overflows: [], missing: [] });
  /** The screen is wide enough. */
  readonly wide = signal(typeof window === 'undefined' || window.innerWidth >= MIN_WIDTH);

  /** Grid sizes offered. */
  readonly gridSizes = GRID_SIZES;
  /** The size has a safe zone. */
  readonly hasSafeZone = computed(() => { const s = this.store(); return !!s && !!safeZoneOf(s.size()); });
  /** Fields of the generating form (block instance fields included). */
  readonly formFields = computed(() => {
    const store = this.store();
    const blocks = this.blocks();
    return store ? effectiveFields(store.doc(), id => blocks.get(id)) : [];
  });
  /** Names of the texts that overflow (with the mode). */
  readonly overflows = computed(() => {
    const store = this.store();
    if (!store) return [];
    return this.report().overflows.map(o => {
      const layer = store.layers().find(l => l.id === o.layerId);
      return { id: o.layerId, name: layer?.name || (o.field ? store.doc().fields.find(f => f.key === o.field)?.label : '') || this.t('type_text'), block: o.mode === 'block' };
    });
  });
  /** Missing library images (deleted or not loadable). */
  readonly missingImages = computed(() => {
    this.redraw();
    return this.report().missing.filter(m => m.startsWith('asset:') && this.resources.failed(Number(m.slice(6)))).length;
  });
  /** Zoom in %. */
  readonly zoomPercent = computed(() => Math.round(this.zoom() * 100));

  /** Signature of the fonts and characters in use (loads fonts when it changes). */
  private fontKey = '';

  constructor() {
    effect(() => {
      const store = this.store();
      if (!store) return;
      this.blocks();
      const doc = this.resources.withBlocks(store.doc());
      const texts = doc.pages[0].layers.map(l => (l.type === 'text' ? l.text + l.font.family + l.font.weight + l.font.style : '')).join('')
        + doc.fields.map(f => (f.type === 'text' ? f.sample : '')).join('');
      const key = [...new Set(Array.from(texts))].sort().join('');
      if (key === this.fontKey) return;
      this.fontKey = key;
      void this.resources.ensureFonts(store.doc(), this.ownFonts(), this.curated());
    });
    if (typeof document !== 'undefined' && document.fonts) {
      const done = () => this.redraw.update(v => v + 1);
      document.fonts.addEventListener('loadingdone', done);
      this.destroyRef.onDestroy(() => document.fonts.removeEventListener('loadingdone', done));
    }
  }

  /** @description Loads the template / block and everything it needs. */
  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    forkJoin({
      template: this.kind === 'block' ? this.blocksApi.block(this.section, id) : this.api.get(this.section, id),
      fonts: this.creatorApi.fonts(),
      curated: this.fontLibrary.curatedFamilies(),
      icons: this.iconSets.iconSet(),
    }).subscribe({
      next: ({ template, fonts, curated, icons }) => {
        this.curated.set(curated);
        this.ownFonts.set(fonts);
        this.iconSet.set(icons);
        this.resources.setIcons(icons);
        const detail = this.kind === 'block' ? blockAsTemplate(template as CreatorBlockDetail) : template as CreatorTemplateDetail;
        const store = new EditorStore(detail, this.canUpdate, this.kind);
        this.addBlocks((template as CreatorTemplateDetail).blocks ?? []);
        store.syncInstances(blockId => this.blocks().get(blockId));
        this.store.set(store);
        this.safeZone.set(!!safeZoneOf(store.size()));
        this.loadAssets(documentReferences(this.resources.withBlocks(detail.document)).assets);
        setTimeout(() => this.fit());
      },
      error: () => this.failed.set(true),
    });
  }

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

  // ── leaving ─────────────────────────────────────────────────────────────────

  /** @description See LeavablePage - unsaved changes ask first. */
  canLeave(): boolean | Promise<boolean> {
    const store = this.store();
    return !store?.dirty() || this.confirm.open(this.t('leave_title'), this.t('leave_text'), { confirm: this.t('leave_confirm'), cancel: this.t('stay') });
  }

  /**
   * @description Closing / reloading the tab with unsaved changes asks the browser's question.
   * @param event Before-unload event.
   */
  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.store()?.dirty()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  /** @description The window changed its width (editor needs 1024 px). */
  @HostListener('window:resize')
  onResize(): void {
    this.wide.set(window.innerWidth >= MIN_WIDTH);
  }

  // ── keyboard ────────────────────────────────────────────────────────────────

  /**
   * @description Shortcuts of the editor (not while typing into an input - except Ctrl+S).
   * @param event Key event.
   */
  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    const store = this.store();
    if (!store || !this.wide() || document.querySelector('.am-backdrop, app-admin-modal')) return;
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (mod && key === 's') {
      event.preventDefault();
      void this.save();
      return;
    }
    if (this.typing(event.target)) return;
    const handled = (() => {
      if (mod && key === 'z') { if (event.shiftKey) store.redo(); else store.undo(); return true; }
      if (mod && key === 'y') { store.redo(); return true; }
      if (mod && key === 'c') { store.copySelected(); return true; }
      if (mod && key === 'x') { store.copySelected(); store.removeSelected(); return true; }
      if (mod && key === 'v') { this.paste(store); return true; }
      if (mod && key === 'd') { store.duplicateSelected(); return true; }
      if (mod && key === 'a') { store.selectAll(); return true; }
      if (key === 'delete' || key === 'backspace') { store.removeSelected(); return true; }
      if (key === 'escape') { store.select([]); return true; }
      const step = event.shiftKey ? 10 : 1;
      const moves: Record<string, [number, number]> = { arrowleft: [-step, 0], arrowright: [step, 0], arrowup: [0, -step], arrowdown: [0, step] };
      if (moves[key]) { store.nudge(...moves[key]); return true; }
      if (key === ' ' && (event.target as HTMLElement | null)?.tagName !== 'BUTTON') { this.panMode.set(true); return true; }
      return false;
    })();
    if (handled) event.preventDefault();
  }

  /**
   * @description Space released: pan mode ends.
   * @param event Key event.
   */
  @HostListener('document:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent): void {
    if (event.key === ' ') this.panMode.set(false);
    if (event.key.startsWith('Arrow')) this.store()?.endStep();
  }

  // ── toolbar ─────────────────────────────────────────────────────────────────

  /**
   * @description Adds a layer of a kind (centred, selected) and shows its properties.
   * @param type Kind.
   */
  add(type: PlainLayerType): void {
    const store = this.store();
    if (!store?.editable) return;
    if (store.layers().length >= DOCUMENT_LIMITS.maxLayers) {
      this.alert.open(this.t('limit_title'), this.t('limit_layers'), 'warning');
      return;
    }
    store.addLayer(type);
    this.tab.set('properties');
  }

  /**
   * @description Pastes the clipboard; a block tells that block instances were left out.
   * @param store Editor.
   */
  private paste(store: EditorStore): void {
    if (store.paste() > 0) this.alert.open(this.t('paste_title'), this.t('paste_no_blocks'), 'info');
  }

  // ── blocks ──────────────────────────────────────────────────────────────────

  /** @description Opens the block chooser (templates). */
  openBlockChooser(): void {
    const store = this.store();
    if (!store?.editable || this.kind !== 'template') return;
    if (store.layers().length >= DOCUMENT_LIMITS.maxLayers) {
      this.alert.open(this.t('limit_title'), this.t('limit_layers'), 'warning');
      return;
    }
    this.choosingBlock.set(true);
  }

  /**
   * @description A block was chosen: loads its document (once) and inserts an instance.
   * @param block Block of the list.
   */
  insertBlock(block: CreatorBlock): void {
    this.choosingBlock.set(false);
    const store = this.store();
    if (!store) return;
    const known = this.blocks().get(block.id);
    if (known) {
      store.addBlock(known);
      this.tab.set('properties');
      return;
    }
    this.blockBusy.set(true);
    this.blocksApi.block(this.section, block.id).subscribe({
      next: detail => {
        this.blockBusy.set(false);
        this.addBlocks([detail]);
        this.loadAssets(documentReferences(detail.document).assets);
        store.addBlock(detail);
        this.tab.set('properties');
      },
      error: () => this.blockBusy.set(false),
    });
  }

  /**
   * @description Opens the editor of the block of an instance (unsaved changes ask first - guard).
   * @param blockId Block.
   */
  editBlock(blockId: number): void {
    void this.router.navigate(['/admin/js-creator/image-blocks', blockId, 'edit']);
  }

  /**
   * @description Unpacks an instance into independent layers.
   * @param layerId Instance.
   */
  unpack(layerId: string): void {
    const store = this.store();
    const layer = store?.layers().find(l => l.id === layerId);
    const block = layer?.type === 'block' ? this.blocks().get(layer.blockId) : undefined;
    if (!store || !block) return;
    if (!store.unpack(layerId, block, this.formFields())) this.alert.open(this.t('limit_title'), this.t('limit_unpack'), 'warning');
  }

  /** @description "Block from the selection": opens the popup with the name of the new block. */
  openMakeBlock(): void {
    const store = this.store();
    if (!store || !this.canCreate || this.kind !== 'template') return;
    const made = blockFromSelection(store.selectedLayers(), store.doc().fields, store.size());
    if ('error' in made) {
      this.alert.open(this.t('make_block'), this.t(`make_block_${made.error}`), 'warning');
      return;
    }
    this.blockName.set('');
  }

  /**
   * @description Name of the new block typed.
   * @param value Name.
   */
  setBlockName(value: string): void {
    this.blockName.set(value.slice(0, 120));
  }

  /**
   * @description Creates the block of the selected layers and replaces them by its instance (one
   *   step - Undo brings the layers back; the block stays on the page Blocks).
   */
  makeBlock(): void {
    const store = this.store();
    const name = (this.blockName() ?? '').trim();
    if (!store || !name || this.blockBusy()) return;
    const layers = store.selectedLayers();
    const made = blockFromSelection(layers, store.doc().fields, store.size());
    if ('error' in made) return;
    this.blockBusy.set(true);
    this.blocksApi.createBlock(this.section, { name, ...made.size, document: made.document }).subscribe({
      next: block => {
        this.blockBusy.set(false);
        this.blockName.set(null);
        this.addBlocks([block]);
        store.replaceWithInstance(layers.map(l => l.id), block, made.box);
        this.tab.set('properties');
        void this.uploadBlockThumbnail(block);
      },
      error: (error: HttpErrorResponse) => {
        this.blockBusy.set(false);
        void this.saveFailed(store, error);
      },
    });
  }

  /**
   * @description Remembers blocks (with their documents) for the canvas and the panels.
   * @param blocks Blocks of the API.
   */
  private addBlocks(blocks: readonly CreatorBlockDetail[]): void {
    if (!blocks.length) return;
    const map = new Map(this.blocks());
    const defs = blocks.map(b => ({ id: b.id, name: b.name, width: b.width, height: b.height, document: b.document }));
    for (const def of defs) map.set(def.id, def);
    this.blocks.set(map);
    this.resources.setBlocks(defs);
  }

  /**
   * @description Draws and uploads the thumbnail of a block made from the selection.
   * @param block New block.
   */
  private async uploadBlockThumbnail(block: CreatorBlockDetail): Promise<void> {
    const blob = await renderThumbnail(block.document, block, this.resources);
    if (blob) this.blocksApi.uploadThumbnail(this.section, block.id, blob, true).subscribe({ next: () => this.usage.refresh(), error: () => undefined });
  }

  /** @description Zoom that shows the whole template. */
  fit(): void {
    if (this.canvas) this.zoom.set(this.canvas.fitZoom());
  }

  /**
   * @description Zoom in / out by a step.
   * @param factor Factor.
   */
  zoomBy(factor: number): void {
    this.zoom.set(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(this.zoom() * factor * 100) / 100)));
  }

  /**
   * @description Grid size chosen.
   * @param value Size (0 = off).
   */
  setGrid(value: string): void {
    this.grid.set(Number(value) || 0);
  }

  /**
   * @description Name of the template typed in the top bar.
   * @param value Name.
   */
  setName(value: string): void {
    this.store()?.commit(draft => { draft.name = value.slice(0, 120); }, 'name');
  }

  /**
   * @description Double click on a text: its properties with the text focused.
   * @param id Layer.
   */
  editText(id: string): void {
    this.store()?.select([id]);
    this.tab.set('properties');
    setTimeout(() => this.properties?.focusText());
  }

  /**
   * @description A library image was chosen in a panel: remember it and load it.
   * @param asset Image.
   */
  useAsset(asset: CreatorAsset): void {
    this.assets.update(map => new Map(map).set(asset.id, asset));
    this.resources.loadAsset(asset.id, asset.url);
  }

  // ── save ────────────────────────────────────────────────────────────────────

  /**
   * @description Saves the template (version check), then uploads its thumbnail. Changes made
   *   while the save runs stay as unsaved changes (EditorStore.saved()).
   * @returns Resolves with true when saved.
   */
  async save(): Promise<boolean> {
    const store = this.store();
    if (!store?.editable || this.saving()) return false;
    const body = this.kind === 'block' ? store.blockSaveBody() : store.saveBody();
    if (!body.name) {
      this.alert.open(this.t('save_error_title'), this.t('error_name_required'), 'warning');
      return false;
    }
    if (documentBytes(body.document) > DOCUMENT_LIMITS.maxBytes) {
      this.alert.open(this.t('save_error_title'), this.t('error_too_large'), 'warning');
      return false;
    }
    this.saving.set(true);
    const sent = store.stateJson();
    const request: Observable<CreatorTemplateDetail | CreatorBlockDetail> = this.kind === 'block'
      ? this.blocksApi.saveBlock(this.section, store.templateId, store.blockSaveBody())
      : this.api.save(this.section, store.templateId, store.saveBody());
    return new Promise(resolve => {
      request.subscribe({
        next: saved => {
          store.saved(this.kind === 'block' ? blockAsTemplate(saved as CreatorBlockDetail) : saved as CreatorTemplateDetail, sent);
          this.addBlocks((saved as CreatorTemplateDetail).blocks ?? []);
          this.saving.set(false);
          this.savedAt.set(new Date());
          void this.uploadThumbnail(store).then(() => this.refreshTemplatesOf(saved as CreatorBlockDetail));
          resolve(true);
        },
        error: (error: HttpErrorResponse) => {
          this.saving.set(false);
          void this.saveFailed(store, error);
          resolve(false);
        },
      });
    });
  }

  /** @description Label of the way back (templates / blocks). */
  get backLabel(): string {
    return this.t(this.kind === 'block' ? 'back_to_blocks' : 'back_to_templates');
  }

  /** @description Time of the last save for the top bar. */
  get savedTime(): string {
    const at = this.savedAt();
    return at ? at.toLocaleTimeString(this.i18n.getDateLocale(), { hour: '2-digit', minute: '2-digit' }) : '';
  }

  /**
   * @description Explains a refused save: a newer version (offer to load it), an invalid
   *   document (its reasons) or another error.
   * @param store Editor.
   * @param error Error of the API.
   */
  private async saveFailed(store: EditorStore, error: HttpErrorResponse): Promise<void> {
    if (error.status === 409 && error.error?.error_code === 'version_conflict') {
      if (await this.confirm.open(this.t('conflict_title'), this.t('conflict_text'), { confirm: this.t('conflict_load'), cancel: this.t('stay') })) {
        const reload: Observable<CreatorTemplateDetail | CreatorBlockDetail> = this.kind === 'block'
          ? this.blocksApi.block(this.section, store.templateId)
          : this.api.get(this.section, store.templateId);
        reload.subscribe(current => {
          const detail = this.kind === 'block' ? blockAsTemplate(current as CreatorBlockDetail) : current as CreatorTemplateDetail;
          this.addBlocks((current as CreatorTemplateDetail).blocks ?? []);
          store.load(detail);
          store.syncInstances(blockId => this.blocks().get(blockId));
          this.loadAssets(documentReferences(this.resources.withBlocks(detail.document)).assets);
        });
      }
      return;
    }
    if (error.status === 422 && error.error?.errors) {
      const reasons = Object.entries(error.error.errors as Record<string, string[]>).slice(0, 6)
        .map(([path, messages]) => `${path}: ${messages.join(' ')}`).join('\n');
      this.alert.open(this.t('save_error_title'), `${this.t('save_invalid')}\n${reasons}`, 'danger');
      return;
    }
    if (error.status === 404) {
      this.alert.open(this.t('save_error_title'), this.t('save_not_found'), 'danger');
      return;
    }
    this.alert.open(this.t('save_error_title'), `${this.t('save_failed')} (${error.status || this.t('network')})`, 'danger');
  }

  /**
   * @description Draws and uploads the thumbnail of the saved template (its failure keeps the
   *   template saved - the list shows the size instead).
   * @param store Editor.
   */
  private async uploadThumbnail(store: EditorStore): Promise<void> {
    const blob = await this.canvas?.thumbnail(480);
    if (!blob) return;
    const api = this.kind === 'block' ? this.blocksApi : this.api;
    await new Promise<void>(resolve => api.uploadThumbnail(this.section, store.templateId, blob).subscribe({
      next: () => { this.usage.refresh(); resolve(); },
      error: () => resolve(),
    }));
  }

  /**
   * @description After a block was saved: the templates using it draw their thumbnails again (in
   *   the background - the list of templates finishes what this page does not).
   * @param block Saved block (with `used_by`).
   */
  private refreshTemplatesOf(block: CreatorBlockDetail): void {
    if (this.kind !== 'block') return;
    const ids = (block.used_by ?? []).filter(u => !u.trashed && (u.kind ?? 'template') === 'template').map(u => u.id);
    if (ids.length) void this.refresher.refresh(this.section, ids);
  }

  /**
   * @description Loads library images by their ids (thumbnails for the panels, images for the canvas).
   * @param ids Ids.
   */
  private loadAssets(ids: number[]): void {
    const missing = ids.filter(id => !this.assets().has(id));
    if (!missing.length) return;
    this.api.assetsByIds(missing).subscribe(page => {
      const map = new Map(this.assets());
      for (const asset of page.data) {
        map.set(asset.id, asset);
        this.resources.loadAsset(asset.id, asset.url);
      }
      this.assets.set(map);
    });
  }

  /**
   * @description Whether a key event comes from typing into a field.
   * @param target Target of the event.
   */
  private typing(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
  }

  /** @description Back to the list of templates / blocks (asks about unsaved changes through the guard). */
  back(): void {
    void this.router.navigate([this.kind === 'block' ? '/admin/js-creator/image-blocks' : '/admin/js-creator/image-templates']);
  }

  /** @description Opens generating from this template (asks about unsaved changes through the guard). */
  generate(): void {
    const store = this.store();
    if (store && this.kind === 'template') void this.router.navigate(['/admin/js-creator/image-templates', store.templateId, 'generate']);
  }
}
