/**
 * @file edit-website.component.spec.ts
 * @path src/app/apps/web/admin/edit-website/edit-website.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of EditWebsiteComponent – the translation editor of the public web
 *   (module 'web'). The page only configures BaseTranslationEditorComponent, so the tests check
 *   the configuration through the real editor behaviour: languages and translations of the
 *   'web' module, missing keys against the Czech reference, editing and saving, the
 *   'web-edit-website-update' permission, adding / deleting / toggling languages, JSON upload, the
 *   "Page titles" tab (PageTitlesEditorComponent of the web pages) and the FAQ / Jobs tabs
 *   (FaqEditorComponent, JobsEditorComponent - created on the first open, kept when hidden).
 * @dependencies
 * - src/testing/admin-test-helpers.ts (DataHandler spy, permission stub, alert spy, i18n stub),
 *   ResourceCacheService (real)
 */

import { ComponentFixture, TestBed, fakeAsync, flush, discardPeriodicTasks } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { By } from '@angular/platform-browser';
import { PageTitlesEditorComponent } from '../../../../admin/components/page-titles-editor/page-titles-editor.component';
import { EditWebsiteComponent } from './edit-website.component';
import { FaqEditorComponent } from './content-editors/faq-editor/faq-editor.component';
import { JobsEditorComponent } from './content-editors/jobs-editor/jobs-editor.component';
import { ReferencesEditorComponent } from './content-editors/references-editor/references-editor.component';
import { KnowledgeBaseEditorComponent } from './content-editors/knowledge-base-editor/knowledge-base-editor.component';
import { AdminTestContext, createAdminTestContext } from '../../../../../testing/admin-test-helpers';

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
      if (url === 'languages/web') return of(JSON.parse(JSON.stringify(languages)));
      if (url === 'translations/web/cz') return of(JSON.parse(JSON.stringify(cz)));
      if (url === 'translations/web/en') return of(JSON.parse(JSON.stringify(en)));
      return throwError(() => new Error('404'));
    });
  };

  const setup = async (granted: string[] | 'all' = 'all') => {
    localStorage.removeItem('jsw_languages');
    ctx = createAdminTestContext({ granted });
    answer();
    await TestBed.configureTestingModule({ imports: [EditWebsiteComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(EditWebsiteComponent);
    component = fixture.componentInstance;
  };

  beforeEach(async () => { await setup(); });
  afterEach(() => { fixture.destroy(); localStorage.removeItem('jsw_languages'); });

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
    expect(JSON.parse(localStorage.getItem('jsw_languages')!)[0].code).toBe('cz');
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
    localStorage.setItem('jsw_languages', JSON.stringify([{ code: 'sk', name: 'Slovenčina', active: true }]));
    component.ngOnInit();
    expect(component.languages.map(l => l.code)).toEqual(['sk']);
    localStorage.removeItem('jsw_languages');
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

  /**
   * @description Calmer actions (`compactActions`, pilot on this page): the JSON download /
   *   upload are in the "⋯ Akce" menu of the page header, not in the sticky bar - it keeps only
   *   the save button, labelled with the count of the changed texts; the menu items run the
   *   download / upload; saving clears the count; the phone save bar exists only with changes.
   * @input  render; updateValue ×2 (two texts, one twice); onSubmit()
   * @output the "Jazyky" button in the header (no Akce menu), no JSON buttons in .ew-topbar; no .ew-savebar; label
   *   'edit-website.save_changes_count' (the page section first) with 2 changes; .ew-savebar present;
   *   after save 0 changes and no .ew-savebar
   */
  it('keeps the rare JSON actions in the menu and only the save button in the bar', fakeAsync(() => {
    fixture.detectChanges();
    flush();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const view = fixture.debugElement.query(By.css('app-translation-editor-view')).componentInstance;
    expect(view.compactActions).toBeTrue();
    expect(el.querySelector('app-page-header .ew-langs-btn')).not.toBeNull();
    expect(el.querySelector('app-page-header app-action-menu-builder')).toBeNull();
    expect(el.querySelectorAll('.ew-topbar-right .ew-btn--ghost').length).toBe(0);
    expect(el.querySelector('.ew-savebar')).toBeNull();

    component.updateValue('footer', 'Nová');
    component.updateValue('home.title', 'Úvod');
    component.updateValue('footer', 'Novější');
    fixture.detectChanges();
    expect(component.changedPaths.size).toBe(2);
    expect(view.saveLabel).toBe('edit-website.save_changes_count');
    expect(el.querySelector('.ew-savebar')).not.toBeNull();

    component.onSubmit();
    flush();
    fixture.detectChanges();
    expect(component.changedPaths.size).toBe(0);
    expect(el.querySelector('.ew-savebar')).toBeNull();
    discardPeriodicTasks();
  }));

  /**
   * @description Everything about the languages in one window behind the "Jazyky" button: the
   *   tabs only switch the language (no small action icons); a row per language with its state;
   *   the main language can only download / upload its JSON; download fetches the SAVED JSON of
   *   any language and the row of the open language with unsaved edits says so; turning on / off
   *   stays in the window; upload / delete / a new language close it and open their own window.
   * @input  render; openManage(); edit a text; download CZ and EN; toggle EN; upload EN; reopen,
   *   delete EN; reopen, add
   * @output no .ew-lang-tab-actions, no letter stand-ins (codes CZ, EN), no "+ Přidat jazyk" tab;
   *   2 rows - CZ main with
   *   [download, upload], EN with 4 actions;
   *   note only in the CZ row after the edit; get('translations/web/cz') + ('translations/web/en')
   *   and 2 files; toggleLangActive(EN) with the window open; openUploadModal('en') and closed;
   *   askDeleteLang(EN); openAddForm()
   */
  it('manages the languages and their JSON in one window', fakeAsync(() => {
    fixture.detectChanges();
    flush();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const view = fixture.debugElement.query(By.css('app-translation-editor-view')).componentInstance;
    expect(el.querySelectorAll('.ew-lang-tab').length).toBeGreaterThan(1);
    expect(el.querySelector('.ew-lang-tab-actions')).toBeNull();
    // A language without a flag shows only its code - no letter stand-in next to it.
    expect(el.querySelector('.ew-lang-tab .ew-lang-icon-placeholder')).toBeNull();
    expect(Array.from(el.querySelectorAll('.ew-lang-tab .ew-lang-tab-code')).map(c => c.textContent!.trim()).slice(0, 2)).toEqual(['CZ', 'EN']);
    expect(el.querySelector('.ew-lang-panel')!.classList).toContain('ew-lang-panel--compact');
    // The row only switches the language - adding one is in the window.
    expect(el.querySelector('.ew-lang-tab--add')).toBeNull();

    (el.querySelector('.ew-langs-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    // The window lives in the document body (AdminModalComponent moves itself there).
    const rows = () => Array.from(document.querySelectorAll('.ew-manage-row')) as HTMLElement[];
    expect(rows().length).toBe(2);
    expect(rows()[0].querySelector('.ew-manage-state')!.textContent!.trim()).toBe('edit-website.built_in_label');
    expect(rows()[0].querySelectorAll('.ew-manage-actions button').length).toBe(2);
    expect(rows()[1].querySelectorAll('.ew-manage-actions button').length).toBe(4);
    expect(document.querySelector('.ew-manage-note')).toBeNull();
    expect(document.querySelector('.ew-manage-row .ew-lang-icon-placeholder')).toBeNull();

    component.updateValue('footer', 'Nová');
    (component as any).cd.markForCheck();
    fixture.detectChanges();
    expect(rows()[0].querySelector('.ew-manage-note')).not.toBeNull();
    expect(rows()[1].querySelector('.ew-manage-note')).toBeNull();

    const files: string[] = [];
    spyOn(HTMLAnchorElement.prototype, 'click').and.callFake(function (this: HTMLAnchorElement) { files.push(this.download); });
    (ctx.dataHandler as any).get.calls.reset();
    view.manageDownload(component.languages[0]);
    view.manageDownload(component.languages[1]);
    flush();
    expect((ctx.dataHandler as any).get).toHaveBeenCalledWith('translations/web/cz');
    expect((ctx.dataHandler as any).get).toHaveBeenCalledWith('translations/web/en');
    expect(files).toEqual(['cz.json', 'en.json']);

    const en = component.languages.find(l => l.code === 'en')!;
    spyOn(component, 'toggleLangActive');
    spyOn(component, 'openUploadModal');
    spyOn(component, 'askDeleteLang');
    spyOn(component, 'openAddForm');
    view.manageToggle(en);
    expect(component.toggleLangActive).toHaveBeenCalledWith(en);
    expect(view.manageOpen).toBeTrue();
    view.manageUpload(en);
    expect(component.openUploadModal).toHaveBeenCalledWith('en');
    expect(view.manageOpen).toBeFalse();
    view.openManage();
    view.manageDelete(en);
    expect(component.askDeleteLang).toHaveBeenCalledWith(en);
    view.openManage();
    view.manageAdd();
    expect(component.openAddForm).toHaveBeenCalled();
    expect(view.manageOpen).toBeFalse();
    discardPeriodicTasks();
  }));

  /**
   * @description The statistics of the whole language are one line (not narrowed by the search)
   *   and the search row has the "Chybí" toggle: only the missing texts, combined with the search;
   *   a text filled meanwhile stays in the list until the next filtering; the toggle stays while
   *   the filter is on even when nothing is missing any more; the empty list says nothing is missing.
   * @input  render; loadLang('en'); click the toggle; search 'foot'; fill footer; clear the search;
   *   fill home.cta; click the toggle; click the toggle again (nothing missing)
   * @output .ew-stats-line (no .ew-stats) 4 / 2 / 2; toggle count 2, aria-pressed false → true,
   *   ['home.cta', 'footer']; search → ['footer']; footer filled stays; reset → ['home.cta'];
   *   langMissing 0, toggle still shown, off → 4 texts; on again → empty list with no_missing_results
   */
  it('filters the missing texts with the toggle of the search row', fakeAsync(() => {
    fixture.detectChanges();
    flush();
    component.loadLang('en');
    flush();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const toggle = () => el.querySelector('.ew-controls .ew-missing-toggle') as HTMLButtonElement | null;
    const paths = () => component.filteredKeys.map(k => k.path);

    expect(el.querySelector('.ew-lang-panel .ew-stats')).toBeNull();
    expect(el.querySelectorAll('.ew-stats-line strong').length).toBe(3);
    expect(Array.from(el.querySelectorAll('.ew-stats-line strong')).map(n => n.textContent!.trim())).toEqual(['4', '2', '2']);
    expect(toggle()!.querySelector('.ew-missing-toggle-count')!.textContent!.trim()).toBe('2');
    expect(toggle()!.getAttribute('aria-pressed')).toBe('false');

    toggle()!.click();
    fixture.detectChanges();
    expect(component.onlyMissing).toBeTrue();
    expect(toggle()!.getAttribute('aria-pressed')).toBe('true');
    expect(paths()).toEqual(['home.cta', 'footer']);

    component.searchQuery = 'foot';
    component.applyFilter();
    expect(paths()).toEqual(['footer']);
    // the statistics follow the whole language, not the narrowed list
    expect(component.langTotal).toBe(4);

    component.updateValue('footer', 'Footer');
    expect(paths()).toEqual(['footer']);
    component.resetFilter();
    expect(paths()).toEqual(['home.cta']);

    component.updateValue('home.cta', 'Contact');
    fixture.detectChanges();
    expect(component.langMissing).toBe(0);
    expect(toggle()).not.toBeNull();
    toggle()!.click();
    fixture.detectChanges();
    expect(component.onlyMissing).toBeFalse();
    expect(paths().length).toBe(4);
    expect(toggle()).toBeNull();

    component.toggleMissing();
    fixture.detectChanges();
    expect(paths().length).toBe(0);
    expect(el.querySelector('.ew-empty')!.textContent).toContain('edit-website.no_missing_results');
    flush();
    discardPeriodicTasks();
  }));

  /**
   * @description "Zrušit změny" next to the save button (the sticky bar and the phone bar) - only
   *   with unsaved changes; it asks first; keeping the changes leaves them; confirming loads the
   *   saved texts again (no changes, no bottom bar).
   * @input  render; updateValue('footer', 'Nová'); click the discard of the bottom bar; keep;
   *   ask again; confirm
   * @output no discard buttons at first; .ew-discard-btn and .ew-savebar-discard after the edit;
   *   the confirmation open; kept → isDirty; confirmed → isDirty false, 0 changes, footer 'Patička',
   *   no .ew-savebar
   */
  it('discards the unsaved changes after a confirmation', fakeAsync(() => {
    fixture.detectChanges();
    flush();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const view = fixture.debugElement.query(By.css('app-translation-editor-view')).componentInstance;
    expect(el.querySelector('.ew-discard-btn')).toBeNull();
    expect(el.querySelector('.ew-savebar-discard')).toBeNull();

    component.updateValue('footer', 'Nová');
    fixture.detectChanges();
    expect(el.querySelector('.ew-topbar .ew-discard-btn')).not.toBeNull();
    (el.querySelector('.ew-savebar-discard') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(view.discardOpen).toBeTrue();
    expect(document.querySelector('.am-btn--danger')).not.toBeNull();

    view.closeDiscard();
    fixture.detectChanges();
    expect(component.isDirty).toBeTrue();
    expect(component.translations.footer).toBe('Nová');

    view.askDiscard();
    view.confirmDiscard();
    flush();
    fixture.detectChanges();
    expect(view.discardOpen).toBeFalse();
    expect(component.isDirty).toBeFalse();
    expect(component.changedPaths.size).toBe(0);
    expect(component.translations.footer).toBe('Patička');
    expect(component.flattenedKeys.find(k => k.path === 'footer')!.value).toBe('Patička');
    expect(el.querySelector('.ew-savebar')).toBeNull();
    discardPeriodicTasks();
  }));

  /**
   * @description The page also manages the browser titles of its own pages: the "Page titles" tab
   *   creates PageTitlesEditorComponent for the 'web' area on the first open; the translations
   *   are hidden, not destroyed; the editor stays created when switching back; its unsaved state
   *   puts a dot on the tab.
   * @input render; click the second tab; dirtyChange(true); click the first tab.
   * @output no editor at first; editor area 'web', endpoint 'web/page-titles', permission
   *   'web-edit-website-update', labels 'edit-website'; .ew-root hidden; dot shown; translations visible, editor hidden.
   */
  it('manages the page titles of its module in a tab', fakeAsync(() => {
    fixture.detectChanges();
    flush();
    const el: HTMLElement = fixture.nativeElement;
    const tabs = () => el.querySelectorAll('.ew-page-tabs .rbb-btn') as NodeListOf<HTMLButtonElement>;
    expect(tabs().length).toBe(6);
    expect(el.querySelector('app-page-titles-editor')).toBeNull();

    tabs()[1].click();
    fixture.detectChanges();
    const debug = fixture.debugElement.query(By.css('app-page-titles-editor'));
    const editor = debug.componentInstance as PageTitlesEditorComponent;
    expect([editor.area, editor.endpoint, editor.updatePermission, editor.labelSection])
      .toEqual(['web', 'web/page-titles', 'web-edit-website-update', 'edit-website']);
    expect((el.querySelector('.ew-root') as HTMLElement).style.display).toBe('none');
    expect(tabs()[1].getAttribute('aria-selected')).toBe('true');

    editor.dirtyChange.emit(true);
    fixture.detectChanges();
    expect(tabs()[1].querySelector('.rbb-dot')).not.toBeNull();

    tabs()[0].click();
    fixture.detectChanges();
    expect((el.querySelector('.ew-root') as HTMLElement).style.display).toBe('');
    expect((el.querySelector('.ew-titles-wrap') as HTMLElement).style.display).toBe('none');
    expect(fixture.debugElement.query(By.css('app-page-titles-editor')).componentInstance).toBe(editor);
    discardPeriodicTasks();
  }));

  /**
   * @description The FAQ, Jobs and References tabs create their editor on the first open, keep
   *   it (hidden) when another tab is shown and show a dot for unsaved changes.
   * @input  click FAQ, Jobs, FAQ again; jobs editor reports unsaved changes; click References,
   *   its editor reports unsaved changes.
   * @output faq editor created once (with the languages of the page) and shown / hidden; jobs
   *   editor created; dot on the Jobs tab; references editor created with the languages of the
   *   page, dot on its tab; knowledge base editor created with the languages of the page, dot on
   *   its tab.
   */
  it('manages the FAQ, the jobs, the references and the knowledge base in tabs', fakeAsync(() => {
    answer({ 'web/faq': of([]), 'web/jobs': of([]), 'web/references': of([]), 'web/knowledge-base': of([]) });
    fixture.detectChanges();
    flush();
    const el: HTMLElement = fixture.nativeElement;
    const tabs = () => el.querySelectorAll('.ew-page-tabs .rbb-btn') as NodeListOf<HTMLButtonElement>;
    expect(el.querySelector('app-faq-editor')).toBeNull();
    expect(el.querySelector('app-jobs-editor')).toBeNull();

    tabs()[2].click();
    fixture.detectChanges();
    const faq = fixture.debugElement.query(By.directive(FaqEditorComponent)).componentInstance as FaqEditorComponent;
    expect(component.activeTab).toBe('faq');
    expect(faq.languages.map(l => l.code)).toEqual(['cz', 'en']);
    expect((el.querySelector('.ew-root') as HTMLElement).style.display).toBe('none');

    tabs()[3].click();
    fixture.detectChanges();
    const jobs = fixture.debugElement.query(By.directive(JobsEditorComponent)).componentInstance as JobsEditorComponent;
    jobs.dirtyChange.emit(true);
    fixture.detectChanges();
    expect(tabs()[3].querySelector('.rbb-dot')).not.toBeNull();
    expect(tabs()[2].querySelector('.rbb-dot')).toBeNull();

    tabs()[2].click();
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.directive(FaqEditorComponent)).componentInstance).toBe(faq);
    expect((fixture.debugElement.query(By.directive(JobsEditorComponent)).nativeElement.parentElement as HTMLElement).style.display).toBe('none');

    expect(el.querySelector('app-references-editor')).toBeNull();
    tabs()[4].click();
    fixture.detectChanges();
    const references = fixture.debugElement.query(By.directive(ReferencesEditorComponent)).componentInstance as ReferencesEditorComponent;
    expect(component.activeTab).toBe('references');
    expect(references.languages.map(l => l.code)).toEqual(['cz', 'en']);
    references.dirtyChange.emit(true);
    fixture.detectChanges();
    expect(tabs()[4].querySelector('.rbb-dot')).not.toBeNull();

    expect(el.querySelector('app-knowledge-base-editor')).toBeNull();
    tabs()[5].click();
    fixture.detectChanges();
    const kb = fixture.debugElement.query(By.directive(KnowledgeBaseEditorComponent)).componentInstance as KnowledgeBaseEditorComponent;
    expect(component.activeTab).toBe('knowledge_base');
    expect(kb.languages.map(l => l.code)).toEqual(['cz', 'en']);
    kb.dirtyChange.emit(true);
    fixture.detectChanges();
    expect(tabs()[5].querySelector('.rbb-dot')).not.toBeNull();
    discardPeriodicTasks();
  }));
});
