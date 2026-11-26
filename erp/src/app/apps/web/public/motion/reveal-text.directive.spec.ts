/**
 * @file reveal-text.directive.spec.ts
 * @path src/app/apps/web/public/motion/reveal-text.directive.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of RevealTextDirective: words rendered as text (never HTML - also `<br>`
 *   stays text), a new line as the line break, the masked reveal (hidden words, then in place), a new text after the
 *   reveal shown at once, the scroll lighting of paragraph words and the whole paragraph at once
 *   on phones.
 * @dependencies Angular TestBed (host component), FakeWebMotion.
 */

import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { RevealTextDirective, RevealTextMode } from './reveal-text.directive';
import { WebMotionService } from './web-motion.service';
import { FakeWebMotion } from './motion.testing';

/** Host: one heading driven by the directive. */
@Component({
  standalone: true,
  imports: [RevealTextDirective],
  template: `<h2 class="title" [appRevealText]="text" [revealTextMode]="mode" [revealTextBreaks]="breaks"></h2>`,
})
class HostComponent {
  text = 'Hello motion world';
  mode: RevealTextMode = 'mask';
  breaks = false;
}

/** Waits until the check passes (max. ~3 s). */
async function settled(check: () => boolean): Promise<void> {
  for (let i = 0; i < 60 && !check(); i++) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

describe('RevealTextDirective', () => {
  let motion: FakeWebMotion;

  /** Creates the host with the given inputs. */
  function create(inputs: Partial<HostComponent> = {}) {
    TestBed.configureTestingModule({ imports: [HostComponent], providers: [{ provide: WebMotionService, useValue: motion }] });
    const fixture = TestBed.createComponent(HostComponent);
    Object.assign(fixture.componentInstance, inputs);
    fixture.detectChanges();
    const title = fixture.nativeElement.querySelector('.title') as HTMLElement;
    return { fixture, title };
  }

  beforeEach(() => { motion = new FakeWebMotion(); });

  /**
   * @description Every word is a masked span; markup in the text stays plain text.
   * @input 'Hello <img src=x onerror=alert(1)> world'.
   * @output 5 .rv-word spans (split at spaces); no <img> element; the text content kept.
   */
  it('renders words as text, never as HTML', () => {
    const { title } = create({ text: 'Hello <img src=x onerror=alert(1)> world' });
    expect(title.querySelectorAll('.rv-mask .rv-word').length).toBe(5);
    expect(title.querySelector('img')).toBeNull();
    expect(title.textContent).toBe('Hello <img src=x onerror=alert(1)> world');
  });

  /**
   * @description A new line becomes a line break when breaks are allowed; a `<br>` written in the
   *   text is no markup - it stays text.
   * @input 'One two\nthree' breaks on; 'One<br>two' breaks on.
   * @output One <br> element, 3 words, textContent without the new line; then no <br> element and
   *   the text '<br>' kept.
   */
  it('turns a new line into a line break and never a tag', () => {
    const { title } = create({ text: 'One two\nthree', breaks: true });
    expect(title.querySelectorAll('br').length).toBe(1);
    expect(title.querySelectorAll('.rv-word').length).toBe(3);
    expect(title.textContent).toBe('One twothree');

    TestBed.resetTestingModule();
    const tag = create({ text: 'One<br>two', breaks: true }).title;
    expect(tag.querySelectorAll('br').length).toBe(0);
    expect(tag.textContent).toBe('One<br>two');
  });

  /**
   * @description Mask reveal: words wait below their clip, then move into place; a new text after
   *   the reveal is rendered in place.
   * @input Mask mode; revealAll(); then a new text.
   * @output Words translated before; transform cleared after; the new words without transform.
   */
  it('reveals the words once and shows later texts in place', async () => {
    const { fixture, title } = create();
    const words = Array.from(title.querySelectorAll('.rv-word')) as HTMLElement[];
    expect(words[0].style.transform).toContain('translateY(118%)');
    motion.revealAll();
    await settled(() => words.every(word => word.style.transform === ''));
    expect(words.every(word => word.style.transform === '')).toBeTrue();

    fixture.componentInstance.text = 'Ahoj světe';
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    const next = Array.from(title.querySelectorAll('.rv-word')) as HTMLElement[];
    expect(next.length).toBe(2);
    expect(next.every(word => word.style.transform === '')).toBeTrue();
  });

  /**
   * @description Paragraph lighting: dim words before the scroll reaches them, full at the end.
   * @input Words mode; scene at 0, then at 1.
   * @output First word 0.36 at 0; every word 1 at 1.
   */
  it('lights paragraph words with the scroll', () => {
    const { title } = create({ mode: 'words' });
    const words = Array.from(title.querySelectorAll('.rv-w')) as HTMLElement[];
    expect(words.length).toBe(3);
    expect(words[0].style.opacity).toBe('0.36');
    motion.scrollTo(1);
    expect(words.every(word => word.style.opacity === '1')).toBeTrue();
  });

  /**
   * @description Phones and tablets (≤ 905 px): the paragraph is shown whole at once – no
   *   word-by-word lighting.
   * @input Words mode; matchMedia answers true for '(max-width: 905px)'; scene at 0.
   * @output Every word opacity '1' at progress 0.
   */
  it('shows the whole paragraph at once on phones', () => {
    const real = window.matchMedia.bind(window);
    spyOn(window, 'matchMedia').and.callFake((query: string) =>
      query === '(max-width: 905px)' ? ({ matches: true } as MediaQueryList) : real(query));
    const { title } = create({ mode: 'words' });
    motion.scrollTo(0);
    const words = Array.from(title.querySelectorAll('.rv-w')) as HTMLElement[];
    expect(words.length).toBe(3);
    expect(words.every(word => word.style.opacity === '1')).toBeTrue();
  });

  /**
   * @description Reduced motion: no hidden words, the heading only fades; lighting shows all words.
   * @input reduced = true; mask mode; then words mode.
   * @output Words without transform, heading opacity '0' until revealed; lit words at 1.
   */
  it('uses fades only with reduced motion', () => {
    motion.reduced = true;
    const { title } = create();
    expect((title.querySelector('.rv-word') as HTMLElement).style.transform).toBe('');
    expect(title.style.opacity).toBe('0');
    TestBed.resetTestingModule();
    motion = new FakeWebMotion();
    motion.reduced = true;
    const lit = create({ mode: 'words' }).title;
    expect(Array.from(lit.querySelectorAll('.rv-w')).every(word => (word as HTMLElement).style.opacity === '1')).toBeTrue();
  });
});
