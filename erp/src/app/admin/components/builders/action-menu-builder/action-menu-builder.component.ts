/**
 * @file action-menu-builder.component.ts
 * @path src/app/admin/components/builders/action-menu-builder/action-menu-builder.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Reusable dropdown ("Actions") replacing a row of single pill buttons on list
 * pages with one trigger + a slide-out list. Takes the SAME `Button[]` config as
 * `ButtonBuilderComponent` - no new configuration layer.
 */
import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef,
  HostListener, ElementRef, ViewChild, inject
} from '@angular/core';
import { Button } from '../../../../shared/interfaces/button';

export interface ActionMenuPosition {
  top: number;
  left: number;
}

/**
 * @description Renders one trigger button and, after a click, the slide-out list of actions,
 * fixed-positioned against the viewport.
 * @usage Drop-in replacement of `<app-button-builder>` on admin list pages - only swap the tag
 * in the template, the `[configs]` binding stays the same.
 */
@Component({
  selector: 'app-action-menu-builder',
  standalone: true,
  imports: [],
  templateUrl: './action-menu-builder.component.html',
  styleUrl: './action-menu-builder.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActionMenuBuilderComponent {
  @Input() configs: Button[] = [];
  @Input() triggerLabel = 'Akce';
  @Input() triggerIcon = '⋯';

  @Output() actionTriggered = new EventEmitter<string>();

  isOpen = false;

  /** Computed fixed position of the menu against the viewport - null = not measured yet. */
  menuPosition: ActionMenuPosition | null = null;

  @ViewChild('trigger') private triggerRef?: ElementRef<HTMLButtonElement>;
  @ViewChild('menu') private menuRef?: ElementRef<HTMLDivElement>;

  private host = inject(ElementRef<HTMLElement>);
  private cd = inject(ChangeDetectorRef);

  /** Small gap (px) between the trigger button and the menu, and from the viewport edges. */
  private static readonly GAP = 6;
  private static readonly VIEWPORT_MARGIN = 8;

  toggleMenu(): void {
    this.isOpen = !this.isOpen;

    if (this.isOpen) {
      this.menuPosition = null;
      // The menu must be in the DOM first (behind `@if (isOpen)`) before it can be measured -
      // `setTimeout(0)` waits for the next tick after the template renders.
      setTimeout(() => this.positionMenu());
    } else {
      this.menuPosition = null;
    }
  }

  onSelect(action: string): void {
    this.isOpen = false;
    this.menuPosition = null;
    this.actionTriggered.emit(action);
  }

  /**
   * @description Computes the fixed `top` / `left` of the menu from the position of the trigger
   * button and the real size of the menu, clamped to the viewport edges (never renders the menu
   * partly off screen).
   */
  private positionMenu(): void {
    const triggerEl = this.triggerRef?.nativeElement;
    const menuEl = this.menuRef?.nativeElement;
    if (!triggerEl || !menuEl) return;

    const triggerRect = triggerEl.getBoundingClientRect();
    const menuRect = menuEl.getBoundingClientRect();

    let top = triggerRect.bottom + ActionMenuBuilderComponent.GAP;
    let left = triggerRect.right - menuRect.width;

    const maxLeft = window.innerWidth - menuRect.width - ActionMenuBuilderComponent.VIEWPORT_MARGIN;
    const maxTop = window.innerHeight - menuRect.height - ActionMenuBuilderComponent.VIEWPORT_MARGIN;

    left = Math.min(Math.max(left, ActionMenuBuilderComponent.VIEWPORT_MARGIN), maxLeft);
    top = Math.min(top, maxTop);

    this.menuPosition = { top, left };
    this.cd.markForCheck();
  }

  /**
   * @description Closes the menu on a click anywhere outside the component - same pattern as
   * `onDocumentClick()` in `TableBuilderComponent` for `.bulk-actions-menu`. The menu is
   * fixed-positioned visually OUTSIDE the `.action-menu` host element, but it is still its
   * child in the DOM (nested inside `<div class="action-menu">`), so the `contains()` check
   * works.
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isOpen && !this.host.nativeElement.contains(event.target as Node)) {
      this.isOpen = false;
      this.menuPosition = null;
      this.cd.markForCheck();
    }
  }

  /** @description Recomputes the position on scroll (capture - also catches scrolling inside nested containers) and window resize while the menu is open. */
  @HostListener('window:scroll')
  onWindowScroll(): void {
    if (this.isOpen) this.positionMenu();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.isOpen) this.positionMenu();
  }
}