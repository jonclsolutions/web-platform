/**
 * @file row-button-builder.component.ts
 * @path src/app/admin/components/builders/row-button-builder/row-button-builder.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Shared row of buttons of the administration - one look for page tabs, filters,
 *   view switches and language tabs: a grey pill with the buttons (icon + text, optional
 *   number / dot / flag), the active one is white. The page only passes the buttons and the
 *   active value and reacts to `selected`.
 * @usage
 *   <app-row-button-builder kind="tabs" [items]="tabs" [active]="activeTab" [ariaLabel]="…"
 *                           (selected)="switchTab($event)" />
 *   kind: `tabs` (role tablist, aria-selected), `filter` (role group, aria-pressed - default),
 *   `nav` (links with routerLink, aria-current="page"). size: `md` (page tabs) / `sm` (inside
 *   cards, language tabs). stretch: the buttons share the full width on mobile.
 * @dependencies AdminIconComponent (icons), NgTemplateOutlet (content of a button), RouterLink (kind nav)
 */

import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminIconComponent } from '../../admin-icon/admin-icon.component';
import { RowButton } from './row-button';

@Component({
  selector: 'app-row-button-builder',
  standalone: true,
  imports: [NgTemplateOutlet, AdminIconComponent, RouterLink],
  templateUrl: './row-button-builder.component.html',
  styleUrl: './row-button-builder.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RowButtonBuilderComponent {
  /** Buttons of the row (hidden ones are left out). */
  @Input() items: readonly RowButton[] = [];
  /** Value of the active button (null = none). */
  @Input() active: string | null | undefined = null;
  /** Semantics: tabs of a page, filter / switch, links to sub-pages. */
  @Input() kind: 'tabs' | 'filter' | 'nav' = 'filter';
  /** Size: md = page tabs, sm = inside a card / language tabs. */
  @Input() size: 'md' | 'sm' = 'md';
  /** The buttons share the full width on mobile. */
  @Input() stretch = false;
  /** Accessible name of the row. */
  @Input() ariaLabel = '';

  /** Value of the clicked button (not emitted for the active or a disabled one). */
  @Output() selected = new EventEmitter<string>();

  /** @description Visible buttons. */
  get visibleItems(): RowButton[] {
    return this.items.filter(item => !item.hidden);
  }

  /** @description Whether a button is the active one. */
  isActive(item: RowButton): boolean {
    return this.active === item.value;
  }

  /**
   * @description Click of a button - emits its value unless it is already active or disabled.
   * @param item Clicked button.
   */
  select(item: RowButton): void {
    if (item.disabled || this.isActive(item)) return;
    this.selected.emit(item.value);
  }
}
