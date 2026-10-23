/**
 * @file home.component.spec.ts
 * @path src/app/public/web-pages/home/home.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of HomeComponent and the tech-stack marquee helper: the marquee rows are
 *   repeated to a minimum length and doubled for a seamless loop; the page renders its texts and
 *   every tech card (logo or placeholder).
 * @dependencies
 * - createPublicPageContext.
 */

import { TestBed } from '@angular/core/testing';

import { HomeComponent } from './home.component';
import { TECH_STACK_ROW_BOTTOM, TECH_STACK_ROW_TOP, buildMarqueeLoop } from './tech-stack.config';
import { createPublicPageContext } from '../../../../testing/public-test-helpers';

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
});
