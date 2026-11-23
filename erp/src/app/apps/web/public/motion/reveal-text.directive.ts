/**
 * @file reveal-text.directive.ts
 * @path src/app/apps/web/public/motion/reveal-text.directive.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Renders a translated text word by word and animates it: masked word reveal of a
 *   heading (on load or when it scrolls into view) or word-by-word lighting of a paragraph while it
 *   scrolls through the viewport.
 * @dependencies WebMotionService, motion (animate, stagger), motion-presets
 */
import { Directive, ElementRef, Input, OnChanges, OnDestroy, inject } from '@angular/core';
import { animate, stagger } from 'motion';
import { WebMotionService } from './web-motion.service';
import { EASE_OUT_POINTS, MASK_DURATION, MASK_STAGGER, REDUCED_FADE, clamp01 } from './motion-presets';

/** `mask` = heading reveal in view; `load` = heading reveal right away (hero); `words` = scroll lighting. */
export type RevealTextMode = 'mask' | 'load' | 'words';

/** Opacity of a paragraph word before the scroll reaches it. */
const WORD_DIM = 0.36;
/** How many words the soft edge of the lighting spans. */
const WORD_EDGE = 6;
/** Screens where a paragraph is shown whole at once (phones, tablets) instead of lit word by word. */
const WORDS_OFF_QUERY = '(max-width: 905px)';

/**
 * @description Writes the text into the host as word spans and runs the chosen animation.
 * @usage `<h2 [appRevealText]="t?.title"></h2>` (mask), `<h1 [appRevealText]="t?.hero?.heading"
 *   revealTextMode="load" [revealTextBreaks]="true"></h1>`, `<p [appRevealText]="t?.text"
 *   revealTextMode="words"></p>`. The host must have no other content in the template.
 * @note The text is written with `textContent` (never as HTML). With `revealTextBreaks` the only
 *   markup recognised is `<br>`, which becomes a line break – any other tag stays plain text. The
 *   spans get the component's style-scope attribute of the host, so the page CSS can style
 *   `.rv-word` / `.rv-w`; they inherit the font of the host (the global `span` rule would
 *   otherwise switch headings to the body font). The full text stays in the DOM for screen
 *   readers and search engines. A new text (language switch) is rendered visible when the reveal already ran.
 */
