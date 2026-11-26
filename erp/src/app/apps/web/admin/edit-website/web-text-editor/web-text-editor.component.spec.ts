/**
 * @file web-text-editor.component.spec.ts
 * @path src/app/apps/web/admin/edit-website/web-text-editor/web-text-editor.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the visual text editor of the website (WebTextEditorComponent with
 *   VisualTextEditorViewComponent): the frame of the website, the messages with the page (ready,
 *   scan, select, content - foreign ones ignored), editing with live drafts and the saved version,
 *   saving (commit), switching the language and leaving with unsaved edits (confirmation), the
 *   phone notice.
 * @dependencies WebTextEditorComponent, VisualTextEditorViewComponent, text-editor-protocol,
 *   createAdminTestContext
 */

import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, flush, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { WEB_EDITOR_PAGES, WebTextEditorComponent } from './web-text-editor.component';
import { DEVICE_STORAGE_KEY, DRAFTS_DELAY_MS, VisualTextEditorViewComponent } from '../../../../../admin/components/translation-editor/visual-text-editor/visual-text-editor-view.component';
import { TEXT_EDITOR_CHANNEL, TEXT_EDITOR_FRAME_NAME } from '../../../../../public/text-editor/text-editor-protocol';
import { AdminTestContext, createAdminTestContext } from '../../../../../../testing/admin-test-helpers';

