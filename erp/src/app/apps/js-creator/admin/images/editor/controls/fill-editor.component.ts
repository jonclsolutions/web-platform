/**
 * @file fill-editor.component.ts
 * @path src/app/apps/js-creator/admin/images/editor/controls/fill-editor.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Fill of the editor: none (when allowed), a colour, a linear gradient (angle) or a
 *   radial gradient with 2-6 colour stops (position in % and colour). Changing the kind keeps the
 *   colours that fit.
 * @usage `<app-jc-fill [fill]="layer.fill" (fillChange)="set('fill', $event)" [allowNone]="true" idPrefix="jc-f1" />`
 * @dependencies ColorInputComponent, render/document.ts (Fill), AdminLocalizationService
 *   (section `js-creator-editor`).
 */

import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { AdminLocalizationService } from '../../../../../../core/services/admin-localization.service';
import { Fill, GradientStop } from '../../../shared/render/document';
import { ColorInputComponent } from './color-input.component';

@Component({
  selector: 'app-jc-fill',
  standalone: true,
  imports: [ColorInputComponent],
  template: `
    <div class="jc-fill">
      <select class="jc-input" [id]="idPrefix + '-kind'" [disabled]="disabled" [attr.aria-label]="label || t('fill')"
        (change)="setKind($any($event.target).value)">
        @if (allowNone) { <option value="none" [selected]="kind === 'none'">{{ t('fill_none') }}</option> }
        <option value="solid" [selected]="kind === 'solid'">{{ t('fill_solid') }}</option>
        <option value="linear" [selected]="kind === 'linear'">{{ t('fill_linear') }}</option>
        <option value="radial" [selected]="kind === 'radial'">{{ t('fill_radial') }}</option>
      </select>
      @if (fill?.type === 'solid') {
        <app-jc-color [value]="$any(fill).color" [label]="t('color')" [alphaLabel]="t('opacity')" [disabled]="disabled"
          (valueChange)="emit({ type: 'solid', color: $event })" />
      }
      @if (fill && fill.type !== 'solid') {
        @if (fill.type === 'linear') {
          <label class="jc-inline">
            <span>{{ t('angle') }}</span>
            <input class="jc-input jc-input--num" type="number" min="0" max="360" step="1" [value]="$any(fill).angle" [disabled]="disabled"
              (change)="setAngle($any($event.target).valueAsNumber)" />
            <span class="jc-unit">°</span>
          </label>
        }
        @for (stop of stops; track $index; let i = $index) {
          <div class="jc-stop">
            <input class="jc-input jc-input--num" type="number" min="0" max="100" step="1" [value]="round(stop.offset * 100)" [disabled]="disabled"
              [attr.aria-label]="t('stop_position')" (change)="setStop(i, { offset: clamp($any($event.target).valueAsNumber) / 100 })" />
            <span class="jc-unit">%</span>
            <app-jc-color [value]="stop.color" [label]="t('color')" [alphaLabel]="t('opacity')" [disabled]="disabled"
              (valueChange)="setStop(i, { color: $event })" />
            <button type="button" class="jc-mini-btn" [disabled]="disabled || stops.length <= 2" [title]="t('remove_stop')"
              [attr.aria-label]="t('remove_stop')" (click)="removeStop(i)">×</button>
          </div>
        }
        @if (stops.length < 6) {
          <button type="button" class="jc-link-btn" [disabled]="disabled" (click)="addStop()">+ {{ t('add_stop') }}</button>
        }
      }
    </div>
  `,
  styleUrl: './controls.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FillEditorComponent {
  private readonly i18n = inject(AdminLocalizationService);

  /** Fill (null = none). */
  @Input() fill: Fill | null = null;
  /** "None" may be chosen. */
  @Input() allowNone = false;
  /** Accessible name of the kind select. */
  @Input() label = '';
  /** Prefix of the ids. */
  @Input() idPrefix = 'jc-fill';
  /** Read only. */
  @Input() disabled = false;
  /** New fill. */
  @Output() readonly fillChange = new EventEmitter<Fill | null>();

  /**
   * @description Text of the editor.
   * @param key Key in `js-creator-editor`.
   */
  t(key: string): string {
    return this.i18n.getValue(`js-creator-editor.${key}`);
  }

  /** @description Kind of the fill (`none` for null). */
  get kind(): string {
    return this.fill?.type ?? 'none';
  }

  /** @description Stops of a gradient. */
  get stops(): GradientStop[] {
    return this.fill && this.fill.type !== 'solid' ? this.fill.stops : [];
  }

  /**
   * @description Whole number.
   * @param value Number.
   */
  round(value: number): number {
    return Math.round(value);
  }

  /**
   * @description Position 0-100.
   * @param value Number.
   */
  clamp(value: number): number {
    return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  }

  /**
   * @description Emits a new fill.
   * @param fill Fill.
   */
  emit(fill: Fill | null): void {
    this.fillChange.emit(fill);
  }

  /**
   * @description Changes the kind, keeping the colours.
   * @param kind none | solid | linear | radial.
   */
  setKind(kind: string): void {
    const first = this.fill?.type === 'solid' ? this.fill.color : this.stops[0]?.color ?? '#000000';
    const stops: GradientStop[] = this.stops.length ? this.stops : [{ offset: 0, color: first }, { offset: 1, color: '#ffffff' }];
    if (kind === 'none') this.emit(null);
    else if (kind === 'solid') this.emit({ type: 'solid', color: first });
    else if (kind === 'linear') this.emit({ type: 'linear', angle: this.fill?.type === 'linear' ? this.fill.angle : 180, stops });
    else this.emit({ type: 'radial', stops });
  }

  /**
   * @description New angle of a linear gradient.
   * @param angle Degrees.
   */
  setAngle(angle: number): void {
    if (this.fill?.type === 'linear' && Number.isFinite(angle)) this.emit({ ...this.fill, angle: ((Math.round(angle) % 360) + 360) % 360 });
  }

  /**
   * @description Changes one stop.
   * @param index Stop.
   * @param patch Position and / or colour.
   */
  setStop(index: number, patch: Partial<GradientStop>): void {
    if (!this.fill || this.fill.type === 'solid') return;
    this.emit({ ...this.fill, stops: this.stops.map((s, i) => i === index ? { ...s, ...patch } : s) });
  }

  /** @description Adds a stop in the middle. */
  addStop(): void {
    if (!this.fill || this.fill.type === 'solid') return;
    this.emit({ ...this.fill, stops: [...this.stops, { offset: 0.5, color: this.stops[0]?.color ?? '#000000' }].sort((a, b) => a.offset - b.offset) });
  }

  /**
   * @description Removes a stop (at least two stay).
   * @param index Stop.
   */
  removeStop(index: number): void {
    if (!this.fill || this.fill.type === 'solid' || this.stops.length <= 2) return;
    this.emit({ ...this.fill, stops: this.stops.filter((_, i) => i !== index) });
  }
}
