/**
 * @file source-picker.component.ts
 * @path src/app/apps/js-creator/admin/images/editor/controls/source-picker.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Source of an image of a template: none, a field filled in when generating (an
 *   existing image field or a new one) or a fixed image of the library (popup with the library).
 * @usage `<app-jc-source [source]="layer.source" [fields]="imageFields" [asset]="assetOf(id)"
 *   (sourceChange)="…" (newField)="…" (assetPicked)="…" idPrefix="jc-src" />`
 * @dependencies AssetChooserComponent, render/document.ts, AdminLocalizationService (section
 *   `js-creator-editor`).
 */

import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { AdminLocalizationService } from '../../../../../../core/services/admin-localization.service';
import { ImageField, ImageSource } from '../../../shared/render/document';
import { CreatorAsset } from '../../../shared/js-creator.models';
import { AssetChooserComponent } from './asset-chooser.component';

/** Value of the field select that asks for a new field. */
const NEW_FIELD = '__new__';

@Component({
  selector: 'app-jc-source',
  standalone: true,
  imports: [AssetChooserComponent],
  template: `
    <div class="jc-source">
      <select class="jc-input" [id]="idPrefix + '-kind'" [disabled]="disabled" [attr.aria-label]="label || t('source')"
        (change)="setKind($any($event.target).value)">
        <option value="none" [selected]="source.kind === 'none'">{{ t('source_none') }}</option>
        <option value="field" [selected]="source.kind === 'field'">{{ t('source_field') }}</option>
        <option value="asset" [selected]="source.kind === 'asset'">{{ t('source_asset') }}</option>
      </select>
      @if (source.kind === 'field') {
        <select class="jc-input" [id]="idPrefix + '-field'" [disabled]="disabled" [attr.aria-label]="t('field')"
          (change)="setField($any($event.target).value)">
          @for (field of fields; track field.key) {
            <option [value]="field.key" [selected]="field.key === $any(source).field">{{ field.label }} ({{ field.key }})</option>
          }
          <option [value]="newFieldValue">+ {{ t('new_field') }}</option>
        </select>
      }
      @if (source.kind === 'asset') {
        <div class="jc-source-asset">
          @if (asset) {
            <img [src]="asset.thumb_url" [alt]="asset.name" />
            <span class="jc-source-name" [title]="asset.name">{{ asset.name }}</span>
          } @else {
            <span class="jc-source-name">#{{ $any(source).assetId }}</span>
          }
          <button type="button" class="jc-link-btn" [disabled]="disabled" (click)="choosing = true">{{ t('change') }}</button>
        </div>
      }
    </div>
    @if (choosing) {
      <app-jc-asset-chooser (chosen)="pick($event)" (dismissed)="choosing = false" />
    }
  `,
  styleUrl: './controls.css',
  styles: [`
    .jc-source { display: flex; flex-direction: column; gap: 6px; }
    .jc-source-asset { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .jc-source-asset img { width: 40px; height: 40px; object-fit: contain; border: 1px solid var(--color-zinc-200); border-radius: 6px; background: var(--color-zinc-50); }
    .jc-source-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.78rem; color: var(--color-zinc-700); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SourcePickerComponent {
  private readonly i18n = inject(AdminLocalizationService);

  /** Current source. */
  @Input({ required: true }) source!: ImageSource;
  /** Image fields of the template. */
  @Input() fields: ImageField[] = [];
  /** Library image of an asset source (thumbnail), when known. */
  @Input() asset: CreatorAsset | undefined;
  /** Accessible name. */
  @Input() label = '';
  /** Prefix of the ids. */
  @Input() idPrefix = 'jc-src';
  /** Read only. */
  @Input() disabled = false;
  /** New source. */
  @Output() readonly sourceChange = new EventEmitter<ImageSource>();
  /** A new image field is wanted (the parent creates it and sets the source). */
  @Output() readonly newField = new EventEmitter<void>();
  /** An image of the library was chosen (the parent loads it). */
  @Output() readonly assetPicked = new EventEmitter<CreatorAsset>();

  /** The library popup is open. */
  choosing = false;
  /** Value of "new field" in the field select. */
  readonly newFieldValue = NEW_FIELD;

  /**
   * @description Text of the editor.
   * @param key Key in `js-creator-editor`.
   */
  t(key: string): string {
    return this.i18n.getValue(`js-creator-editor.${key}`);
  }

  /**
   * @description Kind of the source changed.
   * @param kind none | field | asset.
   */
  setKind(kind: string): void {
    if (kind === 'none') this.sourceChange.emit({ kind: 'none' });
    else if (kind === 'field') {
      if (this.fields.length) this.sourceChange.emit({ kind: 'field', field: this.fields[0].key });
      else this.newField.emit();
    } else {
      this.choosing = true;
    }
  }

  /**
   * @description A field was chosen (or "new field").
   * @param key Field key or NEW_FIELD.
   */
  setField(key: string): void {
    if (key === NEW_FIELD) this.newField.emit();
    else this.sourceChange.emit({ kind: 'field', field: key });
  }

  /**
   * @description An image of the library was chosen.
   * @param asset Image.
   */
  pick(asset: CreatorAsset): void {
    this.choosing = false;
    this.assetPicked.emit(asset);
    this.sourceChange.emit({ kind: 'asset', assetId: asset.id });
  }
}
