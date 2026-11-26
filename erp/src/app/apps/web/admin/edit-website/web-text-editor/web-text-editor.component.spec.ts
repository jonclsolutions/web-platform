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

import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, flush } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { WEB_EDITOR_PAGES, WebTextEditorComponent } from './web-text-editor.component';
import { VisualTextEditorViewComponent } from '../../../../../admin/components/translation-editor/visual-text-editor/visual-text-editor-view.component';
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
    (ctx.dataHandler as any).get.and.callFake((url: string) => {
      if (url === 'languages/web') return of(structuredClone(languages));
      if (url === 'translations/web/cz') return of(structuredClone(cz));
      if (url === 'translations/web/en') return of(structuredClone(en));
      return throwError(() => new Error('404'));
    });
    (ctx.dataHandler as any).post.and.returnValue(of({}));
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
  });

  /**
   * @description The editor shows the own website in a sandboxed frame named for the editor mode,
   *   the pages of the website and the active languages only.
   * @input render
   * @output frame name, sandbox without forms / pop-ups, src '/cs'; 13 pages; languages CZ, EN
   */
  it('shows the website in the frame of the editor', fakeAsync(() => {
    setup();
    const el = fixture.nativeElement as HTMLElement;
    expect(frame().getAttribute('name')).toBe(TEXT_EDITOR_FRAME_NAME);
    expect(frame().getAttribute('sandbox')).toBe('allow-scripts allow-same-origin');
    expect(new URL(frame().src).pathname).toBe('/cs');
    expect(el.querySelectorAll('.te-page-select option').length).toBe(WEB_EDITOR_PAGES.length);
    expect(Array.from(el.querySelectorAll('.te-lang')).map(b => b.textContent!.trim())).toEqual(['CZ', 'EN']);
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
   * @description Editing a text: the translation changes, the page gets the drafts at once, the
   *   panel keeps the saved version; saving hands the drafts over (commit).
   * @input select faq.title; type 'Dotazy'; save
   * @output drafts {faq.title: 'Dotazy'}; saved version 'Časté dotazy'; save label with 1;
   *   POST save_translations/web; commit sent; not dirty
   */
  it('previews the edits live and saves them', fakeAsync(() => {
    setup();
    const el = fixture.nativeElement as HTMLElement;
    fromPage({ type: 'select', key: 'faq.title' });
    flush();
    const field = el.querySelector('.te-value') as HTMLTextAreaElement;
    field.value = 'Dotazy';
    field.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(lastSent()).toEqual({ channel: TEXT_EDITOR_CHANNEL, type: 'drafts', lang: 'cz', values: { 'faq.title': 'Dotazy' } });
    expect(view.savedValue('faq.title')).toBe('Časté dotazy');
    expect(component.changedPaths.size).toBe(1);

    (el.querySelector('.te-btn--primary') as HTMLButtonElement).click();
    flush();
    expect((ctx.dataHandler as any).post).toHaveBeenCalledWith('save_translations/web', jasmine.objectContaining({ lang: 'cz' }));
    expect(lastSent()).toEqual({ channel: TEXT_EDITOR_CHANNEL, type: 'commit' });
    expect(component.isDirty).toBeFalse();
    discardPeriodicTasks();
  }));

  /**
   * @description Another language with unsaved edits asks first; keeping them changes nothing;
   *   confirming loads the language and the same page in it. Closing without edits goes back.
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
    expect(new URL(frame().src).pathname).toBe('/en/faq');
    expect(component.isDirty).toBeFalse();

    const router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.returnValue(Promise.resolve(true));
    view.close();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/admin/web/edit-website');
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
