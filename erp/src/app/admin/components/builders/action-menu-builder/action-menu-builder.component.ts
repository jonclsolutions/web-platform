/**
 * @file action-menu-builder.component.ts
 * @path src/app/admin/components/builders/action-menu-builder/action-menu-builder.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Reusable dropdown ("Actions") replacing a row of single pill buttons on list
 * pages with one trigger + a slide-out list. Takes the SAME `Button[]` config as
 * `ButtonBuilderComponent` - no new configuration layer. The main action of the page
 * (`primaryAction`, 2026-11) is a button of its own next to the menu ("+ Přidat"; on a phone a
 * round green "+") and is not repeated in the menu.
 */
import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef,
  HostListener, ElementRef, ViewChild, DestroyRef, inject
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Button } from '../../../../shared/interfaces/button';
import { AdminLocalizationService } from '../../../../core/services/admin-localization.service';

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

  /**
   * Action of the config shown as the visible main button next to the menu (e.g.
   * 'handleCreateFormOpened' → "+ Přidat") - it follows the rules of its config (`showIf`:
   * permission, hidden in the trash) and is left out of the menu. null = everything in the menu.
   */
  @Input() primaryAction: string | null = null;
  @Output() actionTriggered = new EventEmitter<string>();

  private readonly i18n = inject(AdminLocalizationService);

  /** Label of the main button ("Přidat" / "Add"). */
  get primaryLabel(): string {
    return this.i18n.getValue('shared.add');
  }

  /** @description The main button: the `primaryAction` config when it may be shown now, else null. */
  get primaryButton(): Button | null {
    if (!this.primaryAction) return null;
    return this.configs.find(btn => btn.action === this.primaryAction && btn.showIf !== false && !btn.disabled) ?? null;
  }

  /** @description Items of the menu - every config except the main action (never twice). */
  get menuConfigs(): Button[] {
    return this.primaryAction ? this.configs.filter(btn => btn.action !== this.primaryAction) : this.configs;
  }

  isOpen = false;

  /** Computed fixed position of the menu against the viewport - null = not measured yet. */
  menuPosition: ActionMenuPosition | null = null;

  @ViewChild('trigger') private triggerRef?: ElementRef<HTMLButtonElement>;
  @ViewChild('menu') private menuRef?: ElementRef<HTMLDivElement>;

  private host = inject(ElementRef<HTMLElement>);
  private cd = inject(ChangeDetectorRef);

  /**
   * @description Recomputes the position on any scroll while the menu is open. Capture phase on
   * the document: a scroll event does not bubble, and the admin page scrolls inside the layout's
   * content area, not the window - only a capturing listener hears it.
   */
  private readonly onAnyScroll = (): void => {
    if (this.isOpen) this.positionMenu();
  };

  constructor() {
    this.i18n.translations$.pipe(takeUntilDestroyed()).subscribe(() => this.cd.markForCheck());
    if (typeof document === 'undefined') return;
    document.addEventListener('scroll', this.onAnyScroll, { capture: true, passive: true });
    inject(DestroyRef).onDestroy(() => document.removeEventListener('scroll', this.onAnyScroll, { capture: true }));
  }

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

  /** @description Recomputes the position on a window resize while the menu is open (scrolling: onAnyScroll). */
  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.isOpen) this.positionMenu();
  }
}