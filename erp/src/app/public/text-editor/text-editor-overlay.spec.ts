/**
 * @file text-editor-overlay.spec.ts
 * @path src/app/public/text-editor/text-editor-overlay.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the overlay of the visual text editor on a real DOM: finding marked
 *   texts (also split into word spans), the report of the page (visible / attribute / hidden
 *   texts), selecting by a click instead of following a link, content clicks, blocking of
 *   leaving the editor, drawing of the selection and the hover label, cleanup; measuring once
 *   per change, an unchanged layer kept, no work while the page is hidden.
 * @dependencies TextEditorOverlay, text-editor-markers
 */

import { discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';
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
    host = jasmine.createSpyObj<TextEditorOverlayHost>('host', ['entry', 'contentLabel', 'missingLabel', 'onSelect', 'onContent', 'onScan', 'onKey']);
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
   * @description The scan finds the texts (one split into word spans, the placeholder of an empty
   *   field) and reports the page: the path, the visible keys and the text hidden by CSS.
   * @input the fixture
   * @output count 10 (an option of a select is listed as `option`); onScan visible
   *   [navigation.contact, faq.header_1, about.story_heading_2, contact.placeholder], hidden
   *   (menu.hidden), no placeholder among the hidden; the middle word of the split heading hits it
   */
  it('finds the marked texts and reports the page', () => {
    expect(overlay.count).toBe(10);
    const scan = host.onScan.calls.mostRecent().args[0];
    expect(scan.visible).toEqual(jasmine.arrayWithExactContents(['navigation.contact', 'faq.header_1', 'about.story_heading_2', 'contact.placeholder']));
    expect(scan.missing).toEqual(['about.story_heading_2']);
    expect(scan.hidden).not.toContain({ key: 'contact.placeholder', where: 'placeholder' });
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
   * @description A fixed layer over a text (an open mobile menu) hides its outline and its hit -
   *   the texts of the layer itself stay outlined; closing the layer brings the outline back.
   * @input a fixed panel over the heading with its own text (key navigation.contact); redraw;
   *   then the panel removed
   * @output the heading not hit, no box over its middle; the panel text hit; after removal the
   *   heading hit again
   */
  it('does not outline texts under a fixed layer of the page', async () => {
    const heading = document.querySelectorAll('#heading span')[1];
    const middle = center(heading);
    expect(overlay.hit(middle.clientX, middle.clientY)).not.toBeNull();
    const menu = document.createElement('nav');
    menu.style.cssText = 'position:fixed;left:0;top:0;width:700px;height:400px;z-index:5;background:#111;';
    menu.innerHTML = `<a id="menu-link" href="/cs/contact" style="display:inline-block;margin:300px 0 0 20px;font:16px sans-serif;color:#fff">${markText('Kontakt', 0, 'text')}</a>`;
    document.body.appendChild(menu);
    await new Promise(resolve => setTimeout(resolve, 250));
    expect(overlay.hit(middle.clientX, middle.clientY)).toBeNull();
    const link = center(document.getElementById('menu-link')!);
    expect(overlay.hit(link.clientX, link.clientY)).not.toBeNull();
    menu.remove();
    await new Promise(resolve => setTimeout(resolve, 250));
    expect(overlay.hit(middle.clientX, middle.clientY)).not.toBeNull();
  });

  /**
   * @description The placeholder of an empty form field is outlined around the field and a click
   *   on the field selects it; once the field is filled the placeholder is not seen - it is listed
   *   among the other texts as `placeholder` again.
   * @input click on the empty search field; type into it; rescan
   * @output onSelect('contact.placeholder'), a box around the field; after typing no hit, hidden
   *   {contact.placeholder, placeholder}
   */
  it('selects the placeholder of an empty form field', async () => {
    const field = document.getElementById('search') as HTMLInputElement;
    clickOn(field);
    expect(host.onSelect).toHaveBeenCalledWith('contact.placeholder');
    const middle = center(field);
    expect(overlay.hit(middle.clientX, middle.clientY)!.entry).toEqual({ kind: 'text', key: 'contact.placeholder' });
    field.value = 'něco';
    (overlay as any).scan();
    expect(overlay.hit(middle.clientX, middle.clientY)).toBeNull();
    expect(host.onScan.calls.mostRecent().args[0].hidden).toContain({ key: 'contact.placeholder', where: 'placeholder' });
    field.value = '';
  });

  /**
   * @description Fields of a form are not used in the editor: no focus by the pointer, no typing,
   *   pasting, checking, file picker or dropped files - so no validation message and nothing to
   *   send; a click on a field with a placeholder still selects it. Controls outside forms (an
   *   accordion checkbox) work as on the website.
   * @input a form with an e-mail field (placeholder), a checkbox and a file field; an accordion
   *   checkbox outside it; mousedown / beforeinput / paste / focus / click / drop
   * @output every default prevented, the field blurred, the checkbox unchanged, onSelect of the
   *   placeholder; the accordion checkbox toggles
   */
  it('keeps the fields of the forms unused', () => {
    const form = document.createElement('form');
    form.innerHTML = `<input id="mail" type="email" placeholder="${markText('vas@email.cz', 2, 'text')}" style="width:200px;height:30px">
      <input id="agree" type="checkbox"><input id="file" type="file"><div id="zone" style="width:100px;height:40px">zóna</div>`;
    box.appendChild(form);
    const accordion = document.createElement('input');
    accordion.type = 'checkbox';
    box.appendChild(accordion);
    const fire = (target: Element, event: Event) => { target.dispatchEvent(event); return event.defaultPrevented; };
    const mail = document.getElementById('mail') as HTMLInputElement;
    expect(fire(mail, new MouseEvent('mousedown', { bubbles: true, cancelable: true }))).toBeTrue();
    expect(fire(mail, new InputEvent('beforeinput', { bubbles: true, cancelable: true, data: 'x', inputType: 'insertText' }))).toBeTrue();
    expect(fire(mail, new Event('paste', { bubbles: true, cancelable: true }))).toBeTrue();
    expect(fire(mail, new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true }))).toBeTrue();
    mail.focus();
    expect(document.activeElement).not.toBe(mail);
    (overlay as any).scan();
    clickOn(mail);
    expect(host.onSelect).toHaveBeenCalledWith('contact.placeholder');

    const agree = document.getElementById('agree') as HTMLInputElement;
    agree.click();
    expect(agree.checked).toBeFalse();
    expect(fire(document.getElementById('file')!, new MouseEvent('click', { bubbles: true, cancelable: true }))).toBeTrue();
    expect(fire(document.getElementById('zone')!, new Event('drop', { bubbles: true, cancelable: true }))).toBeTrue();

    accordion.click();
    expect(accordion.checked).toBeTrue();
    form.remove();
    accordion.remove();
  });

  /**
   * @description Shortcuts pressed in the page go to the admin: Ctrl/Cmd+S (the browser's save
   *   stopped) and Esc; other keys not.
   * @input keydown Ctrl+S, Meta+S, Escape, 's'
   * @output onKey save ×2 (default prevented), escape ×1; nothing for 's'
   */
  it('passes the shortcuts of the editor to the admin', () => {
    const press = (init: KeyboardEventInit) => { const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }); document.body.dispatchEvent(event); return event; };
    expect(press({ key: 's', ctrlKey: true }).defaultPrevented).toBeTrue();
    expect(press({ key: 'S', metaKey: true }).defaultPrevented).toBeTrue();
    press({ key: 'Escape' });
    press({ key: 's' });
    expect(host.onKey.calls.allArgs()).toEqual([['save'], ['save'], ['escape']]);
  });

  /**
   * @description The label of the hovered text goes under its text when it would cover the label
   *   of the selected text (two texts next to each other).
   * @input select the first word of the heading, hover the second
   * @output two labels that do not overlap; the hovered one under its text
   */
  it('keeps the label of the hovered text off the label of the selected one', () => {
    const words = document.querySelectorAll('#heading span');
    words[0].innerHTML = markText('Často', 1, 'text');
    words[1].innerHTML = markText('kladené', 3, 'text');
    (overlay as any).scan();
    overlay.select('faq.header_1', false);
    window.dispatchEvent(new MouseEvent('mousemove', center(words[1])));
    const labels = Array.from(layer().querySelectorAll<HTMLElement>('.l')).map(l => l.getBoundingClientRect());
    expect(labels.length).toBe(2);
    const [a, b] = labels;
    expect(a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom).toBeFalse();
    expect(labels[1].top).toBeGreaterThan(words[1].getBoundingClientRect().top);
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

  /**
   * @description Cost of the overlay: the pointer moving within one text measures nothing again
   *   and leaves the drawn layer as it is; the interval rebuilds nothing while the page is the
   *   same and does nothing while the page cannot be seen; a scroll measures again.
   * @input mousemove twice over the heading (measure spied); the interval with the same page; the
   *   interval with the page hidden; a scroll
   * @output no measure on the moves; the same box elements after the interval; no measure while
   *   hidden; one after the scroll
   */
  it('measures once per change and keeps an unchanged layer', fakeAsync(() => {
    // started again inside the fake clock (its interval)
    overlay.stop();
    overlay = new TextEditorOverlay(document, host);
    overlay.start();
    const measure = spyOn(overlay as any, 'measure').and.callThrough();
    const heading = document.querySelectorAll('#heading span')[1];
    window.dispatchEvent(new MouseEvent('mousemove', center(heading)));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: center(heading).clientX + 1, clientY: center(heading).clientY }));
    expect(measure).not.toHaveBeenCalled();
    const first = layer().querySelector('.b.h');
    expect(first).not.toBeNull();

    tick(200);
    expect(measure).toHaveBeenCalledTimes(1);
    expect(layer().querySelector('.b.h')).toBe(first);

    const hidden = spyOnProperty(Document.prototype, 'visibilityState', 'get').and.returnValue('hidden');
    tick(400);
    expect(measure).toHaveBeenCalledTimes(1);
    hidden.and.callThrough();

    window.dispatchEvent(new Event('scroll'));
    tick(20);
    expect(measure).toHaveBeenCalledTimes(2);
    overlay.stop();
    discardPeriodicTasks();
  }));
});
