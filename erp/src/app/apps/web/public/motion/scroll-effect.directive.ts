/**
 * @file scroll-effect.directive.ts
 * @path src/app/apps/web/public/motion/scroll-effect.directive.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Scroll-linked effects of the public web: a line drawn from the centre, a zoom into
 *   focus, a card turning in from the side, a row sliding in, and tiles arriving row by row from
 *   both sides (cascade). Progress is spring-smoothed (WebMotionService.linkScroll).
 * @dependencies WebMotionService, motion-presets
 */
import { AfterViewInit, Directive, ElementRef, Input, OnDestroy, inject } from '@angular/core';
import { WebMotionService } from './web-motion.service';
import { band, easeOut, tileEase } from './motion-presets';

/** Available scroll-linked effects. */
export type ScrollEffect = 'draw-x' | 'draw-y' | 'zoom' | 'tilt' | 'slide' | 'cascade';

/** Delay between rows of a cascade, share of the window of one row, horizontal travel (px). */
const CASCADE_ROW_DELAY = 0.16;
const CASCADE_ROW_SPAN = 0.42;
const CASCADE_TRAVEL = 300;
/** Shorter travel of a tile on phones (one column; the screen is narrow). */
const CASCADE_TRAVEL_PHONE = 120;

/**
 * @description Ties one effect to the scroll position of its element.
 * @usage `<div appScrollEffect="draw-x">` (separator line), `appScrollEffect="draw-y"` (vertical
 *   divider), `appScrollEffect="zoom"`, `appScrollEffect="tilt" [scrollEffectDir]="-1"` (card from
 *   the left), `appScrollEffect="slide" [scrollEffectDir]="1"` (row from the right),
 *   `appScrollEffect="cascade" [scrollEffectColumns]="2"` on a grid (its element children are the
 *   tiles; a child with `data-cascade-frame` is the outer frame that fades in at the end).
 * @note Only transform and opacity are written, `will-change` only while moving. Reduced motion:
 *   the final pose, no movement. Design rules chapter 7.2.
 */
