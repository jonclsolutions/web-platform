/**
 * @file color-input.component.ts
 * @path src/app/apps/js-creator/admin/images/editor/controls/color-input.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Colour of the editor: the colour picker of the browser, the hex code and the
 *   opacity (0-100 %). The value is `#rrggbb` (opaque) or `#rrggbbaa`.
 * @usage `<app-jc-color [value]="layer.color" (valueChange)="set('color', $event)" [label]="t('color')" inputId="jc-c1" />`
 * @dependencies none.
 */

import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

/** Valid colour of a document. */
const COLOR = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;

@Component({
  selector: 'app-jc-color',
  standalone: true,
  template: `
    <div class="jc-color">
      <input type="color" class="jc-color-pick" [id]="inputId" [value]="rgb" [disabled]="disabled" [attr.aria-label]="label"
        (input)="pick($any($event.target).value)" />
      <input type="text" class="jc-color-hex" [value]="value" maxlength="9" spellcheck="false" [disabled]="disabled"
        [attr.aria-label]="label + ' (hex)'" (change)="typed($any($event.target))" />
      <input type="number" class="jc-color-alpha" min="0" max="100" step="1" [value]="alphaPercent" [disabled]="disabled"
        [attr.aria-label]="alphaLabel" [title]="alphaLabel" (change)="setAlpha($any($event.target).valueAsNumber)" />
      <span class="jc-color-unit">%</span>
    </div>
  `,
  styleUrl: './controls.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColorInputComponent {
  /** Colour `#rrggbb(aa)`. */
  @Input({ required: true }) value = '#000000';
  /** Accessible name. */
  @Input() label = '';
  /** Accessible name of the opacity. */
  @Input() alphaLabel = '';
  /** Id of the colour picker (for a label). */
  @Input() inputId = '';
  /** Read only. */
  @Input() disabled = false;
  /** New colour. */
  @Output() readonly valueChange = new EventEmitter<string>();

  /** @description Colour without the opacity. */
  get rgb(): string {
    return this.value.slice(0, 7).toLowerCase();
  }

  /** @description Opacity 0-100. */
  get alphaPercent(): number {
    return this.value.length === 9 ? Math.round((parseInt(this.value.slice(7), 16) / 255) * 100) : 100;
  }

  /**
   * @description Colour of the picker (keeps the opacity).
   * @param rgb `#rrggbb`.
   */
  pick(rgb: string): void {
    this.valueChange.emit(withAlpha(rgb, this.alphaPercent));
  }

  /**
   * @description Typed hex code (ignored when invalid - the old value comes back).
   * @param input Text input.
   */
  typed(input: HTMLInputElement): void {
    let text = input.value.trim();
    if (!text.startsWith('#')) text = '#' + text;
    if (COLOR.test(text)) this.valueChange.emit(text.toLowerCase());
    else input.value = this.value;
  }

  /**
   * @description New opacity.
   * @param percent 0-100.
   */
  setAlpha(percent: number): void {
    if (Number.isFinite(percent)) this.valueChange.emit(withAlpha(this.rgb, percent));
  }
}

/**
 * @description Colour with an opacity: `#rrggbb` for 100 %, otherwise `#rrggbbaa`.
 * @param rgb `#rrggbb`.
 * @param percent 0-100.
 */
export function withAlpha(rgb: string, percent: number): string {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  return p >= 100 ? rgb.toLowerCase() : rgb.toLowerCase() + Math.round((p * 255) / 100).toString(16).padStart(2, '0');
}
