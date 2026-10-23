/**
 * @file knowledge-base.component.spec.ts
 * @path src/app/public/web-pages/knowledge-base/knowledge-base.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of the public KnowledgeBaseComponent: initial section from the URL hash, the
 *   scroll-spy (rAF throttled, last section above the 110 px line wins, missing sections skipped)
 *   and the side-menu jump (smooth scroll + hash update, unknown targets ignored).
 * @dependencies
 * - createPublicPageContext; requestAnimationFrame, getBoundingClientRect, scrollIntoView and history.replaceState spied.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { KnowledgeBaseComponent } from './knowledge-base.component';
import { createPublicPageContext } from '../../../../testing/public-test-helpers';

describe('KnowledgeBaseComponent (public)', () => {
  let fixture: ComponentFixture<KnowledgeBaseComponent>;
  let frames: FrameRequestCallback[];

  /** Places a section at the given viewport top (px); returns its element. */
  const section = (id: string, top: number) => {
    const el = document.getElementById(id)!;
    spyOn(el, 'getBoundingClientRect').and.returnValue({ top } as DOMRect);
    return el;
  };

  beforeEach(() => {
    frames = [];
    spyOn(window, 'requestAnimationFrame').and.callFake((cb: FrameRequestCallback) => { frames.push(cb); return frames.length; });
    const ctx = createPublicPageContext({ translations: { 'knowledge-base': { cta: { btn: 'Contact' } } } });
    TestBed.configureTestingModule({ imports: [KnowledgeBaseComponent], providers: ctx.providers });
    fixture = TestBed.createComponent(KnowledgeBaseComponent);
    fixture.detectChanges();
  });

  /**
   * @description Without a hash the first section is active; scroll events are throttled to one
   *   frame; the last section above the threshold becomes active.
   * @input Two scroll events; security top -500, legal top 50, admin top 400; frame runs.
   * @output 'kb-security' initially; one rAF request; 'kb-legal' afterwards; next scroll requests again.
   */
  it('highlights the section under the header while scrolling', () => {
    const component = fixture.componentInstance;
    expect(component.activeSectionId).toBe(window.location.hash ? window.location.hash.slice(1) : 'kb-security');
    section('kb-security', -500);
    section('kb-legal', 50);
    section('kb-admin', 400);

    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('scroll'));
    expect(frames.length).toBe(1);
    frames[0](0);
    expect(component.activeSectionId).toBe('kb-legal');

    const before = frames.length;
    window.dispatchEvent(new Event('scroll'));
    expect(frames.length).toBeGreaterThan(before);
    frames[frames.length - 1](0);
    expect(component.activeSectionId).toBe('kb-legal');
  });

  /**
   * @description Sections missing in the DOM are skipped by the scroll-spy.
   * @input kb-security element removed, kb-legal at -10, kb-admin at 500.
   * @output 'kb-legal' active.
   */
  it('skips sections that are not rendered', () => {
    document.getElementById('kb-security')?.remove();
    section('kb-legal', -10);
    section('kb-admin', 500);
    window.dispatchEvent(new Event('scroll'));
    frames[0](0);
    expect(fixture.componentInstance.activeSectionId).toBe('kb-legal');
  });

  /**
   * @description Menu jump: smooth scroll, active id and URL hash; unknown id → only preventDefault.
   * @input scrollToSection(event, 'kb-api'); scrollToSection(event, 'missing').
   * @output scrollIntoView({smooth, start}); 'kb-api'; replaceState('#kb-api'); unchanged for missing.
   */
  it('jumps to a section from the menu', () => {
    const component = fixture.componentInstance;
    const target = document.getElementById('kb-api')!;
    spyOn(target, 'scrollIntoView');
    spyOn(history, 'replaceState');
    const event = new Event('click', { cancelable: true });

    component.scrollToSection(event, 'kb-api');
    expect(event.defaultPrevented).toBeTrue();
    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(component.activeSectionId).toBe('kb-api');
    expect(history.replaceState).toHaveBeenCalledWith(null, '', '#kb-api');

    component.scrollToSection(new Event('click', { cancelable: true }), 'missing');
    expect(component.activeSectionId).toBe('kb-api');
    expect(history.replaceState).toHaveBeenCalledTimes(1);
  });
});
