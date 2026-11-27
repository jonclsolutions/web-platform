/**
 * @file base-translation-editor.component.spec.ts
 * @path src/app/shared/components/base-translation-editor/base-translation-editor.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of BaseTranslationEditorComponent through a minimal concrete editor
 *   (module 'test'). Complements the EditWebsite / EditEshop specs with the parts they do not
 *   reach: unsaved edits never leak into the shared cache (bugfix 2026-10-23), missing Czech
 *   reference, icon selection (size limit, preview), add-language with icon and failure,
 *   delete failure, toggle success, JSON upload (valid / invalid / failing / current language
 *   reload), JSON download and the textarea auto-height; a language that failed to load is not
 *   editable, a late answer of another language is ignored, a save sends only the changed texts
 *   and keeps edits made while it runs; a language is switched on only complete.
 * @dependencies
 * - createAdminTestContext (DataHandler spy, alert spy, permission stub, i18n stub), real
 *   ResourceCacheService (the cache whose objects must not be mutated).
 */

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Router } from '@angular/router';
import { ComponentFixture, TestBed, fakeAsync, flush, flushMicrotasks } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';

import { BaseTranslationEditorComponent } from './base-translation-editor.component';
import { AdminNotificationsService } from '../../../core/services/admin-notifications.service';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