@Directive({
  selector: '[appScrollEffect]',
  standalone: true,
})
export class ScrollEffectDirective implements AfterViewInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly motion = inject(WebMotionService);

  /** Effect of the element. */
  @Input('appScrollEffect') effect: ScrollEffect = 'draw-x';
  /** Side the element comes from: −1 = left, 1 = right (tilt, slide). */
  @Input() scrollEffectDir: 1 | -1 = 1;
  /** Columns of a cascade grid. */
  @Input() scrollEffectColumns = 2;

  private stop: () => void = () => {};

  /**
   * @description Starts the scroll scene of the effect – after the view, so tiles rendered by
   *   `@for` inside the host already exist; still before the first paint (no flash).
   */
  ngAfterViewInit(): void {
    const host = this.host;
    const dir = this.scrollEffectDir;
    switch (this.effect) {
      case 'draw-x':
        this.stop = this.motion.linkScroll(host, ['start end', 'center 0.6'], p => {
          host.style.transform = `scaleX(${easeOut(p).toFixed(4)})`;
        });
        break;
      case 'draw-y':
        this.stop = this.motion.linkScroll(host, ['start end', 'center 0.6'], p => {
          host.style.transform = `scaleY(${band(easeOut(p), 0.3, 1).toFixed(4)})`;
        });
        break;
      case 'zoom':
        this.stop = this.motion.linkScroll(host, ['start end', 'center 0.6'], p => {
          const q = easeOut(p);
          host.style.transform = `scale(${(0.78 + 0.22 * q).toFixed(4)})`;
          this.motion.promote(host, q > 0 && q < 1);
        });
        break;
      case 'tilt':
        this.stop = this.motion.linkScroll(host, ['start end', 'center 0.55'], p => {
          const k = 1 - easeOut(p);
          host.style.transform =
            `translateX(${(k * dir * 120).toFixed(1)}px) rotateY(${(-dir * k * 38).toFixed(2)}deg) ` +
            `rotateX(${(k * 10).toFixed(2)}deg) scale(${(0.82 + 0.18 * (1 - k)).toFixed(4)})`;
          host.style.opacity = (0.2 + 0.8 * (1 - k)).toFixed(3);
          this.motion.promote(host, k > 0 && k < 1);
        });
        break;
      case 'slide':
        this.stop = this.motion.linkScroll(host, ['start end', 'start 0.55'], p => {
          const q = easeOut(p);
          host.style.transform = `translateX(${(dir * (1 - q) * 320).toFixed(1)}px)`;
          host.style.opacity = (0.15 + 0.85 * q).toFixed(3);
          this.motion.promote(host, q > 0 && q < 1);
        });
        break;
      case 'cascade':
        this.stop = this.cascade();
        break;
    }
  }

  /** @description Stops the scroll scene. */
  ngOnDestroy(): void {
    this.stop();
  }

  /**
   * @description Tiles of a grid arrive row by row: row r gets its own window of the progress,
   *   r × 0.16 later, so the top row meets first and lower rows are still further out (owner's
   *   sketch). Tiles of the left half come from the left, the right half from the right, with a
   *   small tilt and drop that settle to zero. The frame fades in after the last row.
   * @returns Cleanup of the scroll scene.
   * @note With one column (phones) a grid-wide window cannot work – the list is several screens
   *   tall and row r × 0.16 runs past the end from the 7th row, so the lower tiles would never
   *   arrive. There every tile follows its own position on the screen (arrives between 100 % and
   *   78 % of the viewport height), the sides alternate, the travel is shorter and the frame is
   *   shown at once.
   */
  private cascade(): () => void {
    const host = this.host;
    const children = Array.from(host.children) as HTMLElement[];
    const frame = children.find(child => child.hasAttribute('data-cascade-frame')) ?? null;
    const columns = Math.max(1, this.scrollEffectColumns);
    const tiles = children.filter(child => child !== frame).map((element, index) => {
      const column = index % columns;
      const side = columns === 1 ? (index % 2 === 0 ? -1 : 1) : (column < columns / 2 ? -1 : 1);
      return { element, row: Math.floor(index / columns), side };
    });
    if (columns === 1) {
      if (frame) {
        frame.style.opacity = '1';
      }
      const stops = tiles.map(tile =>
        this.motion.linkScroll(tile.element, ['start 1', 'start 0.78'], p => this.placeTile(tile.element, tile.side, tileEase(p), CASCADE_TRAVEL_PHONE)));
      return () => stops.forEach(stop => stop());
    }
    return this.motion.linkScroll(host, ['start 0.95', 'center 0.5'], p => {
      for (const tile of tiles) {
        const q = tileEase(band(p, tile.row * CASCADE_ROW_DELAY, tile.row * CASCADE_ROW_DELAY + CASCADE_ROW_SPAN));
        this.placeTile(tile.element, tile.side, q, CASCADE_TRAVEL);
      }
      if (frame) {
        frame.style.opacity = band(p, 0.86, 1).toFixed(3);
      }
    });
  }

  /**
   * @description Pose of one cascade tile: off to its side with a small drop and tilt at q = 0,
   *   in place at q = 1; fades in during the first 55 % of the way.
   * @param tile Tile element.
   * @param side -1 from the left, 1 from the right.
   * @param q Eased arrival (0–1).
   * @param travel Horizontal start offset (px).
   */
  private placeTile(tile: HTMLElement, side: number, q: number, travel: number): void {
    const k = 1 - q;
    tile.style.transform =
      `translate(${(side * k * travel).toFixed(1)}px, ${(k * 22).toFixed(1)}px) rotate(${(side * k * -2.2).toFixed(2)}deg)`;
    tile.style.opacity = band(q, 0, 0.55).toFixed(3);
    this.motion.promote(tile, q > 0 && q < 1);
  }
}
