/**
 * @file creator-icon.component.ts
 * @path src/app/apps/js-creator/admin/shared/creator-icon/creator-icon.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description One icon of the icon set of JS Creator drawn as inline SVG from its element list
 *   (path, circle, line, polyline, polygon, rect) - attribute bindings only, never innerHTML.
 * @usage `<app-creator-icon [nodes]="set.icons['heart']" [size]="32" />`
 * @dependencies IconNode (js-creator.models.ts).
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { IconNode } from '../js-creator.models';

@Component({
  selector: 'app-creator-icon',
  standalone: true,
  templateUrl: './creator-icon.component.html',
  styleUrl: './creator-icon.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreatorIconComponent {
  /** Elements of the icon. */
  @Input({ required: true }) nodes: IconNode[] = [];
  /** Edge in px. */
  @Input() size = 24;
  /** Line width (in the 24 px grid of the icon). */
  @Input() strokeWidth = 2;
  /** Accessible name (empty = decorative). */
  @Input() label = '';
}
