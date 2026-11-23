/**
 * @file scroll-effect.directive.spec.ts
 * @path src/app/apps/web/public/motion/scroll-effect.directive.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of ScrollEffectDirective: start and end pose of the line, zoom, tilt and
 *   slide effects, the cascade of tiles (rows later, sides, frame at the end), the one-column
 *   cascade of phones (each tile by its own position) and the final pose with reduced motion.
 * @dependencies Angular TestBed (host component), FakeWebMotion.
 */

import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ScrollEffectDirective } from './scroll-effect.directive';
import { WebMotionService } from './web-motion.service';
import { FakeWebMotion } from './motion.testing';

/** Host: one element per effect and a 2 × 2 cascade grid with a frame. */
@Component({
  standalone: true,
  imports: [ScrollEffectDirective],
  template: `
    <div class="line" appScrollEffect="draw-x"></div>
    <div class="divider" appScrollEffect="draw-y"></div>
    <div class="zoom" appScrollEffect="zoom"></div>
    <div class="tilt" appScrollEffect="tilt" [scrollEffectDir]="-1"></div>
    <div class="slide" appScrollEffect="slide" [scrollEffectDir]="1"></div>
    <div class="grid" appScrollEffect="cascade" [scrollEffectColumns]="2">
      <div class="frame" data-cascade-frame></div>
      <div class="tile"></div><div class="tile"></div><div class="tile"></div><div class="tile"></div>
    </div>`,
})
class HostComponent {}

/** Host: a one-column cascade (phones) with three tiles and a frame. */
@Component({
  standalone: true,
  imports: [ScrollEffectDirective],
  template: `
    <div class="grid" appScrollEffect="cascade" [scrollEffectColumns]="1">
      <div class="frame" data-cascade-frame></div>
      <div class="tile"></div><div class="tile"></div><div class="tile"></div>
    </div>`,
})
class OneColumnHostComponent {}

describe('ScrollEffectDirective', () => {
  let motion: FakeWebMotion;

  /** Creates the host; returns a query helper. */
  function create() {
    TestBed.configureTestingModule({ imports: [HostComponent], providers: [{ provide: WebMotionService, useValue: motion }] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return (selector: string) => fixture.nativeElement.querySelector(selector) as HTMLElement;
  }

  beforeEach(() => { motion = new FakeWebMotion(); });

  /**
   * @description Start pose at progress 0 and rest pose at 1 of the simple effects.
   * @input Scenes at 0, then at 1.
   * @output line scaleX(0) → scaleX(1); divider scaleY(0) → scaleY(1); zoom 0.78 → 1; tilt from the
   *   left (negative x) → no offset, opacity 1; slide from the right → 0 px, opacity 1.
   */
  it('moves the simple effects from start to rest', () => {
    const el = create();
    expect(el('.line').style.transform).toBe('scaleX(0)');
    expect(el('.divider').style.transform).toBe('scaleY(0)');
    expect(el('.zoom').style.transform).toBe('scale(0.78)');
    expect(el('.tilt').style.transform).toContain('translateX(-120px)');
    expect(el('.slide').style.transform).toBe('translateX(320px)');

    motion.scrollTo(1);
    expect(el('.line').style.transform).toBe('scaleX(1)');
    expect(el('.divider').style.transform).toBe('scaleY(1)');
    expect(el('.zoom').style.transform).toBe('scale(1)');
    expect(el('.tilt').style.transform).toContain('translateX(0px)');
    expect(el('.tilt').style.opacity).toBe('1');
    expect(el('.slide').style.transform).toBe('translateX(0px)');
    expect(el('.slide').style.opacity).toBe('1');
  });

  /**
   * @description Cascade: left tiles from the left, right tiles from the right; the second row
   *   starts later than the first; at the end everything rests and the frame is shown.
   * @input Scene at 0, at 0.3, at 1.
   * @output At 0: tile 1 at −300 px, tile 2 at +300 px, frame 0. At 0.3: row 1 closer than row 2.
   *   At 1: every tile translate(0px, 0px), opacity 1, frame 1.
   */
  it('brings the tiles in row by row from both sides', () => {
    const el = create();
    const tiles = Array.from(el('.grid').querySelectorAll('.tile')) as HTMLElement[];
    const x = (tile: HTMLElement) => parseFloat(/translate\((-?[\d.]+)px/.exec(tile.style.transform)![1]);
    expect(x(tiles[0])).toBe(-300);
    expect(x(tiles[1])).toBe(300);
    expect(el('.frame').style.opacity).toBe('0');

    motion.scrollTo(0.3);
    expect(Math.abs(x(tiles[0]))).toBeLessThan(Math.abs(x(tiles[2])));

    motion.scrollTo(1);
    expect(tiles.every(tile => tile.style.transform.startsWith('translate(0px, 0px)'))).toBeTrue();
    expect(tiles.every(tile => tile.style.opacity === '1')).toBeTrue();
    expect(el('.frame').style.opacity).toBe('1');
  });

  /**
   * @description One column (phones): every tile follows its own position on the screen, so the
   *   last tile arrives as surely as the first; sides alternate, shorter travel; the frame is
   *   shown at once.
   * @input columns 1, three tiles; scenes at 0, then at 1.
   * @output At 0: tiles at −120 / +120 / −120 px, frame 1. At 1: every tile translate(0px, 0px)
   *   with opacity 1 – the last one included.
   */
  it('brings every tile of a one-column list into place', () => {
    TestBed.configureTestingModule({ imports: [OneColumnHostComponent], providers: [{ provide: WebMotionService, useValue: motion }] });
    const fixture = TestBed.createComponent(OneColumnHostComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const tiles = Array.from(root.querySelectorAll('.tile')) as HTMLElement[];
    const x = (tile: HTMLElement) => parseFloat(/translate\((-?[\d.]+)px/.exec(tile.style.transform)![1]);
    expect(tiles.map(x)).toEqual([-120, 120, -120]);
    expect((root.querySelector('.frame') as HTMLElement).style.opacity).toBe('1');

    motion.scrollTo(1);
    expect(tiles.every(tile => tile.style.transform.startsWith('translate(0px, 0px)'))).toBeTrue();
    expect(tiles.every(tile => tile.style.opacity === '1')).toBeTrue();
  });

  /**
   * @description Reduced motion: every effect is in its rest pose right away.
   * @input reduced = true.
   * @output line scaleX(1); first tile translate(0px, 0px); frame 1.
   */
  it('shows the rest pose with reduced motion', () => {
    motion.reduced = true;
    const el = create();
    expect(el('.line').style.transform).toBe('scaleX(1)');
    expect((el('.grid').querySelector('.tile') as HTMLElement).style.transform.startsWith('translate(0px, 0px)')).toBeTrue();
    expect(el('.frame').style.opacity).toBe('1');
  });
});
