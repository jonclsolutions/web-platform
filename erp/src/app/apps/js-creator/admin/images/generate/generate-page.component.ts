/**
 * @file generate-page.component.ts
 * @path src/app/apps/js-creator/admin/images/generate/generate-page.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Page "Generate" of the section Images (`image-templates/:id/generate`): the form
 *   of the fields of a template beside the live preview (the same drawing as the output).
 *   - text fields: length, highlight of the selected part (`**…**`), what the template does
 *     when the text does not fit (shrunk / cut / generating refused);
 *   - image fields: a photo from the computer (decoded ONLY in the browser - never uploaded) or
 *     an image of the library; the crop is moved by dragging in the preview and zoomed by a
 *     slider; a warning when the photo is too small for its place;
 *   - the text of the post from the pattern of the template (editable, can be filled again);
 *   - target folder (the last used one is remembered in this browser) and name;
 *   - Generate: waits for every font and image (a fallback font never gets into an output),
 *     draws the template in its exact size to a PNG, sends it to the API (which converts it to
 *     the format of the template) and shows the result with its actions. The form stays filled
 *     (only in the memory of the page) for the next variant.
 * @note Generating needs the create permission of the section; without it the page is a preview.
 * @dependencies TemplatesApiService, OutputsApiService, JsCreatorApiService (fonts, folders),
 *   FontLibraryService, IconSetService, WorkspaceUsageService, RenderResourceStore,
 *   GeneratePreviewComponent, AssetChooserComponent, QuotaBarComponent, generate-form.ts,
 *   local-image.ts, field-images.ts, AlertDialogService, PermissionService, AdminLocalizationService
 *   (section `js-creator-generate`).
 */

import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, effect, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AdminLocalizationService } from '../../../../../core/services/admin-localization.service';
import { AlertDialogService } from '../../../../../core/services/alert-dialog.service';
import { PermissionService } from '../../../../../core/auth/services/permission.service';
import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { TemplatesApiService } from '../../shared/templates-api.service';
import { OutputsApiService } from '../../shared/outputs-api.service';
import { JsCreatorApiService } from '../../shared/js-creator-api.service';
import { FontLibraryService } from '../../shared/font-library.service';
import { IconSetService } from '../../shared/icon-set.service';
import { WorkspaceUsageService } from '../../shared/workspace-usage.service';
import {
  CreatorAsset, CreatorFolder, CreatorFont, CreatorOutput, CreatorTemplateDetail, CuratedFontFamily,
} from '../../shared/js-creator.models';
import { JsCreatorSectionId, sectionPermission } from '../../shared/js-creator-sections';
import { CanvasSize, Field, ImageField, TextField, documentReferences, presetOf } from '../../shared/render/document';
import { ImageCrop, RenderReport, RenderValues, renderPage } from '../../shared/render/renderer';
import { DrawableImage } from '../../shared/render/paint';
import { RenderResourceStore } from '../../shared/render/resource-store';
import { CROP_ZOOM, defaultCrop, fieldImageBoxes, panCrop, requiredScale, zoomCrop } from '../../shared/render/field-images';
import { FolderOption, folderOptions } from '../../shared/folder-tree';
import { formatBytes } from '../../shared/workspace-format';
import { QuotaBarComponent } from '../../shared/quota-bar/quota-bar.component';
import { CreatorIconComponent } from '../../shared/creator-icon/creator-icon.component';
import { UiIconName, uiIcon } from '../../shared/ui-icons';
import { AssetChooserComponent } from '../editor/controls/asset-chooser.component';
import { GeneratePreviewComponent, PreviewPan } from './generate-preview.component';
import {
  GenerateProblem, MAX_CAPTION, MAX_OUTPUT_NAME, defaultOutputName, fillCaption, formProblems, toggleHighlight, visibleLength,
} from './generate-form';
import { LOCAL_IMAGE_ACCEPT, LocalImage, LocalImageError, openLocalImage, outputBitmap } from './local-image';

/** Value of an image field: a photo from the computer or an image of the library. */
export type ImageValue = { kind: 'local'; image: LocalImage } | { kind: 'asset'; asset: CreatorAsset };

/** Key of the last target folder in this browser (only an id - nothing personal). */
const LAST_FOLDER_KEY = 'jsc.generate.folder';

