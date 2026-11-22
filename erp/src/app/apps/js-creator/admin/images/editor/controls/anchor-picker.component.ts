/**
 * @file anchor-picker.component.ts
 * @path src/app/apps/js-creator/admin/images/editor/controls/anchor-picker.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description 3 × 3 grid of the anchor points of a layer (corners, middles of the edges,
 *   centre). The selected point is marked; a click emits the point.
 * @usage `<app-jc-anchor [value]="layer.anchor" (picked)="store.setAnchor(layer.id, $event)" [labels]="anchorLabels" />`
 * @dependencies render/document.ts (ANCHORS).
 */

import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { ANCHORS, Anchor } from '../../../shared/render/document';

@Component({
  selector: 'app-jc-anchor',
  standalone: true,
  template: `
    <div class="jc-anchor" role="group" [attr.aria-label]="label">
      @for (anchor of anchors; track anchor) {
        <button type="button" class="jc-anchor-dot" [class.jc-anchor-dot--on]="anchor === value" [disabled]="disabled"
          [attr.aria-pressed]="anchor === value" [title]="labels[anchor] || anchor" [attr.aria-label]="labels[anchor] || anchor"
          (click)="picked.emit(anchor)"><span></span></button>
      }
    </div>
  `,
  styleUrl: './controls.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnchorPickerComponent {
  /** Selected anchor (null = none marked). */
  @Input() value: Anchor | null = null;
  /** Name of the group. */
  @Input() label = '';
  /** Names of the points. */
  @Input() labels: Partial<Record<Anchor, string>> = {};
  /** Read only. */
  @Input() disabled = false;
  /** Point clicked. */
  @Output() readonly picked = new EventEmitter<Anchor>();

  /** Points in reading order. */
  readonly anchors = ANCHORS;
}
