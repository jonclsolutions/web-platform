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
 * @note Robust detection (2026-11): besides the observer, the state is measured from the geometry
 *   on every scroll of the scroll area (one measurement per frame) - the bar is stuck when it
 *   stands at its sticky edge while its parent has already moved past it. Browsers / zoom levels
 *   where the observer misses the 1 px change still get the floating look.
 * @dependencies IntersectionObserver (optional - the scroll measurement works without it).
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
  /** Scroll area of the bar (null = the viewport). */
  private root: HTMLElement | null = null;
  /** Pending animation frame of a measurement (one per frame at most). */
  private frame = 0;
  /** Scroll / resize listener: measures the state in the next frame. */
  private readonly onScroll = (): void => {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.measure();
    });
  };

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
    const element = this.host.nativeElement;
    const edge = this.edge;
    const root = StickyBarDirective.scrollParent(element);
    this.root = root;
    this.zone.runOutsideAngular(() => {
      (root ?? window).addEventListener('scroll', this.onScroll, { passive: true });
      window.addEventListener('resize', this.onScroll, { passive: true });
    });
    if (typeof IntersectionObserver === 'undefined') return;
    const offset = parseFloat(getComputedStyle(element)[edge]) || 0;
    const padding = root ? parseFloat(getComputedStyle(root)[edge === 'top' ? 'paddingTop' : 'paddingBottom']) || 0 : 0;
    const margin = `-${offset + padding + 1}px`;

    this.zone.runOutsideAngular(() => {
      this.observer = new IntersectionObserver(
        ([entry]) => {
          // The observer and the scroll measurement agree on the floating look: stuck when
          // either sees it (the measurement covers a missed 1 px change).
          element.classList.toggle(StickyBarDirective.STUCK_CLASS, StickyBarDirective.isStuck(entry, edge) || this.isStuckByGeometry());
        },
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
    (this.root ?? window).removeEventListener('scroll', this.onScroll);
    window.removeEventListener('resize', this.onScroll);
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  /** @description Sets the stuck class from the geometry (called on scroll / resize, once per frame). */
  measure(): void {
    this.host.nativeElement.classList.toggle(StickyBarDirective.STUCK_CLASS, this.isStuckByGeometry());
  }

  /**
   * @description The bar is stuck when it stands at its sticky edge (the sticky offset counted
   *   from the edge of the scroll area, with or without its padding - 1.5 px tolerance for a
   *   zoomed page) and its parent has moved past it (the parent's edge is beyond the bar's) - a
   *   bar resting in its normal place is not stuck.
   */
  isStuckByGeometry(): boolean {
    const element = this.host.nativeElement;
    const parent = element.parentElement;
    const rect = element.getBoundingClientRect();
    if (!parent || rect.height === 0) return false;
    const edge = this.edge;
    const style = getComputedStyle(element);
    const offset = parseFloat(edge === 'top' ? style.top : style.bottom) || 0;
    const rootRect = this.root ? this.root.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
    const padding = this.root ? parseFloat(getComputedStyle(this.root)[edge === 'top' ? 'paddingTop' : 'paddingBottom']) || 0 : 0;
    const parentRect = parent.getBoundingClientRect();
    const near = (value: number, limit: number) => Math.abs(value - limit) <= 1.5;
    if (edge === 'top') {
      const limits = [rootRect.top + offset, rootRect.top + padding + offset];
      return limits.some(limit => near(rect.top, limit)) && parentRect.top < rect.top - 1;
    }
    const limits = [rootRect.bottom - offset, rootRect.bottom - padding - offset];
    return limits.some(limit => near(rect.bottom, limit)) && parentRect.bottom > rect.bottom + 1;
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
