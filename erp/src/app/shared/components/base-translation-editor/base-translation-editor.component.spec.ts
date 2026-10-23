/**
 * @file base-translation-editor.component.spec.ts
 * @path src/app/shared/components/base-translation-editor/base-translation-editor.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of BaseTranslationEditorComponent through a minimal concrete editor
 *   (module 'test'). Complements the EditWebsite / EditEshop specs with the parts they do not
 *   reach: unsaved edits never leak into the shared cache (bugfix 2026-10-23), missing Czech
 *   reference, icon selection (size limit, preview), add-language with icon and failure,
 *   delete failure, toggle success, JSON upload (valid / invalid / failing / current language
 *   reload), JSON download and the textarea auto-height.
 * @dependencies
 * - createAdminTestContext (DataHandler spy, alert spy, permission stub, i18n stub), real
 *   ResourceCacheService (the cache whose objects must not be mutated).
 */

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, flush } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';

import { BaseTranslationEditorComponent } from './base-translation-editor.component';
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
    languages: { languages: [{ code: 'cz', name: 'Čeština', active: true, isBuiltIn: true }, { code: 'en', name: 'English', active: true }] },
    cz: { home: { title: 'Domů' } },
    en: { home: { title: 'Home' } }
  };

  /** Routes DataHandler.get by URL; `overrides` win. */
  const answer = (overrides: Record<string, Observable<any>> = {}) =>
    get.and.callFake((url: string) => overrides[url] ?? ({
      'languages/test': of(shared.languages),
      'translations/test/cz': of(shared.cz),
      'translations/test/en': of(shared.en)
    } as Record<string, Observable<any>>)[url] ?? throwError(() => new Error('404')));

  beforeEach(() => {
    localStorage.removeItem('rpsw_languages');
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
    localStorage.removeItem('rpsw_languages');
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
   * @description Without the Czech reference the editor still loads the language (no keys to
   *   compare); refresh forces a new request only when asked.
   * @input translations/test/cz fails.
   * @output czTranslations {}; current cz translations empty with an info alert.
   */
  it('works without the Czech reference', fakeAsync(() => {
    answer({ 'translations/test/cz': throwError(() => new Error('down')) });
    component.ngOnInit();
    expect(component.czTranslations).toEqual({});
    expect(component.flattenedKeys).toEqual([]);
    expect(ctx.alert.open).toHaveBeenCalledWith('test-editor.info_title', jasmine.any(String), 'info');
    flush();
  }));

  /**
   * @description Icon: none chosen → nothing; > 512 kB → error; valid → preview data URL;
   *   clear resets; close hides the form.
   * @input No file; 600 kB file; 1 kB PNG; clearIconSelection(); closeAddForm().
   * @output Unchanged; 'test-editor.icon_size_error'; preview 'data:image/png…', no error; '' ; false.
   */
  it('validates and previews the language icon', async () => {
    component.openAddForm();
    component.onIconFileSelected({ target: { files: [] } } as any);
    expect(component.newLangIconPreview).toBe('');

    component.onIconFileSelected({ target: { files: [fileOfSize('big.png', 600 * 1024)] } } as any);
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
   * @input Icon chosen, code 'De ', name 'Deutsch'; upload ok; then upload failing for 'fr'.
   * @output FormData icon + target_code 'de', languages incl. de; current 'de'; 'language_save_failed_error'.
   */
  it('adds a language with an icon and reports a failed save', async () => {
    component.ngOnInit();
    const upload = (ctx.dataHandler as any).upload as jasmine.Spy;
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
  });

  /**
   * @description Delete: cancel clears the selection; a failure shows the API message (or the
   *   fallback); without a selection nothing happens. Toggle success invalidates the cache.
   * @input askDeleteLang(en) + cancelDelete(); delete failing with / without message; toggle ok.
   * @output null; alerts 'In use' and 'test-editor.delete_language_failed_error'; languages reloaded.
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

    (ctx.dataHandler as any).upload.and.returnValue(of({ status: 'ok' }));
    component.toggleLangActive(en);
    expect(en.active).toBeFalse();
    get.calls.reset();
    component.ngOnInit();
    expect(get).toHaveBeenCalledWith('languages/test');
    en.active = true;
    flush();
  }));

  /**
   * @description JSON upload: modal state, invalid JSON error, failed save error, success for
   *   another language (message only) and for the current language (reloaded from the API).
   * @input openUploadModal('en') + '{bad'; valid file + save error; valid file ok for en; then for cz (current).
   * @output invalid_json_error; upload_failed_error; json_uploaded_message; cz requested again.
   */
  it('uploads translation JSON files', async () => {
    component.ngOnInit();
    const post = (ctx.dataHandler as any).post as jasmine.Spy;
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

    post.and.returnValue(of({}));
    choose('{"a": "b"}');
    await readerDone(() => component.uploadSuccess !== '');
    expect(post).toHaveBeenCalledWith('save_translations/test', { lang: 'en', data: { a: 'b' } });
    expect(component.uploadSuccess).toBe('test-editor.json_uploaded_message');
    expect(component.uploadError).toBe('');

    get.calls.reset();
    component.openUploadModal('cz');
    choose('{"home": {"title": "Nový"}}');
    await readerDone(() => get.calls.count() > 0);
    expect(get).toHaveBeenCalledWith('translations/test/cz');
    component.closeUploadModal();
    expect(component.showUploadModal).toBeFalse();
  });

  /**
   * @description Download saves the current translations as '<lang>.json'; the textarea grows
   *   to its content.
   * @input downloadJson() with anchor click spied; adjustHeight on a textarea.
   * @output click on an anchor 'cz.json' with a blob URL; height = scrollHeight px.
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
});