/** Largest PNG the API accepts (bytes; upload profile js_creator_output). */
const MAX_OUTPUT_BYTES = 20 * 1024 * 1024;

/** Enlargement over which a photo is called too small for its place. */
const BLUR_SCALE = 1.05;

@Component({
  selector: 'app-js-creator-generate-page',
  standalone: true,
  imports: [RouterLink, IconComponent, CreatorIconComponent, QuotaBarComponent, GeneratePreviewComponent, AssetChooserComponent],
  templateUrl: './generate-page.component.html',
  styleUrls: ['../../shared-styles/workspace.css', './generate-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GeneratePageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly templatesApi = inject(TemplatesApiService);
  private readonly outputsApi = inject(OutputsApiService);
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
  /** May generate. */
  readonly canCreate = this.permissions.hasPermission(sectionPermission(this.section, 'create'));
  /** May open the editor. */
  readonly canEdit = this.permissions.hasPermission(sectionPermission(this.section, 'update'));
  /** Types of the photo picker. */
  readonly accept = LOCAL_IMAGE_ACCEPT;
  /** Limits shown in the form. */
  readonly maxName = MAX_OUTPUT_NAME;
  readonly maxCaption = MAX_CAPTION;
  readonly zoomLimits = CROP_ZOOM;

  /** The template (null while loading). */
  readonly template = signal<CreatorTemplateDetail | null>(null);
  /** The template could not be loaded. */
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
  /** Crops of the image fields. */
  readonly crops = signal<Record<string, ImageCrop>>({});
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
  /** Last generated output. */
  readonly result = signal<CreatorOutput | null>(null);
  /** The text of the result was copied. */
  readonly copied = signal(false);
  /** Field whose library chooser is open. */
  readonly choosingFor = signal<string | null>(null);
  /** Field whose photo is being opened. */
  readonly opening = signal<string | null>(null);

  /** Document of the template. */
  readonly doc = computed(() => this.template()?.document ?? null);
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
  /** Text fields and image fields in the order of the template. */
  readonly fields = computed<Field[]>(() => this.doc()?.fields ?? []);
  /** Keys of the image fields with an image (draggable in the preview). */
  readonly filledImages = computed(() => Object.keys(this.images()));
  /** Values for the renderer (preview copies of photos). */
  readonly values = computed<RenderValues>(() => {
    this.redraw();
    const images: Record<string, DrawableImage | undefined> = {};
    for (const [key, value] of Object.entries(this.images())) images[key] = this.drawable(value);
    return { text: this.texts(), images, crops: this.crops() };
  });
  /** Text of the post (from the pattern until edited by hand). */
  readonly caption = computed(() => {
    if (this.captionEdited()) return this.captionTyped();
    const doc = this.doc();
    return doc ? fillCaption(this.template()?.caption_template ?? null, doc.fields, this.texts()).slice(0, MAX_CAPTION) : '';
  });
  /** Reasons that stop generating. */
  readonly problems = computed<GenerateProblem[]>(() => {
    const doc = this.doc();
    if (!doc) return [];
    this.redraw();
    const report = this.report();
    const failed = report.missing.filter(m => m.startsWith('asset:') && this.resources.failed(Number(m.slice(6))));
    return formProblems(doc, this.texts(), new Set(this.filledImages()), { overflows: report.overflows, missing: failed });
  });
  /** Overflow of each text field in the preview (mode of its layer). */
  readonly overflowOf = computed(() => {
    const map = new Map<string, 'ellipsis' | 'block'>();
    for (const o of this.report().overflows) if (o.field) map.set(o.field, map.get(o.field) === 'block' ? 'block' : o.mode);
    return map;
  });
  /** Target folders. */
  readonly folderChoices = computed<FolderOption[]>(() => folderOptions(this.folders()));

  /** Signature of the characters in use (fonts are loaded again when it changes). */
  private fontKey = '';

  constructor() {
    effect(() => {
      const doc = this.doc();
      if (!doc) return;
      const texts = Object.values(this.texts());
      const key = [...new Set(Array.from(texts.join('')))].sort().join('');
      if (key === this.fontKey) return;
      this.fontKey = key;
      void this.resources.ensureFonts(doc, this.ownFonts(), this.curated(), texts);
    });
    if (typeof document !== 'undefined' && document.fonts) {
      const done = () => this.redraw.update(v => v + 1);
      document.fonts.addEventListener('loadingdone', done);
      this.destroyRef.onDestroy(() => document.fonts.removeEventListener('loadingdone', done));
    }
    this.destroyRef.onDestroy(() => Object.values(this.images()).forEach(v => this.release(v)));
  }

  /** @description Loads the template, fonts, icons, folders and the library images it uses. */
  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    forkJoin({
      template: this.templatesApi.get(this.section, id),
      fonts: this.creatorApi.fonts(),
      curated: this.fontLibrary.curatedFamilies(),
      icons: this.iconSets.iconSet(),
    }).subscribe({
      next: ({ template, fonts, curated, icons }) => {
        this.ownFonts.set(fonts);
        this.curated.set(curated);
        this.resources.setIcons(icons);
        this.texts.set(Object.fromEntries(template.document.fields.filter(f => f.type === 'text').map(f => [f.key, ''])));
        this.template.set(template);
        this.loadAssets(documentReferences(template.document).assets);
      },
      error: () => this.failed.set(true),
    });
    this.loadFolders();
    this.usage.refresh();
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
    this.result.set(null);
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
    this.crops.update(crops => {
      const next = { ...crops };
      delete next[key];
      return next;
    });
    this.result.set(null);
  }

  /**
   * @description Zoom of the crop of a field changed.
   * @param key Field.
   * @param value Value of the slider.
   */
  setZoom(key: string, value: string): void {
    const crop = this.crops()[key];
    if (crop) this.crops.update(crops => ({ ...crops, [key]: zoomCrop(crop, Number(value) || 1) }));
  }

  /**
   * @description The crop of a field back to the focus of the template.
   * @param key Field.
   */
  resetCrop(key: string): void {
    const doc = this.doc();
    if (doc) this.crops.update(crops => ({ ...crops, [key]: defaultCrop(fieldImageBoxes(doc, this.size(), key)) }));
  }

  /**
   * @description An image was dragged in the preview: move its crop.
   * @param pan Field, place and distance.
   */
  onPan(pan: PreviewPan): void {
    const value = this.images()[pan.key];
    const crop = this.crops()[pan.key];
    if (!value || !crop) return;
    this.crops.update(crops => ({ ...crops, [pan.key]: panCrop(crop, pan.box, this.naturalSize(value), pan.dx, pan.dy) }));
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
    const doc = this.doc();
    if (!value || !doc) return '';
    const size = this.naturalSize(value);
    if ((field.minWidth > 0 && size.width < field.minWidth) || (field.minHeight > 0 && size.height < field.minHeight)) {
      return this.tf('resolution_min', { width: field.minWidth || '–', height: field.minHeight || '–' });
    }
    const scale = requiredScale(fieldImageBoxes(doc, this.size(), field.key), size, this.crops()[field.key]?.zoom ?? 1);
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

  /** @description Placeholder of the name: the default name. */
  get namePlaceholder(): string {
    return defaultOutputName(this.template()?.name ?? '', new Date(), this.i18n.getDateLocale());
  }

  /**
   * @description Text of a problem.
   * @param problem Problem.
   */
  problemText(problem: GenerateProblem): string {
    return this.tf(`problem_${problem.kind}`, { field: problem.label });
  }

  /**
   * @description Name of the target folder of the result.
   * @param output Generated output.
   */
  folderName(output: CreatorOutput): string {
    return this.folders().find(f => f.id === output.folder_id)?.name ?? this.t('root');
  }

  // ── generating ──────────────────────────────────────────────────────────────

  /** @description Generates the output and stores it in the chosen folder. */
  async generate(): Promise<void> {
    const template = this.template();
    const doc = this.doc();
    if (!template || !doc || !this.canCreate || this.generating()) return;
    this.attempted.set(true);
    if (this.problems().length) return;
    this.generating.set(true);
    this.result.set(null);
    const opened: ImageBitmap[] = [];
    try {
      const texts = Object.values(this.texts());
      await this.resources.ensureFonts(doc, this.ownFonts(), this.curated(), texts);
      if (this.resources.missingFonts(doc, texts).length) return this.fail('error_fonts');
      const assetIds = [
        ...documentReferences(doc).assets,
        ...Object.values(this.images()).flatMap(v => (v.kind === 'asset' ? [v.asset.id] : [])),
      ];
      if ((await this.resources.assetsReady(assetIds)).length) return this.fail('error_images');

      const images: Record<string, DrawableImage | undefined> = {};
      for (const [key, value] of Object.entries(this.images())) {
        if (value.kind === 'asset') {
          images[key] = this.resources.asset(value.asset.id);
          continue;
        }
        const scale = requiredScale(fieldImageBoxes(doc, this.size(), key), value.image, this.crops()[key]?.zoom ?? 1);
        const bitmap = await outputBitmap(value.image, scale);
        opened.push(bitmap);
        images[key] = { image: bitmap, width: bitmap.width, height: bitmap.height };
      }

      const blob = await this.draw(template, { text: this.texts(), images, crops: this.crops() });
      if (!blob) return;
      if (blob.size > MAX_OUTPUT_BYTES) return this.fail('error_too_large');
      if (!this.usage.fits(blob.size)) return this.fail('error_quota');
      await this.upload(template, blob);
    } catch {
      this.fail('error_draw');
    } finally {
      opened.forEach(bitmap => bitmap.close());
      this.generating.set(false);
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
   * @description Size of a file for the result.
   * @param bytes Bytes.
   */
  bytes(bytes: number): string {
    return formatBytes(bytes, this.i18n.getDateLocale());
  }

  /**
   * @description Draws the template in its exact size for the output and checks the drawing.
   * @param template Template.
   * @param values Values with the full photos.
   * @returns PNG, or null when something is missing (the reason is shown).
   */
  private async draw(template: CreatorTemplateDetail, values: RenderValues): Promise<Blob | null> {
    const canvas = document.createElement('canvas');
    canvas.width = template.width;
    canvas.height = template.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      this.fail('error_draw');
      return null;
    }
    const report = renderPage(ctx, template.document, this.size(), this.resources, { mode: 'output', values });
    if (report.missing.length) {
      this.fail('error_images');
      return null;
    }
    if (report.overflows.some(o => o.mode === 'block')) {
      this.fail('error_overflow');
      return null;
    }
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    canvas.width = canvas.height = 0;
    if (!blob) this.fail('error_draw');
    return blob;
  }

  /**
   * @description Sends the output and shows the result (or explains a refusal).
   * @param template Template.
   * @param blob PNG.
   */
  private upload(template: CreatorTemplateDetail, blob: Blob): Promise<void> {
    const name = this.name().trim() || defaultOutputName(template.name, new Date(), this.i18n.getDateLocale());
    return new Promise(resolve => {
      this.outputsApi.generate(this.section, {
        file: blob, template_id: template.id, folder_id: this.folderId(), name, caption: this.caption(),
      }).subscribe({
        next: output => {
          this.result.set(output);
          this.usage.refresh();
          setTimeout(() => document.querySelector('.gen-result')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
          resolve();
        },
        error: (error: HttpErrorResponse) => {
          this.uploadFailed(error);
          resolve();
        },
      });
    });
  }

  /**
   * @description Explains a refused output.
   * @param error Error of the API.
   */
  private uploadFailed(error: HttpErrorResponse): void {
    const errors = (error.error?.errors ?? {}) as Record<string, string[]>;
    if (error.status === 422 && error.error?.error_code === 'quota_exceeded') return this.fail('error_quota');
    if (error.status === 422 && errors['template_id']) return this.fail('error_template_gone');
    if (error.status === 422 && errors['file']) return this.fail('error_template_changed');
    if (error.status === 422 && errors['folder_id']) {
      this.setFolder('');
      this.loadFolders();
      return this.fail('error_folder_gone');
    }
    if (error.status === 413) return this.fail('error_too_large');
    if (error.status === 429) return this.fail('error_throttle');
    this.alert.open(this.t('error_title'), `${this.t('error_upload')} (${error.status || this.t('network')})`, 'danger');
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
    this.resetCrop(key);
    this.result.set(null);
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

  /** @description Back to the templates. */
  back(): void {
    void this.router.navigate(['/admin/js-creator/image-templates']);
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
