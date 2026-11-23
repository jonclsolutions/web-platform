/**
 * @file motion.testing.ts
 * @path src/app/apps/web/public/motion/motion.testing.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Test double of WebMotionService for the specs of the motion directives and pages:
 *   reveals and scroll scenes are captured and driven by the test instead of the browser.
 * @dependencies WebMotionService (the replaced service)
 */
import { WebMotionService, ScrollRender } from './web-motion.service';

/**
 * @description Controllable WebMotionService.
 * @usage `const motion = new FakeWebMotion(); providers: [{ provide: WebMotionService, useValue: motion }]`;
 *   then `motion.revealAll()`, `motion.scrollTo(0.5)`, `motion.reduced = true`.
 * @note Only for specs; not part of the application bundle (imported by *.spec.ts only).
 */
export class FakeWebMotion implements Partial<WebMotionService> {
  /** Reduced-motion answer of isReduced(). */
  reduced = false;
  /** Whether elements may be hidden (canReveal()). */
  revealable = true;
  /** Waiting reveal callbacks. */
  readonly visible: (() => void)[] = [];
  /** Render functions of the running scroll scenes. */
  readonly scenes: ScrollRender[] = [];

  isReduced(): boolean { return this.reduced; }
  canReveal(): boolean { return this.revealable; }
  outside<T>(fn: () => T): T { return fn(); }

  whenVisible(_element: Element, _amount: number, onVisible: () => void): () => void {
    this.visible.push(onVisible);
    return () => {};
  }

  linkScroll(_target: Element, _offset: string[], render: ScrollRender): () => void {
    if (this.reduced) {
      render(1);
      return () => {};
    }
    this.scenes.push(render);
    render(0);
    return () => {};
  }

  promote(element: HTMLElement, moving: boolean): void {
    element.style.willChange = moving ? 'transform, opacity' : 'auto';
  }

  /** @description Runs every waiting reveal (as if all elements scrolled into view). */
  revealAll(): void {
    this.visible.splice(0).forEach(reveal => reveal());
  }

  /**
   * @description Renders every scroll scene at one progress.
   * @param progress Smoothed progress 0–1.
   */
  scrollTo(progress: number): void {
    this.scenes.forEach(render => render(progress));
  }
}
