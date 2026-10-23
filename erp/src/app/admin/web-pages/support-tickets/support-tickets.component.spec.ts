/**
 * @file support-tickets.component.spec.ts
 * @path src/app/admin/web-pages/support-tickets/support-tickets.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of SupportTicketsComponent and support-tickets.config.ts – support
 *   tickets: translated configuration, category / priority / state options, requester data
 *   read-only, attachment only on create, chartable columns, toolbar by permission and view,
 *   toolbar actions and saving (JSON or multipart FormData with _method=PUT).
 * @dependencies
 * - src/testing/admin-test-helpers.ts (all admin doubles)
 */

import { ComponentFixture, TestBed, fakeAsync, discardPeriodicTasks } from '@angular/core/testing';

import { SupportTicketsComponent } from './support-tickets.component';
import { SUPPORT_TICKET_CATEGORY_VALUES, SUPPORT_TICKET_PRIORITY_VALUES, SUPPORT_TICKET_STATE_VALUES } from './support-tickets.config';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('SupportTicketsComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<SupportTicketsComponent>;
  let component: SupportTicketsComponent;

  const toolbar = () => Object.fromEntries(component.toolbarButtons.map(b => [b.action, b]));
  const field = (name: string) => component.formFields.find(f => f.column_name === name) as any;
  const filter = (key: string) => component.filterColumns.find(c => c.key === key) as any;

  beforeEach(async () => {
    ctx = createAdminTestContext();
    await TestBed.configureTestingModule({ imports: [SupportTicketsComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(SupportTicketsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  /**
   * @description The page configuration is built from the 'support-tickets' translations.
   * @input  component created
   * @output caption; row buttons with web-support-tickets-* permissions; 7 + 4 columns; 6 filters; 10 detail columns
   */
  it('builds the page configuration from translations', () => {
    expect(component.tableCaption).toBe('support-tickets.table_header');
    expect(component.buttons.map(b => b.permission)).toEqual([undefined, 'web-support-tickets-update', 'web-support-tickets-delete']);
    expect(component.columns.map(c => c.key)).toEqual(['id', 'subject', 'user_name_plain', 'category', 'priority', 'state', 'created_at']);
    expect(component.trashColumns.map(c => c.key)).toEqual(['id', 'subject', 'user_name_plain', 'deleted_at']);
    expect(component.filterColumns.map(c => c.key)).toEqual(['id', 'subject', 'user_name_plain', 'category', 'priority', 'state']);
    expect(component.detailsColumns.length).toBe(10);
    expect(component.t('btn_edit')).toBe('support-tickets.btn_edit');
  });

  /**
   * @description Category, priority and state options with translated labels (form and filters).
   * @input  category / priority / state fields and filters
   * @output values = exported constants; labels 'support-tickets.category_bug', 'support-tickets.priority_high', 'support-tickets.state_closed'
   */
  it('offers translated category, priority and state options', () => {
    expect(field('category').options.map((o: any) => o.value)).toEqual(SUPPORT_TICKET_CATEGORY_VALUES);
    expect(field('priority').options.map((o: any) => o.value)).toEqual(SUPPORT_TICKET_PRIORITY_VALUES);
    expect(field('state').options.map((o: any) => o.value)).toEqual(SUPPORT_TICKET_STATE_VALUES);
    expect(field('category').options[2].label).toBe('support-tickets.category_bug');
    expect(field('priority').options[2].label).toBe('support-tickets.priority_high');
    expect(field('state').options[2].label).toBe('support-tickets.state_closed');
    expect(['category', 'priority', 'state'].map(k => filter(k).options.length)).toEqual([4, 3, 3]);
  });

  /**
   * @description Requester name / e-mail are read-only; state only when editing; attachment only when creating.
   * @input  formFields
   * @output user_name_plain, user_plain editable false; state show_in_create false; attachment show_in_edit false; required subject, category, priority, description
   */
  it('restricts which fields can be changed', () => {
    expect(field('user_name_plain').editable).toBeFalse();
    expect(field('user_plain').editable).toBeFalse();
    expect(field('state').show_in_create).toBeFalse();
    expect(field('attachment').show_in_edit).toBeFalse();
    expect(field('attachment').type).toBe('file');
    expect(component.formFields.filter(f => f.required).map(f => f.column_name)).toEqual(['subject', 'category', 'priority', 'description']);
  });

  /**
   * @description State, category and priority can be charted (count).
   * @input  detailsColumns
   * @output graphColumns state, category, priority with their value lists
   */
  it('offers chartable columns', () => {
    expect(component.graphColumns).toEqual([
      { key: 'state', label: 'support-tickets.details_state', aggregation: 'count', possibleValues: SUPPORT_TICKET_STATE_VALUES },
      { key: 'category', label: 'support-tickets.details_category', aggregation: 'count', possibleValues: SUPPORT_TICKET_CATEGORY_VALUES },
      { key: 'priority', label: 'support-tickets.details_priority', aggregation: 'count', possibleValues: SUPPORT_TICKET_PRIORITY_VALUES }
    ]);
  });

  /**
   * @description A language change rebuilds the configuration.
   * @input  getValue returns 'EN:<path>'; translations$.next({})
   * @output tableCaption 'EN:support-tickets.table_header'
   */
  it('rebuilds the configuration when translations change', () => {
    ctx.i18n.getValue.and.callFake((p: string) => `EN:${p}`);
    ctx.i18n.translations$.next({});
    expect(component.tableCaption).toBe('EN:support-tickets.table_header');
  });

  /**
   * @description Toolbar buttons without permission are hidden; create/export/import hidden in the trash.
   * @input  granted []; then all; then trash view with open filters
   * @output create/report/trash hidden without permission; trash view: create/export/import hidden, labels switched
   */
  it('builds the toolbar by permission and view', () => {
    ctx.permissions.granted = new Set();
    let t = toolbar();
    expect(t['handleCreateFormOpened'].showIf).toBeFalse();
    expect(t['openGraphBuilder'].showIf).toBeFalse();
    expect(t['toggleTable'].showIf).toBeFalse();
    ctx.permissions.granted = 'all';
    t = toolbar();
    expect(t['handleCreateFormOpened'].showIf).toBeTrue();
    expect(t['toggleTable'].label).toBe('support-tickets.toolbar_show_trash');
    expect(t['toggleFilters'].label).toBe('support-tickets.toolbar_filters');
    component.showTrashTable = true;
    component.isFilterVisible = true;
    t = toolbar();
    expect(['handleCreateFormOpened', 'exportActiveTable', 'triggerImport'].map(a => t[a].showIf)).toEqual([false, false, false]);
    expect(t['toggleTable'].label).toBe('support-tickets.toolbar_show_active');
    expect(t['toggleTable'].isActive).toBeTrue();
    expect(t['toggleFilters'].label).toBe('support-tickets.toolbar_hide_filters');
  });

  /**
   * @description Toolbar actions call their handlers; import goes through the active table.
   * @input  handleToolbarAction(each action) with an activeTable spy; then without a table
   * @output handlers called once; importData() once; no error without a table or for unknown actions
   */
  it('dispatches the toolbar actions', () => {
    const names = ['toggleFilters', 'handleCreateFormOpened', 'exportActiveTable', 'toggleTable', 'openGraphBuilder'];
    const spies = names.map(n => spyOn(component as any, n));
    names.forEach(a => component.handleToolbarAction(a));
    spies.forEach(s => expect(s).toHaveBeenCalledTimes(1));
    const table = jasmine.createSpyObj('TableBuilderComponent', ['importData']);
    component.activeTable = table;
    component.handleToolbarAction('triggerImport');
    expect(table.importData).toHaveBeenCalledTimes(1);
    component.activeTable = undefined as any;
    expect(() => { component.handleToolbarAction('triggerImport'); component.handleToolbarAction('unknown'); }).not.toThrow();
  });

  /**
   * @description Tickets of web/support_tickets are loaded after the auth check; refresh keeps the filters.
   * @input  ngOnInit(); filters { state: 'open' }; refreshData()
   * @output getPaginatedData('web/support_tickets', …) twice; refresh with state 'open'
   */
  it('loads the tickets', fakeAsync(() => {
    component.ngOnInit();
    expect(ctx.genericTable.getPaginatedData.calls.allArgs().map(a => a[0])).toEqual(['web/support_tickets', 'web/support_tickets']);
    component.filters = { state: 'open' };
    component.refreshData();
    expect(ctx.genericTable.getPaginatedData.calls.mostRecent().args[3]).toEqual(jasmine.objectContaining({ state: 'open' }));
    discardPeriodicTasks();
  }));

  /**
   * @description Editing with plain values sends PUT.
   * @input  handleFormSubmitted({ id: 5, state: 'closed' })
   * @output put('web/support_tickets/5', { id: 5, state: 'closed' }); alert 'support-tickets.crud_updated_message'; form closed; reload
   */
  it('updates a ticket from plain values', () => {
    component.showCreateForm = true;
    component.handleFormSubmitted({ id: 5, state: 'closed' });
    expect((ctx.dataHandler as any).put).toHaveBeenCalledWith('web/support_tickets/5', { id: 5, state: 'closed' });
    expect(ctx.alert.open).toHaveBeenCalledWith('shared.success', 'support-tickets.crud_updated_message', 'success');
    expect(component.showCreateForm).toBeFalse();
    expect(ctx.genericTable.getPaginatedData).toHaveBeenCalled();
  });

  /**
   * @description Editing with files (FormData) is sent as POST with _method=PUT (PHP cannot read multipart PUT).
   * @input  FormData { id: '5', subject: 'X' }; handleFormSubmitted(fd)
   * @output post('web/support_tickets/5', fd) with _method 'PUT'; put not called; 'support-tickets.crud_updated_message'
   */
  it('updates a ticket with files as POST + _method=PUT', () => {
    const fd = new FormData();
    fd.append('id', '5');
    fd.append('subject', 'X');
    component.handleFormSubmitted(fd);
    const [url, body] = (ctx.dataHandler as any).post.calls.mostRecent().args;
    expect(url).toBe('web/support_tickets/5');
    expect((body as FormData).get('_method')).toBe('PUT');
    expect((ctx.dataHandler as any).put).not.toHaveBeenCalled();
    expect(ctx.alert.open).toHaveBeenCalledWith('shared.success', 'support-tickets.crud_updated_message', 'success');
  });

  /**
   * @description New tickets are created with POST to the collection (plain or FormData).
   * @input  handleFormSubmitted({ subject: 'New' }); FormData without id
   * @output post('web/support_tickets', { subject: 'New' }); post('web/support_tickets', fd) without _method; 'support-tickets.crud_created_message'
   */
  it('creates tickets', () => {
    component.handleFormSubmitted({ subject: 'New' });
    expect((ctx.dataHandler as any).post).toHaveBeenCalledWith('web/support_tickets', { subject: 'New' });
    expect(ctx.alert.open).toHaveBeenCalledWith('shared.success', 'support-tickets.crud_created_message', 'success');
    const fd = new FormData();
    fd.append('subject', 'With file');
    component.handleFormSubmitted(fd);
    const [url, body] = (ctx.dataHandler as any).post.calls.mostRecent().args;
    expect(url).toBe('web/support_tickets');
    expect((body as FormData).get('_method')).toBeNull();
  });

  /**
   * @description The page renders its title.
   * @input  detectChanges()
   * @output text contains 'support-tickets.table_header'
   */
  it('renders the page', fakeAsync(() => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('support-tickets.table_header');
    discardPeriodicTasks();
  }));
});
