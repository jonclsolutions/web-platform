/**
 * @file public-text-editor.service.spec.ts
 * @path src/app/public/text-editor/public-text-editor.service.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the editor mode of the public website: detection of the frame of
 *   the editor, marking of the translations (identifiers skipped, drafts of the language
 *   applied) and of the content, messages of the admin (only from the parent of the own origin),
 *   saving of the drafts, and that nothing changes outside the editor.
 * @dependencies PublicTextEditorService, text-editor-markers, text-editor-protocol
 */

import { TestBed } from '@angular/core/testing';
import { PublicTextEditorService, isTextEditorFrame, setAtPath } from './public-text-editor.service';
import { hasMarks, scanMarks, stripMarks } from './text-editor-markers';
import { TEXT_EDITOR_BANNERS_PATH, TEXT_EDITOR_CHANNEL, TEXT_EDITOR_FRAME_NAME, isBannersQuery } from './text-editor-protocol';

describe('PublicTextEditorService', () => {
  let service: PublicTextEditorService;

  /** The service as in the frame of the editor (its constructor saw no frame - no overlay). */
  function activate(): void {
    Object.defineProperty(service, 'active', { value: true });
  }

  /** A message as sent by the admin (parent window, own origin). */
  function fromAdmin(data: unknown, origin = window.location.origin, source: unknown = window.parent): void {
    (service as any).receive({ data, origin, source } as MessageEvent);
  }

  /** Key of the entry of a marked text. */
  function keyOf(marked: string): string | undefined {
    const entry = service.entry(scanMarks(marked)[0].index!);
    return entry?.kind === 'text' ? entry.key : undefined;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PublicTextEditorService);
  });

  /**
   * @description Only a window named as the frame of the editor inside an admin page of the same
   *   origin is the editor; another name, no parent, another origin (unreadable) or a parent
   *   outside the admin are not.
   * @input fake windows
   * @output true only for the frame of the editor in the admin
   */
  it('recognises the frame of the editor only inside the admin of the own origin', () => {
    const parent = { location: { origin: 'https://site.cz', pathname: '/admin/web/edit-website/editor' } };
    const frame = (name: string, p: any) => ({ name, parent: p, location: { origin: 'https://site.cz' } }) as unknown as Window;
    expect(isTextEditorFrame(frame(TEXT_EDITOR_FRAME_NAME, parent))).toBeTrue();
    expect(isTextEditorFrame(frame('other', parent))).toBeFalse();
    expect(isTextEditorFrame(frame(TEXT_EDITOR_FRAME_NAME, { location: { origin: 'https://site.cz', pathname: '/cs/faq' } }))).toBeFalse();
    const crossOrigin = { get location(): never { throw new DOMException('blocked'); } };
    expect(isTextEditorFrame(frame(TEXT_EDITOR_FRAME_NAME, crossOrigin))).toBeFalse();
    const top = { name: TEXT_EDITOR_FRAME_NAME, location: { origin: 'https://site.cz' } } as any;
    top.parent = top;
    expect(isTextEditorFrame(top)).toBeFalse();
    expect(service.active).toBeFalse();
  });

  /**
   * @description The page "Lišta cookies a nabídka jazyka": only `?jsw-editor=banners` asks for it
   *   (its path is the home page with that query), and never outside the editor.
   * @input isBannersQuery of several queries; the service in the test window
   * @output true only for jsw-editor=banners; path '/?jsw-editor=banners'; banners false
   */
  it('recognises the banners page of the editor', () => {
    expect(isBannersQuery('?jsw-editor=banners')).toBeTrue();
    expect(isBannersQuery('?a=1&jsw-editor=banners')).toBeTrue();
    for (const search of ['', '?jsw-editor=other', '?banners=1']) {
      expect(isBannersQuery(search)).toBeFalse();
    }
    expect(TEXT_EDITOR_BANNERS_PATH).toBe('/?jsw-editor=banners');
    expect(service.banners).toBeFalse();
  });

  /**
   * @description Outside the editor the translations and the content are returned as they are.
   * @input decorate(data, 'cz'), markContent(list, 'faq') while inactive
   * @output the same objects
   */
  it('changes nothing outside the editor', () => {
    const data = { faq: { title: 'FAQ' } };
    const list = [{ id: 1, name: { cz: 'Obecné' } }];
    expect(service.decorate(data, 'cz')).toBe(data);
    expect(service.markContent(list, 'faq')).toBe(list);
  });

  /**
   * @description In the editor every text leaf is marked with its dot path (also inside arrays),
   *   identifiers (`id`, `key`), empty texts and non-strings are kept; the source stays unchanged
   *   and every call returns a new object.
   * @input decorate({faq: {title}, services: {packages: [{id, name}]}, flag: true, empty: ''}, 'cz') twice
   * @output title → faq.title; packages.0.name marked; id plain; flag, empty unchanged; new objects
   */
  it('marks every text of the translations with its key', () => {
    activate();
    const data = { faq: { title: 'Časté dotazy' }, services: { packages: [{ id: 'web-app', name: 'Aplikace' }] }, flag: true, empty: '' };
    const shown = service.decorate(data, 'cz');
    expect(keyOf(shown.faq.title)).toBe('faq.title');
    expect(stripMarks(shown.faq.title)).toBe('Časté dotazy');
    expect(keyOf(shown.services.packages[0].name)).toBe('services.packages.0.name');
    expect(shown.services.packages[0].id).toBe('web-app');
    expect(shown.flag).toBeTrue();
    expect(shown.empty).toBe('');
    expect(data.faq.title).toBe('Časté dotazy');
    expect(service.decorate(data, 'cz')).not.toBe(shown);
  });

  /**
   * @description Drafts of the admin are shown in their language only (also a key the language
   *   does not have yet) and announced; a message of another origin or another window is ignored.
   * @input drafts {faq.title, faq.new} for 'en'; decorate cz / en; foreign messages
   * @output en shows the drafts, cz not; changes$ once; foreign drafts ignored
   */
  it('shows the drafts of the admin in their language only', () => {
    activate();
    let changes = 0;
    service.changes$.subscribe(() => changes++);
    fromAdmin({ channel: TEXT_EDITOR_CHANNEL, type: 'drafts', lang: 'en', values: { 'faq.title': 'FAQs', 'faq.new': 'New' } });
    expect(changes).toBe(1);
    const en = service.decorate({ faq: { title: 'FAQ' } }, 'en');
    expect(stripMarks(en.faq.title)).toBe('FAQs');
    expect(stripMarks(en.faq.new)).toBe('New');
    expect(stripMarks(service.decorate({ faq: { title: 'FAQ' } }, 'cz').faq.title)).toBe('FAQ');

    fromAdmin({ channel: TEXT_EDITOR_CHANNEL, type: 'drafts', lang: 'en', values: {} }, 'https://evil.example');
    fromAdmin({ channel: TEXT_EDITOR_CHANNEL, type: 'drafts', lang: 'en', values: {} }, window.location.origin, {});
    fromAdmin({ type: 'drafts', lang: 'en', values: {} });
    expect(changes).toBe(1);
  });

  /**
   * @description Saving: `commit` hands the drafts with their language over (the texts service
   *   writes them into the loaded texts) and clears them.
   * @input drafts {faq.title} cz; commit
   * @output commits$ {lang cz, values}; then changes$; decorate shows the source again
   */
  it('hands the saved drafts over and clears them', () => {
    activate();
    const events: string[] = [];
    service.commits$.subscribe(commit => events.push(`commit:${commit.lang}:${commit.values['faq.title']}`));
    service.changes$.subscribe(() => events.push('changes'));
    fromAdmin({ channel: TEXT_EDITOR_CHANNEL, type: 'drafts', lang: 'cz', values: { 'faq.title': 'Nové' } });
    fromAdmin({ channel: TEXT_EDITOR_CHANNEL, type: 'commit' });
    expect(events).toEqual(['changes', 'commit:cz:Nové', 'changes']);
    expect(stripMarks(service.decorate({ faq: { title: 'Staré' } }, 'cz').faq.title)).toBe('Staré');
  });

  /**
   * @description Content: only the texts per language are marked (with the section), numbers,
   *   images and slugs stay.
   * @input [{id, slug, image, name: {cz, en}, items: [{question: {cz}}]}] for 'faq'
   * @output name.cz / name.en / question.cz marked as content of faq; id, slug, image unchanged
   */
  it('marks the texts of the content with their section', () => {
    activate();
    const [item] = service.markContent([{ id: 3, slug: 'pozice', image: 'a.webp', name: { cz: 'Obecné', en: 'General' }, items: [{ question: { cz: 'Proč?' } }] }], 'faq');
    for (const text of [item.name.cz, item.name.en, item.items[0].question.cz]) {
      expect(hasMarks(text)).toBeTrue();
      expect(service.entry(scanMarks(text)[0].index!)).toEqual({ kind: 'content', section: 'faq' });
    }
    expect(item.id).toBe(3);
    expect(item.slug).toBe('pozice');
    expect(item.image).toBe('a.webp');
  });

  /**
   * @description Texts missing in the language: the Czech reference from the admin is shown in
   *   their place (the key in brackets when Czech lacks it too) and marked as missing; a draft or
   *   an existing text wins; another language is not touched.
   * @input init {lang en, missing {about.heading_2: 'Náš příběh', about.x: '', faq.title: 'FAQ'}};
   *   decorate({faq: {title: 'FAQs'}, about: {}}, 'en'); decorate for cz
   * @output about.heading_2 'Náš příběh' (missing entry), about.x '[about.x]', faq.title 'FAQs'
   *   (ordinary entry); cz without them
   */
  it('shows the Czech reference in place of a missing text', () => {
    activate();
    fromAdmin({
      channel: TEXT_EDITOR_CHANNEL, type: 'init', lang: 'en', drafts: {}, selected: null, contentLabels: {}, missingLabel: 'Chybí',
      missing: { 'about.heading_2': 'Náš příběh', 'about.x': '', 'faq.title': 'FAQ' },
    });
    const en = service.decorate({ faq: { title: 'FAQs' }, about: {} }, 'en') as any;
    expect(stripMarks(en.about.heading_2)).toBe('Náš příběh');
    expect(service.entry(scanMarks(en.about.heading_2)[0].index!)).toEqual({ kind: 'text', key: 'about.heading_2', missing: true });
    expect(stripMarks(en.about.x)).toBe('[about.x]');
    expect(service.entry(scanMarks(en.faq.title)[0].index!)).toEqual({ kind: 'text', key: 'faq.title' });
    expect((service.decorate({ about: {} }, 'cz') as any).about.heading_2).toBeUndefined();

    fromAdmin({ channel: TEXT_EDITOR_CHANNEL, type: 'drafts', lang: 'en', values: { 'about.heading_2': 'Our story' } });
    const drafted = service.decorate({ about: {} }, 'en') as any;
    expect(stripMarks(drafted.about.heading_2)).toBe('Our story');
    expect(keyOf(drafted.about.heading_2)).toBe('about.heading_2');
    expect(service.entry(scanMarks(drafted.about.heading_2)[0].index!)).toEqual({ kind: 'text', key: 'about.heading_2' });
  });

  /**
   * @description Content read in a language it lacks gives the placeholder marked as missing
   *   content of its section; existing languages stay ordinary content.
   * @input markContent([{name: {cz: 'Obecné'}}], 'faq', 'Cannot load text'); read name.en, name.cz
   * @output name.en 'Cannot load text' with {content, faq, missing}; name.cz {content, faq}
   */
  it('marks the placeholder of content missing in a language', () => {
    activate();
    const [item] = service.markContent([{ name: { cz: 'Obecné', en: '' } as Record<string, string> }], 'faq', 'Cannot load text');
    expect(stripMarks(item.name['de'])).toBe('Cannot load text');
    expect(service.entry(scanMarks(item.name['de'])[0].index!)).toEqual({ kind: 'content', section: 'faq', missing: true });
    expect(service.entry(scanMarks(item.name['en'])[0].index!)).toEqual({ kind: 'content', section: 'faq', missing: true });
    expect(service.entry(scanMarks(item.name['cz'])[0].index!)).toEqual({ kind: 'content', section: 'faq' });
    expect(Object.keys(item.name)).toEqual(['cz', 'en']);
  });

  /**
   * @description setAtPath creates the missing objects and writes into arrays by index.
   * @input {} 'a.b.c'; {list: [{x}]} 'list.0.x'
   * @output {a: {b: {c}}}; list[0].x replaced
   */
  it('writes a value at a dot path', () => {
    const target: any = { list: [{ x: 'old' }] };
    setAtPath(target, 'a.b.c', 'v');
    setAtPath(target, 'list.0.x', 'new');
    expect(target).toEqual({ list: [{ x: 'new' }], a: { b: { c: 'v' } } });
  });
});