/** Minimal concrete editor without a template. */
@Component({ standalone: true, template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class TestEditorComponent extends BaseTranslationEditorComponent {
  protected override translationSection = 'test-editor';
  protected override readonly MODULE = 'test';
  protected override readonly LANGUAGES_CACHE_KEY = 'test:languages';
  protected override readonly TRANSLATIONS_CACHE_PREFIX = 'test:translations:';
  protected override readonly UPDATE_PERMISSION = 'test-update';
}

/** File whose `size` is reported as given (content stays tiny). */
function fileOfSize(name: string, size: number, content = 'x', type = 'text/plain'): File {
  const f = new File([content], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
}

/**
 * Waits for a FileReader started by the component (real async I/O): until `done()` holds,
 * max. 1 s.
 */
async function readerDone(done: () => boolean): Promise<void> {
  for (let i = 0; i < 50 && !done(); i++) {
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

describe('BaseTranslationEditorComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<TestEditorComponent>;
  let component: TestEditorComponent;
  let get: jasmine.Spy;

  /** The SAME objects are returned every time - like a shared cached response. */
  const shared = {
    languages: [{ code: 'cz', name: 'Čeština', active: true, isBuiltIn: true }, { code: 'en', name: 'English', active: true }],
    cz: { home: { title: 'Domů' } },
    en: { home: { title: 'Home' } }
  };

  /** Routes DataHandler.get / getQuietly (the texts) by URL; `overrides` win; else 404. */
  const answer = (overrides: Record<string, Observable<any>> = {}) => {
    const route = (url: string) => overrides[url] ?? ({
      'languages/test': of(shared.languages),
      'translations/test/cz': of(shared.cz),
      'translations/test/en': of(shared.en)
    } as Record<string, Observable<any>>)[url] ?? throwError(() => ({ status: 404 }));
    get.and.callFake(route);
    (ctx.dataHandler as any).getQuietly.and.callFake(route);
  };

  beforeEach(() => {
    localStorage.removeItem('jsw_languages');
    shared.cz = { home: { title: 'Domů' } };
    shared.en = { home: { title: 'Home' } };
    ctx = createAdminTestContext();
    get = (ctx.dataHandler as any).get;
    answer();
    TestBed.configureTestingModule({ imports: [TestEditorComponent], providers: ctx.providers });
    fixture = TestBed.createComponent(TestEditorComponent);
    component = fixture.componentInstance;
  });
  afterEach(() => {
    fixture.destroy();
    localStorage.removeItem('jsw_languages');
  });

  /**
   * @description Unsaved edits stay in the editor's own copy: refresh discards them, switching
   *   languages and back shows the stored text, the cached response and the Czech reference
   *   are untouched (bugfix 2026-10-23).
   * @input Edit cz 'home.title' → 'X'; refreshTranslations(); edit en, loadLang('cz'), loadLang('en').
   * @output Refresh shows 'Domů' again, not dirty; shared.cz unchanged; en shows 'Home' again.
   */
  it('keeps unsaved edits out of the cached translations', fakeAsync(() => {
    component.ngOnInit();
    component.updateValue('home.title', 'X');
    expect(component.isDirty).toBeTrue();
    expect(shared.cz.home.title).toBe('Domů');
    expect(component.czTranslations.home.title).toBe('Domů');

    component.refreshTranslations();
    expect(component.translations.home.title).toBe('Domů');
    expect(component.isDirty).toBeFalse();

    component.loadLang('en');
    component.updateValue('home.title', 'Changed');
    component.loadLang('cz');
    component.loadLang('en');
    expect(component.translations.home.title).toBe('Home');
    expect(shared.en.home.title).toBe('Home');
    flush();
  }));

  /**
   * @description Changes of one text: the saved value is the loaded one; a text written
   *   back to it is no change any more; ↺ restores it (the other edits stay); the list of the
   *   changes goes from the last edited; a load clears it all.
   * @input cz {home: {title, sub, more}}; edit title, sub, title again, more; write sub back;
   *   revertValue(more); refreshTranslations()
   * @output changedTexts [title, more, sub] after the edits; sub back → [title, more]; savedValueOf
   *   title 'Domů'; revert more → value 'Více', [title], dirty; after the load nothing changed
   */
  it('reverts one text and lists the changes from the last edited', fakeAsync(() => {
    shared.cz = { home: { title: 'Domů', sub: 'Podtitulek', more: 'Více' } } as any;
    component.ngOnInit();
    component.updateValue('home.title', 'A');
    component.updateValue('home.sub', 'B');
    component.updateValue('home.title', 'AA');
    component.updateValue('home.more', 'C');
    expect(component.changedTexts.map(t => t.path)).toEqual(['home.more', 'home.title', 'home.sub']);
    expect(component.changedTexts[1].value).toBe('AA');
    expect(component.savedValueOf('home.title')).toBe('Domů');

    component.updateValue('home.sub', 'Podtitulek');
    expect(component.changedTexts.map(t => t.path)).toEqual(['home.more', 'home.title']);
    expect(component.changedPaths.has('home.sub')).toBeFalse();

    component.revertValue('home.more');
    expect(component.translations.home.more).toBe('Více');
    expect(component.changedTexts.map(t => t.path)).toEqual(['home.title']);
    expect(component.isDirty).toBeTrue();
    component.revertValue('home.title');
    expect(component.isDirty).toBeFalse();

    component.updateValue('home.title', 'X');
    component.refreshTranslations();
    expect(component.changedPaths.size).toBe(0);
    expect(component.savedValueOf('home.title')).toBe('Domů');
    flush();
  }));

  /**
   * @description A text saved meanwhile elsewhere (409 of the API): the admin is asked; "Neukládat"
   *   takes their text as the saved one (the own edit stays a change, nothing saved); "Přepsat"
   *   saves again with `force`.
   * @input cz edited home.title 'A'; POST → 409 conflicts [{home.title, 'Theirs'}]; answer keep;
   *   save again → 409; answer overwrite; then POST ok
   * @output confirm asked with the key; saved 'Theirs', still dirty, no error alert; then a POST
   *   with force true and the base 'Theirs'; not dirty
   */
  it('asks before overwriting texts saved meanwhile elsewhere', fakeAsync(() => {
    component.ngOnInit();
    const post = (ctx.dataHandler as any).postQuietly as jasmine.Spy;
    const conflict = () => throwError(() => ({ status: 409, error: { errors: { conflicts: [{ path: 'home.title', value: 'Theirs' }], conflict_count: 1 } } }));
    post.and.callFake(conflict);
    ctx.confirm.open.and.resolveTo(false);
    component.updateValue('home.title', 'A');
    component.onSubmit();
    flushMicrotasks();
    expect(ctx.confirm.open).toHaveBeenCalledWith('test-editor.save_conflict_title', 'test-editor.save_conflict_message', jasmine.objectContaining({ confirm: 'test-editor.save_conflict_overwrite' }));
    expect(component.savedValueOf('home.title')).toBe('Theirs');
    expect(component.isDirty).toBeTrue();
    expect(ctx.alert.open).not.toHaveBeenCalledWith('shared.error', jasmine.any(String), 'danger');

    ctx.confirm.open.and.resolveTo(true);
    let calls = 0;
    post.and.callFake(() => (++calls === 1 ? conflict() : of({ values: { 'home.title': 'A' } })));
    post.calls.reset();
    component.onSubmit();
    flushMicrotasks();
    expect(post.calls.mostRecent().args[1]).toEqual({ lang: 'cz', changes: [{ path: 'home.title', value: 'A', base: 'Theirs' }], force: true });
    expect(component.isDirty).toBeFalse();
    flush();
  }));

  /**
   * @description Readable path of a key: parts named by the module and by the common words, other
   *   parts put together from their words (numbers kept), list indexes as #n; unknown words stay.
   * @input labels {home: 'Hlavní stránka', story_heading_2: 'Nadpis příběhu 2'}, words {hero: 'Úvod',
   *   heading: 'Nadpis', cta: 'Výzva k akci', primary: 'hlavní', q: 'Otázka', btn: 'Tlačítko'};
   *   keys home.hero.heading, home.about.story_heading_2, home.cta_primary, faq.q1, list.0.btn, x.foo_bar
   * @output 'Hlavní stránka › Úvod › Nadpis', 'Hlavní stránka › About › Nadpis příběhu 2',
   *   'Hlavní stránka › Výzva k akci hlavní', 'Faq › Otázka 1', 'List › #1 › Tlačítko', 'X › Foo bar'
   */
  it('names the keys for people', () => {
    (ctx.i18n.getMergedSection as jasmine.Spy).and.callFake((section: string) => section === 'translation-editor'
      ? { editor_key_words: { hero: 'Úvod', heading: 'Nadpis', cta: 'Výzva k akci', primary: 'hlavní', q: 'Otázka', btn: 'Tlačítko', desktop: 'počítač', tags: 'Štítky', seo: 'SEO' } }
      : { editor_key_labels: { home: 'Hlavní stránka', story_heading_2: 'Nadpis příběhu 2' } });
    expect(component.keyLabel('home.hero.heading')).toBe('Hlavní stránka › Úvod › Nadpis');
    expect(component.keyLabel('home.about.story_heading_2')).toBe('Hlavní stránka › About › Nadpis příběhu 2');
    expect(component.keyLabel('home.cta_primary')).toBe('Hlavní stránka › Výzva k akci hlavní');
    expect(component.keyLabel('faq.q1')).toBe('Faq › Otázka 1');
    expect(component.keyLabel('list.0.btn')).toBe('List › #1 › Tlačítko');
    expect(component.keyLabel('x.foo_bar')).toBe('X › Foo bar');
    expect(component.keyLabel('values.desktop')).toBe('Values › Počítač');
    expect(component.keyLabel('cards.seo_tags')).toBe('Cards › SEO štítky');
    expect(component.hasKeyLabels).toBeTrue();
    (ctx.i18n.getMergedSection as jasmine.Spy).and.returnValue({});
    expect(component.hasKeyLabels).toBeFalse();
  });

  /**
   * @description Without the Czech reference file (404) the editor still opens the language (no
   *   keys to compare) with an info alert.
   * @input translations/test/cz → 404.
   * @output czTranslations {}; current cz translations empty; info alert; editable.
   */
  it('works without the Czech reference', fakeAsync(() => {
    answer({ 'translations/test/cz': throwError(() => ({ status: 404 })) });
    component.ngOnInit();
    expect(component.czTranslations).toEqual({});
    expect(component.flattenedKeys).toEqual([]);
    expect(ctx.alert.open).toHaveBeenCalledWith('test-editor.info_title', jasmine.any(String), 'info');
    expect(component.loadFailed).toBeFalse();
    flush();
  }));

  /**
   * @description A language that cannot be loaded (server / network error, not 404) is not
   *   taken for an empty one: nothing to edit or save, an error alert; a later successful load
   *   makes it editable again. Its saved JSON is not downloaded empty either.
   * @input translations/test/en → 500; loadLang('en'); updateValue; onSubmit(); downloadSavedJson('en');
   *   then en answers; refreshTranslations()
   * @output loadFailed, no keys, canEditTexts false, alert 'translations_load_failed_message'
   *   (danger), no POST, no file; after the reload 'Home' editable
   */
  it('does not edit a language that failed to load', fakeAsync(() => {
    answer({ 'translations/test/en': throwError(() => ({ status: 500 })) });
    component.ngOnInit();
    component.loadLang('en');
    expect(component.loadFailed).toBeTrue();
    expect(component.flattenedKeys).toEqual([]);
    expect(component.canEditTexts).toBeFalse();
    expect(ctx.alert.open).toHaveBeenCalledWith('shared.error', 'test-editor.translations_load_failed_message', 'danger');
    component.updateValue('home.title', 'X');
    expect(component.isDirty).toBeFalse();
    component.onSubmit();
    expect((ctx.dataHandler as any).postQuietly).not.toHaveBeenCalled();
    const click = spyOn(HTMLAnchorElement.prototype, 'click');
    component.downloadSavedJson('en');
    expect(click).not.toHaveBeenCalled();

    answer();
    component.refreshTranslations();
    expect(component.loadFailed).toBeFalse();
    expect(component.translations.home.title).toBe('Home');
    expect(component.canEditTexts).toBeTrue();
    flush();
  }));

  /**
   * @description A newer load wins: the answer of a language opened before (still loading) never
   *   fills the language opened after it.
   * @input en answers late (Subject); loadLang('en'), loadLang('cz'); en answers {home: {title: 'Late'}}
   * @output current cz with 'Domů'
   */
  it('ignores the late answer of a language opened before', fakeAsync(() => {
    const late = new Subject<any>();
    answer({ 'translations/test/en': late });
    component.ngOnInit();
    component.loadLang('en');
    component.loadLang('cz');
    late.next({ home: { title: 'Late' } });
    late.complete();
    expect(component.currentLang).toBe('cz');
    expect(component.translations.home.title).toBe('Domů');
    flush();
  }));

  /**
   * @description Saving sends only the changed texts, one save at a time; the texts as stored by
   *   the API become the saved ones (plain text shown in the field); a text edited again while
   *   the save ran stays a change; `saved$` gives the saved texts.
   * @input cz {home: {title, sub}}; edit title 'A<b>', sub 'S'; onSubmit() (answer held); onSubmit()
   *   again; edit sub 'S2'; answer {values: {home.title: 'A', home.sub: 'S'}}
   * @output one POST {lang cz, changes [title, sub]}; saving while held; after: title 'A' saved and
   *   shown, sub still changed (S2), dirty; saved$ {home.title: 'A', home.sub: 'S'}
   */
  it('saves only the changed texts and keeps edits made meanwhile', fakeAsync(() => {
    shared.cz = { home: { title: 'Domů', sub: 'Pod' } } as any;
    component.ngOnInit();
    const post = (ctx.dataHandler as any).postQuietly as jasmine.Spy;
    const answerOfSave = new Subject<any>();
    post.and.returnValue(answerOfSave);
    let saved: Record<string, string> | null = null;
    component.saved$.subscribe(values => saved = values);

    component.updateValue('home.title', 'A<b>');
    component.updateValue('home.sub', 'S');
    component.onSubmit();
    component.onSubmit();
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('save_translations/test', { lang: 'cz', changes: [{ path: 'home.title', value: 'A<b>', base: 'Domů' }, { path: 'home.sub', value: 'S', base: 'Pod' }] });
    expect(component.saving).toBeTrue();

    component.updateValue('home.sub', 'S2');
    answerOfSave.next({ detected_changes: 2, values: { 'home.title': 'A', 'home.sub': 'S' } });
    answerOfSave.complete();
    expect(component.saving).toBeFalse();
    expect(component.translations.home.title).toBe('A');
    expect(component.savedValueOf('home.title')).toBe('A');
    expect(component.changedPaths.has('home.title')).toBeFalse();
    expect([...component.changedPaths]).toEqual(['home.sub']);
    expect(component.savedValueOf('home.sub')).toBe('S');
    expect(component.isDirty).toBeTrue();
    expect(saved!).toEqual({ 'home.title': 'A', 'home.sub': 'S' });
    flush();
  }));

  /**
   * @description Icon: none chosen → nothing; not PNG / JPG / WebP → error; > 512 kB → error;
   *   valid → preview data URL; clear resets; close hides the form.
   * @input No file; SVG; 600 kB PNG; 1 kB PNG; clearIconSelection(); closeAddForm().
   * @output Unchanged; 'test-editor.icon_type_error'; 'test-editor.icon_size_error'; preview
   *   'data:image/png…', no error; '' ; false.
   */
  it('validates and previews the language icon', async () => {
    component.openAddForm();
    component.onIconFileSelected({ target: { files: [] } } as any);
    expect(component.newLangIconPreview).toBe('');

    component.onIconFileSelected({ target: { files: [fileOfSize('flag.svg', 100, '<svg/>', 'image/svg+xml')], value: 'x' } } as any);
    expect(component.addFormError).toBe('test-editor.icon_type_error');
    expect(component.newLangIconPreview).toBe('');

    component.onIconFileSelected({ target: { files: [fileOfSize('big.png', 600 * 1024, 'x', 'image/png')] } } as any);
    expect(component.addFormError).toBe('test-editor.icon_size_error');

    component.onIconFileSelected({ target: { files: [fileOfSize('ok.png', 1024, 'png', 'image/png')] } } as any);
    await readerDone(() => component.newLangIconPreview !== '');
    expect(component.newLangIconPreview).toMatch(/^data:image\/png/);
    expect(component.addFormError).toBe('');

    component.clearIconSelection();
    expect(component.newLangIconPreview).toBe('');
    component.closeAddForm();
    expect(component.showAddForm).toBeFalse();
  });

  /**
   * @description Adding a language sends the icon with its target code; a failed save shows
   *   the error and keeps the form open.
   * @input Icon chosen, code 'De ', name 'Deutsch'; quiet POST ok; then the POST failing for 'fr'
   *   (network, then 422 of the API).
   * @output FormData icon + target_code 'de', languages incl. de; current 'de';
   *   'language_save_failed_error', then 'code_format_error'; no global error dialog (quiet POST).
   */
  it('adds a language with an icon and reports a failed save', async () => {
    component.ngOnInit();
    const upload = (ctx.dataHandler as any).postQuietly as jasmine.Spy;
    upload.and.returnValue(of({ status: 'ok' }));

    component.openAddForm();
    component.onIconFileSelected({ target: { files: [fileOfSize('de.png', 100, 'png', 'image/png')] } } as any);
    await readerDone(() => component.newLangIconPreview !== '');
    component.newLangCode = 'De ';
    component.newLangName = 'Deutsch';
    component.confirmAddLang();

    const fd = upload.calls.mostRecent().args[1] as FormData;
    expect(upload.calls.mostRecent().args[0]).toBe('languages/test');
    expect((fd.get('icon') as File).name).toBe('de.png');
    expect(fd.get('target_code')).toBe('de');
    expect(JSON.parse(fd.get('languages') as string).map((l: any) => l.code)).toEqual(['cz', 'en', 'de']);
    expect(component.currentLang).toBe('de');
    expect(component.showAddForm).toBeFalse();

    upload.and.returnValue(throwError(() => new Error('x')));
    component.openAddForm();
    component.newLangCode = 'fr';
    component.newLangName = 'Français';
    component.confirmAddLang();
    expect(component.addFormError).toBe('test-editor.language_save_failed_error');
    expect(component.showAddForm).toBeTrue();
    upload.and.returnValue(throwError(() => ({ status: 422 })));
    component.confirmAddLang();
    expect(component.addFormError).toBe('test-editor.code_format_error');
    expect((ctx.dataHandler as any).upload).not.toHaveBeenCalled();
  });

  /**
   * @description Unsaved edits are never lost by the language windows: adding a language keeps
   *   the open one (the new one waits in the list, the message says so); an upload of the open
   *   language loads the uploaded texts and keeps the edits as unsaved changes over them (in the
   *   order made).
   * @input cz edited (home.title 'A', then home.sub 'S'); add 'de' (POST ok); upload of cz (POST
   *   ok, the server then has {home: {title: 'Nahráno', sub: 'S'}})
   * @output current cz, still dirty, 'language_created_kept_message'; after the upload title 'A'
   *   changed over the saved 'Nahráno', sub equal to the uploaded one - no change; changed [title]
   */
  it('keeps unsaved edits when a language is added or uploaded', async () => {
    shared.cz = { home: { title: 'Domů', sub: 'Pod' } } as any;
    component.ngOnInit();
    component.updateValue('home.title', 'A');
    component.updateValue('home.sub', 'S');
    const quiet = (ctx.dataHandler as any).postQuietly as jasmine.Spy;
    quiet.and.returnValue(of({}));

    component.openAddForm();
    component.newLangCode = 'de';
    component.newLangName = 'Deutsch';
    component.confirmAddLang();
    expect(component.currentLang).toBe('cz');
    expect(component.isDirty).toBeTrue();
    expect(ctx.alert.open).toHaveBeenCalledWith('shared.success', 'test-editor.language_created_kept_message', 'success');

    shared.cz = { home: { title: 'Nahráno', sub: 'S' } } as any;
    component.openUploadModal('cz');
    component.onJsonFileSelected({ target: { files: [new File(['{"home": {"title": "Nahráno", "sub": "S"}}'], 'cz.json')] } } as any);
    await readerDone(() => component.uploadSuccess !== '');
    expect(component.savedValueOf('home.title')).toBe('Nahráno');
    expect(component.translations.home.title).toBe('A');
    expect([...component.changedPaths]).toEqual(['home.title']);
    expect(component.isDirty).toBeTrue();
  });

  /**
   * @description The code field keeps only lowercase letters, at most 2 (typed or pasted) and
   *   clears an old error of the form.
   * @input inputs 'TUR', 'ď1 e', 'Sk'; addFormError set before
   * @output field and newLangCode 'tu', 'e', 'sk'; addFormError ''
   */
  it('keeps only two lowercase letters in the code field', () => {
    const field = document.createElement('input');
    const type = (value: string) => { field.value = value; component.onLangCodeInput({ target: field } as unknown as Event); };
    component.addFormError = 'x';
    type('TUR');
    expect([field.value, component.newLangCode, component.addFormError]).toEqual(['tu', 'tu', '']);
    type('ď1 e');
    expect(component.newLangCode).toBe('e');
    type('Sk');
    expect(field.value).toBe('sk');
  });

  /**
   * @description Delete: cancel clears the selection; a failure shows the API message (or the
   *   fallback); without a selection nothing happens. Toggle success invalidates the cache and
   *   asks the notifications again (the orange / grey dots follow the switch at once).
   * @input askDeleteLang(en) + cancelDelete(); delete failing with / without message; toggle ok.
   * @output null; alerts 'In use' and 'test-editor.delete_language_failed_error'; notifications
   *   refreshed; languages reloaded.
   */
  it('handles delete failures and a successful toggle', fakeAsync(() => {
    component.ngOnInit();
    const del = (ctx.dataHandler as any).delete as jasmine.Spy;
    const en = component.languages[1];

    component.askDeleteLang(en);
    expect(component.langToDelete).toBe(en);
    component.cancelDelete();
    expect(component.langToDelete).toBeNull();
    component.confirmDeleteLang();
    expect(del).not.toHaveBeenCalled();

    del.and.returnValue(throwError(() => ({ error: { message: 'In use' } })));
    component.askDeleteLang(en);
    component.confirmDeleteLang();
    expect(ctx.alert.open).toHaveBeenCalledWith('shared.error', 'In use', 'danger');
    del.and.returnValue(throwError(() => ({})));
    component.askDeleteLang(en);
    component.confirmDeleteLang();
    expect(ctx.alert.open).toHaveBeenCalledWith('shared.error', 'test-editor.delete_language_failed_error', 'danger');
    expect(component.langToDelete).toBeNull();

    (ctx.dataHandler as any).postQuietly.and.returnValue(of({ status: 'ok' }));
    const refresh = spyOn(TestBed.inject(AdminNotificationsService), 'refresh');
    component.toggleLangActive(en);
    expect(en.active).toBeFalse();
    expect(refresh).toHaveBeenCalled();
    get.calls.reset();
    component.ngOnInit();
    expect(get).toHaveBeenCalledWith('languages/test');
    en.active = true;
    flush();
  }));

  /**
   * @description A language is switched on only complete: what it lacks comes from the API
   *   (languages/{module}/completeness); an incomplete one is not switched on (nothing sent); a
   *   switch-on refused by the API (422 `errors.incomplete`) is undone with a message naming the missing
   *   parts; switching off is always free; a new language is created switched off.
   * @input en active; completeness {en: {texts: 2}}; switch en off, then on; completeness {en: {}};
   *   switch on → 422 {errors: {incomplete: {en: {page_titles: 1}}}}; openAddForm()
   * @output off sent; on not sent, canActivate false, summary 'texts 2'; then sent, en off again,
   *   alert activate_incomplete_message, completeness en {page_titles: 1}; newLangActive false
   */
  it('switches a language on only complete', fakeAsync(() => {
    let completeness: any = { en: { texts: 2 } };
    answer({ 'languages/test/completeness': new Observable(subscriber => { subscriber.next(completeness); subscriber.complete(); }) });
    component.ngOnInit();
    const post = (ctx.dataHandler as any).postQuietly as jasmine.Spy;
    post.and.returnValue(of(null));
    const en = component.languages[1];

    component.toggleLangActive(en);
    expect(en.active).toBeFalse();
    expect(post).toHaveBeenCalledTimes(1);
    expect(component.canActivate(en)).toBeFalse();
    expect(component.lacksTexts('en')).toBeTrue();
    expect(component.missingSummary('en')).toBe('texts 2');
    component.toggleLangActive(en);
    expect(post).toHaveBeenCalledTimes(1);
    expect(en.active).toBeFalse();

    completeness = { en: {} };
    component.loadCompleteness();
    expect(component.canActivate(en)).toBeTrue();
    post.and.returnValue(throwError(() => ({ status: 422, error: { errors: { incomplete: { en: { page_titles: 1 } } } } })));
    component.toggleLangActive(en);
    expect(post).toHaveBeenCalledTimes(2);
    expect(en.active).toBeFalse();
    expect(ctx.alert.open).toHaveBeenCalledWith('shared.error', 'test-editor.activate_incomplete_message', 'danger');
    expect(component.completeness['en']).toEqual({ page_titles: 1 });

    component.openAddForm();
    expect(component.newLangActive).toBeFalse();
    en.active = true;
    flush();
  }));

  /**
   * @description JSON upload: modal state, invalid JSON error, failed save error, keys refused by
   *   the API (422 - lists and counts shown, "… and N more"), success for another language
   *   (message only) and for the current language (reloaded from the API). Sent quietly with
   *   `upload: true` (the API compares the keys with Czech).
   * @input openUploadModal('en') + '{bad'; valid file + save error; 422 {missing: 2 of 25,
   *   unexpected: 1}; valid file ok for en; then for cz (current).
   * @output invalid_json_error; upload_failed_error; upload_keys_mismatch_error + mismatch;
   *   json_uploaded_message, mismatch cleared; cz requested again.
   */
  it('uploads translation JSON files', async () => {
    component.ngOnInit();
    const post = (ctx.dataHandler as any).postQuietly as jasmine.Spy;
    const choose = (content: string) => component.onJsonFileSelected({ target: { files: [new File([content], 'x.json')] } } as any);

    component.openUploadModal('en');
    expect(component.showUploadModal).toBeTrue();
    component.onJsonFileSelected({ target: { files: [] } } as any);
    choose('{bad');
    await readerDone(() => component.uploadError !== '');
    expect(component.uploadError).toBe('test-editor.invalid_json_error');

    post.and.returnValue(throwError(() => new Error('x')));
    choose('{"a": "b"}');
    await readerDone(() => post.calls.count() === 1);
    expect(component.uploadError).toBe('test-editor.upload_failed_error');
    expect(component.uploadMismatch).toBeNull();

    post.and.returnValue(throwError(() => ({ status: 422, error: { missing: ['a.b', 'a.c'], unexpected: ['x'], missing_count: 25, unexpected_count: 1 } })));
    choose('{"x": "y"}');
    await readerDone(() => component.uploadMismatch !== null);
    expect(component.uploadError).toBe('test-editor.upload_keys_mismatch_error');
    expect(component.uploadMismatch).toEqual({ missing: ['a.b', 'a.c'], unexpected: ['x'], missingCount: 25, unexpectedCount: 1 });
    expect(component.moreKeys(['a.b', 'a.c'], 25)).toBe('test-editor.upload_more_keys');
    expect(component.moreKeys(['x'], 1)).toBe('');

    post.and.returnValue(of({}));
    choose('{"a": "b"}');
    await readerDone(() => component.uploadSuccess !== '');
    expect(post).toHaveBeenCalledWith('save_translations/test', { lang: 'en', data: { a: 'b' }, upload: true });
    expect(component.uploadSuccess).toBe('test-editor.json_uploaded_message');
    expect(component.uploadError).toBe('');
    expect(component.uploadMismatch).toBeNull();

    const getQuietly = (ctx.dataHandler as any).getQuietly as jasmine.Spy;
    getQuietly.calls.reset();
    component.openUploadModal('cz');
    choose('{"home": {"title": "Nový"}}');
    await readerDone(() => getQuietly.calls.count() > 0);
    expect(getQuietly).toHaveBeenCalledWith('translations/test/cz');
    component.closeUploadModal();
    expect(component.showUploadModal).toBeFalse();
  });

  /**
   * @description Download saves the current translations as '<lang>.json'; the textarea grows
   *   to its content.
   * @input downloadJson() for cz; adjustHeight on a textarea.
   * @output anchor 'cz.json' with a blob URL; height = scrollHeight px.
   */
  it('downloads the JSON and auto-sizes textareas', fakeAsync(() => {
    component.ngOnInit();
    const click = spyOn(HTMLAnchorElement.prototype, 'click');
    spyOn(URL, 'createObjectURL').and.returnValue('blob:test');
    spyOn(URL, 'revokeObjectURL');
    component.downloadJson();
    const anchor = click.calls.mostRecent().object as HTMLAnchorElement;
    expect(anchor.download).toBe('cz.json');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');


    const area = document.createElement('textarea');
    document.body.appendChild(area);
    area.value = 'a\nb\nc\nd';
    component.adjustHeight({ target: area });
    expect(area.style.height).toBe(`${area.scrollHeight}px`);
    area.remove();
    flush();
  }));

  /**
   * @description The downloaded file of a language is complete: every key of Czech is in it (a
   *   text the language lacks as ""), its own texts win - so it can be translated and uploaded
   *   back (an upload must have the keys of Czech).
   * @input cz {home: {title, subtitle}}; en {home: {title: 'Home'}}; downloadJson() for en.
   * @output file {"home": {"title": "Home", "subtitle": ""}}, name 'en.json'.
   */
  it('downloads a complete file with the keys of Czech', async () => {
    shared.cz = { home: { title: 'Domů', subtitle: 'Vítejte' } } as any;
    component.ngOnInit();
    component.loadLang('en');
    const click = spyOn(HTMLAnchorElement.prototype, 'click');
    let blob: Blob | null = null;
    spyOn(URL, 'createObjectURL').and.callFake((b: any) => { blob = b; return 'blob:test'; });
    spyOn(URL, 'revokeObjectURL');

    component.downloadJson();

    expect((click.calls.mostRecent().object as HTMLAnchorElement).download).toBe('en.json');
    expect(JSON.parse(await blob!.text())).toEqual({ home: { title: 'Home', subtitle: '' } });
  });

  /**
   * @description The page tabs show the orange number of texts missing in an active language:
   *   the texts tab the kind `<module>_texts_missing`, an extra tab its own attention kind; a
   *   save asks the notifications again, so the number follows at once.
   * @input kinds test_texts_missing 4, test_page_titles_missing 2, test_faq_missing 0; extra tab
   *   with attentionKind test_faq_missing; save of the texts.
   * @output translations tab count 4 (attention, title), page titles tab 2 (its own title), extra
   *   tab no count; with only switched off languages lacking FAQ texts (preparing pl 3): the extra
   *   tab grey 3 (neutral, tab_preparing_title); refresh() called.
   */
  it('shows missing texts on the page tabs', fakeAsync(() => {
    const notifications = TestBed.inject(AdminNotificationsService);
    spyOn(notifications, 'refresh');
    (component as any).extraTabs.push({ key: 'faq', labelKey: 'tab_faq', icon: 'help-circle', attentionKind: 'test_faq_missing' });
    notifications.kinds.set([
      { kind: 'test_texts_missing', module: 'test', link: '/admin/test', count: 4, attention: true },
      { kind: 'test_faq_missing', module: 'test', link: '/admin/test', count: 0, attention: true },
      { kind: 'test_page_titles_missing', module: 'test', link: '/admin/test', count: 2, attention: true },
    ]);
    const [texts, titles, faq] = component.tabItems;
    expect([texts.count, texts.countTone, texts.title]).toEqual([4, 'attention', 'test-editor.tab_missing_texts_title']);
    expect([titles.count, titles.title]).toEqual([2, 'test-editor.tab_missing_titles_title']);
    expect(faq.count).toBeNull();
    notifications.kinds.update(kinds => kinds.map(k => (k.kind === 'test_faq_missing' ? { ...k, preparing: { pl: 3 } } : k)));
    const grey = component.tabItems[2];
    expect([grey.count, grey.countTone, grey.title]).toEqual([3, 'neutral', 'test-editor.tab_preparing_title']);

    component.ngOnInit();
    (ctx.dataHandler as any).postQuietly.and.returnValue(of({}));
    const announced = spyOn(BroadcastChannel.prototype, 'postMessage');
    component.updateValue('home.title', 'Úvod');
    component.onSubmit();
    expect(notifications.refresh).toHaveBeenCalled();
    // open tabs of the website in this browser are told (texts-broadcast)
    expect(announced).toHaveBeenCalledWith({ kind: 'texts', module: 'test', lang: 'cz' });
    flush();
  }));

  /**
   * @description Banner of missing texts: the languages of the attention kind
   *   `<module>_texts_missing` (names from the language list, most missing first) with the total;
   *   a language button opens that language with only its missing texts.
   * @input kinds test_texts_missing 5 split { cz: 1, en: 4 }; en without 'home.title'; ngOnInit()
   *   (cz loaded); showMissingIn('en').
   * @output missingLanguages English 4, Čeština 1; missingTotal 5; currentLang 'en', the filtered
   *   keys only the missing 'home.title'.
   */
  it('lists the languages with missing texts and opens one filtered', fakeAsync(() => {
    shared.en = { home: { title: '' } } as any;
    TestBed.inject(AdminNotificationsService).kinds.set([
      { kind: 'test_texts_missing', module: 'test', link: '/admin/test', count: 5, attention: true, languages: { cz: 1, en: 4 } },
    ]);
    component.ngOnInit();
    expect(component.missingLanguages).toEqual([{ code: 'en', count: 4, name: 'English' }, { code: 'cz', count: 1, name: 'Čeština' }]);
    expect(component.missingTotal).toBe(5);

    component.showMissingIn('en');
    expect(component.currentLang).toBe('en');
    expect(component.filteredKeys.map(k => k.path)).toEqual(['home.title']);
    expect(component.filteredKeys.every(k => k.missing)).toBeTrue();
    flush();
  }));

  /**
   * @description A part of what a language lacks (window Jazyky) opens where it is filled in: the
   *   texts → the list of the missing ones; a tab of the page → the tab, asking it for the
   *   language (a new request each time); a part of another page → the address of the
   *   application (`missingPartLinks`, `{lang}` replaced); an unknown part does nothing.
   * @input extra tab faq; openMissingPart('en', 'texts'), ('pl', 'page_titles'), ('pl', 'faq'),
   *   ('de', 'inquiry_email'), ('de', 'unknown').
   * @output showMissingIn('en'); activeTab page_titles + focusLang {pl, 1}; faq + {pl, 2};
   *   navigateByUrl('/admin/web/user-request?email-template=de'); canOpenMissingPart true for
   *   texts / faq / inquiry_email, false for unknown.
   */
  it('opens where a missing part of a language is filled in', () => {
    (component as any).extraTabs.push({ key: 'faq', labelKey: 'tab_faq', icon: 'help-circle' });
    const showMissing = spyOn(component, 'showMissingIn');
    const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);

    component.openMissingPart('en', 'texts');
    expect(showMissing).toHaveBeenCalledWith('en');
    component.openMissingPart('pl', 'page_titles');
    expect([component.activeTab, component.focusLang]).toEqual(['page_titles', { code: 'pl', seq: 1 }]);
    component.openMissingPart('pl', 'faq');
    expect([component.activeTab, component.focusLang]).toEqual(['faq', { code: 'pl', seq: 2 }]);
    component.openMissingPart('de', 'inquiry_email');
    expect(navigate).toHaveBeenCalledWith('/admin/web/user-request?email-template=de');
    navigate.calls.reset();
    component.openMissingPart('de', 'unknown');
    expect(navigate).not.toHaveBeenCalled();
    expect(['texts', 'faq', 'inquiry_email', 'unknown'].map(part => component.canOpenMissingPart(part))).toEqual([true, true, true, false]);
  });

  /**
   * @description The number on a language tab of the texts follows the menu: missing texts of an
   *   active language orange (`languages`), of a switched off one grey (`preparing`); a complete
   *   language has none (a switched off complete language shows no dot either - only its dashed tab).
   * @input kind test_texts_missing { languages: { de: 2 }, preparing: { pl: 14 } }; de on, pl off,
   *   en off without missing texts.
   * @output de {2, attention}; pl {14, neutral}; en null.
   */
  it('numbers the language tabs of the texts like the menu', () => {
    TestBed.inject(AdminNotificationsService).kinds.set([
      { kind: 'test_texts_missing', module: 'test', link: '/admin/test', count: 2, attention: true, languages: { de: 2 }, preparing: { pl: 14 } },
    ]);
    const lang = (code: string, active: boolean) => ({ code, name: code, active } as any);
    expect(component.langTabMissing(lang('de', true))).toEqual({ count: 2, tone: 'attention' });
    expect(component.langTabMissing(lang('pl', false))).toEqual({ count: 14, tone: 'neutral' });
    expect(component.langTabMissing(lang('en', false))).toBeNull();
  });

  /**
   * @description The visual editor (TEXTS_PAGE_URL set) sends the parts that are tabs of the texts
   *   page there (`?tab=&lang=`), keeps the texts in place (their list is beside it); the texts
   *   page opens the tab and the language named in its address.
   * @input TEXTS_PAGE_URL '/admin/test'; openMissingPart('pl', 'faq'), ('pl', 'texts'); then
   *   without it: openTabOfUrl {tab: page_titles, lang: de}, {tab: unknown}.
   * @output navigateByUrl('/admin/test?tab=faq&lang=pl'); texts: no showMissingIn, cannot be
   *   opened; activeTab page_titles + focusLang de; unknown tab ignored.
   */
  it('routes missing parts of the visual editor to the texts page', () => {
    const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    const showMissing = spyOn(component, 'showMissingIn');
    (component as any).TEXTS_PAGE_URL = '/admin/test';
    component.openMissingPart('pl', 'faq');
    expect(navigate).toHaveBeenCalledWith('/admin/test?tab=faq&lang=pl');
    component.openMissingPart('pl', 'texts');
    expect(showMissing).not.toHaveBeenCalled();
    expect([component.canOpenMissingPart('texts'), component.canOpenMissingPart('faq')]).toEqual([false, true]);

    (component as any).TEXTS_PAGE_URL = null;
    const params = (values: Record<string, string>) => ({ get: (name: string) => values[name] ?? null });
    (component as any).openTabOfUrl(params({ tab: 'page_titles', lang: 'de' }));
    expect([component.activeTab, component.focusLang?.code]).toEqual(['page_titles', 'de']);
    (component as any).openTabOfUrl(params({ tab: 'unknown' }));
    expect(component.activeTab).toBe('page_titles');
  });
});
