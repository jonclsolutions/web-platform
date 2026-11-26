/**
 * @file text-editor-overlay.spec.ts
 * @path src/app/public/text-editor/text-editor-overlay.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the overlay of the visual text editor on a real DOM: finding marked
 *   texts (also split into word spans), the report of the page (visible / attribute / hidden
 *   texts), selecting by a click instead of following a link, content clicks, blocking of
 *   leaving the editor, drawing of the selection and the hover label, cleanup.
 * @dependencies TextEditorOverlay, text-editor-markers
 */

import { TextEditorEntry, TextEditorOverlay, TextEditorOverlayHost } from './text-editor-overlay';
import { markText } from './text-editor-markers';

describe('TextEditorOverlay', () => {
  const entries: TextEditorEntry[] = [
    { kind: 'text', key: 'navigation.contact' },
    { kind: 'text', key: 'faq.header_1' },
    { kind: 'text', key: 'contact.placeholder' },
    { kind: 'text', key: 'menu.hidden' },
    { kind: 'content', section: 'faq' },
    { kind: 'text', key: 'contact.options.new' },
    { kind: 'text', key: 'about.story_heading_2', missing: true },
    { kind: 'content', section: 'jobs', missing: true },
  ];
  let host: jasmine.SpyObj<TextEditorOverlayHost>;
  let box: HTMLElement;
  let overlay: TextEditorOverlay;

  /** Center of an element in the viewport. */
  const center = (element: Element) => {
    const r = element.getBoundingClientRect();
    return { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
  };
  /** Dispatches a click at the center of an element. */
  const clickOn = (element: Element) => {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1, ...center(element) });
    element.dispatchEvent(event);
    return event;
  };
  /** Layer drawn by the overlay. */
  const layer = () => document.querySelector('jsw-text-editor-layer')!.shadowRoot!;

  beforeEach(() => {
    host = jasmine.createSpyObj<TextEditorOverlayHost>('host', ['entry', 'contentLabel', 'missingLabel', 'onSelect', 'onContent', 'onScan']);
    host.entry.and.callFake(index => entries[index]);
    host.contentLabel.and.returnValue('FAQ – upravit v části FAQ');
    host.missingLabel.and.returnValue('Chybí');
    box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:0;top:40px;width:600px;background:#fff;z-index:1;font:16px sans-serif;';
    const heading = markText('Často kladené otázky', 1, 'text').split(' ');
    box.innerHTML = `
      <h2 style="margin:0"><span id="missing">${markText('Náš příběh', 6, 'text')}</span></h2>
      <p style="margin:0"><span id="missing-content">${markText('Cannot load text', 7, 'content')}</span></p>
      <nav><a id="contact" href="/cs/contact">${markText('Kontakt', 0, 'text')}</a></nav>
      <h1 id="heading"><span>${heading[0]}</span> <span>${heading[1]}</span> <span>${heading[2]}</span></h1>
      <input id="search" placeholder="${markText('Hledat', 2, 'text')}">
      <div style="display:none">${markText('Skryté', 3, 'text')}</div>
      <button id="toggle" type="button">${markText('Kolik stojí vývoj?', 0, 'text')}</button>
      <button id="question" type="button">${markText('Jak dlouho trvá vývoj?', 4, 'content')}</button>
      <a id="external" href="https://example.com/">Jinam</a>
      <a id="internal" href="/cs/faq">Interní</a>
      <a id="pill" href="/cs/services" style="display:inline-block;padding:20px 40px">${markText('Služby', 0, 'text')}</a>
      <form id="form"><select><option>${markText('Nová poptávka', 5, 'text')}</option></select><button type="submit">Odeslat</button></form>`;
    document.body.appendChild(box);
    overlay = new TextEditorOverlay(document, host);
    overlay.start();
  });

  afterEach(() => {
    overlay.stop();
    box.remove();
  });

  /**
   * @description The scan finds 7 texts (one split into word spans) and reports the page: the
   *   path, the visible keys, the attribute text and the text hidden by CSS.
   * @input the fixture
   * @output count 9 (the placeholder is an attribute; an option of a select is listed as `option`); onScan visible [navigation.contact,
   *   faq.header_1], hidden placeholder + hidden (menu.hidden); the middle word of the split
   *   heading hits it
   */
  it('finds the marked texts and reports the page', () => {
    expect(overlay.count).toBe(9);
    const scan = host.onScan.calls.mostRecent().args[0];
    expect(scan.visible).toEqual(jasmine.arrayWithExactContents(['navigation.contact', 'faq.header_1', 'about.story_heading_2']));
    expect(scan.missing).toEqual(['about.story_heading_2']);
    expect(scan.hidden).toContain({ key: 'contact.placeholder', where: 'placeholder' });
    expect(scan.hidden).toContain({ key: 'menu.hidden', where: 'hidden' });
    expect(scan.hidden).toContain({ key: 'contact.options.new', where: 'option' });
    expect(typeof scan.path).toBe('string');
    expect(scan.path).not.toContain('jsw-editor');
    const middle = center(document.querySelectorAll('#heading span')[1]);
    expect(overlay.hit(middle.clientX, middle.clientY)).not.toBeNull();
  });

  /**
   * @description A click on a text selects it instead of following the link; the selection gets
   *   a solid outline and the key label; the page is not left.
   * @input click on the "Kontakt" link
   * @output onSelect('navigation.contact'); default prevented; a `.b.s` box for every text of the
   *   key (the link, the pill, the toggle) and a label with the key
   */
  it('selects a text on a click instead of following it', () => {
    const event = clickOn(document.getElementById('contact')!);
    expect(host.onSelect).toHaveBeenCalledWith('navigation.contact');
    expect(event.defaultPrevented).toBeTrue();
    expect(layer().querySelectorAll('.b.s').length).toBe(3);
    expect(Array.from(layer().querySelectorAll('.l')).map(l => l.textContent)).toContain('navigation.contact');
  });

  /**
   * @description A text in a button that is not a link (an accordion of an answer) is selected and
   *   the button still works - the hidden answer can be opened and edited.
   * @input click on the text of a type="button" button with its own click handler
   * @output onSelect; not prevented; the handler of the button ran
   */
  it('selects the text of a button and lets the button work', () => {
    const toggle = document.getElementById('toggle')!;
    let opened = false;
    toggle.addEventListener('click', () => (opened = true), { once: true });
    const event = clickOn(toggle);
    expect(host.onSelect).toHaveBeenCalledWith('navigation.contact');
    expect(event.defaultPrevented).toBeFalse();
    expect(opened).toBeTrue();
  });

  /**
   * @description A click on the padding of a link (beside its text) still selects its text and
   *   does not follow the link.
   * @input click 5 px inside the corner of a padded link
   * @output onSelect('navigation.contact'); default prevented
   */
  it('selects the text of a link clicked beside the text', () => {
    const pill = document.getElementById('pill')!;
    const r = pill.getBoundingClientRect();
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1, clientX: r.left + 5, clientY: r.top + 5 });
    pill.dispatchEvent(event);
    expect(host.onSelect).toHaveBeenCalledWith('navigation.contact');
    expect(event.defaultPrevented).toBeTrue();
  });

  /**
   * @description A key label of a text at the right edge of the screen is shifted left so the
   *   whole key stays on the screen.
   * @input a text with key navigation.contact fixed at the right edge; hover over it
   * @output the label ends inside the width of the page
   */
  it('keeps the key label of a text at the right edge on the screen', async () => {
    const edge = document.createElement('span');
    edge.style.cssText = 'position:fixed;right:0;top:300px;z-index:2;font:16px sans-serif;background:#fff;';
    edge.innerHTML = markText('FAQ', 0, 'text');
    document.body.appendChild(edge);
    await new Promise(resolve => setTimeout(resolve, 200));
    window.dispatchEvent(new MouseEvent('mousemove', center(edge)));
    const label = layer().querySelector('.l') as HTMLElement;
    expect(label.textContent).toBe('navigation.contact');
    expect(label.getBoundingClientRect().right).toBeLessThanOrEqual(document.documentElement.clientWidth);
    edge.remove();
  });

  /**
   * @description The browser title arrives after the page (page titles): its change is reported.
   * @input document.title changed after the start
   * @output a new onScan with the title
   */
  it('reports a browser title set later', async () => {
    const before = document.title;
    document.title = 'FAQ | Web';
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(host.onScan.calls.mostRecent().args[0].title).toBe('FAQ | Web');
    document.title = before;
  });

  /**
   * @description A paragraph clicked in its padding selects its only text; an element with
   *   several texts clicked beside them selects nothing.
   * @input click 4 px inside a padded paragraph; click into the empty corner of the whole box
   * @output onSelect('faq.header_1'); then no further select
   */
  it('selects the only text of an element clicked beside it', () => {
    const p = document.createElement('p');
    p.style.cssText = 'padding:20px 60px;margin:0;';
    p.textContent = markText('Odpověď', 1, 'text');
    box.appendChild(p);
    overlay.scan();
    const r = p.getBoundingClientRect();
    p.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1, clientX: r.left + 4, clientY: r.top + 4 }));
    expect(host.onSelect).toHaveBeenCalledWith('faq.header_1');
    host.onSelect.calls.reset();
    const b = box.getBoundingClientRect();
    box.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1, clientX: b.right - 2, clientY: b.top + 2 }));
    expect(host.onSelect).not.toHaveBeenCalled();
  });

  /**
   * @description Content is let through (an answer opens) and reported; links to another site
   *   are blocked, links inside the website are not; forms are never sent.
   * @input click on the question, on the external and the internal link; submit of the form
   * @output onContent('faq') and not prevented; external prevented; internal not; submit prevented
   */
  it('lets content through, blocks leaving the editor and sending forms', () => {
    const question = clickOn(document.getElementById('question')!);
    expect(host.onContent).toHaveBeenCalledWith('faq');
    expect(question.defaultPrevented).toBeFalse();

    expect(clickOn(document.getElementById('external')!).defaultPrevented).toBeTrue();
    const internal = document.getElementById('internal')!;
    const internalClick = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1, ...center(internal) });
    internal.addEventListener('click', e => e.preventDefault(), { once: true });
    spyOn(internalClick, 'stopImmediatePropagation').and.callThrough();
    internal.dispatchEvent(internalClick);
    expect(internalClick.stopImmediatePropagation).not.toHaveBeenCalled();

    const submit = new Event('submit', { bubbles: true, cancelable: true });
    document.getElementById('form')!.dispatchEvent(submit);
    expect(submit.defaultPrevented).toBeTrue();
  });

  /**
   * @description The admin selects a key and the pointer hovers content: the selection and the
   *   content label are drawn; stop removes the layer.
   * @input select('faq.header_1'); mousemove over the question; stop()
   * @output a `.b.s` box; a `.l.c` label with the content label; no layer after stop
   */
  it('draws the selection from the admin and the hover label, and cleans up', () => {
    overlay.select('faq.header_1', true);
    expect(layer().querySelectorAll('.b.s').length).toBe(1);
    window.dispatchEvent(new MouseEvent('mousemove', center(document.getElementById('question')!)));
    expect(layer().querySelector('.l.c')!.textContent).toBe('FAQ – upravit v části FAQ');
    expect(document.documentElement.classList).toContain('jsw-text-editor-hover');
    overlay.stop();
    expect(document.querySelector('jsw-text-editor-layer')).toBeNull();
    expect(document.documentElement.classList).not.toContain('jsw-text-editor-hover');
  });

  /**
   * @description A text missing in the language (its Czech reference in place) and missing
   *   content ('Cannot load text') are drawn orange with the "missing" label; a click selects the
   *   missing text / reports the content section.
   * @input mousemove over the missing heading / the missing content; clicks on both
   * @output `.b.m` boxes; labels "Chybí · about.story_heading_2" and "Chybí · FAQ – …";
   *   onSelect('about.story_heading_2'), onContent('jobs')
   */
  it('draws missing texts and content orange with the missing label', () => {
    window.dispatchEvent(new MouseEvent('mousemove', center(document.getElementById('missing')!)));
    expect(layer().querySelectorAll('.b.m').length).toBeGreaterThan(0);
    expect(layer().querySelector('.l.m')!.textContent).toBe('Chybí · about.story_heading_2');
    window.dispatchEvent(new MouseEvent('mousemove', center(document.getElementById('missing-content')!)));
    expect(layer().querySelector('.l.c.m')!.textContent).toBe('Chybí · FAQ – upravit v části FAQ');
    clickOn(document.getElementById('missing')!);
    expect(host.onSelect).toHaveBeenCalledWith('about.story_heading_2');
    clickOn(document.getElementById('missing-content')!);
    expect(host.onContent).toHaveBeenCalledWith('jobs');
  });
});
