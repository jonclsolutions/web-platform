/**
 * @file generate-page.component.ts
 * @path src/app/apps/js-creator/admin/images/generate/generate-page.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Page "Generate" of the section Images (`image-templates/:id/generate`): the form
 *   of the fields of a template beside the live preview (the same drawing as the output).
 *   The same page generates a SET (`image-sets/:id/generate`, route data `kind: 'set'`): one
 *   form with the fields of all its templates (outside the trash; block instance fields
 *   included), the preview of each format in tabs with its own crop of every image, and
 *   Generate makes one output per template (name + format) into the chosen folder.
 *   A CAROUSEL (a template with more pages) is one output with a picture per slide: the preview
 *   shows the slides in tabs, overflows of every slide are checked, every slide is drawn and
 *   staged on its own (OutputsApiService.stagePage) and the output joins them.
 *   Safe zones of a network (remembered in the browser) are drawn over the preview and the layers
 *   reaching into them are listed (a warning, generating is not stopped).
 *   PRESETS: saved fillings of the template / set (texts, library images with their crops, the
 *   text of the post typed by hand - never photos of the computer) are chosen above the fields,
 *   saved under a name (the same name overwrites after a confirmation) and deleted.
 *   BULK: the dialog "From a table" generates one output per row of a CSV / XLSX table read only
 *   in the browser (BulkGenerateComponent); the page checks and generates each row the same way
 *   as the form (produce()), waiting when the server asks to slow down (429).
 *   - text fields: length, highlight of the selected part (`**…**`), what the template does
 *     when the text does not fit (shrunk / cut / generating refused);
 *   - image fields: a photo from the computer (decoded ONLY in the browser - never uploaded) or
 *     an image of the library; the crop is moved by dragging in the preview and zoomed by a
 *     slider; a warning when the photo is too small for its place;
 *   - the text of the post from the pattern of the template (editable, can be filled again);
 *   - target folder (the last used one is remembered in this browser) and name;
 *   - Generate: waits for every font and image (a fallback font never gets into an output -
 *     characters the fonts do not have stop it too; an optional image left empty stays empty),
 *     draws the template in its exact size to a PNG, sends it to the API (which converts it to
 *     the format of the template) and shows the result with its actions. The form stays filled
 *     (only in the memory of the page) for the next variant.
 * @note Generating needs the create permission of the section; without it the page is a preview.
 * @dependencies TemplatesApiService, SetsApiService, OutputsApiService, PresetsApiService, JsCreatorApiService (fonts, folders),
 *   FontLibraryService, IconSetService, WorkspaceUsageService, RenderResourceStore,
 *   GeneratePreviewComponent, AssetChooserComponent, QuotaBarComponent, generate-form.ts,
 *   local-image.ts, field-images.ts, block-fields.ts, BulkGenerateComponent, AdminModalComponent,
 *   AlertDialogService, ConfirmDialogService, PermissionService, AdminLocalizationService
 *   (section `js-creator-generate`).
 */

import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, effect, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, firstValueFrom, forkJoin } from 'rxjs';
import { AdminLocalizationService } from '../../../../../core/services/admin-localization.service';
import { AlertDialogService } from '../../../../../core/services/alert-dialog.service';
import { ConfirmDialogService } from '../../../../../core/services/confirm-dialog.service';
import { PermissionService } from '../../../../../core/auth/services/permission.service';
import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { TemplatesApiService } from '../../shared/templates-api.service';
import { SetsApiService } from '../../shared/sets-api.service';
import { OutputsApiService } from '../../shared/outputs-api.service';
import { PresetOwner, PresetsApiService } from '../../shared/presets-api.service';
import { AdminModalComponent } from '../../../../../admin/components/admin-modal/admin-modal.component';
import { JsCreatorApiService } from '../../shared/js-creator-api.service';
import { FontLibraryService } from '../../shared/font-library.service';
import { IconSetService } from '../../shared/icon-set.service';
import { WorkspaceUsageService } from '../../shared/workspace-usage.service';
import {
  CreatorAsset, CreatorFolder, CreatorFont, CreatorOutput, CreatorPreset, CreatorSet, CreatorTemplateDetail, CuratedFontFamily, PresetSave, PresetValues,
} from '../../shared/js-creator.models';
import { JsCreatorSectionId, sectionPermission } from '../../shared/js-creator-sections';
import { CanvasSize, Field, ImageField, TextField, documentReferences, presetOf } from '../../shared/render/document';
import { ImageCrop, RenderReport, RenderValues, renderPage } from '../../shared/render/renderer';
import { BlockResolver, EffectiveField, effectiveFields } from '../../shared/render/block-fields';
import { DrawableImage } from '../../shared/render/paint';
import { RenderResourceStore } from '../../shared/render/resource-store';
import { CROP_ZOOM, defaultCrop, fieldImageBoxes, panCrop, requiredScale, zoomCrop } from '../../shared/render/field-images';
import { SafeNetwork, rememberNetwork, rememberedNetwork, safeNetworks, safeZoneHits, safeZones } from '../../shared/render/safe-zones';
import { saveUrl } from '../../shared/save-url';
import { FolderOption, folderOptions } from '../../shared/folder-tree';
import { formatBytes } from '../../shared/workspace-format';
import { QuotaBarComponent } from '../../shared/quota-bar/quota-bar.component';
import { CreatorIconComponent } from '../../shared/creator-icon/creator-icon.component';
import { UiIconName, uiIcon } from '../../shared/ui-icons';
import { AssetChooserComponent } from '../editor/controls/asset-chooser.component';
import { GeneratePreviewComponent, PreviewPan } from './generate-preview.component';
import { BulkGenerateComponent, BulkRunInput, BulkRunner } from './bulk-generate.component';
import {
  GenerateProblem, MAX_CAPTION, MAX_OUTPUT_NAME, defaultOutputName, fillCaption, formProblems, toggleHighlight, unionFields, visibleLength,
} from './generate-form';
import { LOCAL_IMAGE_ACCEPT, LocalImage, LocalImageError, openLocalImage, outputBitmap } from './local-image';

/** Value of an image field: a photo from the computer or an image of the library. */
export type ImageValue = { kind: 'local'; image: LocalImage } | { kind: 'asset'; asset: CreatorAsset };

/** One template being generated (a set has more, in its order). */
export interface GenerateTarget {
  template: CreatorTemplateDetail;
  /** Fields of its form (block instance fields with their form keys). */
  fields: EffectiveField[];
}

/** Key of the last target folder in this browser (only an id - nothing personal). */
const LAST_FOLDER_KEY = 'jsc.generate.folder';

/** Largest PNG the API accepts (bytes; upload profile js_creator_output). */
const MAX_OUTPUT_BYTES = 20 * 1024 * 1024;

/** Enlargement over which a photo is called too small for its place. */
const BLUR_SCALE = 1.05;

/** Tries of a request the server asked to slow down (429) when generating in bulk. */
const RETRIES = 5;