@Directive({
  selector: '[appRevealText]',
  standalone: true,
})
export class RevealTextDirective implements OnChanges, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly motion = inject(WebMotionService);

  /** Text to render (translation). */
  @Input('appRevealText') text: string | null | undefined = '';
  /** Animation of the text. */
  @Input() revealTextMode: RevealTextMode = 'mask';
  /** Whether `<br>` in the text is a line break (hero heading). */
  @Input() revealTextBreaks = false;

  private revealed = false;
  private stop: () => void = () => {};

  /** @description Re-renders the words when the text changes and starts the animation once. */
  ngOnChanges(): void {
    this.stop();
    this.stop = () => {};
    const words = this.render(this.text ?? '');
    if (!words.length) {
      return;
    }
    if (this.revealTextMode === 'words') {
      this.lightWords(words);
      return;
    }
    if (this.revealed || !this.motion.canReveal()) {
      return;
    }
    if (this.motion.isReduced()) {
      this.host.style.opacity = '0';
    } else {
      words.forEach(word => { word.style.transform = 'translateY(118%) rotate(5deg)'; });
    }
    if (this.revealTextMode === 'load') {
      this.revealMask(words, 0.2);
    } else {
      this.stop = this.motion.whenVisible(this.host, 0.6, () => this.revealMask(words, 0));
    }
  }

  /** @description Stops the observer / scroll listener. */
  ngOnDestroy(): void {
    this.stop();
  }

  /**
   * @description Replaces the content of the host with word spans.
   * @param text Text of the translation.
   * @returns The animated span of every word (`.rv-word` in masks, `.rv-w` for lighting).
   */
  private render(text: string): HTMLElement[] {
    const host = this.host;
    const doc = host.ownerDocument;
    const scope = Array.from(host.attributes).find(attribute => attribute.name.startsWith('_ngcontent-'))?.name;
    const scoped = (element: HTMLElement) => { if (scope) { element.setAttribute(scope, ''); } return element; };
    host.textContent = '';
    const lines = this.revealTextBreaks ? text.split(/<br\s*\/?>/i) : [text];
    const words: HTMLElement[] = [];
    lines.forEach((line, lineIndex) => {
      if (lineIndex > 0) {
        host.appendChild(doc.createElement('br'));
      }
      const parts = line.trim().split(/\s+/).filter(Boolean);
      parts.forEach((part, index) => {
        if (index > 0) {
          host.appendChild(doc.createTextNode(' '));
        }
        if (this.revealTextMode === 'words') {
          const span = scoped(doc.createElement('span'));
          span.className = 'rv-w';
          span.style.fontFamily = 'inherit';
          span.textContent = part;
          host.appendChild(span);
          words.push(span);
          return;
        }
        const mask = scoped(doc.createElement('span'));
        mask.className = 'rv-mask';
        mask.style.cssText = 'display:inline-block;overflow:hidden;vertical-align:bottom;padding:0.06em 0.06em 0.16em;margin:-0.06em -0.06em -0.16em;font-family:inherit;';
        const word = scoped(doc.createElement('span'));
        word.className = 'rv-word';
        word.style.cssText = 'display:inline-block;transform-origin:0% 100%;font-family:inherit;';
        word.textContent = part;
        mask.appendChild(word);
        host.appendChild(mask);
        words.push(word);
      });
    });
    return words;
  }

  /**
   * @description Masked word reveal (claude-motion Mask): words slide up out of their clip with a
   *   slight tilt, 0.8 s each, 0.09 s apart. Reduced motion: the heading fades in (150 ms).
   * @param words Word spans.
   * @param startDelay Delay before the first word (seconds).
   */
  private revealMask(words: HTMLElement[], startDelay: number): void {
    this.revealed = true;
    if (this.motion.isReduced()) {
      words.forEach(word => { word.style.transform = ''; });
      animate(this.host, { opacity: [0, 1] }, { duration: REDUCED_FADE })
        .finished.then(() => this.afterFrame(() => { this.host.style.opacity = ''; }));
      return;
    }
    this.host.style.opacity = '';
    animate(words, { y: ['118%', '0%'], rotate: [5, 0] }, {
      duration: MASK_DURATION, ease: EASE_OUT_POINTS, delay: stagger(MASK_STAGGER, { startDelay }),
    }).finished.then(() => this.afterFrame(() => words.forEach(word => { word.style.transform = ''; })));
  }

  /**
   * @description Runs a clean-up one frame later – Motion commits the final keyframe right after
   *   the `finished` promise of an animation resolves.
   * @param fn Clean-up of inline styles.
   */
  private afterFrame(fn: () => void): void {
    const view = this.host.ownerDocument.defaultView;
    if (view) {
      view.requestAnimationFrame(fn);
    } else {
      fn();
    }
  }

  /**
   * @description Word-by-word lighting tied to the scroll: the words reach full opacity in reading
   *   order with a soft edge of six words. Only changed opacities are written (2 % steps).
   *   Phones and tablets (≤ 905 px) get the whole paragraph readable at once – no lighting.
   * @param words Word spans of the paragraph.
   */
  private lightWords(words: HTMLElement[]): void {
    if (this.host.ownerDocument.defaultView?.matchMedia?.(WORDS_OFF_QUERY).matches) {
      words.forEach(word => { word.style.opacity = '1'; });
      return;
    }
    const count = words.length;
    const current = new Float32Array(count).fill(-1);
    this.stop = this.motion.linkScroll(this.host, ['start 0.95', 'end 0.7'], progress => {
      const head = progress * (count + WORD_EDGE);
      for (let i = 0; i < count; i++) {
        const opacity = Math.round((WORD_DIM + (1 - WORD_DIM) * clamp01((head - i) / WORD_EDGE)) * 50) / 50;
        if (opacity !== current[i]) {
          current[i] = opacity;
          words[i].style.opacity = String(opacity);
        }
      }
    });
  }
}
