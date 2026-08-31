/**
 * @file icon.component.ts
 * @path src/app/shared/components/icon/icon.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Centralized inline-SVG icon set used across admin table builders
 * (replaces ad-hoc emoji in TableButtons/Button configs). Adding a new icon = one
 * new @case in icon.component.html, then reference it by `name` from any *.config.ts.
 * @note Icons render in solid black (see icon.component.css) regardless of the
 * parent button's `color`/`currentColor` context - admin tables have a white
 * background, so icons are intentionally NOT tinted per button type (info/danger/etc).
 * Hover feedback lives on the parent <button>, not here - see table-style.css.
 */
import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

export type IconName =
  | 'search' | 'edit' | 'delete' | 'restore' | 'purge'
  | 'filter' | 'plus' | 'export' | 'import' | 'mail' | 'chart' | 'trash'
  | 'link' | 'settings' | 'folder' | 'chat' | 'package' | 'image' | 'key'
  | 'folder-open' | 'sparkles' | 'circle' | 'check' | 'x';

@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './icon.component.html',
  styleUrls: ['./icon.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IconComponent {
  /** Which icon to render. Undefined renders nothing (caller falls back to text). */
  @Input() name?: string;
  /** Square size in px, applied to both width and height. */
  @Input() size: number = 16;
}