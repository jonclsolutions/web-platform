/**
 * @file translation-languages.component.spec.ts
 * @path src/app/admin/components/translation-editor/translation-languages/translation-languages.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the languages window of a translation editor: the actions of a row
 *   call the editor and announce a change, closing announces `closed`, the window is shown only
 *   while `open`. The whole behaviour with a real editor is tested by the pages that use it
 *   (edit-website.component.spec.ts, web-text-editor.component.spec.ts).
 * @dependencies TranslationLanguagesComponent
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslationLanguagesComponent } from './translation-languages.component';
import { BaseTranslationEditorComponent, LangMeta } from '../base-translation-editor.component';

describe('TranslationLanguagesComponent', () => {
  let fixture: ComponentFixture<TranslationLanguagesComponent>;
  let component: TranslationLanguagesComponent;
  let editor: jasmine.SpyObj<BaseTranslationEditorComponent>;
  const en: LangMeta = { code: 'en', name: 'English', active: true } as LangMeta;

  beforeEach(() => {
    editor = jasmine.createSpyObj<BaseTranslationEditorComponent>('editor',
      ['toggleLangActive', 'openUploadModal', 'askDeleteLang', 'openAddForm', 'downloadSavedJson', 't', 'trackByCode', 'onLangCodeInput', 'closeAddForm', 'confirmAddLang', 'onIconFileSelected', 'clearIconSelection',
        'loadCompleteness', 'canActivate', 'missingSummary', 'lacksTexts', 'missingPartsOf', 'showMissingIn', 'canOpenMissingPart', 'openMissingPart']);
    editor.t.and.callFake((key: string) => key);
    editor.canActivate.and.returnValue(true);
    editor.missingSummary.and.returnValue('');
    editor.lacksTexts.and.returnValue(false);
    Object.assign(editor, { languages: [en], canUpdate: true, isDirty: false, currentLang: 'cz', i18n: { getValue: (k: string) => k } });
    TestBed.configureTestingModule({ imports: [TranslationLanguagesComponent] });
    fixture = TestBed.createComponent(TranslationLanguagesComponent);
    component = fixture.componentInstance;
    component.e = editor;
  });

  afterEach(() => fixture.destroy());

  /**
   * @description Turning on / off, upload, delete and a new language call the editor and announce
   *   a change; the download only calls the editor; closing announces `closed`.
   * @input manageToggle / manageUpload / manageDelete / manageAdd / manageDownload(en), closeManage
   * @output editor calls; changed 4×; closed 1×
   */
  it('runs the actions of the languages and announces them', () => {
    let changed = 0;
    let closed = 0;
    component.changed.subscribe(() => changed++);
    component.closed.subscribe(() => closed++);
    component.manageToggle(en);
    component.manageUpload(en);
    component.manageDelete(en);
    component.manageAdd();
    component.manageDownload(en);
    component.closeManage();
    expect(editor.toggleLangActive).toHaveBeenCalledWith(en);
    expect(editor.openUploadModal).toHaveBeenCalledWith('en');
    expect(editor.askDeleteLang).toHaveBeenCalledWith(en);
    expect(editor.openAddForm).toHaveBeenCalled();
    expect(editor.downloadSavedJson).toHaveBeenCalledWith('en');
    expect(changed).toBe(4);
    expect(closed).toBe(1);
  });

  /**
   * @description The window is drawn only while `open`; a row per language.
   * @input open false; open true
   * @output no row; one row (EN)
   */
  it('shows the window only while open', () => {
    fixture.detectChanges();
    expect(document.querySelector('.ew-manage-row')).toBeNull();
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    expect(document.querySelectorAll('.ew-manage-row').length).toBe(1);
  });

  /**
   * @description A language is switched on only complete: opening the window asks what the
   *   languages lack; a switched off incomplete language has its switch-on disabled with what is
   *   missing - every part a button to where it is filled in (the window closes), a part without
   *   a place to open is plain text; a switched on one that lacks texts says the visitors see
   *   'Cannot load text'. A new language is created switched off.
   * @input DE off lacking Texty 3 + FAQ 2 + Other 1 (cannot be opened), EN on lacking Texty 1;
   *   open; click "FAQ 2" of DE; the add form
   * @output loadCompleteness once; DE switch-on disabled + activate_incomplete_note with the
   *   buttons 'Texty 3', 'FAQ 2' and the text 'Other 1'; EN enabled + active_incomplete_note;
   *   openMissingPart('de', 'faq'), closed; the add form without the active box, with
   *   new_language_off_note
   */
  it('switches on only a complete language and says what is missing', () => {
    const de = { code: 'de', name: 'Deutsch', active: false } as LangMeta;
    Object.assign(editor, { languages: [en, de] });
    editor.canActivate.and.callFake((lang: LangMeta) => lang.active);
    editor.missingSummary.and.callFake((code: string) => (code === 'de' ? 'Texty 3' : 'Texty 1'));
    editor.missingPartsOf.and.callFake((code: string) => code === 'de'
      ? [{ part: 'texts', label: 'Texty', count: 3 }, { part: 'faq', label: 'FAQ', count: 2 }, { part: 'other', label: 'Other', count: 1 }]
      : [{ part: 'texts', label: 'Texty', count: 1 }]);
    editor.canOpenMissingPart.and.callFake((part: string) => part !== 'other');
    editor.lacksTexts.and.returnValue(true);
    let closed = 0;
    component.closed.subscribe(() => closed++);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    expect(editor.loadCompleteness).toHaveBeenCalledTimes(1);
    const rows = Array.from(document.querySelectorAll('.ew-manage-row')) as HTMLElement[];
    expect((rows[1].querySelector('.ew-manage-toggle') as HTMLButtonElement).disabled).toBeTrue();
    expect(rows[1].querySelector('.ew-manage-missing')!.textContent).toContain('activate_incomplete_note');
    expect((rows[0].querySelector('.ew-manage-toggle') as HTMLButtonElement).disabled).toBeFalse();
    expect(rows[0].querySelector('.ew-manage-missing')!.textContent).toContain('active_incomplete_note');
    const parts = Array.from(rows[1].querySelectorAll('.ew-missing-part')) as HTMLElement[];
    expect(parts.map(part => [part.tagName, part.textContent!.trim()])).toEqual([['BUTTON', 'Texty 3'], ['BUTTON', 'FAQ 2'], ['SPAN', 'Other 1']]);
    parts[1].click();
    expect(editor.openMissingPart).toHaveBeenCalledWith('de', 'faq');
    expect(closed).toBe(1);

    fixture.componentRef.setInput('open', false);
    Object.assign(editor, { showAddForm: true, newLangCode: '', newLangName: '' });
    fixture.detectChanges();
    expect(document.querySelector('.ew-checkbox')).toBeNull();
    expect(document.body.textContent).toContain('new_language_off_note');
  });

  /**
   * @description The code field of a new language takes at most 2 characters and hands every
   *   input to the editor (which keeps only the letters).
   * @input showAddForm; type 'tu' into the code field
   * @output maxlength 2; onLangCodeInput called
   */
  it('limits the code field of a new language to 2 characters', () => {
    Object.assign(editor, { showAddForm: true, newLangCode: '', newLangName: '', newLangActive: false });
    fixture.detectChanges();
    const field = document.querySelector('.ew-input--mono') as HTMLInputElement;
    expect(field.maxLength).toBe(2);
    field.value = 'tu';
    field.dispatchEvent(new Event('input'));
    expect(editor.onLangCodeInput).toHaveBeenCalled();
  });
});
