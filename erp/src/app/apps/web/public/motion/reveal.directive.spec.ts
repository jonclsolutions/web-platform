/**
 * @file reveal.directive.spec.ts
 * @path src/app/apps/web/public/motion/reveal.directive.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of RevealDirective: hidden until visible, a block / a group revealed
 *   and cleaned up afterwards, the reduced-motion fade, a group waiting for its items, and nothing
 *   hidden when the browser cannot tell visibility.
 * @dependencies Angular TestBed (host component), FakeWebMotion.
 */

import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { RevealDirective } from './reveal.directive';
import { WebMotionService } from './web-motion.service';
import { FakeWebMotion } from './motion.testing';

/** Host: a block, a group of two items and an empty group filled later. */
@Component({
  standalone: true,
  imports: [RevealDirective],
  template: `
    <p class="block" appReveal>Text</p>
    <ul class="group" appReveal="group"><li>A</li><li>B</li></ul>
    <ul class="late" appReveal="group">@for (item of items; track item) { <li>{{ item }}</li> }</ul>`,
})
class HostComponent {
  items: string[] = [];
}

/** Waits until the animations of the given elements have finished (max. ~3 s). */
async function settled(check: () => boolean): Promise<void> {
  for (let i = 0; i < 60 && !check(); i++) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

describe('RevealDirective', () => {
  let motion: FakeWebMotion;

  /** Creates the host with the fake motion service. */
  function create() {
    TestBed.configureTestingModule({ imports: [HostComponent], providers: [{ provide: WebMotionService, useValue: motion }] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el = (selector: string) => fixture.nativeElement.querySelector(selector) as HTMLElement;
    return { fixture, el };
  }

  beforeEach(() => { motion = new FakeWebMotion(); });

  /**
   * @description Blocks are hidden from creation until their reveal, then animated and the inline
   *   styles removed (their own CSS applies again).
   * @input Host rendered; revealAll(); wait for the animations.
   * @output opacity '0' before; after: block and group items without inline opacity / transform.
   */
  it('hides blocks until visible and cleans up after the reveal', async () => {
    const { el } = create();
    expect(el('.block').style.opacity).toBe('0');
    expect(el('.group').style.opacity).toBe('0');
    motion.revealAll();
    const items = Array.from(el('.group').children) as HTMLElement[];
    await settled(() => el('.block').style.opacity === '' && items.every(item => item.style.opacity === ''));
    expect(el('.block').style.opacity).toBe('');
    expect(el('.block').style.transform).toBe('');
    expect(el('.group').style.opacity).toBe('');
    expect(items.every(item => item.style.opacity === '' && item.style.transform === '')).toBeTrue();
  });

  /**
   * @description A group visible before its items arrive waits for them.
   * @input The empty group revealed; then two items rendered.
   * @output Still hidden without items; revealed (opacity cleared) after they arrive.
   */
  it('waits for the items of a group that arrive later', async () => {
    const { fixture, el } = create();
    motion.revealAll();
    expect(el('.late').style.opacity).toBe('0');
    fixture.componentInstance.items = ['x', 'y'];
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    await settled(() => el('.late').style.opacity === '');
    expect(el('.late').style.opacity).toBe('');
    expect(el('.late').children.length).toBe(2);
  });

  /**
   * @description Reduced motion: a fade only (no movement), styles removed afterwards.
   * @input reduced = true; revealAll().
   * @output The block ends without inline opacity / transform.
   */
  it('only fades with reduced motion', async () => {
    motion.reduced = true;
    const { el } = create();
    motion.revealAll();
    await settled(() => el('.block').style.opacity === '');
    expect(el('.block').style.opacity).toBe('');
    expect(el('.block').style.transform).toBe('');
  });

  /**
   * @description When the browser cannot tell visibility nothing is hidden.
   * @input revealable = false.
   * @output No inline opacity on the block or the group.
   */
  it('never hides content without visibility detection', () => {
    motion.revealable = false;
    const { el } = create();
    expect(el('.block').style.opacity).toBe('');
    expect(el('.group').style.opacity).toBe('');
  });
});
