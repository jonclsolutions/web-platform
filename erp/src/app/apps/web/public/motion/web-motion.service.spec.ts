/**
 * @file web-motion.service.spec.ts
 * @path src/app/apps/web/public/motion/web-motion.service.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of WebMotionService: the live reduced-motion state, the one-shot reveal
 *   callback (also without IntersectionObserver and for an element taller than the viewport), the
 *   scroll scene with reduced motion and the just-in-time layer promotion.
 * @dependencies Angular TestBed (DOCUMENT replaced by a stub window where needed).
 */

import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { WebMotionService } from './web-motion.service';
import { band, clamp01, lerp } from './motion-presets';

/** Fake MediaQueryList whose `matches` can be flipped and whose listeners can be fired. */
function fakeQuery(matches: boolean) {
  const listeners: ((event: MediaQueryListEvent) => void)[] = [];
  return {
    matches,
    addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => listeners.push(listener),
    removeEventListener: () => {},
    fire(value: boolean) { listeners.forEach(listener => listener({ matches: value } as MediaQueryListEvent)); },
  };
}

/** Service created with a document whose window has the given matchMedia / IntersectionObserver. */
function serviceWith(windowStub: Record<string, unknown>): WebMotionService {
  TestBed.configureTestingModule({
    providers: [{ provide: DOCUMENT, useValue: { defaultView: windowStub } }],
  });
  return TestBed.inject(WebMotionService);
}

describe('WebMotionService', () => {
  /**
   * @description Helpers of the presets.
   * @input clamp01(-1 / 0.5 / 2); band(0.5, 0, 1), band(0.1, 0.2, 0.6), band(0.4, 0.2, 0.6); lerp(10, 20, 0.25).
   * @output 0 / 0.5 / 1; 0.5, 0, 0.5; 12.5.
   */
  it('clamps, windows and interpolates progress', () => {
    expect([clamp01(-1), clamp01(0.5), clamp01(2)]).toEqual([0, 0.5, 1]);
    expect(band(0.5, 0, 1)).toBe(0.5);
    expect(band(0.1, 0.2, 0.6)).toBe(0);
    expect(band(0.4, 0.2, 0.6)).toBeCloseTo(0.5, 5);
    expect(lerp(10, 20, 0.25)).toBe(12.5);
  });

  /**
   * @description The reduced-motion state follows the OS setting live.
   * @input matchMedia reduce = false, then a change event with true.
   * @output isReduced() false, then true.
   */
  it('follows the reduced-motion setting live', () => {
    const query = fakeQuery(false);
    const motion = serviceWith({ matchMedia: () => query });
    expect(motion.isReduced()).toBeFalse();
    query.fire(true);
    expect(motion.isReduced()).toBeTrue();
  });

  /**
   * @description Without IntersectionObserver content is never hidden: canReveal() is false and
   *   the reveal callback runs right away.
   * @input A window without IntersectionObserver.
   * @output canReveal() false; the callback called once, synchronously.
   */
  it('reveals at once without IntersectionObserver', () => {
    const motion = serviceWith({ matchMedia: () => fakeQuery(false) });
    const spy = jasmine.createSpy('visible');
    expect(motion.canReveal()).toBeFalse();
    motion.whenVisible(document.createElement('div'), 0.4, spy);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  /**
   * @description One shared observer; the callback runs once when the share is reached – an
   *   element taller than the viewport counts by the share of the viewport it covers.
   * @input Two elements watched at 0.6; entries: A ratio 0.3 (small), A ratio 0.7, A again,
   *   B ratio 0.2 but covering 70 % of an 800 px viewport.
   * @output one observer created; A called once (after 0.7); B called once.
   */
  it('calls each reveal once from one shared observer', () => {
    let created = 0;
    let feed: (entries: Partial<IntersectionObserverEntry>[]) => void = () => {};
    class FakeObserver {
      constructor(callback: (entries: IntersectionObserverEntry[]) => void) {
        created++;
        feed = entries => callback(entries as IntersectionObserverEntry[]);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    const motion = serviceWith({ matchMedia: () => fakeQuery(false), IntersectionObserver: FakeObserver, innerHeight: 800 });
    const a = document.createElement('div');
    const b = document.createElement('div');
    const onA = jasmine.createSpy('a');
    const onB = jasmine.createSpy('b');
    motion.whenVisible(a, 0.6, onA);
    motion.whenVisible(b, 0.6, onB);
    expect(created).toBe(1);

    feed([{ target: a, isIntersecting: true, intersectionRatio: 0.3, intersectionRect: { height: 100 } as DOMRectReadOnly }]);
    expect(onA).not.toHaveBeenCalled();
    feed([{ target: a, isIntersecting: true, intersectionRatio: 0.7, intersectionRect: { height: 300 } as DOMRectReadOnly }]);
    feed([{ target: a, isIntersecting: true, intersectionRatio: 0.9, intersectionRect: { height: 400 } as DOMRectReadOnly }]);
    expect(onA).toHaveBeenCalledTimes(1);

    feed([{ target: b, isIntersecting: true, intersectionRatio: 0.2, intersectionRect: { height: 560 } as DOMRectReadOnly }]);
    expect(onB).toHaveBeenCalledTimes(1);
  });

  /**
   * @description With reduced motion a scroll scene renders its final pose only.
   * @input reduce = true; linkScroll with a render spy.
   * @output render called once with 1; the cleanup is a function.
   */
  it('renders the final pose of a scroll scene with reduced motion', () => {
    const motion = serviceWith({ matchMedia: () => fakeQuery(true) });
    const render = jasmine.createSpy('render');
    const stop = motion.linkScroll(document.createElement('div'), ['start end', 'end start'], render);
    expect(render.calls.allArgs()).toEqual([[1]]);
    expect(typeof stop).toBe('function');
  });

  /**
   * @description A running scroll scene starts at progress 0 and stops cleanly.
   * @input The real window; linkScroll on an element in the page; cleanup.
   * @output render first called with 0; cleanup does not throw.
   */
  it('starts a scroll scene at 0 and stops it', () => {
    const motion = TestBed.inject(WebMotionService);
    const element = document.createElement('div');
    document.body.appendChild(element);
    const render = jasmine.createSpy('render');
    const stop = motion.linkScroll(element, ['start end', 'end start'], render);
    expect(render.calls.first().args[0]).toBe(motion.isReduced() ? 1 : 0);
    expect(() => stop()).not.toThrow();
    element.remove();
  });

  /**
   * @description will-change only while moving, written only on change.
   * @input promote(el, true), promote(el, true), promote(el, false).
   * @output 'transform, opacity', unchanged, 'auto'.
   */
  it('promotes a layer only while it moves', () => {
    const motion = TestBed.inject(WebMotionService);
    const element = document.createElement('div');
    motion.promote(element, true);
    expect(element.style.willChange).toBe('transform, opacity');
    motion.promote(element, true);
    expect(element.style.willChange).toBe('transform, opacity');
    motion.promote(element, false);
    expect(element.style.willChange).toBe('auto');
  });
});
