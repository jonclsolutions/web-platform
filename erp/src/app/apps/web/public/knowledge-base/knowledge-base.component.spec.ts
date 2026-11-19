/**
 * @file knowledge-base.component.spec.ts
 * @path src/app/apps/web/public/knowledge-base/knowledge-base.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the public KnowledgeBaseComponent: the content from
 *   `public/web/knowledge-base` (introduction, blocks with sub-blocks and the image at the end, a
 *   missing text, the language switch, no glossary), the active block from the URL hash / the
 *   first one, the scroll-spy (rAF throttled, last block above the 110 px line wins, missing
 *   blocks skipped) and the side-menu jump (smooth scroll + hash update, unknown targets ignored).
 * @dependencies
 * - createPublicPageContext (PublicDataService stub answers the content); requestAnimationFrame,
 *   getBoundingClientRect, scrollIntoView and history.replaceState spied.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { KnowledgeBaseComponent } from './knowledge-base.component';
import { PublicPageContext, createPublicPageContext } from '../../../../../testing/public-test-helpers';

describe('KnowledgeBaseComponent (public)', () => {
  let fixture: ComponentFixture<KnowledgeBaseComponent>;
  let ctx: PublicPageContext;
  let frames: FrameRequestCallback[];

  const content = [
    { id: 1, intro: true, heading: { cz: 'Vše o systému', en: 'All about it' }, text: { cz: 'Úvod\nDruhý řádek', en: 'Intro' }, image: null, items: [] },
    { id: 4, intro: false, heading: { cz: 'Zabezpečení', en: 'Security' }, text: { cz: 'Text bezpečnosti', en: 'Security text' }, image: null,
      items: [{ title: { cz: 'Hesla', en: 'Passwords' }, text: { cz: 'Hash', en: 'Hash' } }, { title: { cz: 'HTTPS' }, text: { cz: 'TLS' } }] },
    { id: 7, intro: false, heading: { cz: 'E-maily', en: 'E-mails' }, text: { cz: '5 schránek', en: '5 mailboxes' }, image: 'knowledge-base/7-abc.webp', items: [] },
    { id: 9, intro: false, heading: { cz: 'Podpora', en: 'Support' }, text: { cz: 'Pomoc', en: 'Help' }, image: null, items: [] },
  ];

  /** Places a block at the given viewport top (px); returns its element. */
  const section = (id: string, top: number) => {
    const el = document.getElementById(id)!;
    spyOn(el, 'getBoundingClientRect').and.returnValue({ top } as DOMRect);
    return el;
  };
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    frames = [];
    spyOn(window, 'requestAnimationFrame').and.callFake((cb: FrameRequestCallback) => { frames.push(cb); return frames.length; });
    ctx = createPublicPageContext({ translations: { 'knowledge-base': { cta: { btn: 'Contact', text: 'Questions?' } } } });
    ctx.publicData.get.and.callFake((endpoint: string) => of(endpoint === 'public/web/knowledge-base' ? content : {}));
    TestBed.configureTestingModule({ imports: [KnowledgeBaseComponent], providers: ctx.providers });
    fixture = TestBed.createComponent(KnowledgeBaseComponent);
    fixture.detectChanges();
  });

  /**
   * @description The page is built from the content: the introduction in the hero, one section per
   *   block in the side list and the pills, sub-blocks as points, the image at the end of its
   *   block, no glossary, the call to action from the translations.
   * @input Introduction + 3 blocks (2 sub-blocks in the first, an image in the second); cz.
   * @output hero 'Vše o systému' / 'Úvod\nDruhý řádek'; sections kb-4, kb-7, kb-9; 3 side links and
   *   3 pills; points Hesla, HTTPS; image '/storage/knowledge-base/7-abc.webp' as the last child of
   *   kb-7; no .kb-glossary-section; CTA 'Contact'.
   */
  it('renders the introduction and the blocks from the content', () => {
    expect(ctx.publicData.get).toHaveBeenCalledWith('public/web/knowledge-base');
    expect(el().querySelector('.kb-hero-heading')!.textContent).toBe('Vše o systému');
    expect(el().querySelector('.kb-hero-lead')!.textContent).toBe('Úvod\nDruhý řádek');
    expect(Array.from(el().querySelectorAll('.kb-section')).map(s => s.id)).toEqual(['kb-4', 'kb-7', 'kb-9']);
    expect(el().querySelectorAll('.kb-sidebar-link').length).toBe(3);
    expect(el().querySelectorAll('.kb-toc-item').length).toBe(3);
    expect(Array.from(el().querySelectorAll('#kb-4 .kb-point-title')).map(p => p.textContent)).toEqual(['Hesla', 'HTTPS']);
    expect(el().querySelector('#kb-4 .kb-points-grid')).not.toBeNull();
    expect(el().querySelector('#kb-7 .kb-points-grid')).toBeNull();
    const figure = el().querySelector('#kb-7')!.lastElementChild!;
    expect(figure.querySelector('img')!.getAttribute('src')).toBe('/storage/knowledge-base/7-abc.webp');
    expect(el().querySelector('.kb-glossary-section')).toBeNull();
    expect(el().querySelector('.kb-cta-btn')!.textContent!.trim()).toBe('Contact');
  });

  /**
   * @description A switch of the language redraws the texts; a text missing in the language shows
   *   the placeholder.
   * @input Language en.
   * @output hero 'All about it'; first block 'Security'; the second sub-block 'Cannot load text'.
   */
  it('follows the current language', () => {
    ctx.localization.currentLanguage$.next('en');
    fixture.detectChanges();
    expect(el().querySelector('.kb-hero-heading')!.textContent).toBe('All about it');
    expect(el().querySelector('#kb-4 .kb-section-header')!.textContent).toBe('Security');
    expect(el().querySelectorAll('#kb-4 .kb-point-title')[1].textContent).toBe('Cannot load text');
  });

  /**
   * @description Without a known hash the first block is active; scroll events are throttled to
   *   one frame; the last block above the threshold becomes active.
   * @input Two scroll events; kb-4 top -500, kb-7 top 50, kb-9 top 400; frame runs.
   * @output 'kb-4' initially (or the hash of a known block); one rAF request; 'kb-7' afterwards.
   */
  it('highlights the block under the header while scrolling', () => {
    const component = fixture.componentInstance;
    const hash = window.location.hash.slice(1);
    expect(component.activeSectionId).toBe(['kb-4', 'kb-7', 'kb-9'].includes(hash) ? hash : 'kb-4');
    section('kb-4', -500);
    section('kb-7', 50);
    section('kb-9', 400);

    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('scroll'));
    expect(frames.length).toBe(1);
    frames[0](0);
    expect(component.activeSectionId).toBe('kb-7');

    const before = frames.length;
    window.dispatchEvent(new Event('scroll'));
    expect(frames.length).toBeGreaterThan(before);
  });

  /**
   * @description Blocks missing in the DOM are skipped by the scroll-spy.
   * @input kb-4 element removed, kb-7 at -10, kb-9 at 500.
   * @output 'kb-7' active.
   */
  it('skips blocks that are not rendered', () => {
    document.getElementById('kb-4')?.remove();
    section('kb-7', -10);
    section('kb-9', 500);
    window.dispatchEvent(new Event('scroll'));
    frames[0](0);
    expect(fixture.componentInstance.activeSectionId).toBe('kb-7');
  });

  /**
   * @description Menu jump: smooth scroll, active id and URL hash; unknown id → only preventDefault.
   * @input scrollToSection(event, 'kb-9'); scrollToSection(event, 'missing').
   * @output scrollIntoView({smooth, start}); 'kb-9'; replaceState('#kb-9'); unchanged for missing.
   */
  it('jumps to a block from the menu', () => {
    const component = fixture.componentInstance;
    const target = document.getElementById('kb-9')!;
    spyOn(target, 'scrollIntoView');
    spyOn(history, 'replaceState');
    const event = new Event('click', { cancelable: true });

    component.scrollToSection(event, 'kb-9');
    expect(event.defaultPrevented).toBeTrue();
    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(component.activeSectionId).toBe('kb-9');
    expect(history.replaceState).toHaveBeenCalledWith(null, '', '#kb-9');

    component.scrollToSection(new Event('click', { cancelable: true }), 'missing');
    expect(component.activeSectionId).toBe('kb-9');
    expect(history.replaceState).toHaveBeenCalledTimes(1);
  });
});
