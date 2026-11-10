/**
 * @file faq-editor.component.spec.ts
 * @path src/app/admin/web-pages/edit-website/content-editors/faq-editor/faq-editor.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of FaqEditorComponent (and the shared I18nContentEditorBase): loading the
 *   FAQ with the active web languages, missing translations per language / category / field,
 *   unsaved state (output for the host tab), adding / reordering / moving / removing, discard,
 *   saving the whole FAQ, read-only mode without the update permission and the load error.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (DataHandler / permission / i18n / alert stubs).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { FaqEditorComponent } from './faq-editor.component';
import { AdminTestContext, createAdminTestContext } from '../../../../../../testing/admin-test-helpers';

describe('FaqEditorComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<FaqEditorComponent>;
  let component: FaqEditorComponent;
  let dirty: boolean[];

  const languages = [{ code: 'cz', name: 'Čeština', active: true }, { code: 'en', name: 'English', active: true }, { code: 'de', name: 'Deutsch', active: false }];
  const rows = () => [
    { id: 1, name_i18n: { cz: 'Obecné', en: 'General' }, items: [
      { id: 10, question_i18n: { cz: 'Q1?', en: 'Q1 EN?' }, answer_i18n: { cz: 'A1', en: 'A1 EN' } },
      { id: 11, question_i18n: { cz: 'Q2?' }, answer_i18n: { cz: 'A2' } },
    ] },
    { id: 2, name_i18n: { cz: 'Ceny' }, items: [] },
  ];

  /** Creates the editor; `get` answers the GET requests. */
  const create = (get?: (url: string) => any) => {
    (ctx.dataHandler as any).get.and.callFake(get ?? ((url: string) => of(url === 'languages/web' ? languages : rows())));
    fixture = TestBed.createComponent(FaqEditorComponent);
    component = fixture.componentInstance;
    dirty = [];
    component.dirtyChange.subscribe(d => dirty.push(d));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    ctx = createAdminTestContext();
    await TestBed.configureTestingModule({ imports: [FaqEditorComponent], providers: ctx.providers }).compileComponents();
  });

  afterEach(() => fixture?.destroy());

  /**
   * @description Loads web/faq with the active web languages; every text gets every language; the
   *   first category is expanded; nothing unsaved.
   * @input Languages cz, en, de (inactive); two categories.
   * @output get('web/faq'); languages cz, en; texts with cz + en; open [true, false]; not dirty;
   *   inputs of the first category rendered (name + 2 × question / answer).
   */
  it('loads the FAQ with the web languages', () => {
    create();
    expect((ctx.dataHandler as any).get).toHaveBeenCalledWith('web/faq');
    expect(component.languages.map(l => l.code)).toEqual(['cz', 'en']);
    expect(component.entries[1].name_i18n).toEqual({ cz: 'Ceny', en: '' });
    expect(component.entries[0].items[1].question_i18n).toEqual({ cz: 'Q2?', en: '' });
    expect(component.entries.map(c => c.open)).toEqual([true, false]);
    expect(component.isDirty).toBeFalse();
    expect(fixture.nativeElement.querySelectorAll('.ce-input').length).toBe(5);
  });

  /**
   * @description Missing translations: count per language (tab badge), per category in the edited
   *   language, the warning and the marked fields.
   * @input cz complete; en misses Ceny, Q2? and A2.
   * @output cz 0, en 3; no warning in cz; en: warning, category counts [2, 1], 2 marked fields of
   *   the expanded category + text under them.
   */
  it('counts the missing translations', () => {
    create();
    expect(component.missingCount('cz')).toBe(0);
    expect(component.missingCount('en')).toBe(3);
    expect(component.missingWarning).toBe('');

    component.switchLang('en');
    fixture.detectChanges();
    expect(component.missingWarning).toBe('web-content-editor.missing_warning');
    expect(component.entries.map(c => component.missingIn(c))).toEqual([2, 1]);
    expect(fixture.nativeElement.querySelectorAll('.ce-input--missing').length).toBe(2);
    expect(fixture.nativeElement.querySelector('.ce-warning')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.ce-lang-tab .ce-missing-count')?.textContent.trim()).toBe('3');
  });

  /**
   * @description Edits make the editor dirty (output once), discard restores the loaded state.
   * @input Change a question; discard.
   * @output dirty [true, false]; the question back; not dirty.
   */
  it('tracks unsaved changes and discards them', () => {
    create();
    component.entries[0].items[0].question_i18n['cz'] = 'Changed?';
    component.changed();
    expect(component.isDirty).toBeTrue();

    component.discard();
    expect(component.entries[0].items[0].question_i18n['cz']).toBe('Q1?');
    expect(component.isDirty).toBeFalse();
    expect(dirty).toEqual([true, false]);
  });

  /**
   * @description Adding, reordering, moving to another category and removing; the payload carries
   *   ids (null for new entries) and texts only.
   * @input addCategory; addItem to it; move it up; move Q2? to Ceny; remove Q1?; save.
   * @output PUT web/faq { categories: [new (1 empty question), Obecné (no questions), Ceny (Q2?)] };
   *   success dialog; the API answer becomes the saved state (not dirty).
   */
  it('edits the structure and saves the whole FAQ', () => {
    create();
    component.addCategory();
    const added = component.entries[2];
    component.addItem(added);
    component.move(component.entries, 2, -1);
    component.move(component.entries, 1, -1);
    expect(component.entries.map(c => c.id)).toEqual([null, 1, 2]);

    const general = component.entries[1];
    component.moveItemTo(general, 1, component.entries[2].key);
    component.remove(general.items, 0);
    expect(component.isDirty).toBeTrue();

    (ctx.dataHandler as any).put.and.returnValue(of(rows()));
    component.save();
    const [url, body] = (ctx.dataHandler as any).put.calls.mostRecent().args;
    expect(url).toBe('web/faq');
    expect(body).toEqual({ categories: [
      { id: null, name_i18n: { cz: '', en: '' }, items: [{ id: null, question_i18n: { cz: '', en: '' }, answer_i18n: { cz: '', en: '' } }] },
      { id: 1, name_i18n: { cz: 'Obecné', en: 'General' }, items: [] },
      { id: 2, name_i18n: { cz: 'Ceny', en: '' }, items: [{ id: 11, question_i18n: { cz: 'Q2?', en: '' }, answer_i18n: { cz: 'A2', en: '' } }] },
    ] });
    expect(ctx.alert.open).toHaveBeenCalledWith('web-content-editor.saved_title', 'web-content-editor.saved_message', 'success');
    expect(component.isDirty).toBeFalse();
    expect(component.saving).toBeFalse();
  });

  /**
   * @description A failed save keeps the edits; nothing is sent without changes.
   * @input save() unchanged; edit + PUT fails.
   * @output no PUT; then still dirty, not saving.
   */
  it('keeps the edits when saving fails', () => {
    create();
    component.save();
    expect((ctx.dataHandler as any).put).not.toHaveBeenCalled();

    component.addCategory();
    (ctx.dataHandler as any).put.and.returnValue(throwError(() => new Error('422')));
    component.save();
    expect(component.isDirty).toBeTrue();
    expect(component.saving).toBeFalse();
  });

  /**
   * @description Without web-edit-website-update the editor is read-only.
   * @input No permissions.
   * @output canUpdate false; no save / add buttons; inputs readonly.
   */
  it('is read-only without the update permission', () => {
    ctx.permissions.granted = new Set(['web-edit-website-view']);
    create();
    expect(component.canUpdate).toBeFalse();
    expect(fixture.nativeElement.querySelector('.ce-btn-primary')).toBeNull();
    expect(fixture.nativeElement.querySelector('.ce-add-btn')).toBeNull();
    expect((fixture.nativeElement.querySelector('.ce-input') as HTMLInputElement).readOnly).toBeTrue();
  });

  /**
   * @description A failed load shows the error.
   * @input GET web/faq fails.
   * @output loadError + error text.
   */
  it('shows a failed load', () => {
    create(url => (url === 'web/faq' ? throwError(() => new Error('500')) : of(languages)));
    fixture.detectChanges();
    expect(component.loadError).toBeTrue();
    expect(fixture.nativeElement.querySelector('.ce-error')).not.toBeNull();
  });

  /**
   * @description Without languages the built-in Czech is used; an empty FAQ shows its text.
   * @input Languages fail, FAQ [].
   * @output languages ['cz']; empty text.
   */
  it('falls back to Czech without languages', () => {
    create(url => (url === 'languages/web' ? throwError(() => new Error('500')) : of([])));
    expect(component.languages.map(l => l.code)).toEqual(['cz']);
    expect(fixture.nativeElement.querySelector('.ce-empty')).not.toBeNull();
  });

  /**
   * @description With the languages of the host page the editor loads no languages itself and
   *   follows them: a deleted language disappears (the edited one falls back to the first) with
   *   all its texts (also from the saved state - a language created again with the same code
   *   starts empty), a switched off one is not offered.
   * @input hostLanguages cz + en; edit en + a cz name; host list without en; en created again;
   *   en back but inactive.
   * @output no GET languages/web; languages [cz, en]; then [cz], lang 'cz', no en texts, the cz
   *   edit kept, not dirty once undone; en again: no texts (all 6 missing); then [cz].
   */
  it('follows the languages of the host page', () => {
    (ctx.dataHandler as any).get.and.callFake((url: string) => of(url === 'languages/web' ? languages : rows()));
    fixture = TestBed.createComponent(FaqEditorComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('hostLanguages', languages.slice(0, 2));
    fixture.detectChanges();
    expect((ctx.dataHandler as any).get).not.toHaveBeenCalledWith('languages/web');
    expect(component.languages.map(l => l.code)).toEqual(['cz', 'en']);

    component.switchLang('en');
    component.entries[1].name_i18n['cz'] = 'Ceny 2';
    component.changed();
    fixture.componentRef.setInput('hostLanguages', [languages[0]]);
    fixture.detectChanges();
    expect(component.languages.map(l => l.code)).toEqual(['cz']);
    expect(component.lang).toBe('cz');
    expect(fixture.nativeElement.querySelectorAll('.ce-lang-tab').length).toBe(1);
    // The texts of the deleted language are gone (also from the saved state), other edits stay.
    expect(component.entries[0].name_i18n).toEqual({ cz: 'Obecné' });
    expect(component.entries[0].items[0].answer_i18n).toEqual({ cz: 'A1' });
    expect(component.entries[1].name_i18n).toEqual({ cz: 'Ceny 2' });
    expect(component.entries.map(c => c.open)).toEqual([true, false]);
    component.entries[1].name_i18n['cz'] = 'Ceny';
    component.changed();
    expect(component.isDirty).toBeFalse();

    fixture.componentRef.setInput('hostLanguages', languages.slice(0, 2));
    fixture.detectChanges();
    expect(component.entries[0].name_i18n['en']).toBeUndefined();
    expect(component.missingCount('en')).toBe(6);

    fixture.componentRef.setInput('hostLanguages', [languages[0], { ...languages[1], active: false }]);
    fixture.detectChanges();
    expect(component.languages.map(l => l.code)).toEqual(['cz']);
  });
});
