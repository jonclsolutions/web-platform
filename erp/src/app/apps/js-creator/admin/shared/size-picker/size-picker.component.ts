/**
 * @file size-picker.component.ts
 * @path src/app/apps/js-creator/admin/shared/size-picker/size-picker.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Choice of the size of a template: a preset of a social network (Instagram, Story /
 *   Reels, Facebook / LinkedIn, X, YouTube, Pinterest) or a custom width × height (100-3000 px).
 *   Used by the new-template popup, "duplicate to another format" and the format panel of the
 *   editor.
 * @usage `<app-jc-size-picker [size]="size" (sizeChange)="size = $event" idPrefix="jc-new" />`
 * @dependencies render/document.ts (presets, limits), AdminLocalizationService (section
 *   `js-creator-templates`).
 */

import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminLocalizationService } from '../../../../../core/services/admin-localization.service';
import { CanvasSize, DOCUMENT_LIMITS, SIZE_PRESETS, SizePreset, presetOf } from '../render/document';

@Component({
  selector: 'app-jc-size-picker',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './size-picker.component.html',
  styleUrls: ['../../shared-styles/workspace.css', './size-picker.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SizePickerComponent {
  private readonly i18n = inject(AdminLocalizationService);

  /** Current size. */
  @Input({ required: true }) size!: CanvasSize;
  /** Prefix of the ids of the inputs (unique on the page). */
  @Input() idPrefix = 'jc-size';
  /** New size. */
  @Output() readonly sizeChange = new EventEmitter<CanvasSize>();

  /** Presets of the networks. */
  readonly presets = SIZE_PRESETS;
  /** Limits of a side. */
  readonly min = DOCUMENT_LIMITS.minSide;
  readonly max = DOCUMENT_LIMITS.maxSide;
  /** The custom inputs are open (also for a preset size the user wants to change). */
  private customOpen = false;

  /**
   * @description Text of the section.
   * @param key Key in `js-creator-templates`.
   */
  t(key: string): string {
    return this.i18n.getValue(`js-creator-templates.${key}`);
  }

  /**
   * @description Label of a preset with its size.
   * @param preset Preset.
   */
  label(preset: SizePreset): string {
    return `${this.t(preset.labelKey)} – ${preset.width} × ${preset.height}`;
  }

  /** @description Value of the select: id of the preset, or `custom`. */
  get selected(): string {
    return this.customOpen ? 'custom' : presetOf(this.size)?.id ?? 'custom';
  }

  /**
   * @description A preset or "custom" was chosen.
   * @param value Id of a preset or `custom`.
   */
  choose(value: string): void {
    const preset = SIZE_PRESETS.find(p => p.id === value);
    this.customOpen = !preset;
    if (preset) this.sizeChange.emit({ width: preset.width, height: preset.height });
  }

  /**
   * @description A custom side changed.
   * @param side width | height.
   * @param value New value.
   */
  setSide(side: 'width' | 'height', value: number): void {
    this.customOpen = true;
    this.sizeChange.emit({ ...this.size, [side]: Math.round(Number(value) || 0) });
  }
}
