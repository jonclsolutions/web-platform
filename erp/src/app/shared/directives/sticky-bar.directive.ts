/**
 * @file sticky-bar.directive.ts
 * @path src/app/shared/directives/sticky-bar.directive.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Marks a `position: sticky` bar (save / discard actions of a settings section) with
 *   the class `is-stuck` while it is stuck to the edge of its scroll area, so the component can
 *   show it as a floating bar (rounded, shadow) only then.
 * @usage `<div class="ce-card-header" appStickyBar>` (stuck to the top) or
 *   `<div class="ws-form-footer" appStickyBar="bottom">`. The CSS of the component sets
 *   `position: sticky` with `top` / `bottom` and the look of `.is-stuck`.
 * @note The bar must not have an ancestor with `overflow: hidden / auto` below the scroll area
 *   (use `overflow: clip` on rounded cards) - otherwise it never sticks. The class is set directly
 *   on the element, so it also works in OnPush components (no change detection needed).
 * @dependencies IntersectionObserver (without it the bar only sticks, without the floating look).
 */

import { AfterViewInit, Directive, ElementRef, Input, NgZone, OnDestroy, inject } from '@angular/core';

/** Edge the bar sticks to. */
export type StickyBarEdge = 'top' | 'bottom';

@Directive({
  selector: '[appStickyBar]',
  standalone: true,
})
export class StickyBarDirective implements AfterViewInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private observer: IntersectionObserver | null = null;

  /** Edge the bar sticks to (`''` = top). */
  @Input() appStickyBar: StickyBarEdge | '' = '';

  /** CSS class of the stuck state. */
  static readonly STUCK_CLASS = 'is-stuck';

  /**
   * @description Observes the bar in its scroll area; the root margin cuts off the sticky offset,
   *   the padding of the scroll area (sticky offsets count from inside it, the observer from its
   *   padding box) and 1 px, so a stuck bar is no longer fully inside the root.
   */
  ngAfterViewInit(): void {
    if (typeof IntersectionObserver === 'undefined') return;
    const element = this.host.nativeElement;
    const edge = this.edge;
    const root = StickyBarDirective.scrollParent(element);
    const offset = parseFloat(getComputedStyle(element)[edge]) || 0;
    const padding = root ? parseFloat(getComputedStyle(root)[edge === 'top' ? 'paddingTop' : 'paddingBottom']) || 0 : 0;
    const margin = `-${offset + padding + 1}px`;

    this.zone.runOutsideAngular(() => {
      this.observer = new IntersectionObserver(
        ([entry]) => element.classList.toggle(StickyBarDirective.STUCK_CLASS, StickyBarDirective.isStuck(entry, edge)),
        {
          root,
          rootMargin: edge === 'top' ? `${margin} 0px 0px 0px` : `0px 0px ${margin} 0px`,
          threshold: [1],
        },
      );
      this.observer.observe(element);
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  /** @description Edge of the bar (top unless `bottom` is given). */
  private get edge(): StickyBarEdge {
    return this.appStickyBar === 'bottom' ? 'bottom' : 'top';
  }

  /**
   * @description Is the bar stuck: visible (a hidden tab has no size), not fully inside the root
   *   and beyond the sticky edge of the root.
   * @param entry Observer entry of the bar.
   * @param edge Sticky edge.
   */
  static isStuck(entry: IntersectionObserverEntry, edge: StickyBarEdge): boolean {
    const rect = entry.boundingClientRect;
    const root = entry.rootBounds;
    if (!root || rect.height === 0 || entry.intersectionRatio >= 1) return false;
    return edge === 'top' ? rect.top < root.top : rect.bottom > root.bottom;
  }

  /**
   * @description Nearest scrolling ancestor (the admin content area); null = the viewport.
   * @param element The bar.
   */
  static scrollParent(element: HTMLElement): HTMLElement | null {
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY)) return parent;
    }
    return null;
  }
}
