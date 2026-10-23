/**
 * @file sales-orders.component.spec.ts
 * @path src/app/admin/web-pages/sales-orders/sales-orders.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of SalesOrdersComponent and sales-orders.config.ts – sales orders
 *   (realisations created from sales leads): translated configuration, form validation, GDPR /
 *   terms consent charts, toolbar by permission and view, toolbar actions, creating or opening
 *   the project of an order and saving an edited order.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (all admin doubles), Router (spy on navigate)
 */

import { ComponentFixture, TestBed, fakeAsync, discardPeriodicTasks } from '@angular/core/testing';
import { Router } from '@angular/router';

import { SalesOrdersComponent } from './sales-orders.component';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('SalesOrdersComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<SalesOrdersComponent>;
  let component: SalesOrdersComponent;
  let navigate: jasmine.Spy;

  const toolbar = () => Object.fromEntries(component.toolbarButtons.map(b => [b.action, b]));
  const field = (name: string) => component.formFields.find(f => f.column_name === name) as any;

  beforeEach(async () => {
    ctx = createAdminTestContext();
    await TestBed.configureTestingModule({ imports: [SalesOrdersComponent], providers: ctx.providers }).compileComponents();
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.returnValue(Promise.resolve(true));
    fixture = TestBed.createComponent(SalesOrdersComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  /**
   * @description The page configuration is built from the 'sales-orders' translations.
   * @input  component created
   * @output caption; row buttons details / project (web-projects-create) / edit / delete; 5 + 4 columns; 4 filters; 13 detail columns
   */
  it('builds the page configuration from translations', () => {
    expect(component.tableCaption).toBe('sales-orders.table_header');
    expect(component.buttons.map(b => [b.action, b.permission])).toEqual([
      ['details', undefined], ['generate_form', 'web-projects-create'],
      ['edit', 'web-sales-orders-update'], ['delete', 'web-sales-orders-delete']
    ]);
    expect(component.columns.map(c => c.key)).toEqual(['id', 'client_name', 'salesman_name', 'ico', 'created_at']);
    expect(component.trashColumns.map(c => c.key)).toEqual(['id', 'client_name', 'salesman_name', 'deleted_at']);
    expect(component.filterColumns.map(c => c.key)).toEqual(['id', 'client_name', 'salesman_name', 'ico']);
    expect(component.detailsColumns.length).toBe(13);
    expect(component.t('btn_edit')).toBe('sales-orders.btn_edit');
  });

  /**
   * @description Client name, e-mail and description are required; the e-mail must contain '@' and a domain.
   * @input  formFields; client_email pattern
   * @output required ['client_name', 'client_email', 'order_description']; 'a@b.cz' ok, 'a@b' and 'ab.cz' rejected; attachments as files
   */
  it('validates the order form', () => {
    expect(component.formFields.filter(f => f.required).map(f => f.column_name)).toEqual(['client_name', 'client_email', 'order_description']);
    const re = new RegExp(`^${field('client_email').pattern}$`);
    expect(re.test('a@b.cz')).toBeTrue();
    expect(re.test('a@b')).toBeFalse();
    expect(re.test('ab.cz')).toBeFalse();
    expect(field('attachments').type).toBe('files');
    expect(field('client_phone').type).toBe('tel');
  });

  /**
   * @description Salesman and both consents (GDPR, terms) can be charted; consents as '1'/'0'.
   * @input  detailsColumns
   * @output graphColumns salesman_name, data_processing_agreement ['1','0'], tos_agreement ['1','0']
   */
  it('offers chartable columns', () => {
    expect(component.graphColumns).toEqual([
      { key: 'salesman_name', label: 'sales-orders.details_salesman', aggregation: 'count', possibleValues: undefined },
      { key: 'data_processing_agreement', label: 'sales-orders.details_gdpr_agreement', aggregation: 'count', possibleValues: ['1', '0'] },
      { key: 'tos_agreement', label: 'sales-orders.details_tos_agreement', aggregation: 'count', possibleValues: ['1', '0'] }
    ]);
  });

  /**
   * @description A language change rebuilds the configuration.
   * @input  getValue returns 'EN:<path>'; translations$.next({})
   * @output tableCaption 'EN:sales-orders.table_header'
   */
  it('rebuilds the configuration when translations change', () => {
    ctx.i18n.getValue.and.callFake((p: string) => `EN:${p}`);
    ctx.i18n.translations$.next({});
    expect(component.tableCaption).toBe('EN:sales-orders.table_header');
  });

  /**
   * @description Toolbar: report and trash need permissions; export hidden in the trash; labels follow the state.
   * @input  granted []; then all with trash view and open filters
   * @output report/trash hidden without permission; trash view: export hidden, 'sales-orders.toolbar_show_active', 'sales-orders.toolbar_hide_filters'
   */
  it('builds the toolbar by permission and view', () => {
    ctx.permissions.granted = new Set();
    expect(toolbar()['openGraphBuilder'].showIf).toBeFalse();
    expect(toolbar()['toggleTable'].showIf).toBeFalse();
    ctx.permissions.granted = 'all';
    let t = toolbar();
    expect(t['exportActiveTable'].showIf).toBeTrue();
    expect(t['toggleTable'].label).toBe('sales-orders.toolbar_show_trash');
    expect(t['toggleFilters'].label).toBe('sales-orders.toolbar_filters');
    component.showTrashTable = true;
    component.isFilterVisible = true;
    t = toolbar();
    expect(t['exportActiveTable'].showIf).toBeFalse();
    expect(t['toggleTable'].label).toBe('sales-orders.toolbar_show_active');
    expect(t['toggleTable'].isActive).toBeTrue();
    expect(t['toggleFilters'].label).toBe('sales-orders.toolbar_hide_filters');
    expect(t['toggleFilters'].isActive).toBeTrue();
  });

  /**
   * @description Toolbar actions call their handlers; unknown actions are ignored.
   * @input  handleToolbarAction(toggleFilters | exportActiveTable | openGraphBuilder | toggleTable | 'unknown')
   * @output each handler called once; 'unknown' does nothing
   */
  it('dispatches the toolbar actions', () => {
    const names = ['toggleFilters', 'exportActiveTable', 'openGraphBuilder', 'toggleTable'];
    const spies = names.map(n => spyOn(component as any, n));
    names.forEach(a => component.handleToolbarAction(a));
    spies.forEach(s => expect(s).toHaveBeenCalledTimes(1));
    expect(() => component.handleToolbarAction('unknown')).not.toThrow();
  });

  /**
   * @description Orders of web/sales_orders are loaded after the auth check; refresh keeps the filters.
   * @input  ngOnInit(); filters { ico: '123' }; refreshData()
   * @output getPaginatedData('web/sales_orders', …) twice; refresh with ico '123'
   */
  it('loads the orders', fakeAsync(() => {
    component.ngOnInit();
    expect(ctx.genericTable.getPaginatedData.calls.allArgs().map(a => a[0])).toEqual(['web/sales_orders', 'web/sales_orders']);
    component.filters = { ico: '123' };
    component.refreshData();
    expect(ctx.genericTable.getPaginatedData.calls.mostRecent().args[3]).toEqual(jasmine.objectContaining({ ico: '123' }));
    discardPeriodicTasks();
  }));

  /**
   * @description The project button opens the existing project or starts a new one for the order.
   * @input  createProject({ id: 4, project_id: 9 }), ({ id: 5 }), ({}), (null)
   * @output navigate(['/admin/web/projects'], { open_project: 9 }); (…, { order_id: 5 }); nothing for rows without id
   */
  it('opens or creates the project of an order', () => {
    component.createProject({ id: 4, project_id: 9 });
    expect(navigate).toHaveBeenCalledWith(['/admin/web/projects'], { queryParams: { open_project: 9 } });
    component.createProject({ id: 5 });
    expect(navigate).toHaveBeenCalledWith(['/admin/web/projects'], { queryParams: { order_id: 5 } });
    navigate.calls.reset();
    component.createProject({});
    component.createProject(null);
    expect(navigate).not.toHaveBeenCalled();
  });

  /**
   * @description Saving updates the order, shows a success message, reloads and closes the form.
   * @input  handleFormSubmitted({ id: 4, client_name: 'ACME' })
   * @output put('web/sales_orders/4', …); alert ('shared.success', 'sales-orders.crud_updated_message', 'success'); form closed
   */
  it('saves an edited order', () => {
    component.showCreateForm = true;
    component.handleFormSubmitted({ id: 4, client_name: 'ACME' });
    expect((ctx.dataHandler as any).put).toHaveBeenCalledWith('web/sales_orders/4', { id: 4, client_name: 'ACME' });
    expect(ctx.alert.open).toHaveBeenCalledWith('shared.success', 'sales-orders.crud_updated_message', 'success');
    expect(ctx.genericTable.getPaginatedData).toHaveBeenCalled();
    expect(component.showCreateForm).toBeFalse();
  });

  /**
   * @description The page renders its title.
   * @input  detectChanges()
   * @output text contains 'sales-orders.table_header'
   */
  it('renders the page', fakeAsync(() => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('sales-orders.table_header');
    discardPeriodicTasks();
  }));
});
