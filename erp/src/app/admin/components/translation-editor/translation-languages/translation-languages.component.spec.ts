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
      ['toggleLangActive', 'openUploadModal', 'askDeleteLang', 'openAddForm', 'downloadSavedJson', 't', 'trackByCode', 'onLangCodeInput', 'closeAddForm', 'confirmAddLang', 'onIconFileSelected', 'clearIconSelection']);
    editor.t.and.callFake((key: string) => key);
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
   * @description The code field of a new language takes at most 2 characters and hands every
   *   input to the editor (which keeps only the letters).
   * @input showAddForm; type 'tu' into the code field
   * @output maxlength 2; onLangCodeInput called
   */
  it('limits the code field of a new language to 2 characters', () => {
    Object.assign(editor, { showAddForm: true, newLangCode: '', newLangName: '', newLangActive: true });
    fixture.detectChanges();
    const field = document.querySelector('.ew-input--mono') as HTMLInputElement;
    expect(field.maxLength).toBe(2);
    field.value = 'tu';
    field.dispatchEvent(new Event('input'));
    expect(editor.onLangCodeInput).toHaveBeenCalled();
  });
});