/** Values of one filling being generated: the form, or a row of a table (bulk). */
interface ProduceInput {
  texts: Record<string, string>;
  images: Record<string, ImageValue>;
  /** Crops by template id. */
  cropsOf: Record<number, Record<string, ImageCrop>>;
  caption: string;
  /** Name of the output (a set adds the size of each template). */
  name: string;
}

/** Result of one filling: its outputs, or why it stopped (`stop` = later fillings would fail the same way). */
export type ProduceResult = { ok: true; outputs: CreatorOutput[] } | { ok: false; error: string; detail?: string; stop: boolean };

@Component({
  selector: 'app-js-creator-generate-page',
  standalone: true,
  imports: [RouterLink, IconComponent, CreatorIconComponent, QuotaBarComponent, GeneratePreviewComponent, AssetChooserComponent, BulkGenerateComponent, AdminModalComponent],
  templateUrl: './generate-page.component.html',
  styleUrls: ['../../../../../admin/shared-styles/modal.css', '../../shared-styles/workspace.css', './generate-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GeneratePageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly templatesApi = inject(TemplatesApiService);
  private readonly setsApi = inject(SetsApiService);
  private readonly outputsApi = inject(OutputsApiService);
  private readonly presetsApi = inject(PresetsApiService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly creatorApi = inject(JsCreatorApiService);
  private readonly fontLibrary = inject(FontLibraryService);
  private readonly iconSets = inject(IconSetService);
  private readonly usage = inject(WorkspaceUsageService);
  private readonly i18n = inject(AdminLocalizationService);
  private readonly alert = inject(AlertDialogService);
  private readonly permissions = inject(PermissionService);
  private readonly destroyRef = inject(DestroyRef);

  /** Section of the page. */
  readonly section: JsCreatorSectionId = 'images';
  /** One template or a set (route data `kind`). */
  readonly mode: 'template' | 'set' = this.route.snapshot.data?.['kind'] === 'set' ? 'set' : 'template';
  /** May generate. */
  readonly canCreate = this.permissions.hasPermission(sectionPermission(this.section, 'create'));
  /** May open the editor. */
  readonly canEdit = this.permissions.hasPermission(sectionPermission(this.section, 'update'));
  /** May delete presets. */
  readonly canDelete = this.permissions.hasPermission(sectionPermission(this.section, 'delete'));
  /** Types of the photo picker. */
  readonly accept = LOCAL_IMAGE_ACCEPT;
  /** Limits shown in the form. */
  readonly maxName = MAX_OUTPUT_NAME;
  readonly maxCaption = MAX_CAPTION;
  readonly zoomLimits = CROP_ZOOM;

  /** The set (set mode). */
  readonly set = signal<CreatorSet | null>(null);
  /** Templates being generated (one; a set: its templates outside the trash). */
  readonly targets = signal<GenerateTarget[]>([]);
  /** Index of the template shown in the preview (tabs of a set). */
  readonly active = signal(0);
  /** Slide shown in the preview (a carousel). */
  readonly slide = signal(0);
  /** Network whose safe zones are drawn over the preview (null = none). */
  readonly safeNetwork = signal<SafeNetwork | null>(null);
  /** The template shown in the preview. */
  readonly target = computed<GenerateTarget | null>(() => this.targets()[this.active()] ?? this.targets()[0] ?? null);
  /** The template shown in the preview (null while loading). */
  readonly template = computed(() => this.target()?.template ?? null);
  /** The template / set could not be loaded (or the set has no template). */
  readonly failed = signal(false);
  /** Resources of the renderer. */
  readonly resources = new RenderResourceStore(this.fontLibrary, () => this.redraw.update(v => v + 1));
  /** Changes when a resource finished loading. */
  readonly redraw = signal(0);
  /** Own fonts and the curated set. */
  private readonly ownFonts = signal<CreatorFont[]>([]);
  private readonly curated = signal<CuratedFontFamily[]>([]);

  /** Values of the text fields. */
  readonly texts = signal<Record<string, string>>({});
  /** Values of the image fields. */
  readonly images = signal<Record<string, ImageValue>>({});
  /** Crops of the image fields of each template (by template id) - every format has its own. */
  readonly cropsOf = signal<Record<number, Record<string, ImageCrop>>>({});
  /** Crops of the image fields of the template in the preview. */
  readonly crops = computed<Record<string, ImageCrop>>(() => this.cropsOf()[this.template()?.id ?? 0] ?? {});
  /** Report of the last drawing of the preview. */
  readonly report = signal<RenderReport>({ overflows: [], missing: [] });
  /** Text of the post typed by the user (used once edited). */
  private readonly captionTyped = signal('');
  /** The text of the post was edited by hand. */
  readonly captionEdited = signal(false);
  /** Folders of the workspace. */
  readonly folders = signal<CreatorFolder[]>([]);
  /** Target folder (null = top level). */
  readonly folderId = signal<number | null>(null);
  /** Name typed (empty = template + time). */
  readonly name = signal('');
  /** Generating runs. */
  readonly generating = signal(false);
  /** Generating was tried (show the problems). */
  readonly attempted = signal(false);
  /** Outputs of the last Generate (one per template). */
  readonly results = signal<CreatorOutput[]>([]);
  /** Last generated output. */
  readonly result = computed<CreatorOutput | null>(() => this.results()[this.results().length - 1] ?? null);
  /** Template being drawn / sent (progress of a set). */
  readonly progress = signal<{ done: number; total: number } | null>(null);
  /** Seconds generating waits because the server asked to slow down (bulk; null = not waiting). */
  readonly waiting = signal<number | null>(null);
  /** The dialog "Generate from a table" is open. */
  readonly bulkOpen = signal(false);
  /** Presets (saved fillings) of the template / set. */
  readonly presets = signal<CreatorPreset[]>([]);
  /** Preset chosen in the list. */
  readonly presetId = signal<number | null>(null);
  /** Dialog saving a preset: the name typed and its error. */
  readonly presetDialog = signal<{ name: string; error: string | null } | null>(null);
  /** A preset is being saved / applied / deleted. */
  readonly presetBusy = signal(false);
  /** What the dialog "Generate from a table" uses of this page. */
  readonly bulkRunner: BulkRunner = {
    fields: () => this.fields(),
    targetCount: () => this.targets().length,
    prepare: texts => this.prepareFonts(texts),
    check: (texts, filled) => this.checkRow(texts, filled),
    problemText: problem => this.problemText(problem),
    run: row => this.runRow(row),
  };
  /** The text of the result was copied. */
  readonly copied = signal(false);
  /** Field whose library chooser is open. */
  readonly choosingFor = signal<string | null>(null);
  /** Field whose photo is being opened. */
  readonly opening = signal<string | null>(null);

  /** Document of the template. */
  readonly doc = computed(() => this.template()?.document ?? null);
  /** Slides of the template shown (1 = not a carousel). */
  readonly pageCount = computed(() => this.doc()?.pages.length ?? 1);
  /** Numbers of the slides (1 …) for the tabs. */
  readonly slideNumbers = computed(() => Array.from({ length: this.pageCount() }, (_, i) => i + 1));
  /** Index of the slide shown (within the slides of the template). */
  readonly slideIndex = computed(() => Math.min(this.slide(), this.pageCount() - 1));
  /** Networks with a guide for the size shown. */
  readonly networks = computed(() => safeNetworks(this.size()));
  /** Zones of the chosen network over the preview. */
  readonly previewZones = computed(() => {
    const network = this.safeNetwork();
    return network && this.networks().includes(network) ? safeZones(network, this.size()) : [];
  });
  /** Layers of every slide of the template shown that reach into the zones (with the number of the slide). */
  readonly safeHits = computed(() => {
    const doc = this.doc();
    const zones = this.previewZones();
    if (!doc || !zones.length) return [];
    return doc.pages.flatMap((page, i) => safeZoneHits(page.layers, this.size(), zones).map(hit => ({ ...hit, page: i + 1 })));
  });
  /** Size of the template. */
  readonly size = computed<CanvasSize>(() => {
    const t = this.template();
    return { width: t?.width ?? 1080, height: t?.height ?? 1080 };
  });
  /** Label of the size (preset name or W × H). */
  readonly sizeLabel = computed(() => {
    const size = this.size();
    const preset = presetOf(size);
    return `${size.width} × ${size.height}${preset ? ' · ' + this.i18n.getValue(`js-creator-templates.${preset.labelKey}`) : ''}`;
  });
  /** Fields of the form: of the template / united over the templates of a set. */
  readonly united = computed(() => unionFields(this.targets().map(t => t.fields)));
  /** Text fields and image fields in the order of the form. */
  readonly fields = computed<Field[]>(() => this.united().fields);
  /** Labels of the formats (tabs of a set). */
  readonly tabs = computed(() => this.targets().map(t => ({ id: t.template.id, name: t.template.name, label: this.formatLabel(t.template) })));
  /** Finds the blocks of instances (loaded with the templates). */
  readonly resolve: BlockResolver = id => this.resources.block(id);
  /** Keys of the image fields with an image (draggable in the preview). */
  readonly filledImages = computed(() => Object.keys(this.images()));
  /** Values for the renderer (preview copies of photos). */
  readonly values = computed<RenderValues>(() => {
    this.redraw();
    const images: Record<string, DrawableImage | undefined> = {};
    for (const [key, value] of Object.entries(this.images())) images[key] = this.drawable(value);
    return { text: this.texts(), images, crops: this.crops() };
  });
  /** Caption pattern: of the set (or its first template) / of the template. */
  readonly captionPattern = computed(() => {
    const set = this.set();
    return set ? set.caption_template ?? this.targets()[0]?.template.caption_template ?? null : this.template()?.caption_template ?? null;
  });
  /** Text of the post (from the pattern until edited by hand). */
  readonly caption = computed(() => {
    if (this.captionEdited()) return this.captionTyped();
    return this.targets().length ? fillCaption(this.captionPattern(), this.fields(), this.texts()).slice(0, MAX_CAPTION) : '';
  });
  /** Reports of every slide of every template (the preview draws one; the others are measured off screen). */
  readonly reports = computed<RenderReport[]>(() => {
    this.redraw();
    const shown = this.report();
    const texts = this.texts();
    const slide = this.slideIndex();
    return this.targets().flatMap((t, i) => t.template.document.pages.map((_, page) =>
      (i === this.active() && page === slide ? shown : this.measure(t, texts, page))));
  });
  /** Reasons that stop generating (over every template of a set). */
  readonly problems = computed<GenerateProblem[]>(() => {
    if (!this.targets().length) return [];
    const reports = this.reports();
    const overflows = reports.flatMap(r => r.overflows);
    const failed = reports.flatMap(r => r.missing).filter(m => m.startsWith('asset:') && this.resources.failed(Number(m.slice(6))));
    const problems = formProblems(this.fields(), this.texts(), new Set(this.filledImages()), { overflows, missing: failed }, this.united().conflicts);
    // Characters the fonts do not have would be drawn with another font.
    const texts = this.texts();
    const characters = [...new Set(this.targets().flatMap(t => this.resources.unsupportedCharacters(t.template.document, texts)))];
    if (characters.length) problems.push({ kind: 'characters', field: null, label: characters.join(' ') });
    return problems;
  });
  /** Overflow of each text field (mode of its layer; a set: the worst of its templates). */
  readonly overflowOf = computed(() => {
    const map = new Map<string, 'ellipsis' | 'block'>();
    for (const o of this.reports().flatMap(r => r.overflows)) if (o.field) map.set(o.field, map.get(o.field) === 'block' ? 'block' : o.mode);
    return map;
  });
  /** Target folders. */
  readonly folderChoices = computed<FolderOption[]>(() => folderOptions(this.folders()));

  /** Signature of the characters in use (fonts are loaded again when it changes). */
  private fontKey = '';
  /** Context of the off-screen measuring of the templates not shown. */
  private measureCtx: CanvasRenderingContext2D | null | undefined;

  constructor() {
    effect(() => {
      const targets = this.targets();
      if (!targets.length) return;
      const texts = Object.values(this.texts());
      const key = [...new Set(Array.from(texts.join('')))].sort().join('');
      if (key === this.fontKey) return;
      this.fontKey = key;
      for (const t of targets) void this.resources.ensureFonts(t.template.document, this.ownFonts(), this.curated(), texts);
    });
    if (typeof document !== 'undefined' && document.fonts) {
      const done = () => this.redraw.update(v => v + 1);
      document.fonts.addEventListener('loadingdone', done);
      this.destroyRef.onDestroy(() => document.fonts.removeEventListener('loadingdone', done));
    }
    this.destroyRef.onDestroy(() => Object.values(this.images()).forEach(v => this.release(v)));
  }

  /** @description Loads the template (or the set and its templates), fonts, icons, folders and the library images. */
  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    const shared = { fonts: this.creatorApi.fonts(), curated: this.fontLibrary.curatedFamilies(), icons: this.iconSets.iconSet() };
    if (this.mode === 'set') {
      forkJoin({ set: this.setsApi.get(this.section, id), ...shared }).subscribe({
        next: ({ set, fonts, curated, icons }) => {
          const ids = set.templates.filter(t => !t.trashed).map(t => t.id);
          if (!ids.length) return this.failed.set(true);
          forkJoin(ids.map(templateId => this.templatesApi.get(this.section, templateId))).subscribe({
            next: templates => {
              this.set.set(set);
              this.start(templates, fonts, curated, icons);
            },
            error: () => this.failed.set(true),
          });
        },
        error: () => this.failed.set(true),
      });
    } else {
      forkJoin({ template: this.templatesApi.get(this.section, id), ...shared }).subscribe({
        next: ({ template, fonts, curated, icons }) => this.start([template], fonts, curated, icons),
        error: () => this.failed.set(true),
      });
    }
    this.loadFolders();
    this.usage.refresh();
  }

  /**
   * @description Sets up the form for the loaded templates: their blocks, fields, empty texts
   *   and the library images they need.
   * @param templates Templates in their order.
   * @param fonts Own fonts.
   * @param curated Curated set.
   * @param icons Icon set.
   */
  private start(templates: CreatorTemplateDetail[], fonts: CreatorFont[], curated: CuratedFontFamily[], icons: Parameters<RenderResourceStore['setIcons']>[0]): void {
    this.ownFonts.set(fonts);
    this.curated.set(curated);
    this.resources.setIcons(icons);
    this.resources.setBlocks(templates.flatMap(t => t.blocks ?? []));
    const targets = templates.map(template => ({ template, fields: effectiveFields(template.document, this.resolve) }));
    const fields = unionFields(targets.map(t => t.fields)).fields;
    this.texts.set(Object.fromEntries(fields.filter(f => f.type === 'text').map(f => [f.key, ''])));
    this.targets.set(targets);
    this.safeNetwork.set(rememberedNetwork(templates[0]));
    this.loadAssets([...new Set(templates.flatMap(t => documentReferences(this.resources.withBlocks(t.document)).assets))]);
    this.loadPresets();
  }

  /**
   * @description Label of a format: W × H and its preset.
   * @param size Size of a template.
   */
  formatLabel(size: CanvasSize): string {
    const preset = presetOf(size);
    return `${size.width} × ${size.height}${preset ? ' · ' + this.i18n.getValue(`js-creator-templates.${preset.labelKey}`) : ''}`;
  }

  /**
   * @description Shows another format in the preview (tabs of a set).
   * @param index Index of the template.
   */
  showTarget(index: number): void {
    if (index === this.active() || !this.targets()[index]) return;
    this.report.set({ overflows: [], missing: [] });
    this.active.set(index);
    this.slide.set(0);
    if (!this.networks().includes(this.safeNetwork() as SafeNetwork)) this.safeNetwork.set(rememberedNetwork(this.size()));
  }

  /**
   * @description Number of slides of a carousel with its word ("3 slidy", "5 slidů").
   * @param count Slides (2 … 20).
   */
  slideCount(count: number): string {
    return `${count} ${this.t(count <= 4 ? 'slides_count_few' : 'slides_count')}`;
  }

  /**
   * @description Shows another slide of a carousel in the preview.
   * @param index Slide (0 = the first).
   */
  showSlide(index: number): void {
    if (index === this.slideIndex() || index < 0 || index >= this.pageCount()) return;
    this.report.set({ overflows: [], missing: [] });
    this.slide.set(index);
  }

  /**
   * @description Shows the safe zones of a network over the preview (remembered in this browser).
   * @param value Network id, or '' (none).
   */
  setSafeNetwork(value: string): void {
    const network = this.networks().includes(value as SafeNetwork) ? value as SafeNetwork : null;
    this.safeNetwork.set(network);
    rememberNetwork(network);
  }

  /**
   * @description Text shared by the pages (safe zones).
   * @param key Key in `js-creator-shared`.
   */
  ts(key: string): string {
    return this.i18n.getValue(`js-creator-shared.${key}`);
  }

  /**
   * @description Name of a layer reaching into a safe zone (its name, its text, or its kind).
   * @param hit Hit of safeHits().
   */
  hitName(hit: { layerId: string; name: string; page: number }): string {
    const layer = this.doc()?.pages[hit.page - 1]?.layers.find(l => l.id === hit.layerId);
    const text = layer?.type === 'text' ? layer.text.replace(/\*\*/g, '').split('\n')[0].slice(0, 30) : '';
    return hit.name || text || this.t('layer');
  }

  /**
   * @description Text of the page.
   * @param key Key in `js-creator-generate`.
   */
  t(key: string): string {
    return this.i18n.getValue(`js-creator-generate.${key}`);
  }

  /**
   * @description Text with values (`{name}` placeholders).
   * @param key Key in `js-creator-generate`.
   * @param params Values.
   */
  tf(key: string, params: Record<string, string | number>): string {
    return Object.entries(params).reduce((text, [name, value]) => text.split(`{${name}}`).join(String(value)), this.t(key));
  }

  /**
   * @description Elements of an interface icon.
   * @param name Name.
   */
  icon(name: UiIconName) {
    return uiIcon(name);
  }

  // ── text fields ─────────────────────────────────────────────────────────────

  /**
   * @description A text field was typed into.
   * @param key Field.
   * @param value Text.
   */
  setText(key: string, value: string): void {
    this.texts.update(texts => ({ ...texts, [key]: value }));
    this.results.set([]);
  }

  /**
   * @description Highlights (or un-highlights) the selected part of a text field.
   * @param key Field (its input / textarea has the id `jc-gen-<key>`).
   */
  highlight(key: string): void {
    const input = document.getElementById(`jc-gen-${key}`) as HTMLInputElement | HTMLTextAreaElement | null;
    if (!input) return;
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    if (start >= end) {
      this.alert.open(this.t('highlight'), this.t('highlight_hint'), 'info');
      return;
    }
    const next = toggleHighlight(this.texts()[key] ?? '', start, end);
    this.setText(key, next.value);
    input.value = next.value;
    input.focus();
    input.setSelectionRange(next.start, next.end);
  }

  /**
   * @description Visible length of a text field.
   * @param key Field.
   */
  lengthOf(key: string): number {
    return visibleLength(this.texts()[key] ?? '');
  }

  // ── image fields ────────────────────────────────────────────────────────────

  /**
   * @description A photo was chosen from the computer: decoded in the browser only.
   * @param field Image field.
   * @param event Change of the file input.
   */
  async chooseFile(field: ImageField, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.opening.set(field.key);
    try {
      this.setImage(field.key, { kind: 'local', image: await openLocalImage(file) });
    } catch (error) {
      const reason = error instanceof LocalImageError ? error.reason : 'unsupported';
      this.alert.open(this.t('photo_error_title'), this.t(reason === 'too_large' ? 'photo_too_large' : 'photo_unsupported'), 'warning');
    } finally {
      this.opening.set(null);
    }
  }

  /**
   * @description An image of the library was chosen for a field.
   * @param asset Image.
   */
  useAsset(asset: CreatorAsset): void {
    const key = this.choosingFor();
    this.choosingFor.set(null);
    if (!key) return;
    this.resources.loadAsset(asset.id, asset.url);
    this.setImage(key, { kind: 'asset', asset });
  }

  /**
   * @description Removes the image of a field.
   * @param key Field.
   */
  clearImage(key: string): void {
    const current = this.images()[key];
    if (current) this.release(current);
    this.images.update(images => {
      const next = { ...images };
      delete next[key];
      return next;
    });
    this.cropsOf.update(all => Object.fromEntries(Object.entries(all).map(([id, crops]) => {
      const next = { ...crops };
      delete next[key];
      return [id, next];
    })));
    this.results.set([]);
  }

  /**
   * @description Zoom of the crop of a field changed.
   * @param key Field.
   * @param value Value of the slider.
   */
  setZoom(key: string, value: string): void {
    const crop = this.crops()[key];
    if (crop) this.setCrop(key, zoomCrop(crop, Number(value) || 1));
  }

  /**
   * @description The crop of a field (in the format shown) back to the focus of the template.
   * @param key Field.
   */
  resetCrop(key: string): void {
    const target = this.target();
    if (target) this.setCrop(key, defaultCrop(this.boxes(target, key)));
  }

  /**
   * @description An image was dragged in the preview: move its crop (of the format shown).
   * @param pan Field, place and distance.
   */
  onPan(pan: PreviewPan): void {
    const value = this.images()[pan.key];
    const crop = this.crops()[pan.key];
    if (!value || !crop) return;
    this.setCrop(pan.key, panCrop(crop, pan.box, this.naturalSize(value), pan.dx, pan.dy));
  }

  /**
   * @description Sets the crop of a field in the format shown.
   * @param key Field.
   * @param crop Crop.
   */
  private setCrop(key: string, crop: ImageCrop): void {
    const id = this.template()?.id;
    if (id === undefined) return;
    this.cropsOf.update(all => ({ ...all, [id]: { ...(all[id] ?? {}), [key]: crop } }));
  }

  /**
   * @description Places of an image field in a template - on every slide (block instances included).
   * @param target Template.
   * @param key Field.
   */
  private boxes(target: GenerateTarget, key: string) {
    return target.template.document.pages.flatMap((_, page) => fieldImageBoxes(target.template.document, target.template, key, page, this.resolve));
  }

  /**
   * @description Natural size of the image of a field.
   * @param value Value.
   */
  naturalSize(value: ImageValue): { width: number; height: number } {
    return value.kind === 'local' ? { width: value.image.width, height: value.image.height } : { width: value.asset.width, height: value.asset.height };
  }

  /**
   * @description Name and size of the image of a field for the form.
   * @param value Value.
   */
  describe(value: ImageValue): string {
    const size = this.naturalSize(value);
    return `${value.kind === 'local' ? value.image.name : value.asset.name} · ${size.width} × ${size.height} px`;
  }

  /**
   * @description Thumbnail of the image of a field (library images only - a photo from the
   *   computer is shown in the preview).
   * @param value Value.
   */
  thumbOf(value: ImageValue): string | null {
    return value.kind === 'asset' ? value.asset.thumb_url : null;
  }

  /**
   * @description Warning about the resolution of the image of a field (or empty).
   * @param field Image field.
   */
  resolutionWarning(field: ImageField): string {
    const value = this.images()[field.key];
    if (!value || !this.targets().length) return '';
    const size = this.naturalSize(value);
    if ((field.minWidth > 0 && size.width < field.minWidth) || (field.minHeight > 0 && size.height < field.minHeight)) {
      return this.tf('resolution_min', { width: field.minWidth || '–', height: field.minHeight || '–' });
    }
    const all = this.cropsOf();
    const scale = Math.max(0, ...this.targets().map(t =>
      requiredScale(this.boxes(t, field.key), size, all[t.template.id]?.[field.key]?.zoom ?? 1)));
    return scale > BLUR_SCALE ? this.t('resolution_low') : '';
  }

  // ── caption, target ─────────────────────────────────────────────────────────

  /**
   * @description The text of the post was edited by hand.
   * @param value Text.
   */
  setCaption(value: string): void {
    this.captionTyped.set(value.slice(0, MAX_CAPTION));
    this.captionEdited.set(true);
  }

  /** @description The text of the post from the pattern of the template again. */
  refillCaption(): void {
    this.captionEdited.set(false);
  }

  /**
   * @description Target folder chosen (remembered in this browser).
   * @param value Value of the select ('' = top level).
   */
  setFolder(value: string): void {
    const id = value === '' ? null : Number(value);
    this.folderId.set(id);
    try {
      localStorage.setItem(LAST_FOLDER_KEY, id === null ? '' : String(id));
    } catch {
      // Storage may be unavailable (private mode) - the choice is only a convenience.
    }
  }

  /**
   * @description Name typed.
   * @param value Name.
   */
  setName(value: string): void {
    this.name.set(value.slice(0, MAX_OUTPUT_NAME));
  }

  /** @description Placeholder of the name: the default name (a set: its name - each output adds its format). */
  get namePlaceholder(): string {
    return defaultOutputName(this.set()?.name ?? this.template()?.name ?? '', new Date(), this.i18n.getDateLocale());
  }

  /**
   * @description Text of a problem.
   * @param problem Problem.
   */
  problemText(problem: GenerateProblem): string {
    return this.tf(`problem_${problem.kind}`, { field: problem.label });
  }

  /**
   * @description Name of the template of a generated output (results of a set).
   * @param output Output.
   */
  formatOf(output: CreatorOutput): string {
    return `${output.width} × ${output.height}`;
  }

  /**
   * @description Name of the target folder of the result.
   * @param output Generated output.
   */
  folderName(output: CreatorOutput): string {
    return this.folders().find(f => f.id === output.folder_id)?.name ?? this.t('root');
  }

  // ── bulk from a table ───────────────────────────────────────────────────────

  /** @description Opens the dialog "Generate from a table". */
  openBulk(): void {
    if (this.canCreate && this.targets().length && !this.generating()) this.bulkOpen.set(true);
  }

  /** @description Opens the target folder on the page Outputs (after a bulk run). */
  openTargetFolder(): void {
    void this.router.navigate(['/admin/js-creator/outputs'], { queryParams: { folder: this.folderId() ?? 'root' } });
  }

  /** Name of the target folder. */
  readonly folderLabel = computed(() => this.folders().find(f => f.id === this.folderId())?.name ?? this.t('root'));

  /**
   * @description Loads the fonts the texts of a table need (overflows are measured with them).
   * @param texts Texts of all rows.
   */
  private async prepareFonts(texts: string[]): Promise<void> {
    for (const t of this.targets()) await this.resources.ensureFonts(t.template.document, this.ownFonts(), this.curated(), texts);
  }

  /**
   * @description What stops a row of a table: the rules of the form, texts that do not fit on any
   *   slide of any template, characters the fonts do not have.
   * @param texts Texts of the row.
   * @param filled Image fields with an image.
   */
  private checkRow(texts: Record<string, string>, filled: ReadonlySet<string>): GenerateProblem[] {
    const targets = this.targets();
    const overflows = targets.flatMap(t => t.template.document.pages.map((_, page) => this.measure(t, texts, page))).flatMap(r => r.overflows);
    const problems = formProblems(this.fields(), texts, new Set(filled), { overflows, missing: [] }, this.united().conflicts);
    const characters = [...new Set(targets.flatMap(t => this.resources.unsupportedCharacters(t.template.document, texts)))];
    if (characters.length) problems.push({ kind: 'characters', field: null, label: characters.join(' ') });
    return problems;
  }

  /**
   * @description Generates one row of a table: its photos are opened only in the browser (and
   *   freed afterwards), every image starts at the focus of the template, the text of the post
   *   comes from its column or the pattern, the name from its column or the default with the
   *   number of the row; the server is waited for when it asks to slow down.
   * @param row Row with its images.
   */
  private async runRow(row: BulkRunInput): Promise<ProduceResult> {
    const opened: LocalImage[] = [];
    try {
      const images: Record<string, ImageValue> = {};
      for (const [key, image] of Object.entries(row.images)) {
        if (image.kind === 'asset') {
          this.resources.loadAsset(image.asset.id, image.asset.url);
          images[key] = { kind: 'asset', asset: image.asset };
          continue;
        }
        try {
          const local = await openLocalImage(image.file);
          opened.push(local);
          images[key] = { kind: 'local', image: local };
        } catch (error) {
          const tooLarge = error instanceof LocalImageError && error.reason === 'too_large';
          return { ok: false, error: tooLarge ? 'photo_too_large' : 'photo_unsupported', stop: false };
        }
      }
      const cropsOf: Record<number, Record<string, ImageCrop>> = {};
      for (const t of this.targets()) {
        cropsOf[t.template.id] = Object.fromEntries(Object.keys(images).map(key => [key, defaultCrop(this.boxes(t, key))]));
      }
      const caption = row.caption ?? fillCaption(this.captionPattern(), this.fields(), row.texts);
      const base = defaultOutputName(this.set()?.name ?? this.targets()[0].template.name, new Date(), this.i18n.getDateLocale());
      const name = row.name || `${base.slice(0, MAX_OUTPUT_NAME - 8)} – ${String(row.index).padStart(3, '0')}`;
      return await this.produce({ texts: row.texts, images, cropsOf, caption: caption.slice(0, MAX_CAPTION), name }, () => undefined, true);
    } finally {
      opened.forEach(image => image.preview.close());
      this.progress.set(null);
      this.usage.refresh();
    }
  }

  // ── presets (saved fillings) ─────────────────────────────────────────────────

  /** Owner of the presets of the page: the set, or the template. */
  private presetOwner(): PresetOwner | null {
    const set = this.set();
    if (set) return { set_id: set.id };
    const template = this.targets()[0]?.template;
    return template ? { template_id: template.id } : null;
  }

  /** @description Loads the presets of the template / set. */
  private loadPresets(): void {
    const owner = this.presetOwner();
    if (!owner) return;
    this.presetsApi.list(this.section, owner).subscribe({ next: presets => this.presets.set(presets), error: () => this.presets.set([]) });
  }

  /**
   * @description Fills the form from a preset: texts (fields missing in it get empty), library
   *   images and their crops, the text of the post (typed by hand, or again from the pattern).
   *   Photos of the computer in the form stay (presets never hold them); images no longer in
   *   the library are named.
   * @param value Id of the preset ('' = none).
   */
  async applyPreset(value: string): Promise<void> {
    const preset = this.presets().find(p => p.id === Number(value)) ?? null;
    this.presetId.set(preset?.id ?? null);
    if (!preset || this.generating()) return;
    this.presetBusy.set(true);
    try {
      const values = preset.values;
      this.texts.update(texts => Object.fromEntries(Object.keys(texts).map(key => [key, String(values.texts[key] ?? '')])));
      const imageKeys = new Set(this.fields().filter(f => f.type === 'image').map(f => f.key));
      const wanted = Object.entries(values.images).filter(([key]) => imageKeys.has(key));
      let missing = 0;
      if (wanted.length) {
        const page = await firstValueFrom(this.templatesApi.assetsByIds([...new Set(wanted.map(([, id]) => id))]));
        for (const [key, id] of wanted) {
          const asset = page.data.find(a => a.id === id);
          if (!asset) {
            missing++;
            continue;
          }
          this.resources.loadAsset(asset.id, asset.url);
          this.setImage(key, { kind: 'asset', asset });
        }
      }
      const images = this.images();
      this.cropsOf.update(all => {
        const next = { ...all };
        for (const t of this.targets()) {
          for (const [key, crop] of Object.entries(values.crops[String(t.template.id)] ?? {})) {
            if (images[key]?.kind === 'asset') next[t.template.id] = { ...(next[t.template.id] ?? {}), [key]: { ...crop } };
          }
        }
        return next;
      });
      if (values.caption !== null) this.setCaption(values.caption);
      else this.refillCaption();
      this.results.set([]);
      if (missing) this.alert.open(this.t('presets'), this.tf('preset_missing_images', { count: missing }), 'warning');
    } catch {
      this.alert.open(this.t('presets'), this.t('preset_load_failed'), 'warning');
    } finally {
      this.presetBusy.set(false);
    }
  }

  /** @description Opens the dialog saving the filling as a preset (the chosen preset's name offered). */
  openSavePreset(): void {
    if (!this.canCreate) return;
    const chosen = this.presets().find(p => p.id === this.presetId());
    this.presetDialog.set({ name: chosen?.name ?? '', error: null });
  }

  /**
   * @description Name typed in the dialog.
   * @param value Name.
   */
  setPresetName(value: string): void {
    this.presetDialog.update(d => (d ? { name: value.slice(0, 120), error: null } : d));
  }

  /** @description Saves the filling: a new preset, or (after a confirmation) over the preset with the same name. */
  async savePreset(): Promise<void> {
    const dialog = this.presetDialog();
    const owner = this.presetOwner();
    if (!dialog || !owner || this.presetBusy()) return;
    const name = dialog.name.trim();
    if (!name) {
      this.presetDialog.set({ ...dialog, error: this.t('preset_name_required') });
      return;
    }
    const same = this.presets().find(p => p.name.toLocaleLowerCase('cs-CZ') === name.toLocaleLowerCase('cs-CZ'));
    if (same && !(await this.confirm.open(this.t('preset_overwrite_title'), this.tf('preset_overwrite_text', { name: same.name })))) return;
    const data: PresetSave = { name, ...owner, values: this.presetValues() };
    this.presetBusy.set(true);
    try {
      const saved = await firstValueFrom(same ? this.presetsApi.save(this.section, same.id, data) : this.presetsApi.create(this.section, data));
      this.presets.update(list => [...list.filter(p => p.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name, 'cs')));
      this.presetId.set(saved.id);
      this.presetDialog.set(null);
    } catch (error) {
      const http = error instanceof HttpErrorResponse ? error : null;
      const key = http?.error?.error_code === 'preset_limit' ? 'preset_limit'
        : http?.status === 422 && http.error?.errors?.['name'] ? 'preset_name_taken' : 'preset_save_failed';
      this.presetDialog.set({ name, error: this.t(key) });
    } finally {
      this.presetBusy.set(false);
    }
  }

  /** @description Deletes the chosen preset after a confirmation. */
  async deletePreset(): Promise<void> {
    const preset = this.presets().find(p => p.id === this.presetId());
    if (!preset || !this.canDelete || this.presetBusy()) return;
    if (!(await this.confirm.open(this.t('preset_delete_title'), this.tf('preset_delete_text', { name: preset.name })))) return;
    this.presetBusy.set(true);
    this.presetsApi.delete(this.section, preset.id).subscribe({
      next: () => {
        this.presets.update(list => list.filter(p => p.id !== preset.id));
        this.presetId.set(null);
        this.presetBusy.set(false);
      },
      error: () => this.presetBusy.set(false),
    });
  }

  /**
   * @description Values of the form for a preset: texts, library images with their crops (by
   *   template), the text of the post when typed by hand. Photos of the computer are left out.
   */
  private presetValues(): PresetValues {
    const images: Record<string, number> = {};
    for (const [key, value] of Object.entries(this.images())) if (value.kind === 'asset') images[key] = value.asset.id;
    const crops: PresetValues['crops'] = {};
    for (const t of this.targets()) {
      const own = Object.entries(this.cropsOf()[t.template.id] ?? {}).filter(([key]) => key in images);
      if (own.length) crops[String(t.template.id)] = Object.fromEntries(own.map(([key, c]) => [key, { focusX: c.focusX, focusY: c.focusY, zoom: c.zoom }]));
    }
    return { texts: { ...this.texts() }, images, crops, caption: this.captionEdited() ? this.caption() : null };
  }

  // ── generating ──────────────────────────────────────────────────────────────

  /**
   * @description Generates the output (a set: one output per template, in its order) and stores
   *   it in the chosen folder. Waits for every font and image first; a failure stops the rest
   *   (outputs already made stay and are shown).
   */
  async generate(): Promise<void> {
    const targets = this.targets();
    if (!targets.length || !this.canCreate || this.generating()) return;
    this.attempted.set(true);
    if (this.problems().length) return;
    this.generating.set(true);
    this.results.set([]);
    const base = this.name().trim() || defaultOutputName(this.set()?.name ?? targets[0].template.name, new Date(), this.i18n.getDateLocale());
    try {
      const result = await this.produce(
        { texts: this.texts(), images: this.images(), cropsOf: this.cropsOf(), caption: this.caption(), name: base },
        output => this.results.update(list => [...list, output]),
        false,
      );
      if (result.ok) setTimeout(() => document.querySelector('.gen-result')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
      else this.failWith(result);
    } finally {
      this.progress.set(null);
      this.generating.set(false);
    }
  }

  /**
   * @description Draws and stores the outputs of one filling - of the form, or of a row of a
   *   table (bulk): one output per template, a carousel slide by slide. Waits for the fonts and
   *   images first (a fallback font never gets into an output).
   * @param input Values of the filling.
   * @param onOutput Called with every stored output.
   * @param patient Wait and try again when the server asks to slow down (429, bulk).
   * @returns The outputs, or why it stopped (`stop` = later rows would fail the same way).
   */
  private async produce(input: ProduceInput, onOutput: (output: CreatorOutput) => void, patient: boolean): Promise<ProduceResult> {
    const targets = this.targets();
    const opened: ImageBitmap[] = [];
    const outputs: CreatorOutput[] = [];
    const failed = (error: string, stop = false): ProduceResult => ({ ok: false, error, stop });
    try {
      const texts = Object.values(input.texts);
      for (const t of targets) await this.resources.ensureFonts(t.template.document, this.ownFonts(), this.curated(), texts);
      if (targets.some(t => this.resources.missingFonts(t.template.document, texts).length)) return failed('error_fonts');
      if (targets.some(t => this.resources.unsupportedCharacters(t.template.document, input.texts).length)) return failed('error_characters');
      const assetIds = [
        ...new Set(targets.flatMap(t => documentReferences(this.resources.withBlocks(t.template.document)).assets)),
        ...Object.values(input.images).flatMap(v => (v.kind === 'asset' ? [v.asset.id] : [])),
      ];
      if ((await this.resources.assetsReady(assetIds)).length) return failed('error_images');

      const total = targets.reduce((sum, t) => sum + t.template.document.pages.length, 0);
      let done = 0;
      for (const target of targets) {
        this.progress.set({ done, total });
        const crops = input.cropsOf[target.template.id] ?? {};
        const images: Record<string, DrawableImage | undefined> = {};
        for (const [key, value] of Object.entries(input.images)) {
          if (value.kind === 'asset') {
            images[key] = this.resources.asset(value.asset.id);
            continue;
          }
          const scale = requiredScale(this.boxes(target, key), value.image, crops[key]?.zoom ?? 1);
          if (!scale) continue;
          const bitmap = await outputBitmap(value.image, scale);
          opened.push(bitmap);
          images[key] = { image: bitmap, width: bitmap.width, height: bitmap.height };
        }
        const name = targets.length > 1 ? `${input.name.slice(0, MAX_OUTPUT_NAME - 14)} – ${target.template.width}×${target.template.height}` : input.name.slice(0, MAX_OUTPUT_NAME);
        const values: RenderValues = { text: input.texts, images, crops };
        const pages = target.template.document.pages.length;
        let content: { file: Blob } | { pages: string[] };
        if (pages === 1) {
          const blob = await this.draw(target.template, values, 0);
          if (typeof blob === 'string') return failed(blob);
          if (blob.size > MAX_OUTPUT_BYTES) return failed('error_too_large');
          if (!this.usage.fits(blob.size)) return failed('error_quota', true);
          content = { file: blob };
          done++;
        } else {
          // A carousel: every slide is drawn and staged on its own, then the output joins them.
          const tokens: string[] = [];
          let bytes = 0;
          for (let page = 0; page < pages; page++) {
            this.progress.set({ done, total });
            const blob = await this.draw(target.template, values, page);
            if (typeof blob === 'string') return failed(blob);
            if (blob.size > MAX_OUTPUT_BYTES) return failed('error_too_large');
            bytes += blob.size;
            if (!this.usage.fits(bytes)) return failed('error_quota', true);
            const staged = await this.call(() => this.outputsApi.stagePage(this.section, target.template.id, blob), patient);
            if (!staged.ok) return this.uploadError(staged.error);
            tokens.push(staged.value.token);
            done++;
          }
          content = { pages: tokens };
        }
        const sent = await this.call(() => this.outputsApi.generate(this.section, {
          ...content, template_id: target.template.id, folder_id: this.folderId(), name, caption: input.caption,
        }), patient);
        if (!sent.ok) return this.uploadError(sent.error);
        outputs.push(sent.value);
        onOutput(sent.value);
        this.usage.refresh();
        opened.splice(0).forEach(bitmap => bitmap.close());
      }
      return { ok: true, outputs };
    } catch {
      return failed('error_draw');
    } finally {
      opened.forEach(bitmap => bitmap.close());
    }
  }

  /**
   * @description Calls the API; when the server asks to slow down (429) and the caller is patient
   *   (bulk), waits for the time it names (Retry-After, at most a minute) and tries again.
   * @param request Makes the request.
   * @param patient Wait and try again on 429 (up to RETRIES times).
   */
  private async call<T>(request: () => Observable<T>, patient: boolean): Promise<{ ok: true; value: T } | { ok: false; error: HttpErrorResponse }> {
    for (let attempt = 0; ; attempt++) {
      try {
        return { ok: true, value: await firstValueFrom(request()) };
      } catch (error) {
        const http = error instanceof HttpErrorResponse ? error : new HttpErrorResponse({ status: 0 });
        if (!patient || http.status !== 429 || attempt >= RETRIES) return { ok: false, error: http };
        const seconds = Math.min(60, Math.max(1, Number(http.headers?.get('Retry-After')) || 15));
        this.waiting.set(seconds);
        await new Promise(resolve => setTimeout(resolve, seconds * 1000));
        this.waiting.set(null);
      }
    }
  }

  /**
   * @description Copies the text of the generated post.
   * @param output Generated output.
   */
  async copyCaption(output: CreatorOutput): Promise<void> {
    try {
      await navigator.clipboard.writeText(output.caption ?? '');
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      this.alert.open(this.t('copy'), this.t('copy_failed'), 'warning');
    }
  }

  /**
   * @description Opens the output on the page Outputs.
   * @param output Generated output.
   */
  openInOutputs(output: CreatorOutput): void {
    void this.router.navigate(['/admin/js-creator/outputs'], { queryParams: { folder: output.folder_id ?? 'root', output: output.id } });
  }

  /**
   * @description Downloads a generated output: a carousel as a ZIP of its slides.
   * @param output Generated output with more pages.
   */
  downloadSlides(output: CreatorOutput): void {
    this.outputsApi.zip([output.id]).subscribe(zip => saveUrl(zip.url));
  }

  /**
   * @description Size of a file for the result.
   * @param bytes Bytes.
   */
  bytes(bytes: number): string {
    return formatBytes(bytes, this.i18n.getDateLocale());
  }

  /**
   * @description Draws a page of the template in its exact size for the output and checks the drawing.
   * @param template Template.
   * @param values Values with the full photos.
   * @param page Page (slide of a carousel).
   * @returns PNG, or the key of the reason when something is missing.
   */
  private async draw(template: CreatorTemplateDetail, values: RenderValues, page: number): Promise<Blob | string> {
    const canvas = document.createElement('canvas');
    canvas.width = template.width;
    canvas.height = template.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'error_draw';
    const report = renderPage(ctx, template.document, template, this.resources, { mode: 'output', values, page });
    // An image field without a value is an optional field left empty (required ones are
    // checked by the form) - its place simply stays empty, like in the preview.
    if (report.missing.some(m => !m.startsWith('field:'))) return 'error_images';
    if (report.overflows.some(o => o.mode === 'block')) return 'error_overflow';
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    canvas.width = canvas.height = 0;
    return blob ?? 'error_draw';
  }

  /**
   * @description Measures a page of a template that is not shown (overflows, missing images) -
   *   drawn into a 1 px canvas, so only the layout runs.
   * @param target Template.
   * @param texts Values of the text fields.
   * @param page Page (slide).
   */
  private measure(target: GenerateTarget, texts: Record<string, string>, page = 0): RenderReport {
    if (this.measureCtx === undefined) {
      this.measureCtx = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
    }
    const ctx = this.measureCtx;
    if (!ctx) return { overflows: [], missing: [] };
    ctx.setTransform(0.001, 0, 0, 0.001, 0, 0);
    return renderPage(ctx, target.template.document, target.template, this.resources, {
      mode: 'output', placeholders: true, page, values: { text: texts, images: {}, crops: {} },
    });
  }

  /**
   * @description Why the API refused an output (a folder gone meanwhile also resets the target).
   * @param error Error of the API.
   * @returns The reason; `stop` when later outputs would be refused the same way.
   */
  private uploadError(error: HttpErrorResponse): ProduceResult {
    const errors = (error.error?.errors ?? {}) as Record<string, string[]>;
    const refused = (key: string, stop = true): ProduceResult => ({ ok: false, error: key, stop });
    if (error.status === 422 && error.error?.error_code === 'quota_exceeded') return refused('error_quota');
    if (error.status === 422 && errors['template_id']) return refused('error_template_gone');
    if (error.status === 422 && (errors['file'] || Object.keys(errors).some(k => k.startsWith('pages')))) return refused('error_template_changed');
    if (error.status === 422 && errors['folder_id']) {
      this.setFolder('');
      this.loadFolders();
      return refused('error_folder_gone');
    }
    if (error.status === 413) return refused('error_too_large', false);
    if (error.status === 429) return refused('error_throttle');
    return { ok: false, error: 'error_upload', detail: String(error.status || this.t('network')), stop: true };
  }

  /**
   * @description Shows why generating stopped.
   * @param result Failed result.
   */
  private failWith(result: ProduceResult): void {
    if (result.ok) return;
    if (result.detail) this.alert.open(this.t('error_title'), `${this.t(result.error)} (${result.detail})`, 'danger');
    else this.fail(result.error);
  }

  /**
   * @description Shows why an output was not generated.
   * @param key Key of the text.
   */
  private fail(key: string): void {
    this.alert.open(this.t('error_title'), this.t(key), 'warning');
  }

  /**
   * @description Sets the image of a field and starts its crop at the focus of the template.
   * @param key Field.
   * @param value Image.
   */
  private setImage(key: string, value: ImageValue): void {
    const current = this.images()[key];
    if (current) this.release(current);
    this.images.update(images => ({ ...images, [key]: value }));
    this.cropsOf.update(all => {
      const next = { ...all };
      for (const t of this.targets()) next[t.template.id] = { ...(next[t.template.id] ?? {}), [key]: defaultCrop(this.boxes(t, key)) };
      return next;
    });
    this.results.set([]);
  }

  /**
   * @description Drawable of an image value (the preview copy of a photo).
   * @param value Value.
   */
  private drawable(value: ImageValue): DrawableImage | undefined {
    if (value.kind === 'asset') return this.resources.asset(value.asset.id);
    return { image: value.image.preview, width: value.image.preview.width, height: value.image.preview.height };
  }

  /**
   * @description Frees the memory of a photo from the computer.
   * @param value Value.
   */
  private release(value: ImageValue): void {
    if (value.kind === 'local') value.image.preview.close();
  }

  /**
   * @description Loads the library images of the template by their ids.
   * @param ids Ids.
   */
  private loadAssets(ids: number[]): void {
    if (!ids.length) return;
    this.templatesApi.assetsByIds(ids).subscribe(page => {
      for (const asset of page.data) this.resources.loadAsset(asset.id, asset.url);
      this.redraw.update(v => v + 1);
    });
  }

  /** @description Loads the folders and picks the last used target that still exists. */
  private loadFolders(): void {
    this.creatorApi.folders().subscribe(folders => {
      this.folders.set(folders);
      let last: string | null = null;
      try {
        last = localStorage.getItem(LAST_FOLDER_KEY);
      } catch {
        last = null;
      }
      const id = last ? Number(last) : null;
      this.folderId.set(id !== null && folders.some(f => f.id === id) ? id : null);
    });
  }

  /** @description Back to the templates / sets. */
  back(): void {
    void this.router.navigate([this.mode === 'set' ? '/admin/js-creator/image-sets' : '/admin/js-creator/image-templates']);
  }

  /**
   * @description Whether a field is a text field (template narrowing).
   * @param field Field.
   */
  isText(field: Field): field is TextField {
    return field.type === 'text';
  }

  /**
   * @description The field as an image field (template narrowing).
   * @param field Field.
   */
  asImage(field: Field): ImageField {
    return field as ImageField;
  }
}
