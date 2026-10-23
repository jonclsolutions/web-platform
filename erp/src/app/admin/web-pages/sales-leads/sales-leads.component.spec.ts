/**
 * @file sales-leads.component.spec.ts
 * @path src/app/admin/web-pages/sales-leads/sales-leads.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of SalesLeadsComponent and sales-leads.config.ts – the sales lead CRM
 *   table: translated configuration, status / priority / source channel options, form validation
 *   (subject, e-mail, phone), chartable and importable columns, toolbar by permission and view,
 *   toolbar actions (incl. import / export through the table), the inquiry form link copied to
 *   the clipboard, create / update and the detail view.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (all admin doubles), navigator.clipboard (spy)
 */

import { ComponentFixture, TestBed, fakeAsync, discardPeriodicTasks } from '@angular/core/testing';
import { of } from 'rxjs';

import { SalesLeadsComponent } from './sales-leads.component';
import { SALES_LEAD_PRIORITY_VALUES, SALES_LEAD_SOURCE_CHANNEL_VALUES, SALES_LEAD_STATUS_VALUES } from './sales-leads.config';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('SalesLeadsComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<SalesLeadsComponent>;
  let component: SalesLeadsComponent;

  const toolbar = () => Object.fromEntries(component.toolbarButtons.map(b => [b.action, b]));
  const field = (name: string) => component.formFields.find(f => f.column_name === name) as any;
  const filter = (key: string) => component.filterColumns.find(c => c.key === key) as any;

  beforeEach(async () => {
    ctx = createAdminTestContext();
    await TestBed.configureTestingModule({ imports: [SalesLeadsComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(SalesLeadsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  /**
   * @description The page configuration is built from the 'sales-leads' translations.
   * @input  component created
   * @output caption; row buttons details / edit / link / delete with permissions; 7 + 3 columns; 5 filters; 18 detail columns
   */
  it('builds the page configuration from translations', () => {
    expect(component.tableCaption).toBe('sales-leads.table_header');
    expect(component.buttons.map(b => [b.action, b.permission])).toEqual([
      ['details', undefined], ['edit', 'web-sales-leads-update'], ['generate_form', 'web-sales-leads-update'], ['delete', 'web-sales-leads-delete']
    ]);
    expect(component.salesLeadColumns.map(c => c.key)).toEqual(['id', 'subject_name', 'status', 'priority', 'salesman_name', 'last_contact_date', 'created_at']);
    expect(component.trashSalesLeadColumns.map(c => c.key)).toEqual(['id', 'subject_name', 'deleted_at']);
    expect(component.filterColumns.map(c => c.key)).toEqual(['id', 'subject_name', 'status', 'priority', 'salesman_name']);
    expect(component.detailsColumns.length).toBe(18);
    expect(component.t('btn_link')).toBe('sales-leads.btn_link');
  });

  /**
   * @description Status (14), priority (5) and source channel (23) are offered with translated labels.
   * @input  status / priority / source_channel fields and status / priority filters
   * @output values equal the exported constants; labels 'sales-leads.status_closed_won', 'sales-leads.priority_critical', 'sales-leads.source_x_twitter'
   */
  it('offers translated status, priority and source options', () => {
    expect(field('status').options.map((o: any) => o.value)).toEqual(SALES_LEAD_STATUS_VALUES);
    expect(field('priority').options.map((o: any) => o.value)).toEqual(SALES_LEAD_PRIORITY_VALUES);
    expect(field('source_channel').options.map((o: any) => o.value)).toEqual(SALES_LEAD_SOURCE_CHANNEL_VALUES);
    expect(field('status').options.find((o: any) => o.value === 'closed_won').label).toBe('sales-leads.status_closed_won');
    expect(field('priority').options.find((o: any) => o.value === 'critical').label).toBe('sales-leads.priority_critical');
    expect(field('source_channel').options.find((o: any) => o.value === 'x_twitter').label).toBe('sales-leads.source_x_twitter');
    expect(filter('status').options.length).toBe(14);
    expect(filter('priority').options.length).toBe(5);
    const all = [...field('status').options, ...field('priority').options, ...field('source_channel').options];
    expect(all.every((o: any) => !o.label.includes('undefined'))).toBeTrue();
  });

  /**
   * @description Form validation: subject 2–255 chars; optional e-mail and phone patterns; hidden technical fields.
   * @input  patterns of subject_name, contact_email, contact_phone; formFields
   * @output 'A' rejected, 'AB' ok; 'a@b.cz' ok, 'ab' rejected; '+420 123 456 789' ok, 'abc' rejected; 4 hidden fields; rejection reason only in edit
   */
  it('validates the lead form', () => {
    const re = (name: string, anchored = false) => new RegExp(anchored ? `^${field(name).pattern}$` : field(name).pattern);
    expect(re('subject_name').test('A')).toBeFalse();
    expect(re('subject_name').test('AB')).toBeTrue();
    expect(re('contact_email', true).test('a@b.cz')).toBeTrue();
    expect(re('contact_email', true).test('ab')).toBeFalse();
    expect(re('contact_phone').test('+420 123 456 789')).toBeTrue();
    expect(re('contact_phone').test('123456789')).toBeTrue();
    expect(re('contact_phone').test('abc')).toBeFalse();
    expect(component.formFields.filter(f => f.type === 'hidden').map(f => f.column_name)).toEqual(['user_id', 'salesman_name', 'contact_other', 'source_url']);
    expect(component.formFields.filter(f => f.required).map(f => f.column_name)).toEqual(['subject_name', 'source_channel', 'status', 'priority']);
    expect(field('rejection_reason').show_in_create).toBeFalse();
  });

  /**
   * @description Salesman, source, status and priority can be charted; every detail column except id/created is importable.
   * @input  detailsColumns
   * @output graphColumns salesman_name, source_channel, status, priority (with their value lists); importable count 16
   */
  it('offers chartable and importable columns', () => {
    expect(component.graphColumns.map(g => [g.key, g.possibleValues])).toEqual([
      ['salesman_name', undefined], ['source_channel', SALES_LEAD_SOURCE_CHANNEL_VALUES],
      ['status', SALES_LEAD_STATUS_VALUES], ['priority', SALES_LEAD_PRIORITY_VALUES]
    ]);
    expect(component.graphColumns.every(g => g.aggregation === 'count')).toBeTrue();
    expect(component.detailsColumns.filter(c => c.importable).length).toBe(16);
  });

  /**
   * @description A language change rebuilds the configuration.
   * @input  getValue returns 'EN:<path>'; translations$.next({})
   * @output tableCaption 'EN:sales-leads.table_header'
   */
  it('rebuilds the configuration when translations change', () => {
    ctx.i18n.getValue.and.callFake((p: string) => `EN:${p}`);
    ctx.i18n.translations$.next({});
    expect(component.tableCaption).toBe('EN:sales-leads.table_header');
  });

  /**
   * @description Toolbar buttons without permission are hidden; create/export/import hidden in the trash.
   * @input  granted []; then all; then trash view with open filters
   * @output create/report/trash hidden without permission; all visible in the active view; trash view: create/export/import hidden, labels switched
   */
  it('builds the toolbar by permission and view', () => {
    ctx.permissions.granted = new Set();
    let t = toolbar();
    expect(t['handleCreateFormOpened'].showIf).toBeFalse();
    expect(t['openGraphBuilder'].showIf).toBeFalse();
    expect(t['toggleTable'].showIf).toBeFalse();
    expect(t['triggerImport'].showIf).toBeTrue();
    ctx.permissions.granted = 'all';
    t = toolbar();
    expect(t['handleCreateFormOpened'].showIf).toBeTrue();
    expect(t['toggleTable'].label).toBe('sales-leads.toolbar_show_trash');
    expect(t['toggleFilters'].label).toBe('sales-leads.toolbar_filters');
    component.showTrashTable = true;
    component.isFilterVisible = true;
    t = toolbar();
    expect(['handleCreateFormOpened', 'exportActiveTable', 'triggerImport'].map(a => t[a].showIf)).toEqual([false, false, false]);
    expect(t['toggleTable'].label).toBe('sales-leads.toolbar_show_active');
    expect(t['toggleTable'].isActive).toBeTrue();
    expect(t['toggleFilters'].label).toBe('sales-leads.toolbar_hide_filters');
  });

  /**
   * @description Toolbar actions call their handlers; import / export go through the active table.
   * @input  handleToolbarAction(each action) with an activeTable spy; then without a table
   * @output toggleFilters, handleCreateFormOpened, openGraphBuilder, toggleTable called; importData() and exportToCSV() once; no error without a table
   */
  it('dispatches the toolbar actions', () => {
    const names = ['toggleFilters', 'handleCreateFormOpened', 'openGraphBuilder', 'toggleTable'];
    const spies = names.map(n => spyOn(component as any, n));
    names.forEach(a => component.handleToolbarAction(a));
    spies.forEach(s => expect(s).toHaveBeenCalledTimes(1));
    const table = jasmine.createSpyObj('TableBuilderComponent', ['importData', 'exportToCSV']);
    component.activeTable = table;
    component.handleToolbarAction('triggerImport');
    component.handleToolbarAction('exportActiveTable');
    expect(table.importData).toHaveBeenCalledTimes(1);
    expect(table.exportToCSV).toHaveBeenCalledTimes(1);
    component.activeTable = undefined as any;
    expect(() => {
      component.handleToolbarAction('triggerImport');
      component.handleToolbarAction('exportActiveTable');
      component.handleToolbarAction('unknown');
    }).not.toThrow();
  });

  /**
   * @description Leads of web/sales_leads are loaded after the auth check; clearing filters returns to the defaults.
   * @input  ngOnInit(); filters { status: 'new' }; refreshData(); clearFilters()
   * @output getPaginatedData('web/sales_leads', …) twice; refresh with status 'new'; filters { sort_by: 'id', sort_direction: 'desc' }
   */
  it('loads, refreshes and clears the leads', fakeAsync(() => {
    component.ngOnInit();
    expect(ctx.genericTable.getPaginatedData.calls.allArgs().map(a => a[0])).toEqual(['web/sales_leads', 'web/sales_leads']);
    component.filters = { status: 'new' };
    component.refreshData();
    expect(ctx.genericTable.getPaginatedData.calls.mostRecent().args[3]).toEqual(jasmine.objectContaining({ status: 'new' }));
    component.clearFilters();
    expect(component.filters).toEqual({ sort_by: 'id', sort_direction: 'desc' });
    discardPeriodicTasks();
  }));

  /**
   * @description The inquiry form link is generated and copied to the clipboard.
   * @input  handleGenerateFormLink({ id: 3, subject_name: 'ACME' }); API { url: 'https://x/form/t' }; link_copied_message '{subject}'
   * @output post('web/sales_leads/3/generate-link', {}); clipboard 'https://x/form/t'; alert ('sales-leads.link_copied_title', 'ACME', 'success')
   */
  it('copies the generated inquiry form link', async () => {
    ctx.i18n.getValue.and.callFake((p: string) => (p === 'sales-leads.link_copied_message' ? '{subject}' : p));
    (ctx.dataHandler as any).post.and.returnValue(of({ token: 't', url: 'https://x/form/t' }));
    const write = spyOn(navigator.clipboard, 'writeText').and.returnValue(Promise.resolve());
    component.handleGenerateFormLink({ id: 3, subject_name: 'ACME' });
    await write.calls.mostRecent().returnValue;
    await Promise.resolve();
    expect((ctx.dataHandler as any).post).toHaveBeenCalledWith('web/sales_leads/3/generate-link', {});
    expect(write).toHaveBeenCalledWith('https://x/form/t');
    expect(ctx.alert.open).toHaveBeenCalledWith('sales-leads.link_copied_title', 'ACME', 'success');
  });

  /**
   * @description When the clipboard is not available the user gets an error message.
   * @input  writeText rejects
   * @output alert ('shared.error', 'sales-leads.link_copy_failed_message', 'danger')
   */
  it('reports a failed clipboard copy', async () => {
    (ctx.dataHandler as any).post.and.returnValue(of({ token: 't', url: 'u' }));
    spyOn(navigator.clipboard, 'writeText').and.returnValue(Promise.reject(new Error('denied')));
    component.handleGenerateFormLink({ id: 3, subject_name: 'ACME' });
    await new Promise(r => setTimeout(r));
    expect(ctx.alert.open).toHaveBeenCalledWith('shared.error', 'sales-leads.link_copy_failed_message', 'danger');
  });

  /**
   * @description A lead with id is updated, a new one created; both show their message and reload.
   * @input  handleFormSubmitted({ id: 3, … }), then ({ subject_name: 'New' })
   * @output put('web/sales_leads/3', …) + 'sales-leads.crud_updated_message'; post('web/sales_leads', …) + 'sales-leads.crud_created_message'; form closed
   */
  it('updates and creates leads', () => {
    component.showCreateForm = true;
    component.handleFormSubmitted({ id: 3, subject_name: 'ACME' });
    expect((ctx.dataHandler as any).put).toHaveBeenCalledWith('web/sales_leads/3', { id: 3, subject_name: 'ACME' });
    expect(ctx.alert.open).toHaveBeenCalledWith('shared.success', 'sales-leads.crud_updated_message', 'success');
    component.handleFormSubmitted({ subject_name: 'New' });
    expect((ctx.dataHandler as any).post).toHaveBeenCalledWith('web/sales_leads', { subject_name: 'New' });
    expect(ctx.alert.open).toHaveBeenCalledWith('shared.success', 'sales-leads.crud_created_message', 'success');
    expect(component.showCreateForm).toBeFalse();
  });

  /**
   * @description Details are loaded from the API and can be closed.
   * @input  handleViewDetails({ id: 3 }); handleCloseDetails()
   * @output getOne('web/sales_leads/3'); details shown; then hidden and cleared
   */
  it('shows and closes the details', () => {
    (ctx.dataHandler as any).getOne.and.returnValue(of({ id: 3, subject_name: 'ACME' }));
    component.handleViewDetails({ id: 3 });
    expect((ctx.dataHandler as any).getOne).toHaveBeenCalledWith('web/sales_leads/3');
    expect(component.selectedItemForDetails).toEqual({ id: 3, subject_name: 'ACME' });
    expect(component.showDetails).toBeTrue();
    component.handleCloseDetails();
    expect(component.showDetails).toBeFalse();
    expect(component.selectedItemForDetails).toBeNull();
  });

  /**
   * @description The page renders its title.
   * @input  detectChanges()
   * @output text contains 'sales-leads.table_header'
   */
  it('renders the page', fakeAsync(() => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('sales-leads.table_header');
    discardPeriodicTasks();
  }));
});
