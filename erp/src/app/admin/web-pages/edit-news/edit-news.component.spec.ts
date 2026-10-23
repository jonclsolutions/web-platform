/**
 * @file edit-news.component.spec.ts
 * @path src/app/admin/web-pages/edit-news/edit-news.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of EditNewsComponent and edit-news.config.ts – the news table page of
 *   the Web module: translated table / form / filter / detail configuration, theme options,
 *   form validation patterns, chartable columns, toolbar by permission and view, toolbar actions,
 *   loading of web/news after the auth check, default sorting and closing the details.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (all admin doubles)
 */

import { ComponentFixture, TestBed, fakeAsync, discardPeriodicTasks } from '@angular/core/testing';

import { EditNewsComponent } from './edit-news.component';
import { NEWS_THEMA_VALUES } from './edit-news.config';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('EditNewsComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<EditNewsComponent>;
  let component: EditNewsComponent;

  const toolbar = () => Object.fromEntries(component.toolbarButtons.map(b => [b.action, b]));
  const field = (name: string) => component.formFields.find(f => f.column_name === name)!;

  beforeEach(async () => {
    ctx = createAdminTestContext();
    await TestBed.configureTestingModule({ imports: [EditNewsComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(EditNewsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  /**
   * @description The whole page configuration is built from the 'edit-news' translations.
   * @input  component created
   * @output caption 'edit-news.table_header'; 3 row buttons; 8 form fields; 5 active and 3 trash columns; 4 filters; 11 detail columns
   */
  it('builds the page configuration from translations', () => {
    expect(component.tableCaption).toBe('edit-news.table_header');
    expect(component.buttons.map(b => b.action)).toEqual(['details', 'edit', 'delete']);
    expect(component.buttons.map(b => b.permission)).toEqual([undefined, 'web-news-update', 'web-news-delete']);
    expect(component.formFields.map(f => f.column_name)).toEqual(['title', 'thema', 'author', 'message', 'bullet_1', 'bullet_2', 'bullet_3', 'bullet_4']);
    expect(component.newsColumns.map(c => c.key)).toEqual(['id', 'title', 'thema', 'author', 'created_at']);
    expect(component.trashNewsColumns.map(c => c.key)).toEqual(['id', 'title', 'deleted_at']);
    expect(component.filterColumns.map(c => c.key)).toEqual(['id', 'title', 'author', 'thema']);
    expect(component.detailsColumns.length).toBe(11);
    expect(component.t('btn_edit')).toBe('edit-news.btn_edit');
  });

  /**
   * @description The theme select offers all 8 themes with translated labels (form and filter).
   * @input  thema form field; thema filter column
   * @output values = NEWS_THEMA_VALUES; first label 'edit-news.thema_milestone'
   */
  it('offers the translated news themes', () => {
    expect(field('thema').options!.map(o => o.value)).toEqual(NEWS_THEMA_VALUES);
    expect(field('thema').options![0].label).toBe('edit-news.thema_milestone');
    expect(component.filterColumns.find(c => c.key === 'thema')!.options!.length).toBe(8);
  });

  /**
   * @description Form patterns: title 3–255 chars, author 1–255, message up to 10 000 incl. new lines, bullets optional.
   * @input  patterns of title, author, message, bullet_1
   * @output 'ab' rejected / 'abc' ok; '' author rejected; multi-line message ok; empty bullet ok, required false
   */
  it('validates the form fields', () => {
    const re = (name: string) => new RegExp(field(name).pattern!);
    expect(re('title').test('ab')).toBeFalse();
    expect(re('title').test('abc')).toBeTrue();
    expect(re('author').test('')).toBeFalse();
    expect(re('message').test('line 1\nline 2')).toBeTrue();
    expect(re('message').test('x'.repeat(10001))).toBeFalse();
    expect(re('bullet_1').test('')).toBeTrue();
    expect(field('bullet_1').required).toBeFalse();
    expect(component.formFields.filter(f => f.required).map(f => f.column_name)).toEqual(['title', 'thema', 'author', 'message']);
  });

  /**
   * @description Only chartable detail columns go to the report builder, counted by default.
   * @input  detailsColumns (thema and author chartable)
   * @output graphColumns [{ thema, count, NEWS_THEMA_VALUES }, { author, count, undefined }]; importable keys without id/created/updated
   */
  it('offers chartable and importable columns', () => {
    expect(component.graphColumns).toEqual([
      { key: 'thema', label: 'edit-news.details_thema', aggregation: 'count', possibleValues: NEWS_THEMA_VALUES },
      { key: 'author', label: 'edit-news.details_author', aggregation: 'count', possibleValues: undefined }
    ]);
    expect(component.detailsColumns.filter(c => c.importable).map(c => c.key))
      .toEqual(['title', 'thema', 'author', 'message', 'bullet_1', 'bullet_2', 'bullet_3', 'bullet_4']);
  });

  /**
   * @description A language change rebuilds the configuration (labels follow the admin language).
   * @input  getValue returns 'EN:<path>'; translations$.next({})
   * @output tableCaption 'EN:edit-news.table_header'
   */
  it('rebuilds the configuration when translations change', () => {
    ctx.i18n.getValue.and.callFake((p: string) => `EN:${p}`);
    ctx.i18n.translations$.next({});
    expect(component.tableCaption).toBe('EN:edit-news.table_header');
    expect(component.formFields[0].label).toBe('EN:edit-news.field_title_label');
  });

  /**
   * @description Toolbar buttons without the matching permission are hidden.
   * @input  granted [] (none)
   * @output create, report and trash hidden; filters, export and import visible
   */
  it('hides toolbar buttons without permission', () => {
    ctx.permissions.granted = new Set();
    const t = toolbar();
    expect(t['handleCreateFormOpened'].showIf).toBeFalse();
    expect(t['openGraphBuilder'].showIf).toBeFalse();
    expect(t['toggleTable'].showIf).toBeFalse();
    expect(t['toggleFilters'].showIf).toBeUndefined();
    expect(t['exportActiveTable'].showIf).toBeTrue();
    expect(t['triggerImport'].showIf).toBeTrue();
  });

  /**
   * @description Default view: create/export/import visible, labels "filters" and "show trash".
   * @input  all permissions, active table, filters closed
   * @output create/export/import showIf true; filter label 'edit-news.toolbar_filters' inactive; trash label 'edit-news.toolbar_show_trash'
   */
  it('shows the default toolbar', () => {
    const t = toolbar();
    expect(t['handleCreateFormOpened'].showIf).toBeTrue();
    expect(t['exportActiveTable'].showIf).toBeTrue();
    expect(t['triggerImport'].showIf).toBeTrue();
    expect(t['toggleFilters'].label).toBe('edit-news.toolbar_filters');
    expect(t['toggleFilters'].isActive).toBeFalse();
    expect(t['toggleTable'].label).toBe('edit-news.toolbar_show_trash');
    expect(t['toggleTable'].isActive).toBeFalse();
  });

  /**
   * @description In the trash view create/export/import are hidden and the labels switch.
   * @input  showTrashTable true; isFilterVisible true
   * @output create/export/import showIf false; 'edit-news.toolbar_show_active' active; 'edit-news.toolbar_hide_filters' active
   */
  it('adapts the toolbar to the trash view and open filters', () => {
    component.showTrashTable = true;
    component.isFilterVisible = true;
    const t = toolbar();
    expect(t['handleCreateFormOpened'].showIf).toBeFalse();
    expect(t['exportActiveTable'].showIf).toBeFalse();
    expect(t['triggerImport'].showIf).toBeFalse();
    expect(t['toggleTable'].label).toBe('edit-news.toolbar_show_active');
    expect(t['toggleTable'].isActive).toBeTrue();
    expect(t['toggleFilters'].label).toBe('edit-news.toolbar_hide_filters');
    expect(t['toggleFilters'].isActive).toBeTrue();
  });

  /**
   * @description Every toolbar action calls its handler; import goes to the active table; unknown actions do nothing.
   * @input  handleToolbarAction(each action), activeTable spy; 'triggerImport' without a table; 'unknown'
   * @output toggleFilters, handleCreateFormOpened, exportActiveTable, openGraphBuilder, toggleTable called; importData() once; no error
   */
  it('dispatches the toolbar actions', () => {
    const spies = ['toggleFilters', 'handleCreateFormOpened', 'exportActiveTable', 'openGraphBuilder', 'toggleTable']
      .map(name => spyOn(component as any, name));
    ['toggleFilters', 'handleCreateFormOpened', 'exportActiveTable', 'openGraphBuilder', 'toggleTable']
      .forEach(a => component.handleToolbarAction(a));
    spies.forEach(s => expect(s).toHaveBeenCalledTimes(1));
    const table = jasmine.createSpyObj('TableBuilderComponent', ['importData']);
    component.activeTable = table;
    component.handleToolbarAction('triggerImport');
    expect(table.importData).toHaveBeenCalledTimes(1);
    component.activeTable = undefined as any;
    expect(() => component.handleToolbarAction('triggerImport')).not.toThrow();
    expect(() => component.handleToolbarAction('unknown')).not.toThrow();
  });

  /**
   * @description After the auth check the active and trashed news of web/news are loaded, newest first.
   * @input  ngOnInit() logged in
   * @output getPaginatedData('web/news', …) twice (active + trash)
   */
  it('loads the news after the auth check', fakeAsync(() => {
    component.ngOnInit();
    expect(ctx.genericTable.getPaginatedData.calls.allArgs().map(a => a[0])).toEqual(['web/news', 'web/news']);
    discardPeriodicTasks();
  }));

  /**
   * @description Refresh reloads with the current filters; clearing resets to id desc.
   * @input  filters { title: 'x' }; refreshData(); clearFilters()
   * @output reload with title 'x'; then filters { sort_by: 'id', sort_direction: 'desc' } and reload with them
   */
  it('refreshes and clears the filters', () => {
    component.filters = { title: 'x' };
    component.refreshData();
    expect(ctx.genericTable.getPaginatedData.calls.mostRecent().args[3]).toEqual(jasmine.objectContaining({ title: 'x' }));
    component.clearFilters();
    expect(component.filters).toEqual({ sort_by: 'id', sort_direction: 'desc' });
    expect(ctx.genericTable.getPaginatedData.calls.mostRecent().args[3]).toEqual(jasmine.objectContaining({ sort_by: 'id', sort_direction: 'desc' }));
  });

  /**
   * @description Closing the details clears the selected news.
   * @input  details of { id: 1 } open; handleCloseDetails()
   * @output selectedItemForDetails null; showDetails false
   */
  it('closes the details', () => {
    component.selectedItemForDetails = { id: 1 };
    component.showDetails = true;
    component.handleCloseDetails();
    expect(component.selectedItemForDetails).toBeNull();
    expect(component.showDetails).toBeFalse();
  });

  /**
   * @description The page renders its title.
   * @input  detectChanges()
   * @output text contains 'edit-news.table_header'
   */
  it('renders the page', fakeAsync(() => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('edit-news.table_header');
    discardPeriodicTasks();
  }));
});
