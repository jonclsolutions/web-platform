/**
 * @file template-panel.component.ts
 * @path src/app/apps/js-creator/admin/images/editor/panels/template-panel.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Panel "Template" of the editor: the size (preset or custom - layers keep their
 *   anchors), the background (fill, image of a field or of the library with its fit, focus and
 *   overlay), the output format (PNG, or JPG with its quality) and the pattern of the post text
 *   (`{{key}}` = value of a field, buttons insert the fields).
 * @usage `<app-jc-template-panel [store]="store" [assets]="assets" (assetPicked)="…" />`
 * @dependencies EditorStore, SizePickerComponent, FillEditorComponent, SourcePickerComponent,
 *   render/document.ts, AdminLocalizationService (section `js-creator-editor`).
 */

import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, computed, inject, input, output } from '@angular/core';
import { AdminLocalizationService } from '../../../../../../core/services/admin-localization.service';
import { EditorStore, EditorSnapshot } from '../editor-store';
import { Background, CanvasSize, DOCUMENT_LIMITS, Fill, ImageField, ImageSource, fieldKeyFrom, isValidSize, safeZoneOf } from '../../../shared/render/document';
import { CreatorAsset } from '../../../shared/js-creator.models';
import { SizePickerComponent } from '../../../shared/size-picker/size-picker.component';
import { FillEditorComponent } from '../controls/fill-editor.component';
import { SourcePickerComponent } from '../controls/source-picker.component';

@Component({
  selector: 'app-jc-template-panel',
  standalone: true,
  imports: [SizePickerComponent, FillEditorComponent, SourcePickerComponent],
  templateUrl: './template-panel.component.html',
  styleUrls: ['../../../shared-styles/workspace.css', '../controls/controls.css', './panels.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplatePanelComponent {
  private readonly i18n = inject(AdminLocalizationService);

  /** State of the editor. */
  readonly store = input.required<EditorStore>();
  /** Known library images. */
  readonly assets = input<ReadonlyMap<number, CreatorAsset>>(new Map());
  /** A library image was chosen. */
  readonly assetPicked = output<CreatorAsset>();

  @ViewChild('caption') private captionArea?: ElementRef<HTMLTextAreaElement>;

  /** Longest caption. */
  readonly maxCaption = DOCUMENT_LIMITS.maxCaption;
  /** State of the template. */
  readonly state = computed(() => this.store().state());
  /** Background of the page. */
  readonly background = computed(() => this.store().doc().pages[0].background);
  /** Image fields. */
  readonly imageFields = computed(() => this.store().doc().fields.filter((f): f is ImageField => f.type === 'image'));
  /** Safe zone of the size. */
  readonly safeZone = computed(() => safeZoneOf(this.store().size()));

  /**
   * @description Text of the editor.
   * @param key Key in `js-creator-editor`.
   */
  t(key: string): string {
    return this.i18n.getValue(`js-creator-editor.${key}`);
  }

  /**
   * @description New size of the canvas (only a valid one is applied).
   * @param size Size.
   */
  setSize(size: CanvasSize): void {
    if (isValidSize(size)) this.store().resize(size);
  }

  /**
   * @description Changes the background.
   * @param patch Changed parts.
   * @param step Coalescing key.
   */
  setBackground(patch: Partial<Background>, step: string | null = null): void {
    this.store().mutate(doc => {
      doc.pages[0].background = { ...doc.pages[0].background, ...patch };
    }, step);
  }

  /**
   * @description Fill of the background.
   * @param fill Fill.
   */
  setFill(fill: Fill | null): void {
    if (fill) this.setBackground({ fill }, 'bg-fill');
  }

  /**
   * @description Switches the background image on (no source yet) / off.
   * @param on On.
   */
  toggleImage(on: boolean): void {
    this.setBackground({ image: on ? { source: { kind: 'none' }, fit: 'cover', focusX: 0.5, focusY: 0.5, overlay: null } : null });
  }

  /**
   * @description Changes the background image.
   * @param patch Changed properties.
   * @param step Coalescing key.
   */
  setImage(patch: Partial<NonNullable<Background['image']>>, step: string | null = null): void {
    const image = this.background().image;
    if (image) this.setBackground({ image: { ...image, ...patch } }, step);
  }

  /**
   * @description New image field used by the background.
   */
  newBackgroundField(): void {
    const label = this.t('background_field');
    this.store().mutate(doc => {
      const key = fieldKeyFrom(label, new Set(doc.fields.map(f => f.key)));
      doc.fields.push({ key, type: 'image', label, help: '', required: true, minWidth: 0, minHeight: 0 });
      const image = doc.pages[0].background.image;
      if (image) image.source = { kind: 'field', field: key } as ImageSource;
    });
  }

  /**
   * @description Library image of the background source.
   * @param source Source.
   */
  assetOf(source: ImageSource): CreatorAsset | undefined {
    return source.kind === 'asset' ? this.assets().get(source.assetId) : undefined;
  }

  /**
   * @description Changes a property of the template (not of the document).
   * @param patch Changed properties.
   * @param step Coalescing key.
   */
  setTemplate(patch: Partial<EditorSnapshot>, step: string | null = null): void {
    this.store().commit(draft => Object.assign(draft, patch), step);
  }

  /**
   * @description Quality of JPG from an input.
   * @param event Input event.
   */
  setQuality(event: Event): void {
    const value = (event.target as HTMLInputElement).valueAsNumber;
    if (Number.isFinite(value)) this.setTemplate({ outputQuality: Math.min(100, Math.max(1, Math.round(value))) }, 'quality');
  }

  /**
   * @description Inserts `{{key}}` of a field at the cursor of the caption.
   * @param key Field key.
   */
  insertField(key: string): void {
    const area = this.captionArea?.nativeElement;
    const text = this.state().caption;
    const start = area?.selectionStart ?? text.length;
    const end = area?.selectionEnd ?? text.length;
    const token = `{{${key}}}`;
    this.setTemplate({ caption: (text.slice(0, start) + token + text.slice(end)).slice(0, this.maxCaption) });
    this.store().endStep();
    setTimeout(() => {
      area?.focus();
      area?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  /**
   * @description Placeholder of a field in the caption.
   * @param key Field key.
   */
  token(key: string): string {
    return `{{${key}}}`;
  }

  /**
   * @description Number of characters of a text (as people count them).
   * @param text Text.
   */
  length(text: string): number {
    return Array.from(text).length;
  }
}
