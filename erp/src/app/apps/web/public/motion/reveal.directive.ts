/**
 * @file reveal.directive.ts
 * @path src/app/apps/web/public/motion/reveal.directive.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description One-shot entrance of a block (rise on a UI spring) or of a group of blocks (children
 *   rise one after another) when it scrolls into view.
 * @dependencies WebMotionService, motion (animate, stagger), motion-presets
 */
import { Directive, ElementRef, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { animate, stagger } from 'motion';
import { WebMotionService } from './web-motion.service';
import { GROUP_STAGGER, REDUCED_FADE, SPRING_UI } from './motion-presets';

/** `rise` = the element itself; `group` = its element children one after another. */
export type RevealMode = 'rise' | 'group' | '';

/**
 * @description Reveals a block once, when enough of it is visible.
 * @usage `<p appReveal>…</p>`, `<div appReveal="group">` (children rise with a 0.07 s stagger),
 *   optional `[revealDelay]="0.15"` (seconds).
 * @note The element is hidden (opacity 0) from its creation until the reveal, so it never flashes.
 *   A group whose items arrive later (loaded data) waits for them.
 *   Reduced motion: a 150 ms fade, no movement. After the animation the inline styles are removed,
 *   so the element's own CSS transform (if any) applies again. Not for legal pages, 404, login and
 *   forms (design rules, chapter 7.4).
 */
@Directive({
  selector: '[appReveal]',
  standalone: true,
})
export class RevealDirective implements OnInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly motion = inject(WebMotionService);

  /** Reveal mode (empty attribute = `rise`). */
  @Input('appReveal') mode: RevealMode = 'rise';
  /** Extra delay before the reveal (seconds). */
  @Input() revealDelay = 0;

  private stopWatching: () => void = () => {};

  /** @description Hides the element and waits until it is visible. */
  ngOnInit(): void {
    if (!this.motion.canReveal()) {
      return;
    }
    this.host.style.opacity = '0';
    const amount = this.mode === 'group' ? 0.2 : 0.35;
    this.stopWatching = this.motion.whenVisible(this.host, amount, () => this.reveal());
  }

  /** @description Stops watching the element. */
  ngOnDestroy(): void {
    this.stopWatching();
  }

  /**
   * @description Plays the entrance: a fade for reduced motion, otherwise a spring rise of the
   *   element or of its children with a stagger.
   */
  private reveal(): void {
    const host = this.host;
    const delay = this.revealDelay;
    if (this.motion.isReduced()) {
      animate(host, { opacity: [0, 1] }, { duration: REDUCED_FADE, delay })
        .finished.then(() => this.clear([host]));
      return;
    }
    if (this.mode === 'group') {
      const children = Array.from(host.children) as HTMLElement[];
      if (!children.length) {
        this.waitForChildren();
        return;
      }
      children.forEach(child => { child.style.opacity = '0'; });
      host.style.opacity = '';
      animate(children, { opacity: [0, 1], y: [36, 0] }, { ...SPRING_UI, delay: stagger(GROUP_STAGGER, { startDelay: delay }) })
        .finished.then(() => this.clear(children));
      return;
    }
    animate(host, { opacity: [0, 1], y: [28, 0] }, { ...SPRING_UI, delay: delay + 0.1 })
      .finished.then(() => this.clear([host]));
  }

  /**
   * @description A group that became visible before its items arrived (data still loading):
   *   reveals it as soon as the first items are rendered.
   */
  private waitForChildren(): void {
    const view = this.host.ownerDocument.defaultView;
    if (!view?.MutationObserver) {
      this.host.style.opacity = '';
      return;
    }
    const observer = new view.MutationObserver(() => {
      if (this.host.children.length) {
        observer.disconnect();
        this.reveal();
      }
    });
    observer.observe(this.host, { childList: true });
    const previousStop = this.stopWatching;
    this.stopWatching = () => { observer.disconnect(); previousStop(); };
  }

  /**
   * @description Removes the inline styles of the animation, so the elements' own CSS applies.
   * @param elements Animated elements.
   * @note Runs one frame after the animation finished: Motion commits the final keyframe of a
   *   hardware-accelerated animation (opacity) right after its `finished` promise resolves.
   */
  private clear(elements: HTMLElement[]): void {
    const view = this.host.ownerDocument.defaultView;
    const run = () => {
      for (const element of elements) {
        element.style.opacity = '';
        element.style.transform = '';
      }
    };
    if (view) {
      view.requestAnimationFrame(run);
    } else {
      run();
    }
  }
}