describe('WebTextEditorComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<WebTextEditorComponent>;
  let component: WebTextEditorComponent;
  let view: VisualTextEditorViewComponent;
  let sent: any[];

  const languages = [{ code: 'cz', name: 'Čeština', active: true, isBuiltIn: true }, { code: 'en', name: 'English', active: true }, { code: 'de', name: 'Deutsch', active: false }];
  const cz = { faq: { title: 'Časté dotazy', sub: 'Podtitulek' } };
  const en = { faq: { title: 'FAQ', sub: 'Subtitle' } };

  /** What the languages lack (API languages/web/completeness) - {} = complete. */
  let completeness: Record<string, Record<string, number>> = {};

  /** The frame of the website. */
  const frame = () => fixture.nativeElement.querySelector('iframe') as HTMLIFrameElement;
  /** A message of the page in the frame. */
  const fromPage = (data: object, origin = window.location.origin, source: unknown = frame().contentWindow) => {
    window.dispatchEvent(new MessageEvent('message', { data: { channel: TEXT_EDITOR_CHANNEL, ...data }, origin, source: source as MessageEventSource }));
    fixture.detectChanges();
  };
  /** Last message sent to the page. */
  const lastSent = () => sent[sent.length - 1];

  /** Renders the editor (desktop unless `phone`). */
  const setup = (phone = false) => {
    localStorage.removeItem('jsw_languages');
    spyOn(window, 'matchMedia').and.returnValue({ matches: phone, addEventListener: () => {}, removeEventListener: () => {} } as unknown as MediaQueryList);
    ctx = createAdminTestContext();
    // get: the languages; getQuietly: the texts (a missing language answers 404) and what the
    // languages lack (`completeness` of the test)
    completeness = {};
    const route = (url: string) => {
      if (url === 'languages/web') return of(structuredClone(languages));
      if (url === 'languages/web/completeness') return of(structuredClone(completeness));
      if (url === 'translations/web/cz') return of(structuredClone(cz));
      if (url === 'translations/web/en') return of(structuredClone(en));
      return throwError(() => ({ status: 404 }));
    };
    (ctx.dataHandler as any).get.and.callFake(route);
    (ctx.dataHandler as any).getQuietly.and.callFake(route);
    (ctx.dataHandler as any).postQuietly.and.returnValue(of({}));
    TestBed.configureTestingModule({ imports: [WebTextEditorComponent], providers: ctx.providers });
    fixture = TestBed.createComponent(WebTextEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    flush();
    fixture.detectChanges();
    view = fixture.debugElement.query(By.directive(VisualTextEditorViewComponent)).componentInstance;
    sent = [];
    if (!phone) {
      spyOn(frame().contentWindow!, 'postMessage').and.callFake((message: any) => { sent.push(message); });
    }
  };

  afterEach(() => {
    fixture.destroy();
    localStorage.removeItem('jsw_languages');
    localStorage.removeItem(DEVICE_STORAGE_KEY);
  });

  /**
   * @description The editor shows the own website in a sandboxed frame named for the editor mode,
   *   the pages of the website and every language (a switched off one marked).
   * @input render
   * @output frame name, sandbox without forms / pop-ups, '/cs' loaded without `src` (replacing the
   *   entry of the history); 13 pages; languages CZ, EN,
   *   DE (off, dashed); no notice of a switched off language for Czech
   */
  it('shows the website in the frame of the editor', fakeAsync(() => {
    setup();
    const el = fixture.nativeElement as HTMLElement;
    expect(frame().getAttribute('name')).toBe(TEXT_EDITOR_FRAME_NAME);
    expect(frame().getAttribute('sandbox')).toBe('allow-scripts allow-same-origin');
    expect(view.frameUrl).toBe('/cs');
    expect(frame().hasAttribute('src')).toBeFalse();
    expect(el.querySelectorAll('.te-page-select option').length).toBe(WEB_EDITOR_PAGES.length);
    expect(Array.from(el.querySelectorAll('.te-lang')).map(b => b.textContent!.trim().slice(0, 2))).toEqual(['CZ', 'EN', 'DE']);
    expect(el.querySelectorAll('.te-lang--off').length).toBe(1);
    expect(el.querySelector('.te-inactive')).toBeNull();
    expect(el.querySelector('.te-badge')).not.toBeNull();
    discardPeriodicTasks();
  }));

  /**
   * @description Messages of the page: ready gets the init (language, drafts, content labels);
   *   scan sets the page, its title and its hidden texts; select opens the text in the panel;
   *   content shows the note of its part. Messages of another origin / window are ignored.
   * @input ready; scan /faq; select faq.title; content faq; foreign select
   * @output init cz {} with the labels of the 4 content parts; select shows /faq, title, hidden placeholder; key and
   *   value in the panel; the content note; nothing from foreign messages
   */
  it('follows the page in the frame', fakeAsync(() => {
    setup();
    const el = fixture.nativeElement as HTMLElement;
    fromPage({ type: 'ready' });
    expect(lastSent()).toEqual(jasmine.objectContaining({ type: 'init', lang: 'cz', drafts: {}, selected: null }));
    expect(Object.keys(lastSent().contentLabels)).toEqual(['faq', 'jobs', 'references', 'knowledge_base']);

    fromPage({ type: 'scan', path: '/faq', title: 'FAQ | Web', visible: ['faq.title'], hidden: [{ key: 'faq.sub', where: 'placeholder' }] });
    flush();
    fixture.detectChanges();
    expect((el.querySelector('.te-page-select') as HTMLSelectElement).value).toContain('/faq');
    expect(el.querySelector('.te-hidden-key')!.textContent).toBe('faq.sub');

    fromPage({ type: 'select', key: 'faq.title' });
    flush();
    expect(el.querySelector('.te-key')!.textContent).toBe('faq.title');
    expect((el.querySelector('.te-value') as HTMLTextAreaElement).value).toBe('Časté dotazy');

    fromPage({ type: 'content', section: 'faq' });
    expect(el.querySelector('.te-note')).not.toBeNull();
    expect(el.querySelector('.te-key')).toBeNull();

    fromPage({ type: 'select', key: 'faq.sub' }, 'https://evil.example');
    fromPage({ type: 'select', key: 'faq.sub' }, window.location.origin, window);
    expect(view.selectedKey).toBeNull();
    discardPeriodicTasks();
  }));

  /**
   * @description Editing a text: the translation changes, the page gets the drafts after a short
   *   pause of the typing (one message, without the unchanged missing texts), the panel keeps the
   *   saved version; saving hands the drafts over (commit).
   * @input select faq.title; type 'Dotaz', 'Dotazy'; DRAFTS_DELAY_MS; save
   * @output one drafts {faq.title: 'Dotazy'} without missing; saved version 'Časté dotazy'; save label with 1;
   *   POST save_translations/web with the change; commit {cz, faq.title: 'Dotazy'} sent, then the
   *   drafts (none left); not dirty
   */
  it('previews the edits live and saves them', fakeAsync(() => {
    setup();
    const el = fixture.nativeElement as HTMLElement;
    fromPage({ type: 'select', key: 'faq.title' });
    flush();
    const field = el.querySelector('.te-value') as HTMLTextAreaElement;
    field.value = 'Dotaz';
    field.dispatchEvent(new Event('input'));
    field.value = 'Dotazy';
    field.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    sent.length = 0;
    tick(DRAFTS_DELAY_MS);
    // one message after the pause of the typing; the missing texts are the same - not sent again
    expect(sent).toEqual([{ channel: TEXT_EDITOR_CHANNEL, type: 'drafts', lang: 'cz', values: { 'faq.title': 'Dotazy' } }]);
    expect(view.savedValue('faq.title')).toBe('Časté dotazy');
    expect(component.changedPaths.size).toBe(1);

    (el.querySelector('.te-btn--primary') as HTMLButtonElement).click();
    flush();
    expect((ctx.dataHandler as any).postQuietly).toHaveBeenCalledWith('save_translations/web', { lang: 'cz', changes: [{ path: 'faq.title', value: 'Dotazy', base: 'Časté dotazy' }] });
    expect(sent[sent.length - 2]).toEqual({ channel: TEXT_EDITOR_CHANNEL, type: 'commit', lang: 'cz', values: { 'faq.title': 'Dotazy' } });
    expect(lastSent()).toEqual(jasmine.objectContaining({ type: 'drafts', lang: 'cz', values: {} }));
    expect(component.isDirty).toBeFalse();
    discardPeriodicTasks();
  }));

  /**
   * @description A changed text: "Vrátit uloženou verzi" in the panel restores it at once (also
   *   on the page); the panel lists the edits from the last one, a text not on the page shown
   *   marked "jiná stránka"; ↺ of the list restores it; a click selects it; the save button tells
   *   where the list is.
   * @input scan /faq with faq.title; edit faq.title, then faq.sub (not on the page); revert from
   *   the list, then from the panel link
   * @output list [faq.sub (other page), faq.title]; save title tooltip; ↺ faq.sub → drafts
   *   {faq.title}; the link → drafts {}, no list, not dirty
   */
  it('restores a text and lists the edited texts', fakeAsync(() => {
    setup();
    const el = fixture.nativeElement as HTMLElement;
    fromPage({ type: 'scan', path: '/faq', title: '', visible: ['faq.title'], missing: [], hidden: [] });
    fromPage({ type: 'select', key: 'faq.title' });
    flush();
    view.edit('faq.title', 'Dotazy');
    view.edit('faq.sub', 'Jiný');
    fixture.detectChanges();
    const rows = () => Array.from(el.querySelectorAll('.te-changed-row'));
    expect(rows().map(r => r.querySelector('.te-hidden-key')!.textContent!.trim().split(/\s+/)[0])).toEqual(['faq.sub', 'faq.title']);
    expect(rows()[0].querySelector('.te-changed-other')).not.toBeNull();
    expect(rows()[1].querySelector('.te-changed-other')).toBeNull();
    expect(el.querySelector('.te-btn--primary')!.getAttribute('title')).toContain('editor_changed_tooltip');

    (rows()[0].querySelector('.te-changed-revert') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(lastSent()).toEqual(jasmine.objectContaining({ type: 'drafts', values: { 'faq.title': 'Dotazy' } }));
    expect(rows().length).toBe(1);

    (rows()[0].querySelector('.te-changed-item') as HTMLButtonElement).click();
    flush();
    expect(view.selectedKey).toBe('faq.title');
    (el.querySelector('.te-revert') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(lastSent()).toEqual(jasmine.objectContaining({ type: 'drafts', values: {} }));
    expect(component.translations.faq.title).toBe('Časté dotazy');
    expect(rows().length).toBe(0);
    expect(el.querySelector('.te-revert')).toBeNull();
    expect(component.isDirty).toBeFalse();
    discardPeriodicTasks();
  }));

  /**
   * @description Another language with unsaved edits asks first; keeping them changes nothing;
   *   confirming loads the language and the same page in it. Close goes back (the route asks
   *   about unsaved edits - see the next test).
   * @input edit; EN → keep; EN → confirm; close
   * @output pending → nothing; then currentLang en, frame /en/faq; navigateByUrl to the list
   */
  it('asks before losing the edits and keeps the page on a language switch', fakeAsync(() => {
    setup();
    fromPage({ type: 'scan', path: '/faq', title: '', visible: [], hidden: [] });
    view.edit('faq.title', 'Jiné');
    view.switchLang('en');
    fixture.detectChanges();
    expect(view.pendingAction).not.toBeNull();
    view.cancelPending();
    expect(component.currentLang).toBe('cz');

    view.switchLang('en');
    view.confirmPending();
    flush();
    fixture.detectChanges();
    expect(component.currentLang).toBe('en');
    expect(view.frameUrl).toBe('/en/faq');
    expect(component.isDirty).toBeFalse();

    const router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.returnValue(Promise.resolve(true));
    view.close();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/admin/web/edit-website');
    discardPeriodicTasks();
  }));

  /**
   * @description Leaving the editor by any way (unsavedTextsGuard - Back, close, a link to a part):
   *   at once without edits; with edits the confirmation decides - keep = stay, discard = leave.
   * @input confirmLeave() clean; edit → confirmLeave(), keep; again, discard
   * @output true; false after keep (window closed); true after discard
   */
  it('asks before leaving the editor with unsaved edits', fakeAsync(() => {
    setup();
    expect(component.confirmLeave()).toBeTrue();
    view.edit('faq.title', 'Jiné');
    let answer: boolean | undefined;
    (component.confirmLeave() as Promise<boolean>).then(a => (answer = a));
    fixture.detectChanges();
    expect(view.pendingAction).not.toBeNull();
    expect(view.pendingLeave).toBeTrue();
    expect(document.querySelector('.am-overlay[data-level="prompt"] .am-btn--danger')!.textContent).toContain('leave_confirm_button');
    view.cancelPending();
    flush();
    expect(answer).toBeFalse();
    expect(view.pendingAction).toBeNull();

    (component.confirmLeave() as Promise<boolean>).then(a => (answer = a));
    view.confirmPending();
    flush();
    expect(answer).toBeTrue();
    discardPeriodicTasks();
  }));

  /**
   * @description A switched off language: the notice under the bar with its switch-on - disabled
   *   with what is missing while the language is incomplete; the texts it lacks go to the page as
   *   the visitors would see them ('Cannot load text', init and after the texts load) and the
   *   missing texts the page shows are listed in the panel - a click selects them; once complete
   *   the language is switched on without a new load of the page.
   * @input DE (off, no texts, completeness {texts: 2}); ready; scan with missing faq.sub; click the
   *   list; Zapnout jazyk; completeness {} → Zapnout jazyk
   * @output notice with activate_incomplete_note, the button disabled, nothing sent; init missing
   *   {faq.title, faq.sub: 'Cannot load text'} and the label; list of 1 → selected faq.sub; then the
   *   language turned on (POST languages/web), notice gone, the page not loaded again
   */
  it('shows the missing texts and switches a switched off language on', fakeAsync(() => {
    setup();
    completeness = { de: { texts: 2 } };
    component.loadCompleteness();
    const el = fixture.nativeElement as HTMLElement;
    view.switchLang('de');
    flush();
    fixture.detectChanges();
    expect(component.currentLang).toBe('de');
    expect(el.querySelector('.te-inactive')!.textContent).toContain('editor_inactive_message');
    expect(el.querySelector('.te-inactive-missing')!.textContent).toContain('activate_incomplete_note');
    expect((el.querySelector('.te-inactive-btn') as HTMLButtonElement).disabled).toBeTrue();
    const missing = { 'faq.title': 'Cannot load text', 'faq.sub': 'Cannot load text' };
    expect(lastSent()).toEqual(jasmine.objectContaining({ type: 'drafts', lang: 'de', missing }));

    fromPage({ type: 'ready' });
    expect(lastSent()).toEqual(jasmine.objectContaining({ type: 'init', lang: 'de', missing, missingLabel: jasmine.stringContaining('editor_missing_label') }));
    fromPage({ type: 'scan', path: '/faq', title: '', visible: ['faq.sub'], missing: ['faq.sub'], hidden: [] });
    const items = el.querySelectorAll('.te-missing-item');
    expect(items.length).toBe(1);
    (items[0] as HTMLButtonElement).click();
    flush();
    expect(view.selectedKey).toBe('faq.sub');
    expect(lastSent()).toEqual({ channel: TEXT_EDITOR_CHANNEL, type: 'select', key: 'faq.sub', reveal: true });

    const loaded = view.frameUrl;
    view.activateLang();
    expect((ctx.dataHandler as any).postQuietly).not.toHaveBeenCalledWith('languages/web', jasmine.any(FormData));
    completeness = { de: {} };
    component.loadCompleteness();
    fixture.detectChanges();
    (el.querySelector('.te-inactive-btn') as HTMLButtonElement).click();
    flush();
    fixture.detectChanges();
    expect((ctx.dataHandler as any).postQuietly).toHaveBeenCalledWith('languages/web', jasmine.any(FormData));
    expect(component.languages.find(l => l.code === 'de')!.active).toBeTrue();
    expect(el.querySelector('.te-inactive')).toBeNull();
    expect(view.frameUrl).toBe(loaded);
    expect(view.frameLoading).toBeFalse();
    discardPeriodicTasks();
  }));

  /**
   * @description The window "Jazyky" of the editor is the one of the list of the texts: every
   *   language with its actions; deleting the open language opens Czech in the page.
   * @input Jazyky; DE; delete DE (confirmed)
   * @output window with 3 rows; after the delete the language cz and the page /cs
   */
  it('manages the languages in the window "Jazyky"', fakeAsync(() => {
    setup();
    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('.te-langs-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(document.querySelectorAll('.ew-manage-row').length).toBe(3);

    view.switchLang('de');
    flush();
    fixture.detectChanges();
    expect(view.frameUrl).toBe('/de');
    (ctx.dataHandler as any).delete.and.returnValue(of({}));
    component.askDeleteLang(component.languages.find(l => l.code === 'de')!);
    component.confirmDeleteLang();
    flush();
    fixture.detectChanges();
    expect(component.currentLang).toBe('cz');
    expect(view.frameUrl).toBe('/cs');
    discardPeriodicTasks();
  }));

  /**
   * @description The page "Lišta cookies a nabídka jazyka" is the last of the list: it opens the
   *   home page with the query of the banners (in the language) and stays chosen after its scan.
   * @input choose the last page; scan with its path
   * @output frame /cs?jsw-editor=banners; the select keeps it (no "other page")
   */
  it('offers the cookie bar and the language offer as a page', fakeAsync(() => {
    setup();
    const el = fixture.nativeElement as HTMLElement;
    const last = WEB_EDITOR_PAGES[WEB_EDITOR_PAGES.length - 1];
    expect(last.labelKey).toBe('editor_page_banners');
    view.goToPage(last.path);
    expect(view.frameUrl).toBe('/cs?jsw-editor=banners');
    fromPage({ type: 'scan', path: last.path, title: '', visible: ['cookie_consent.title'], missing: [], hidden: [] });
    flush();
    fixture.detectChanges();
    expect(view.knownPage).toBeTrue();
    expect(el.querySelectorAll('.te-page-select option').length).toBe(WEB_EDITOR_PAGES.length);
    discardPeriodicTasks();
  }));

  /**
   * @description The preview switches between the desktop and a phone: the same frame (no reload,
   *   the edits stay) in a phone-wide box; the choice is remembered for the next opening.
   * @input desktop at first; click Mobil; edit; click Počítač; a new editor with 'mobile' stored
   * @output desktop pressed; then the stage --mobile, the frame 390 px wide, the same src, stored
   *   'mobile'; back to the full width with the edits kept; a new editor opens in the phone preview
   */
  it('switches the preview between the desktop and a phone', fakeAsync(() => {
    setup();
    const el = fixture.nativeElement as HTMLElement;
    const buttons = () => el.querySelectorAll<HTMLButtonElement>('.te-device-btn');
    expect(buttons()[0].getAttribute('aria-pressed')).toBe('true');
    const url = view.frameUrl;
    buttons()[1].click();
    fixture.detectChanges();
    expect(el.querySelector('.te-stage')!.classList).toContain('te-stage--mobile');
    expect(frame().clientWidth).toBe(390); // the page inside the bezel
    expect(view.frameUrl).toBe(url);
    expect(localStorage.getItem(DEVICE_STORAGE_KEY)).toBe('mobile');
    view.edit('faq.title', 'Dotazy');
    buttons()[0].click();
    fixture.detectChanges();
    expect(el.querySelector('.te-stage')!.classList).not.toContain('te-stage--mobile');
    expect(component.changedPaths.has('faq.title')).toBeTrue();
    discardPeriodicTasks();

    localStorage.setItem(DEVICE_STORAGE_KEY, 'mobile');
    const again = TestBed.createComponent(WebTextEditorComponent);
    again.detectChanges();
    flush();
    again.detectChanges();
    expect(again.debugElement.query(By.directive(VisualTextEditorViewComponent)).componentInstance.device).toBe('mobile');
    again.destroy();
    discardPeriodicTasks();
  }));

  /**
   * @description Small helps of the panel: the title of the page while it loads ("Loading" is
   *   the placeholder - "Načítá se…") and when it stays (no title of its own); the other texts
   *   grouped by where they are, the first 6 and "zobrazit všechny"; the field grows with a long
   *   text.
   * @input scan with 'Loading' and 9 other texts (5 hidden, 3 for readers, 1 empty field); wait
   *   3 s; scan with a title; a long text selected
   * @output pending → missing → the title; groups hidden 5 + readers 1 at first, all 3 groups
   *   after "zobrazit všechny"; the field taller than its 3 rows
   */
  it('helps with the title, the other texts and long texts', fakeAsync(() => {
    setup();
    const el = fixture.nativeElement as HTMLElement;
    const hidden = [
      ...['a', 'b', 'c', 'd', 'e'].map(k => ({ key: `faq.${k}`, where: 'hidden' })),
      ...['r1', 'r2', 'r3'].map(k => ({ key: `faq.${k}`, where: 'aria-label' })),
      { key: 'faq.sub', where: 'placeholder' },
    ];
    fromPage({ type: 'scan', path: '/faq', title: 'Loading', visible: ['faq.title'], missing: [], hidden });
    expect(el.querySelector('.te-ref--pending')).not.toBeNull();
    tick(3000);
    fixture.detectChanges();
    expect(el.querySelector('.te-ref--missing')!.textContent).toContain('editor_page_title_missing');
    fromPage({ type: 'scan', path: '/faq', title: 'FAQ | Web', visible: ['faq.title'], missing: [], hidden });
    expect(el.querySelector('.te-ref--missing')).toBeNull();

    const groups = () => Array.from(el.querySelectorAll('.te-hidden-group')).map(g => g.textContent!.replace(/\s+/g, ' ').trim());
    expect(groups().length).toBe(2);
    expect(el.querySelectorAll('.te-hidden-group + .te-hidden .te-hidden-item').length).toBe(6);
    const more = Array.from(el.querySelectorAll<HTMLButtonElement>('.te-link')).find(b => b.textContent!.includes('editor_changed_all'))!;
    more.click();
    fixture.detectChanges();
    expect(groups().length).toBe(3);
    expect(groups()[1]).toContain('3');

    fromPage({ type: 'select', key: 'faq.title' });
    view.edit('faq.title', 'Řádek\n'.repeat(12));
    fixture.detectChanges();
    flush();
    const field = el.querySelector('.te-value') as HTMLTextAreaElement;
    expect(field.style.height).not.toBe('');
    expect(parseFloat(field.style.height)).toBeGreaterThan(100);
    discardPeriodicTasks();
  }));

  /**
   * @description Saving in the editor: no window over its bar, a quiet "Uloženo" by the button for
   *   a moment; the list of the texts keeps its window (saveAlert back after leaving).
   * @input edit; Ctrl+S in the admin window; wait 3 s; destroy
   * @output post save_translations; no alert window; .te-saved, gone after 3 s; saveAlert true again
   */
  it('saves with Ctrl+S and confirms quietly', fakeAsync(() => {
    setup();
    const el = fixture.nativeElement as HTMLElement;
    view.edit('faq.title', 'Dotazy');
    const key = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, cancelable: true });
    window.dispatchEvent(key);
    fixture.detectChanges();
    expect(key.defaultPrevented).toBeTrue();
    expect((ctx.dataHandler as any).postQuietly).toHaveBeenCalledWith('save_translations/web', jasmine.objectContaining({ lang: 'cz' }));
    expect(ctx.alert.open).not.toHaveBeenCalled();
    expect(el.querySelector('.te-saved')).not.toBeNull();
    tick(3000);
    fixture.detectChanges();
    expect(el.querySelector('.te-saved')).toBeNull();
    expect(component.saveAlert).toBeFalse();
    fixture.destroy();
    expect(component.saveAlert).toBeTrue();
    discardPeriodicTasks();
  }));

  /**
   * @description Shortcuts from the page (the frame passes them on): Esc cancels the selection
   *   (and tells the page), Ctrl+S without edits does nothing; not while a window is open.
   * @input select faq.title; key escape from the page; key save; pending window + escape
   * @output nothing selected, select null sent; no save; the selection kept while a window is open
   */
  it('takes the shortcuts pressed in the page', fakeAsync(() => {
    setup();
    fromPage({ type: 'select', key: 'faq.title' });
    flush();
    fromPage({ type: 'key', key: 'escape' });
    expect(view.selectedKey).toBeNull();
    expect(lastSent()).toEqual({ channel: TEXT_EDITOR_CHANNEL, type: 'select', key: null, reveal: false });
    fromPage({ type: 'key', key: 'save' });
    expect((ctx.dataHandler as any).postQuietly).not.toHaveBeenCalled();

    fromPage({ type: 'select', key: 'faq.title' });
    flush();
    view.languagesOpen = true;
    fromPage({ type: 'key', key: 'escape' });
    expect(view.selectedKey).toBe('faq.title');
    view.languagesOpen = false;
    discardPeriodicTasks();
  }));

  /**
   * @description Without the edit permission the panel says the text can only be read.
   * @input permissions view only; select faq.title
   * @output .te-readonly note; the field read-only
   */
  it('explains a read-only text', fakeAsync(() => {
    setup();
    ctx.permissions.granted = new Set(['web-edit-website-view']);
    const el = fixture.nativeElement as HTMLElement;
    fromPage({ type: 'select', key: 'faq.title' });
    flush();
    fixture.detectChanges();
    expect(el.querySelector('.te-readonly')!.textContent).toContain('editor_readonly_note');
    expect((el.querySelector('.te-value') as HTMLTextAreaElement).readOnly).toBeTrue();
    discardPeriodicTasks();
  }));

  /**
   * @description A detail reached by a click in the preview is named in the page list (not "Jiná
   *   stránka"); an unknown page keeps "Jiná stránka (path)".
   * @input scan /jobs/ui-designer; scan /neco
   * @output selected option 'pt_page_web_job_detail (ui-designer)'; then 'editor_page_other (/neco)'
   */
  it('names a detail page in the page list', fakeAsync(() => {
    setup();
    const el = fixture.nativeElement as HTMLElement;
    const selected = () => { const select = el.querySelector('.te-page-select') as HTMLSelectElement; return select.options[select.selectedIndex].textContent!.trim(); };
    fromPage({ type: 'scan', path: '/jobs/ui-designer', title: 'Volná pozice', visible: [], missing: [], hidden: [] });
    flush();
    fixture.detectChanges();
    expect(selected()).toContain('pt_page_web_job_detail');
    expect(selected()).toContain('(ui-designer)');
    fromPage({ type: 'scan', path: '/neco', title: 'X', visible: [], missing: [], hidden: [] });
    flush();
    fixture.detectChanges();
    expect(selected()).toContain('editor_page_other');
    expect(selected()).toContain('(/neco)');
    discardPeriodicTasks();
  }));

  /**
   * @description A text of a shared part of the website (menu, footer, cookie bar, language
   *   offer) carries a note that an edit changes every page; a text of one page does not.
   * @input select navigation.home; select faq.title
   * @output .te-shared with editor_shared_note; then none
   */
  it('warns that a shared text changes every page', fakeAsync(() => {
    setup();
    const el = fixture.nativeElement as HTMLElement;
    fromPage({ type: 'select', key: 'navigation.home' });
    flush();
    fixture.detectChanges();
    expect(el.querySelector('.te-shared')!.textContent).toContain('editor_shared_note');
    // the readable path above the exact key (kept for debugging) - only when the module names its groups
    expect(el.querySelector('.te-path')).toBeNull();
    (ctx.i18n.getMergedSection as jasmine.Spy).and.callFake((section: string) => section === 'edit-website' ? { editor_key_labels: { navigation: 'Menu' } } : {});
    fromPage({ type: 'select', key: 'navigation.home' });
    flush();
    fixture.detectChanges();
    expect(el.querySelector('.te-path')!.textContent).toContain('Menu');
    expect(el.querySelector('.te-key')!.textContent).toBe('navigation.home');
    fromPage({ type: 'select', key: 'faq.title' });
    flush();
    fixture.detectChanges();
    expect(el.querySelector('.te-shared')).toBeNull();
    expect(view.isShared('cookie_consent.title')).toBeTrue();
    expect(view.isShared('footer_extra.x')).toBeFalse();
    discardPeriodicTasks();
  }));

  /**
   * @description Another page of the list is shown inside the running website (no new load) once
   *   it said `ready`; before that, for a new language and for the page of the banners the frame
   *   is loaded again.
   * @input goToPage('/faq') before ready; ready; goToPage('/contact'); the banners page;
   *   goToPage('/jobs'); switchLang('en')
   * @output loaded /cs/faq; then select null + navigate '/cs/contact' without a load; the
   *   banners loaded; /cs/jobs loaded (leaving the banners); /en/jobs loaded
   */
  it('changes pages inside the website without a new load', fakeAsync(() => {
    setup();
    view.goToPage('/faq');
    expect(view.frameUrl).toBe('/cs/faq');
    fromPage({ type: 'ready' });
    sent.length = 0;
    view.goToPage('/contact');
    expect(view.frameUrl).toBe('/cs/contact');
    expect(view.frameLoading).toBeFalse();
    expect(sent).toEqual([
      { channel: TEXT_EDITOR_CHANNEL, type: 'select', key: null, reveal: false },
      { channel: TEXT_EDITOR_CHANNEL, type: 'navigate', url: '/cs/contact' },
    ]);
    const banners = WEB_EDITOR_PAGES[WEB_EDITOR_PAGES.length - 1].path;
    view.goToPage(banners);
    expect(view.frameUrl).toBe('/cs?jsw-editor=banners');
    expect(view.frameLoading).toBeTrue();
    fromPage({ type: 'ready' });
    view.goToPage('/jobs');
    expect(view.frameUrl).toBe('/cs/jobs');
    expect(view.frameLoading).toBeTrue();
    fromPage({ type: 'ready' });
    view.switchLang('en');
    flush();
    expect(view.frameUrl).toBe('/en/jobs');
    expect(view.frameLoading).toBeTrue();
    discardPeriodicTasks();
  }));

  /**
   * @description The language switcher of the page switches the editor (with the question about
   *   unsaved edits); a language the editor does not have is ignored. A page showing another
   *   language than the editor (it moved there itself) is loaded in the editor's language once.
   * @input ready; language 'xx'; language 'en'; edit + language 'cz'; scan with lang 'cz' (editor
   *   en) twice
   * @output nothing for 'xx'; en opened and loaded (/en); with the edit the question first; the
   *   mismatching page loaded again once (/en), the second scan leaves it
   */
  it('follows the language switcher of the page and keeps the page in the edited language', fakeAsync(() => {
    setup();
    fromPage({ type: 'ready' });
    fromPage({ type: 'language', code: 'xx' });
    expect(component.currentLang).toBe('cz');
    fromPage({ type: 'language', code: 'en' });
    flush();
    expect(component.currentLang).toBe('en');
    expect(view.frameUrl).toBe('/en');

    fromPage({ type: 'ready' });
    view.edit('faq.title', 'Q');
    fromPage({ type: 'language', code: 'cz' });
    expect(view.pendingAction).not.toBeNull();
    view.cancelPending();
    expect(component.currentLang).toBe('en');

    fromPage({ type: 'scan', path: '/', lang: 'cz', title: '', visible: [], missing: [], hidden: [] });
    expect(view.frameLoading).toBeTrue();
    expect(view.frameUrl).toBe('/en');
    fromPage({ type: 'ready' });
    fromPage({ type: 'scan', path: '/', lang: 'cz', title: 'x', visible: [], missing: [], hidden: [] });
    expect(view.frameLoading).toBeFalse();
    discardPeriodicTasks();
  }));

  /**
   * @description The home page under its other address (/home - the logo and the menu link there)
   *   is the "Hlavní stránka" of the list, not "another page".
   * @input scan with path '/home'
   * @output framePath '/', a known page (no "Jiná stránka" option)
   */
  it('names the home page under its other address', fakeAsync(() => {
    setup();
    fromPage({ type: 'scan', path: '/home', title: '', visible: [], missing: [], hidden: [] });
    expect(view.framePath).toBe('/');
    expect(view.knownPage).toBeTrue();
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.te-page-select option').length).toBe(WEB_EDITOR_PAGES.length);
    discardPeriodicTasks();
  }));

  /**
   * @description On a phone there is no editor - a notice with the way back.
   * @input phone
   * @output no frame; the notice
   */
  it('shows a notice instead of the editor on a phone', fakeAsync(() => {
    setup(true);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('iframe')).toBeNull();
    expect(el.querySelector('.te-phone-title')!.textContent).toContain('editor_phone_title');
    discardPeriodicTasks();
  }));
});
