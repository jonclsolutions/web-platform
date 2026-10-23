/**
 * @file edit-legal.component.spec.ts
 * @path src/app/admin/core-pages/edit-legal/edit-legal.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of EditLegalComponent – editing the legal documents (terms, privacy …)
 *   section by section per language: tabs, languages, missing translations per position,
 *   inline edit, add and delete of sections.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (DataHandler spy, confirm/alert spies, i18n stub),
 *   ResourceCacheService (real)
 */

import { ComponentFixture, TestBed, fakeAsync, flush, discardPeriodicTasks } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { EditLegalComponent } from './edit-legal.component';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('EditLegalComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<EditLegalComponent>;
  let component: EditLegalComponent;

  const types = [{ id: 1, slug: 'tos', title: 'Terms' }, { id: 2, slug: 'gdpr', title: 'Privacy' }];
  const languages = { languages: [{ code: 'cz', name: 'Čeština', active: true }, { code: 'en', name: 'English', active: true }, { code: 'de', name: 'Deutsch', active: false }] };
  /** sections[typeId][lang] */
  let sections: Record<number, Record<string, any[]>>;

  beforeEach(async () => {
    sections = {
      1: {
        cz: [{ id: 11, document_type_id: 1, position: 1, heading: 'Úvod', content: 'a' }, { id: 12, document_type_id: 1, position: 2, heading: 'Platby', content: 'b' }],
        en: [{ id: 21, document_type_id: 1, position: 1, heading: 'Intro', content: 'a' }]
      },
      2: { cz: [], en: [] }
    };
    ctx = createAdminTestContext();
    ctx.i18n.getMergedSection.and.returnValue({
      warning_count_singular: 'warning', warning_count_plural: 'warnings', empty_no_sections: 'No sections in {lang}',
      missing_tag_title: 'Missing in {langs}', missing_tag_text: '{count} missing', new_section_title: 'New in {tab} ({lang})',
      position_fill_tag: 'Position {pos}', add_section_to: 'Add to {tab} ({lang})', add_position_button: 'Add {pos}'
    });
    (ctx.dataHandler as any).getCollection.and.callFake((url: string) => {
      if (url === 'legal/document-types') return of(types);
      if (url === 'languages/web') return of(languages);
      const m = /document_type_id=(\d+)&lang=(\w+)/.exec(url);
      return of(m ? (sections[+m[1]]?.[m[2]] ?? []) : []);
    });
    await TestBed.configureTestingModule({ imports: [EditLegalComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(EditLegalComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  const init = () => { component.ngOnInit(); };

  /**
   * @description Init loads the document types (first tab active), the active web languages and the sections.
   * @input  ngOnInit()
   * @output activeTabId 1; languages cz, en (inactive de left out); data = 2 cz sections of type 1
   */
  it('loads types, languages and sections', fakeAsync(() => {
    init();
    expect(component.activeTabId).toBe(1);
    expect(component.languages.map(l => l.code)).toEqual(['cz', 'en']);
    expect(component.data.map(s => s.id)).toEqual([11, 12]);
    expect((ctx.dataHandler as any).getCollection).toHaveBeenCalledWith('legal/document-sections?no_pagination=true&document_type_id=1&lang=cz');
    discardPeriodicTasks();
  }));

  /**
   * @description Positions missing in a language are reported (here position 2 missing in EN).
   * @input  cz positions [1, 2], en positions [1]
   * @output missingSummary { 2: ['en'] }; langHasWarning('en') true; totalWarningsLabel '1 warning'; missingPositionsForCurrentLang [] in cz
   */
  it('reports positions missing in other languages', fakeAsync(() => {
    init();
    expect(component.missingSummary).toEqual({ 2: ['en'] });
    expect(component.langHasWarning('en')).toBeTrue();
    expect(component.langHasWarning('cz')).toBeFalse();
    expect(component.totalWarningsLabel).toBe('1 warning');
    expect(component.missingPositionsForCurrentLang).toEqual([]);
    component.switchLang('en');
    expect(component.missingPositionsForCurrentLang).toEqual([2]);
    discardPeriodicTasks();
  }));

  /**
   * @description Switching language or tab loads that combination and resets the edit state.
   * @input  startEdit(section 11); switchLang('en'); switchTab(2)
   * @output data [21] after the language switch; editingIds empty; data [] for tab 2; emptyMessage 'No sections in English'
   */
  it('switches language and tab', fakeAsync(() => {
    init();
    component.startEdit(component.data[0]);
    component.switchLang('en');
    expect(component.data.map(s => s.id)).toEqual([21]);
    expect(component.editingIds.size).toBe(0);
    component.switchTab(2);
    expect(component.data).toEqual([]);
    expect(component.emptyMessage).toBe('No sections in English');
    expect(component.tabLabel).toBe('Privacy');
    discardPeriodicTasks();
  }));

  /**
   * @description Saving an edited section sends heading, content and the active language.
   * @input  startEdit(section 11); change content to 'new'; saveEdit()
   * @output put('legal/document-sections/11', { …section, heading: 'Úvod', content: 'new', lang: 'cz' }); edit closed; success alert
   */
  it('saves an edited section', fakeAsync(() => {
    init();
    const item = component.data[0];
    component.startEdit(item);
    component.editBuffer[item.id].content = 'new';
    component.saveEdit(item);
    expect((ctx.dataHandler as any).put).toHaveBeenCalledWith('legal/document-sections/11',
      jasmine.objectContaining({ id: 11, heading: 'Úvod', content: 'new', lang: 'cz' }));
    expect(component.isEditing(11)).toBeFalse();
    expect(ctx.alert.open).toHaveBeenCalledWith('shared.success', 'edit-legal.save_success', 'success');
    discardPeriodicTasks();
  }));

  /**
   * @description Empty content is not saved.
   * @input  content '   '; saveEdit()
   * @output warning alert 'edit-legal.content_empty_error'; put not called
   */
  it('rejects empty content', fakeAsync(() => {
    init();
    const item = component.data[0];
    component.startEdit(item);
    component.editBuffer[item.id].content = '   ';
    component.saveEdit(item);
    expect(ctx.alert.open).toHaveBeenCalledWith('shared.error', 'edit-legal.content_empty_error', 'warning');
    expect((ctx.dataHandler as any).put).not.toHaveBeenCalled();
    discardPeriodicTasks();
  }));

  /**
   * @description A new section is added at the end, or at the chosen missing position.
   * @input  openAddForm(); heading 'H', content 'C'; submitAdd(); then openAddForm(2) in EN
   * @output post with position 3 (2 sections + 1), lang 'cz'; second post position 2, lang 'en'
   */
  it('adds sections at the end or at a missing position', fakeAsync(() => {
    init();
    component.openAddForm();
    component.newHeading = 'H';
    component.newContent = 'C';
    component.submitAdd();
    expect((ctx.dataHandler as any).post).toHaveBeenCalledWith('legal/document-sections',
      { document_type_id: 1, heading: 'H', content: 'C', position: 3, lang: 'cz' });
    component.switchLang('en');
    component.openAddForm(2);
    component.newHeading = 'H2';
    component.newContent = 'C2';
    component.submitAdd();
    expect((ctx.dataHandler as any).post.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({ position: 2, lang: 'en' }));
    expect(component.showAddForm).toBeFalse();
    expect(ctx.alert.open).toHaveBeenCalledWith('shared.success', 'edit-legal.add_success', 'success');
    flush();
    discardPeriodicTasks();
  }));

  /**
   * @description Adding needs both heading and content.
   * @input  heading '' content 'C'; submitAdd()
   * @output warning alert; post not called
   */
  it('requires heading and content for a new section', fakeAsync(() => {
    init();
    component.newHeading = '';
    component.newContent = 'C';
    component.submitAdd();
    expect(ctx.alert.open).toHaveBeenCalledWith('edit-legal.add_validation_title', 'edit-legal.add_required_error', 'warning');
    expect((ctx.dataHandler as any).post).not.toHaveBeenCalled();
    discardPeriodicTasks();
  }));

  /**
   * @description Deleting asks with the section heading and language, then deletes and reloads.
   * @input  delete_confirm_message '{heading} {lang}'; confirmDelete(section 11), confirm → true
   * @output confirm message 'Úvod CZ'; delete('legal/document-sections/11'); success alert
   */
  it('deletes a section after confirmation', async () => {
    ctx.i18n.getValue.and.callFake((p: string) => (p === 'edit-legal.delete_confirm_message' ? '{heading} {lang}' : p));
    init();
    await component.confirmDelete(component.data[0]);
    expect(ctx.confirm.open).toHaveBeenCalledWith('edit-legal.delete_confirm_title', 'Úvod CZ');
    expect((ctx.dataHandler as any).delete).toHaveBeenCalledWith('legal/document-sections/11');
    expect(ctx.alert.open).toHaveBeenCalledWith('shared.success', 'edit-legal.delete_success', 'success');
  });

  /**
   * @description A failed save shows the error alert and keeps editing possible.
   * @input  put fails; saveEdit()
   * @output alert ('shared.error', 'edit-legal.save_error', 'danger'); saving false; still editing
   */
  it('reports a failed save', fakeAsync(() => {
    init();
    const item = component.data[0];
    component.startEdit(item);
    (ctx.dataHandler as any).put.and.returnValue(throwError(() => new Error('x')));
    component.saveEdit(item);
    expect(ctx.alert.open).toHaveBeenCalledWith('shared.error', 'edit-legal.save_error', 'danger');
    expect(component.saving).toBeFalse();
    expect(component.isEditing(11)).toBeTrue();
    discardPeriodicTasks();
  }));

  /**
   * @description Labels are built from the translated templates.
   * @input  tab 1 (Terms), lang cz; section at position 2 missing in en
   * @output newSectionTitle 'New in Terms (Čeština)'; missingTagTitle 'Missing in en'; missingTagText '1 missing'; addPositionButtonLabel(2) 'Add 2'
   */
  it('builds the translated labels', fakeAsync(() => {
    init();
    expect(component.newSectionTitle).toBe('New in Terms (Čeština)');
    expect(component.missingTagTitle(component.data[1])).toBe('Missing in en');
    expect(component.missingTagText(component.data[1])).toBe('1 missing');
    expect(component.addPositionButtonLabel(2)).toBe('Add 2');
    expect(component.getLangName('xx')).toBe('XX');
    discardPeriodicTasks();
  }));

  /**
   * @description The page renders the tabs.
   * @input  detectChanges()
   * @output text contains 'Terms' and 'Privacy'
   */
  it('renders the document tabs', fakeAsync(() => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Terms');
    expect(fixture.nativeElement.textContent).toContain('Privacy');
    flush();
    discardPeriodicTasks();
  }));
  /**
   * @description Failures: document types / languages / sections unavailable, add and delete
   *   errors (translated alerts), no tab → nothing sent; the current language missing in the list
   *   switches to the first one; missing-position helpers.
   * @input types error; languages without 'cz'; sections error; post error; delete error; activeTabId null.
   * @output types []; activeLang 'en'; data []; alerts add_error / delete_error; no post without a tab.
   */
  it('handles failing requests', fakeAsync(async () => {
    (ctx.dataHandler as any).getCollection.and.callFake((url: string) => {
      if (url === 'legal/document-types') return throwError(() => new Error('x'));
      if (url === 'languages/web') return of({ languages: [{ code: 'en', name: 'English', active: true }] });
      return throwError(() => new Error('x'));
    });
    init();
    expect(component.documentTypes).toEqual([]);
    expect(component.activeLang).toBe('en');
    expect(component.data).toEqual([]);
    expect(component.missingPositionsForCurrentLang).toEqual([]);
    expect(component.positionFillTagText(4)).toBe('Position 4');

    component.newHeading = 'H';
    component.newContent = 'C';
    component.activeTabId = null;
    component.submitAdd();
    expect((ctx.dataHandler as any).post).not.toHaveBeenCalled();
    component.activeTabId = 1;
    (ctx.dataHandler as any).post.and.returnValue(throwError(() => new Error('x')));
    component.submitAdd();
    expect(ctx.alert.open).toHaveBeenCalledWith('shared.error', 'edit-legal.add_error', 'danger');
    expect(component.saving).toBeFalse();

    (ctx.dataHandler as any).delete.and.returnValue(throwError(() => new Error('x')));
    await component.confirmDelete({ id: 5, heading: 'X', position: 1 } as any);
    expect(ctx.alert.open).toHaveBeenCalledWith('shared.error', 'edit-legal.delete_error', 'danger');
    flush();
    discardPeriodicTasks();
  }));
});
