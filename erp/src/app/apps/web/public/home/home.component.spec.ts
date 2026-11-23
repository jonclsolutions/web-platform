/**
 * @file home.component.spec.ts
 * @path src/app/apps/web/public/home/home.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of HomeComponent and the tech-stack marquee helper: the marquee rows are
 *   repeated to a minimum length and doubled for a seamless loop; the page renders its texts and
 *   every tech card (logo or placeholder); the hero headline split into
 *   words and the static hero for reduced motion; the pinned hero scene on any screen width; the
 *   decorative layers of the pinned hero let clicks through to the hero CTAs.
 * @dependencies
 * - createPublicPageContext, FakeWebMotion (motion test double).
 */

import { TestBed } from '@angular/core/testing';

import { HomeComponent } from './home.component';
import { TECH_STACK_ROW_BOTTOM, TECH_STACK_ROW_TOP, buildMarqueeLoop } from './tech-stack.config';
import { createPublicPageContext } from '../../../../../testing/public-test-helpers';
import { WebMotionService } from '../motion/web-motion.service';
import { FakeWebMotion } from '../motion/motion.testing';

describe('HomeComponent', () => {
  /**
   * @description Marquee loop: empty → []; short rows repeated until ≥ minPerCopy, then doubled.
   * @input [] ; 3 items with min 10; 12 items with min 10.
   * @output []; 24 items (12 per copy); 24 items (one copy of 12, doubled).
   */
  it('builds seamless marquee loops', () => {
    const items = [{ name: 'A', logo: null }, { name: 'B', logo: 'b.svg' }, { name: 'C', logo: null }];
    expect(buildMarqueeLoop([])).toEqual([]);
    const loop = buildMarqueeLoop(items);
    expect(loop.length).toBe(24);
    expect(loop.slice(0, 12)).toEqual(loop.slice(12));
    expect(buildMarqueeLoop(Array(12).fill(items[0])).length).toBe(24);
  });

  /**
   * @description Page: all tech items listed once in the static list, rows looped; texts rendered.
   * @input home translations with hero / faq.
   * @output techStackAll = top + bottom rows; loops are buildMarqueeLoop of each row; 'Question 1' rendered.
   */
  it('renders the home page with the tech stack', () => {
    const ctx = createPublicPageContext({ translations: { home: { hero: { cta_primary: 'Start' }, faq: { heading: 'FAQ', q1: 'Question 1' }, cta: { contact: { btn: 'Write' } } } } });
    TestBed.configureTestingModule({ imports: [HomeComponent], providers: ctx.providers });
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    expect(page.techStackAll).toEqual([...TECH_STACK_ROW_TOP, ...TECH_STACK_ROW_BOTTOM]);
    expect(page.techStackTopLoop).toEqual(buildMarqueeLoop(TECH_STACK_ROW_TOP));
    expect(page.techStackBottomLoop).toEqual(buildMarqueeLoop(TECH_STACK_ROW_BOTTOM));
    expect(fixture.nativeElement.textContent).toContain('Question 1');
    expect(fixture.nativeElement.textContent).toContain(TECH_STACK_ROW_TOP[0].name);
  });

  /**
   * @description The hero headline is written word by word (line break kept); with reduced motion
   *   the hero is not pinned.
   * @input hero.heading 'We build<br>products'; reduced = true.
   * @output 3 words, one <br>; the hero without the pinned class.
   */
  it('renders the hero headline by words and a static hero for reduced motion', () => {
    const motion = new FakeWebMotion();
    motion.reduced = true;
    const ctx = createPublicPageContext({ translations: { home: { hero: { heading: 'We build<br>products' } } } });
    TestBed.configureTestingModule({ imports: [HomeComponent], providers: [...ctx.providers, { provide: WebMotionService, useValue: motion }] });
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    const heading = fixture.nativeElement.querySelector('.hero-heading') as HTMLElement;
    expect(heading.querySelectorAll('.rv-word').length).toBe(3);
    expect(heading.querySelectorAll('br').length).toBe(1);
    expect(fixture.componentInstance.heroPinned).toBeFalse();
    expect((fixture.nativeElement.querySelector('.hero') as HTMLElement).classList).not.toContain('hero--pinned');
  });

  /**
   * @description With motion allowed the hero is pinned on every screen width (phones included):
   *   at the start the screen is tilted and the text visible, at the end the screen is flat and the
   *   text gone. Phones use their measured geometry, wide screens the desktop pose – both end flat.
   * @input motion allowed; translations with the hero heading; scene progress 0, then 1.
   * @output heroPinned true; tilt > 20° and text opacity 1 at 0; tilt 0° and text opacity 0 at 1.
   */
  it('runs the pinned hero scene whenever motion is allowed', async () => {
    const motion = new FakeWebMotion();
    const ctx = createPublicPageContext({ translations: { home: { hero: { heading: 'We build products' } } } });
    TestBed.configureTestingModule({ imports: [HomeComponent], providers: [...ctx.providers, { provide: WebMotionService, useValue: motion }] });
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    await Promise.resolve(); // the scene starts in a microtask after the view query
    const root = fixture.nativeElement as HTMLElement;
    const device = root.querySelector('.hero-device') as HTMLElement;
    const content = root.querySelector('.hero-content') as HTMLElement;
    expect(fixture.componentInstance.heroPinned).toBeTrue();
    motion.scrollTo(0);
    const tilt = () => parseFloat(/rotateX\(([-\d.]+)deg\)/.exec(device.style.transform)?.[1] ?? 'NaN');
    expect(tilt()).toBeGreaterThan(20);
    expect(Number(content.style.opacity)).toBe(1);
    motion.scrollTo(1);
    expect(tilt()).toBe(0);
    expect(Number(content.style.opacity)).toBe(0);
  });

  /**
   * @description Pinned hero: the device frame wrapper is absolutely positioned over the hero text
   *   (from the top of the stage), so it and the scroll hint must not take pointer events – the
   *   CTAs below them have to stay clickable.
   * @input heroPinned = true (desktop pose), component styles attached to the document.
   * @output .hero--pinned on the section; pointer-events 'none' on .hero-device-in and .hero-hint;
   *   'auto' on both CTA links.
   */
  it('keeps the hero CTAs clickable under the pinned device frame', () => {
    const ctx = createPublicPageContext({ translations: { home: { hero: { cta_primary: 'Contact', cta_secondary: 'Services' } } } });
    TestBed.configureTestingModule({ imports: [HomeComponent], providers: [...ctx.providers, { provide: WebMotionService, useValue: new FakeWebMotion() }] });
    const fixture = TestBed.createComponent(HomeComponent);
    // heroPinned is readonly (decided once from the viewport); the headless test window is narrow.
    (fixture.componentInstance as unknown as { heroPinned: boolean }).heroPinned = true;
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect((root.querySelector('.hero') as HTMLElement).classList).toContain('hero--pinned');
    expect(getComputedStyle(root.querySelector('.hero-device-in') as HTMLElement).pointerEvents).toBe('none');
    expect(getComputedStyle(root.querySelector('.hero-hint') as HTMLElement).pointerEvents).toBe('none');
    const links = Array.from(root.querySelectorAll<HTMLElement>('.hero-cta-row a'));
    expect(links.length).toBe(2);
    links.forEach(link => expect(getComputedStyle(link).pointerEvents).toBe('auto'));
  });
});
