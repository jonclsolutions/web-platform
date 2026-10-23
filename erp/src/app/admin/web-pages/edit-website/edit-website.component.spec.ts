/**
 * @file edit-website.component.spec.ts
 * @path src/app/admin/web-pages/edit-website/edit-website.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of EditWebsiteComponent – the translation editor of the public web
 *   (module 'web'). The page only configures BaseTranslationEditorComponent, so the tests check
 *   the configuration through the real editor behaviour: languages and translations of the
 *   'web' module, missing keys against the Czech reference, editing and saving, the
 *   'web-edit-website-update' permission, adding / deleting / toggling languages and JSON upload.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (DataHandler spy, permission stub, alert spy, i18n stub),
 *   ResourceCacheService (real)
 */

import { ComponentFixture, TestBed, fakeAsync, flush, discardPeriodicTasks } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { EditWebsiteComponent } from './edit-website.component';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('EditWebsiteComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<EditWebsiteComponent>;
  let component: EditWebsiteComponent;

  const languages = [{ code: 'cz', name: 'Čeština', active: true, isBuiltIn: true }, { code: 'en', name: 'English', active: true }];
  const cz = { home: { title: 'Domů', cta: 'Kontakt' }, footer: 'Patička' };
  const en = { home: { title: 'Home', cta: '' }, extra: 'Only EN' };

  /** DataHandler.get answers: languages and translations per language of the 'web' module. */
  const answer = (overrides: Record<string, any> = {}) => {
    (ctx.dataHandler as any).get.and.callFake((url: string) => {
      if (url in overrides) return overrides[url];
      if (url === 'languages/web') return of({ languages: JSON.parse(JSON.stringify(languages)) });
      if (url === 'translations/web/cz') return of(JSON.parse(JSON.stringify(cz)));
      if (url === 'translations/web/en') return of(JSON.parse(JSON.stringify(en)));
      return throwError(() => new Error('404'));
    });
  };

  const setup = async (granted: string[] | 'all' = 'all') => {
    localStorage.removeItem('rpsw_languages');
    ctx = createAdminTestContext({ granted });
    answer();
    await TestBed.configureTestingModule({ imports: [EditWebsiteComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(EditWebsiteComponent);
    component = fixture.componentInstance;
  };

  beforeEach(async () => { await setup(); });
  afterEach(() => { fixture.destroy(); localStorage.removeItem('rpsw_languages'); });

  /**
   * @description The page is configured for the 'web' module and the 'edit-website' texts.
   * @input  t('page_title'); ngOnInit()
   * @output 'edit-website.page_title'; get('languages/web'), get('translations/web/cz'); languages cz, en
   */
  it('loads the languages and translations of the web module', fakeAsync(() => {
    expect(component.t('page_title')).toBe('edit-website.page_title');
    component.ngOnInit();
    expect((ctx.dataHandler as any).get).toHaveBeenCalledWith('languages/web');
    expect((ctx.dataHandler as any).get).toHaveBeenCalledWith('translations/web/cz');
    expect(component.languages.map(l => l.code)).toEqual(['cz', 'en']);
    expect(component.currentLang).toBe('cz');
    expect(component.totalCount).toBe(3);
    expect(JSON.parse(localStorage.getItem('rpsw_languages')!)[0].code).toBe('cz');
    flush();
  }));

  /**
   * @description Another language is compared with the Czech reference: empty values are missing, extra keys are kept.
   * @input  loadLang('en'): home.title 'Home', home.cta '', extra 'Only EN'; cz has home.title, home.cta, footer
   * @output 4 keys; missing home.cta and footer (missingCount 2); filledCount 2; filterMissing → 2 keys
   */
  it('marks keys missing against the Czech reference', fakeAsync(() => {
    component.ngOnInit();
    component.loadLang('en');
    expect(component.flattenedKeys.map(k => k.path)).toEqual(['home.title', 'home.cta', 'footer', 'extra']);
    expect(component.missingCount).toBe(2);
    expect(component.filledCount).toBe(2);
    component.filterMissing();
    expect(component.filteredKeys.map(k => k.path)).toEqual(['home.cta', 'footer']);
    expect(component.getCurrentLangMeta()?.name).toBe('English');
    flush();
  }));

  /**
   * @description Search matches key paths and values (case-insensitive); reset shows everything.
   * @input  searchQuery 'KONTAKT'; applyFilter(); resetFilter()
   * @output filtered ['home.cta']; after reset 3 keys
   */
  it('searches in keys and values', fakeAsync(() => {
    component.ngOnInit();
    component.searchQuery = 'KONTAKT';
    component.applyFilter();
    expect(component.filteredKeys.map(k => k.path)).toEqual(['home.cta']);
    component.resetFilter();
    expect(component.filteredKeys.length).toBe(3);
    flush();
  }));

  /**
   * @description Editing a value updates the nested translation object and marks the page dirty.
   * @input  updateValue('home.cta', ''), updateValue('new.deep.key', 'x')
   * @output home.cta missing; translations.new.deep.key 'x'; isDirty true
   */
  it('edits values in the nested translations', fakeAsync(() => {
    component.ngOnInit();
    component.updateValue('home.cta', '');
    component.updateValue('new.deep.key', 'x');
    expect(component.flattenedKeys.find(k => k.path === 'home.cta')!.missing).toBeTrue();
    expect(component.translations.new.deep.key).toBe('x');
    expect(component.isDirty).toBeTrue();
    flush();
  }));

  /**
   * @description Saving posts the whole language to the web module and clears the dirty flag.
   * @input  updateValue('footer', 'Nová'); onSubmit()
   * @output post('save_translations/web', { lang: 'cz', data: { …, footer: 'Nová' } }); isDirty false; success alert
   */
  it('saves the translations of the current language', fakeAsync(() => {
    component.ngOnInit();
    component.updateValue('footer', 'Nová');
    component.onSubmit();
    expect((ctx.dataHandler as any).post).toHaveBeenCalledWith('save_translations/web',
      { lang: 'cz', data: jasmine.objectContaining({ footer: 'Nová' }) });
    expect(component.isDirty).toBeFalse();
    expect(ctx.alert.open).toHaveBeenCalledWith('edit-website.admin_title', 'edit-website.translations_saved_message', 'success');
    flush();
  }));

  /**
   * @description A failed save keeps the changes and reports the error.
   * @input  post fails; onSubmit()
   * @output alert ('shared.error', 'edit-website.save_failed_message', 'danger'); isDirty still true
   */
  it('reports a failed save', fakeAsync(() => {
    component.ngOnInit();
    component.updateValue('footer', 'Nová');
    (ctx.dataHandler as any).post.and.returnValue(throwError(() => new Error('x')));
    component.onSubmit();
    expect(ctx.alert.open).toHaveBeenCalledWith('shared.error', 'edit-website.save_failed_message', 'danger');
    expect(component.isDirty).toBeTrue();
    flush();
  }));

  /**
   * @description Without 'web-edit-website-update' nothing can be saved.
   * @input  granted ['web-edit-website-view']; onSubmit()
   * @output canUpdate false; post not called
   */
  it('requires the web-edit-website-update permission to save', fakeAsync(async () => {
    fixture.destroy();
    TestBed.resetTestingModule();
    await setup(['web-edit-website-view']);
    component.ngOnInit();
    component.onSubmit();
    expect(component.canUpdate).toBeFalse();
    expect((ctx.dataHandler as any).post).not.toHaveBeenCalled();
    flush();
  }));

  /**
   * @description A language without a translation file starts as an empty copy of the Czech keys.
   * @input  languages cz, de; translations/web/de → 404; loadLang('de')
   * @output 3 keys, all missing; info alert 'edit-website.translations_not_found_message'
   */
  it('starts an empty translation when the file does not exist', fakeAsync(() => {
    component.ngOnInit();
    component.loadLang('de');
    expect(component.totalCount).toBe(3);
    expect(component.missingCount).toBe(3);
    expect(ctx.alert.open).toHaveBeenCalledWith('edit-website.info_title', 'edit-website.translations_not_found_message', 'info');
    flush();
  }));

  /**
   * @description When the language list cannot be loaded, the last list from localStorage (or Czech only) is used.
   * @input  languages request fails; localStorage holds [{ code: 'sk' }]; then nothing stored
   * @output languages ['sk']; then ['cz'] (built-in)
   */
  it('falls back to the stored or built-in languages', fakeAsync(() => {
    answer({ 'languages/web': throwError(() => new Error('x')) });
    spyOn(console, 'error');
    localStorage.setItem('rpsw_languages', JSON.stringify([{ code: 'sk', name: 'Slovenčina', active: true }]));
    component.ngOnInit();
    expect(component.languages.map(l => l.code)).toEqual(['sk']);
    localStorage.removeItem('rpsw_languages');
    component.ngOnInit();
    expect(component.languages.map(l => l.code)).toEqual(['cz']);
    flush();
  }));

  /**
   * @description A new language needs a valid unique code (2–5 letters) and a name.
   * @input  confirmAddLang() with '' / 'x1' / 'en' / 'SK' + 'Slovenčina'
   * @output errors code_and_name_required_error, code_format_error, code_already_exists_error; then upload('languages/web', FormData) with 'sk'
   */
  it('validates and adds a new language', fakeAsync(() => {
    component.ngOnInit();
    component.openAddForm();
    component.confirmAddLang();
    expect(component.addFormError).toBe('edit-website.code_and_name_required_error');
    component.newLangName = 'Test';
    component.newLangCode = 'x1';
    component.confirmAddLang();
    expect(component.addFormError).toBe('edit-website.code_format_error');
    component.newLangCode = 'en';
    component.confirmAddLang();
    expect(component.addFormError).toBe('edit-website.code_already_exists_error');
    component.newLangCode = ' SK ';
    component.newLangName = 'Slovenčina';
    component.confirmAddLang();
    const [url, fd] = (ctx.dataHandler as any).upload.calls.mostRecent().args;
    expect(url).toBe('languages/web');
    expect(JSON.parse((fd as FormData).get('languages') as string).map((l: any) => l.code)).toEqual(['cz', 'en', 'sk']);
    expect((fd as FormData).get('module')).toBe('web');
    expect(component.currentLang).toBe('sk');
    expect(component.showAddForm).toBeFalse();
    flush();
  }));

  /**
   * @description Deleting the current language switches back to Czech and reloads the list.
   * @input  loadLang('en'); askDeleteLang(en); confirmDeleteLang()
   * @output delete('languages/web/en'); currentLang 'cz'; langToDelete null
   */
  it('deletes a language', fakeAsync(() => {
    component.ngOnInit();
    component.loadLang('en');
    component.askDeleteLang(component.languages[1]);
    component.confirmDeleteLang();
    expect((ctx.dataHandler as any).delete).toHaveBeenCalledWith('languages/web/en');
    expect(component.currentLang).toBe('cz');
    expect(component.langToDelete).toBeNull();
    flush();
  }));

  /**
   * @description A failed toggle of the active flag is rolled back.
   * @input  upload fails; toggleLangActive(en)
   * @output en.active true again; alert 'edit-website.toggle_failed_error'
   */
  it('rolls back a failed language toggle', fakeAsync(() => {
    component.ngOnInit();
    (ctx.dataHandler as any).upload.and.returnValue(throwError(() => new Error('x')));
    component.toggleLangActive(component.languages[1]);
    expect(component.languages[1].active).toBeTrue();
    expect(ctx.alert.open).toHaveBeenCalledWith('shared.error', 'edit-website.toggle_failed_error', 'danger');
    flush();
  }));

  /**
   * @description The page renders the language tabs and the key statistics.
   * @input  detectChanges() after loading
   * @output text contains 'English' and 'edit-website.page_title'
   */
  it('renders the editor', fakeAsync(() => {
    fixture.detectChanges();
    flush();
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('edit-website.page_title');
    expect(text).toContain('English');
    discardPeriodicTasks();
  }));
});
