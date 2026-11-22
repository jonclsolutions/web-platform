/**
 * @file template-editor.component.ts
 * @path src/app/apps/js-creator/admin/images/editor/template-editor.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Page "Template editor" of the section Images (`image-templates/:id/edit`):
 *   - loads the template, the own fonts, the curated font set, the icon set and the library
 *     images the template uses; fonts are loaded with the characters of the texts before drawing;
 *   - top bar: back, name, undo / redo, zoom (fit, 100 %, ±), grid with snapping, smart guides,
 *     safe zone, state of the save and Save;
 *   - left: adding layers (text, image, grid, shape, icon) and the layers; middle: the canvas;
 *     right: Properties, Fields, Template;
 *   - keyboard: Ctrl+S save, Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y, Ctrl+C / Ctrl+V / Ctrl+D, Ctrl+A,
 *     Delete, arrows (Shift = 10 px), Escape, Space + drag = pan;
 *   - save: version check (409 → offer to load the current state), invalid document (422 → the
 *     reasons), then a thumbnail of the template is uploaded; leaving with unsaved changes asks.
 *   The editor is made for screens of 1024 px and more; a smaller screen shows a message.
 *   Without the update permission the template is shown read only.
 * @dependencies TemplatesApiService, JsCreatorApiService (fonts), FontLibraryService,
 *   IconSetService, EditorStore, RenderResourceStore, EditorCanvasComponent, the panels,
 *   ConfirmDialogService, AlertDialogService, PermissionService, AdminLocalizationService
 *   (section `js-creator-editor`).
 */

import {
  ChangeDetectionStrategy, Component, DestroyRef, HostListener, OnInit, ViewChild, computed, effect, inject, signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AdminLocalizationService } from '../../../../../core/services/admin-localization.service';
import { AlertDialogService } from '../../../../../core/services/alert-dialog.service';
import { ConfirmDialogService } from '../../../../../core/services/confirm-dialog.service';
import { PermissionService } from '../../../../../core/auth/services/permission.service';
import { TemplatesApiService } from '../../shared/templates-api.service';
import { JsCreatorApiService } from '../../shared/js-creator-api.service';
import { FontLibraryService } from '../../shared/font-library.service';
import { IconSetService } from '../../shared/icon-set.service';
import { WorkspaceUsageService } from '../../shared/workspace-usage.service';
import { CreatorAsset, CreatorFont, CuratedFontFamily, IconSet } from '../../shared/js-creator.models';
import { JsCreatorSectionId, sectionPermission } from '../../shared/js-creator-sections';
import { DOCUMENT_LIMITS, LayerType, documentBytes, documentReferences, safeZoneOf } from '../../shared/render/document';
import { RenderReport } from '../../shared/render/renderer';
import { RenderResourceStore } from '../../shared/render/resource-store';
import { CreatorIconComponent } from '../../shared/creator-icon/creator-icon.component';
import { UiIconName, uiIcon } from '../../shared/ui-icons';
import { EditorStore } from './editor-store';
import { EditorCanvasComponent, ZOOM_MAX, ZOOM_MIN } from './editor-canvas/editor-canvas.component';
import { LayersPanelComponent } from './panels/layers-panel.component';
import { PropertiesPanelComponent } from './panels/properties-panel.component';
import { FieldsPanelComponent } from './panels/fields-panel.component';
import { TemplatePanelComponent } from './panels/template-panel.component';
import { LeavablePage } from './unsaved-template.guard';

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
  ],
  templateUrl: './template-editor.component.html',
  styleUrls: ['./controls/controls.css', './panels/panels.css', './template-editor.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplateEditorComponent implements OnInit, LeavablePage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(TemplatesApiService);
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
  /** May save. */
  readonly canUpdate = this.permissions.hasPermission(sectionPermission(this.section, 'update'));

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
      const doc = store.doc();
      const texts = doc.pages[0].layers.map(l => (l.type === 'text' ? l.text + l.font.family + l.font.weight + l.font.style : '')).join('')
        + doc.fields.map(f => (f.type === 'text' ? f.sample : '')).join('');
      const key = [...new Set(Array.from(texts))].sort().join('');
      if (key === this.fontKey) return;
      this.fontKey = key;
      void this.resources.ensureFonts(doc, this.ownFonts(), this.curated());
    });
    if (typeof document !== 'undefined' && document.fonts) {
      const done = () => this.redraw.update(v => v + 1);
      document.fonts.addEventListener('loadingdone', done);
      this.destroyRef.onDestroy(() => document.fonts.removeEventListener('loadingdone', done));
    }
  }

  /** @description Loads the template and everything it needs. */
  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    forkJoin({
      template: this.api.get(this.section, id),
      fonts: this.creatorApi.fonts(),
      curated: this.fontLibrary.curatedFamilies(),
      icons: this.iconSets.iconSet(),
    }).subscribe({
      next: ({ template, fonts, curated, icons }) => {
        this.curated.set(curated);
        this.ownFonts.set(fonts);
        this.iconSet.set(icons);
        this.resources.setIcons(icons);
        const store = new EditorStore(template, this.canUpdate);
        this.store.set(store);
        this.safeZone.set(!!safeZoneOf(store.size()));
        this.loadAssets(documentReferences(template.document).assets);
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
      if (mod && key === 'v') { store.paste(); return true; }
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
  add(type: LayerType): void {
    const store = this.store();
    if (!store?.editable) return;
    if (store.layers().length >= DOCUMENT_LIMITS.maxLayers) {
      this.alert.open(this.t('limit_title'), this.t('limit_layers'), 'warning');
      return;
    }
    store.addLayer(type);
    this.tab.set('properties');
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
   * @description Saves the template (version check), then uploads its thumbnail.
   * @returns Resolves with true when saved.
   */
  async save(): Promise<boolean> {
    const store = this.store();
    if (!store?.editable || this.saving()) return false;
    const body = store.saveBody();
    if (!body.name) {
      this.alert.open(this.t('save_error_title'), this.t('error_name_required'), 'warning');
      return false;
    }
    if (documentBytes(body.document) > DOCUMENT_LIMITS.maxBytes) {
      this.alert.open(this.t('save_error_title'), this.t('error_too_large'), 'warning');
      return false;
    }
    this.saving.set(true);
    return new Promise(resolve => {
      this.api.save(this.section, store.templateId, body).subscribe({
        next: template => {
          store.load(template, true);
          this.saving.set(false);
          this.savedAt.set(new Date());
          void this.uploadThumbnail(store);
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
        this.api.get(this.section, store.templateId).subscribe(template => {
          store.load(template);
          this.loadAssets(documentReferences(template.document).assets);
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
    this.api.uploadThumbnail(this.section, store.templateId, blob).subscribe({ next: () => this.usage.refresh(), error: () => undefined });
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

  /** @description Back to the list of templates (asks about unsaved changes through the guard). */
  back(): void {
    void this.router.navigate(['/admin/js-creator/image-templates']);
  }
}
