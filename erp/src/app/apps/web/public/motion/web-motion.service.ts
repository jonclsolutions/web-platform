/**
 * @file web-motion.service.ts
 * @path src/app/apps/web/public/motion/web-motion.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Runtime of the public web motion: reduced-motion state (live), one shared
 *   IntersectionObserver for one-shot reveals, spring-smoothed scroll progress and the
 *   just-in-time layer promotion. Everything runs outside the Angular zone – a scroll frame or an
 *   animation tick never triggers change detection.
 * @dependencies motion (scroll, motionValue, springValue), NgZone, DOCUMENT
 */
import { DOCUMENT, Injectable, NgZone, OnDestroy, inject } from '@angular/core';
import { motionValue, scroll, springValue } from 'motion';
import { SCROLL_SMOOTH } from './motion-presets';

/** Called with the smoothed scroll progress 0–1 of a scene; writes transform / opacity only. */
export type ScrollRender = (progress: number) => void;

/**
 * @description Motion runtime shared by the reveal / scroll-effect directives and the pages.
 * @usage `const motion = inject(WebMotionService);`
 *   `motion.whenVisible(el, 0.4, () => …)`, `const stop = motion.linkScroll(el, ['start end', 'center 0.6'], p => …)`.
 * @note Reduced motion (`prefers-reduced-motion: reduce`) is read live: a change of the OS setting
 *   applies to every scene from its next frame and to every reveal that has not run yet, no reload
 *   needed. Without IntersectionObserver (very old browsers) or outside a browser everything is
 *   shown at once.
 */
@Injectable({ providedIn: 'root' })
export class WebMotionService implements OnDestroy {
  private readonly zone = inject(NgZone);
  private readonly document = inject(DOCUMENT);
  private readonly window = this.document.defaultView;

  /** Media query of the reduced-motion preference (null outside a browser). */
  private readonly reducedQuery = this.window?.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;
  private reducedState = !!this.reducedQuery?.matches;
  private readonly onReducedChange = (event: MediaQueryListEvent) => { this.reducedState = event.matches; };

  /** One observer shared by every element waiting for its reveal. */
  private observer: IntersectionObserver | null = null;
  /** Required visible share and callback of every observed element (one-shot: removed after it ran). */
  private readonly pending = new Map<Element, { amount: number; onVisible: () => void }>();

  constructor() {
    this.reducedQuery?.addEventListener?.('change', this.onReducedChange);
  }

  /**
   * @description Whether movement should be replaced by short fades (visitor's OS setting).
   * @returns true when `prefers-reduced-motion: reduce` currently matches.
   */
  isReduced(): boolean {
    return this.reducedState;
  }

  /**
   * @description Whether elements may be hidden and revealed later. False when the browser cannot
   *   tell visibility (no IntersectionObserver) – the content must never stay hidden.
   * @returns true in a browser with IntersectionObserver.
   */
  canReveal(): boolean {
    return !!this.window && typeof this.window.IntersectionObserver === 'function';
  }

  /**
   * @description Runs a function outside the Angular zone (animations, scroll work).
   * @param fn Work that must not trigger change detection.
   * @returns The function's result.
   */
  outside<T>(fn: () => T): T {
    return this.zone.runOutsideAngular(fn);
  }

  /**
   * @description Calls `onVisible` once, when the given share of the element is in the viewport.
   *   All elements share one IntersectionObserver (batched reveals).
   * @param element Element to watch.
   * @param amount Visible share that triggers it (0–1), e.g. 0.4.
   * @param onVisible One-shot callback (runs outside the Angular zone).
   * @returns Function that stops watching (for ngOnDestroy).
   * @note Without IntersectionObserver the callback runs immediately. An element taller than the
   *   viewport counts as visible when it covers `amount` of the viewport height (it could never
   *   reach `amount` of its own height).
   */
  whenVisible(element: Element, amount: number, onVisible: () => void): () => void {
    if (!this.canReveal()) {
      onVisible();
      return () => {};
    }
    const observer = this.sharedObserver();
    this.pending.set(element, { amount, onVisible });
    observer.observe(element);
    return () => {
      this.pending.delete(element);
      observer.unobserve(element);
    };
  }

  /**
   * @description Links the scroll position of an element to a render function through a spring:
   *   raw progress → springValue (SCROLL_SMOOTH) → render. Wheel steps therefore glide.
   * @param target Element whose position in the viewport is measured.
   * @param offset Motion scroll offsets, e.g. ['start end', 'center 0.6'].
   * @param render Receives the smoothed progress 0–1; writes transform / opacity only.
   * @returns Cleanup that stops the scroll listener and the spring.
   * @note With reduced motion the render gets 1 (final pose) and no listener is attached; a later
   *   switch to reduced motion makes the running scene render its final pose.
   */
  linkScroll(target: Element, offset: string[], render: ScrollRender): () => void {
    if (!this.window || this.isReduced()) {
      render(1);
      return () => {};
    }
    return this.outside(() => {
      const raw = motionValue(0);
      const smooth = springValue(raw, SCROLL_SMOOTH);
      const unsubscribe = smooth.on('change', (value: number) => render(this.isReduced() ? 1 : value));
      const stopScroll = scroll((progress: number) => raw.set(progress), { target, offset } as any);
      render(0);
      return () => {
        stopScroll();
        unsubscribe();
        smooth.destroy();
        raw.destroy();
      };
    });
  }

  /**
   * @description Just-in-time layer promotion (60fps rule): `will-change` only while the element is
   *   between its start and end pose, `auto` when it rests. Writes only on change.
   * @param element Animated element.
   * @param moving Whether it is mid-animation now.
   */
  promote(element: HTMLElement, moving: boolean): void {
    const value = moving ? 'transform, opacity' : 'auto';
    if (element.style.willChange !== value) {
      element.style.willChange = value;
    }
  }

  /** @description Disconnects the shared observer and the media-query listener. */
  ngOnDestroy(): void {
    this.reducedQuery?.removeEventListener?.('change', this.onReducedChange);
    this.observer?.disconnect();
    this.observer = null;
    this.pending.clear();
  }

  /**
   * @description The shared observer; created on first use, outside the zone. Thresholds every
   *   10 % so tall elements report their growing visible part.
   * @returns The observer.
   */
  private sharedObserver(): IntersectionObserver {
    if (!this.observer) {
      const thresholds = Array.from({ length: 11 }, (_, i) => i / 10);
      this.observer = this.outside(() => new this.window!.IntersectionObserver(entries => {
        const viewport = this.window?.innerHeight ?? 0;
        for (const entry of entries) {
          const waiting = this.pending.get(entry.target);
          if (!waiting || !entry.isIntersecting) {
            continue;
          }
          const enough = entry.intersectionRatio >= waiting.amount
            || entry.intersectionRect.height >= viewport * waiting.amount;
          if (enough) {
            this.pending.delete(entry.target);
            this.observer?.unobserve(entry.target);
            waiting.onVisible();
          }
        }
      }, { threshold: thresholds }));
    }
    return this.observer;
  }
}
