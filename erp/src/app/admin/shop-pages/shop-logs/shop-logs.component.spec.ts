/**
 * @file shop-logs.component.spec.ts
 * @path src/app/admin/shop-pages/shop-logs/shop-logs.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of ShopLogsComponent and shop-logs.config.ts – the read-only audit log
 *   of the e-shop: configuration, chartable columns, toolbar by permission and filter state,
 *   toolbar actions, loading of shop/logs and the detail view.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (all admin doubles)
 */

import { ComponentFixture, TestBed, fakeAsync, discardPeriodicTasks } from '@angular/core/testing';
import { of } from 'rxjs';

import { ShopLogsComponent } from './shop-logs.component';
import { EVENT_TYPE_VALUES, FORM_FIELDS, MODULE_VALUES } from './shop-logs.config';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('ShopLogsComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<ShopLogsComponent>;
  let component: ShopLogsComponent;

  const toolbar = () => Object.fromEntries(component.toolbarButtons.map(b => [b.action, b]));

  beforeEach(async () => {
    ctx = createAdminTestContext();
    await TestBed.configureTestingModule({ imports: [ShopLogsComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(ShopLogsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  /**
   * @description The log is read-only: only the details button, no form fields.
   * @input  component created
   * @output buttons ['details']; FORM_FIELDS []; 7 columns; 5 filters; 11 detail columns; caption and
   *   headers from the shop-logs section (finding #16)
   */
  it('builds a read-only configuration', () => {
    expect(component.buttons.map(b => b.action)).toEqual(['details']);
    expect(FORM_FIELDS).toEqual([]);
    expect(component.tableColumns.map(c => c.key)).toEqual(['id', 'created_at', 'user_plain', 'event_type', 'module', 'description', 'origin']);
    expect(component.filterColumns.map(c => c.key)).toEqual(['id', 'user_plain', 'event_type', 'module', 'origin']);
    expect(component.detailsColumns.length).toBe(11);
    expect(component.tableCaption).toBe('shop-logs.table_header');
    expect(component.tableColumns[1].header).toBe('shop-logs.col_time');
    expect(component.buttons[0].header_name).toBe('shop-logs.btn_details');
  });

  /**
   * @description Event type and module can be charted (count) with their known values.
   * @input  graphColumns
   * @output event_type (14 values) and module (10 values)
   */
  it('offers chartable columns', () => {
    expect(component.graphColumns.map(g => [g.key, g.aggregation, g.possibleValues!.length])).toEqual([
      ['event_type', 'count', 14], ['module', 'count', 10]
    ]);
  });

  /**
   * @description The event / module filters use the values the API writes (exact-match filter of
   *   shop/logs), with translated labels (finding #16 bugfix: the old module values never matched).
   * @input  filterColumns event_type / module
   * @output modules ShopProduct … Shop with module_* labels; events with event_* labels; no old 'shop-products' / 'login'
   */
  it('filters by the real event types and modules', () => {
    const opts = (key: string) => (component.filterColumns.find(c => c.key === key) as any).options;
    expect(opts('module').map((o: any) => o.value)).toEqual(MODULE_VALUES);
    expect(opts('module')[0]).toEqual({ value: 'ShopProduct', label: 'shop-logs.module_shop_product' });
    expect(opts('module')[3]).toEqual({ value: 'ShopOrder (Checkout)', label: 'shop-logs.module_shop_order_checkout' });
    expect(opts('event_type').map((o: any) => o.value)).toEqual(EVENT_TYPE_VALUES);
    expect(opts('event_type')[0]).toEqual({ value: 'create', label: 'shop-logs.event_create' });
    expect(MODULE_VALUES).not.toContain('shop-products');
    expect(EVENT_TYPE_VALUES).not.toContain('login');
  });

  /**
   * @description Reports need 'shop-view-logs'; filters label follows the state.
   * @input  granted []; then all and filters open
   * @output openGraphBuilder hidden without permission; toolbar_hide_filters active when open, toolbar_filters when closed
   */
  it('builds the toolbar by permission and filter state', () => {
    ctx.permissions.granted = new Set();
    expect(toolbar()['openGraphBuilder'].showIf).toBeFalse();
    expect(toolbar()['exportActiveTable'].showIf).toBeTrue();
    ctx.permissions.granted = 'all';
    expect(toolbar()['openGraphBuilder'].showIf).toBeTrue();
    expect(toolbar()['toggleFilters'].label).toBe('shop-logs.toolbar_filters');
    component.isFilterVisible = true;
    expect(toolbar()['toggleFilters'].label).toBe('shop-logs.toolbar_hide_filters');
    expect(toolbar()['toggleFilters'].isActive).toBeTrue();
  });

  /**
   * @description Toolbar actions call their handlers; actions the log does not offer are ignored.
   * @input  handleToolbarAction(toggleFilters | exportActiveTable | openGraphBuilder | toggleTable)
   * @output the first three handlers called once; toggleTable not called
   */
  it('dispatches the toolbar actions', () => {
    const spies = ['toggleFilters', 'exportActiveTable', 'openGraphBuilder', 'toggleTable'].map(n => spyOn(component as any, n));
    ['toggleFilters', 'exportActiveTable', 'openGraphBuilder', 'toggleTable'].forEach(a => component.handleToolbarAction(a));
    expect(spies.map(s => s.calls.count())).toEqual([1, 1, 1, 0]);
  });

  /**
   * @description shop/logs is loaded after the auth check and on refresh.
   * @input  ngOnInit(); filters { module: 'shop-orders' }; refreshData()
   * @output getPaginatedData('shop/logs', …); refresh with module 'shop-orders'
   */
  it('loads the logs', fakeAsync(() => {
    component.ngOnInit();
    expect(ctx.genericTable.getPaginatedData.calls.first().args[0]).toBe('shop/logs');
    component.filters = { module: 'shop-orders' };
    component.refreshData();
    expect(ctx.genericTable.getPaginatedData.calls.mostRecent().args[3]).toEqual(jasmine.objectContaining({ module: 'shop-orders' }));
    discardPeriodicTasks();
  }));

  /**
   * @description Details are loaded by id and can be closed; rows without id are ignored.
   * @input  handleViewDetails({ id: 4 }); ({}); handleCloseDetails()
   * @output getOne('shop/logs/4'); details shown; no request without id; closed and cleared
   */
  it('shows and closes the details', () => {
    (ctx.dataHandler as any).getOne.and.returnValue(of({ id: 4 }));
    component.handleViewDetails({ id: 4 });
    expect((ctx.dataHandler as any).getOne).toHaveBeenCalledWith('shop/logs/4');
    expect(component.selectedItemForDetails).toEqual({ id: 4 });
    expect(component.showDetails).toBeTrue();
    component.handleViewDetails({});
    expect((ctx.dataHandler as any).getOne).toHaveBeenCalledTimes(1);
    component.handleCloseDetails();
    expect(component.selectedItemForDetails).toBeNull();
    expect(component.showDetails).toBeFalse();
  });

  /**
   * @description The page renders.
   * @input  detectChanges()
   * @output text contains the translated header, no hardcoded Czech header
   */
  it('renders the page', fakeAsync(() => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('shop-logs.table_header');
    expect(fixture.nativeElement.textContent).not.toContain('E-Shop logy');
    discardPeriodicTasks();
  }));
});
