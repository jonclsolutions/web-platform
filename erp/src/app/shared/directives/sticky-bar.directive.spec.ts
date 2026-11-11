/**
 * @file sticky-bar.directive.spec.ts
 * @path src/app/shared/directives/sticky-bar.directive.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of StickyBarDirective: the stuck state (top / bottom edge, hidden bar,
 *   bar fully visible), the scroll area it observes and the `is-stuck` class in a real scroll area.
 * @dependencies Angular TestBed (a host component with a scrolling container).
 */

import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { StickyBarDirective } from './sticky-bar.directive';

/** Host: a 200 px scroll area (with a padding, like the admin content) with a sticky bar and a long content. */
@Component({
  standalone: true,
  imports: [StickyBarDirective],
  template: `
    <div class="scroller" style="height: 200px; overflow-y: auto; padding: 3px">
      <div style="height: 50px"></div>
      <div class="bar" appStickyBar style="position: sticky; top: 8px; height: 30px; background: #fff"></div>
      <div style="height: 1200px"></div>
    </div>`,
})
class HostComponent {}

describe('StickyBarDirective', () => {
  /** Entry with the given bar / root rectangles. */
  const entry = (bar: Partial<DOMRectReadOnly>, root: Partial<DOMRectReadOnly> | null, ratio: number) =>
    ({ boundingClientRect: { height: 30, ...bar }, rootBounds: root, intersectionRatio: ratio }) as unknown as IntersectionObserverEntry;

  /**
   * @description Stuck = visible, not fully inside the root and beyond its sticky edge.
   * @input top: bar above the root top / fully visible / hidden (height 0) / no root;
   *   bottom: bar below the root bottom.
   * @output true / false / false / false; true.
   */
  it('detects the stuck state', () => {
    expect(StickyBarDirective.isStuck(entry({ top: 8 }, { top: 9 }, 0.97), 'top')).toBeTrue();
    expect(StickyBarDirective.isStuck(entry({ top: 50 }, { top: 9 }, 1), 'top')).toBeFalse();
    expect(StickyBarDirective.isStuck(entry({ top: 0, height: 0 }, { top: 9 }, 0), 'top')).toBeFalse();
    expect(StickyBarDirective.isStuck(entry({ top: 8 }, null, 0.97), 'top')).toBeFalse();
    expect(StickyBarDirective.isStuck(entry({ bottom: 600 }, { bottom: 590 }, 0.9), 'bottom')).toBeTrue();
    expect(StickyBarDirective.isStuck(entry({ bottom: 300 }, { bottom: 590 }, 0.9), 'bottom')).toBeFalse();
  });

  /**
   * @description The nearest scrolling ancestor is observed; none = the viewport.
   * @input The bar in the host; a detached element.
   * @output the `.scroller` element; null.
   */
  it('finds the scroll area', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    const bar = fixture.nativeElement.querySelector('.bar') as HTMLElement;
    expect(StickyBarDirective.scrollParent(bar)).toBe(fixture.nativeElement.querySelector('.scroller'));
    expect(StickyBarDirective.scrollParent(document.createElement('div'))).toBeNull();
    fixture.destroy();
  });

  /**
   * @description In a real scroll area the bar gets `is-stuck` once it sticks and loses it at the top.
   * @input Scroll 300 px; back to 0.
   * @output class is-stuck; no class.
   */
  it('marks the bar while it is stuck', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    const scroller = fixture.nativeElement.querySelector('.scroller') as HTMLElement;
    const bar = fixture.nativeElement.querySelector('.bar') as HTMLElement;
    const frames = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 50))));

    await frames();
    expect(bar.classList).not.toContain('is-stuck');
    scroller.scrollTop = 300;
    await frames();
    expect(bar.classList).toContain('is-stuck');
    scroller.scrollTop = 0;
    await frames();
    expect(bar.classList).not.toContain('is-stuck');
    fixture.destroy();
  });
});
