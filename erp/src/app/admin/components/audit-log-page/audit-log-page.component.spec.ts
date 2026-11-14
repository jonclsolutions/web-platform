/**
 * @file audit-log-page.component.spec.ts
 * @path src/app/admin/components/audit-log-page/audit-log-page.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of AuditLogPageComponent and audit-log-page.config.ts - the read-only
 *   audit log page shared by the core and the applications: configuration from the route, shared
 *   and page texts, toolbar by permission and filter state, toolbar actions, loading and the
 *   detail view; every log route of the admin (core + installed applications) is configured.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (all admin doubles), ADMIN_ROUTES (route tables).
 */

import { ComponentFixture, TestBed, fakeAsync, discardPeriodicTasks } from '@angular/core/testing';
import { ActivatedRoute, Route } from '@angular/router';
import { of } from 'rxjs';

import { AuditLogPageComponent } from './audit-log-page.component';
import { AUDIT_LOG_ROUTE_DATA, AuditLogPageConfig, auditLogLabelKey } from './audit-log-page.config';
import { ADMIN_ROUTES } from '../../admin-routing.module';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('AuditLogPageComponent', () => {
  const CONFIG: AuditLogPageConfig = {
    endpoint: 'demo/logs',
    section: 'demo-logs',
    reportPermission: 'demo-view-logs',
    eventTypes: ['create', 'PasswordChanged'],
    modules: ['DemoThing', 'Translation:demo'],
  };
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<AuditLogPageComponent>;
  let component: AuditLogPageComponent;

  const toolbar = () => Object.fromEntries(component.toolbarButtons.map(b => [b.action, b]));

  beforeEach(async () => {
    ctx = createAdminTestContext();
    await TestBed.configureTestingModule({
      imports: [AuditLogPageComponent],
      providers: [...ctx.providers, { provide: ActivatedRoute, useValue: { snapshot: { data: { [AUDIT_LOG_ROUTE_DATA]: CONFIG } } } }],
    }).compileComponents();
    fixture = TestBed.createComponent(AuditLogPageComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  /**
   * @description The route configures the page; the newest rows come first; the column labels
   *   are shared (`audit-log`), the caption is the page's.
   * @input  route data { auditLog: CONFIG }
   * @output apiEndpoint 'demo/logs'; sort created_at desc; caption 'demo-logs.table_header';
   *   column header 'audit-log.col_time'; details button only; 7 columns, 5 filters, 11 details
   */
  it('is configured by its route', () => {
    expect(component.apiEndpoint).toBe('demo/logs');
    expect(component.filters).toEqual({ sort_by: 'created_at', sort_direction: 'desc' });
    expect(component.tableCaption).toBe('demo-logs.table_header');
    expect(component.tableColumns.map(c => c.key)).toEqual(['id', 'created_at', 'user_plain', 'event_type', 'module', 'description', 'origin']);
    expect(component.tableColumns[1].header).toBe('audit-log.col_time');
    expect(component.buttons.map(b => [b.action, b.header_name])).toEqual([['details', 'audit-log.btn_details']]);
    expect(component.filterColumns.map(c => c.key)).toEqual(['id', 'user_plain', 'event_type', 'module', 'origin']);
    expect(component.detailsColumns.length).toBe(11);
  });

  /**
   * @description Event types and modules are labelled from the page section (snake case keys)
   *   and can be charted.
   * @input  filter options; graphColumns
   * @output 'demo-logs.event_create' / 'demo-logs.event_password_changed';
   *   'demo-logs.module_demo_thing' / 'demo-logs.module_translation_demo'; chart columns
   *   event_type and module with the configured values
   */
  it('labels event types and modules from the page section', () => {
    const options = (key: string) => component.filterColumns.find(c => c.key === key)!.options!.map(o => (o as { label: string }).label);
    expect(options('event_type')).toEqual(['demo-logs.event_create', 'demo-logs.event_password_changed']);
    expect(options('module')).toEqual(['demo-logs.module_demo_thing', 'demo-logs.module_translation_demo']);
    expect(component.graphColumns.map(g => [g.key, g.aggregation, g.possibleValues])).toEqual([
      ['event_type', 'count', CONFIG.eventTypes],
      ['module', 'count', CONFIG.modules],
    ]);
    expect(auditLogLabelKey('module_', 'ShopOrder (Checkout)')).toBe('module_shop_order_checkout');
  });

  /**
   * @description Toolbar: filters, reports (only with the report permission), export; the filter
   *   button follows the state of the panel.
   * @input  without / with 'demo-view-logs'; filter panel open
   * @output report hidden / shown; filter label 'audit-log.toolbar_hide_filters', active
   */
  it('builds the toolbar by permission and filter state', () => {
    ctx.permissions.granted = new Set();
    expect(component.toolbarButtons.map(b => b.action)).toEqual(['toggleFilters', 'openGraphBuilder', 'exportActiveTable']);
    expect(toolbar()['openGraphBuilder'].showIf).toBeFalse();
    ctx.permissions.granted = new Set(['demo-view-logs']);
    expect(toolbar()['openGraphBuilder'].showIf).toBeTrue();
    component.isFilterVisible = true;
    expect(toolbar()['toggleFilters'].label).toBe('audit-log.toolbar_hide_filters');
    expect(toolbar()['toggleFilters'].isActive).toBeTrue();
  });

  /**
   * @description Only the filter, report and export actions do something.
   * @input  toggleFilters, openGraphBuilder, handleCreateFormOpened, toggleTable
   * @output filters open; graph builder open; no create form; no trash table
   */
  it('handles only its own toolbar actions', () => {
    component.handleToolbarAction('toggleFilters');
    component.handleToolbarAction('openGraphBuilder');
    component.handleToolbarAction('handleCreateFormOpened');
    component.handleToolbarAction('toggleTable');
    expect(component.isFilterVisible).toBeTrue();
    expect(component.showGraphBuilder).toBeTrue();
    expect(component.showCreateForm).toBeFalse();
    expect(component.showTrashTable).toBeFalse();
  });

  /**
   * @description The detail of a row is loaded by its id; a row without id opens nothing;
   *   closing clears it.
   * @input  handleViewDetails({ id: 5 }); ({}); handleCloseDetails()
   * @output getOne('demo/logs/5') once; detail shown, then cleared
   */
  it('opens and closes the detail of a row', () => {
    (ctx.dataHandler as any).getOne.and.returnValue(of({ id: 5 }));
    component.handleViewDetails({ id: 5 });
    component.handleViewDetails({});
    expect((ctx.dataHandler as any).getOne.calls.allArgs()).toEqual([['demo/logs/5']]);
    expect(component.showDetails).toBeTrue();
    expect(component.selectedItemForDetails).toEqual({ id: 5 });
    component.handleCloseDetails();
    expect(component.showDetails).toBeFalse();
    expect(component.selectedItemForDetails).toBeNull();
  });

  /**
   * @description After sign-in the rows are loaded; a reload uses the current filters; the page
   *   renders its caption.
   * @input  ngOnInit(); refreshData(); detectChanges()
   * @output getPaginatedData('demo/logs', …); invalidateEndpoint('demo/logs'); text
   *   'demo-logs.table_header'
   */
  it('loads, reloads and renders the log', fakeAsync(() => {
    component.ngOnInit();
    expect(ctx.genericTable.getPaginatedData.calls.argsFor(0)[0]).toBe('demo/logs');
    component.refreshData();
    expect(ctx.genericTable.invalidateEndpoint).toHaveBeenCalledWith('demo/logs');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('demo-logs.table_header');
    discardPeriodicTasks();
  }));

  /**
   * @description Every route of the admin showing this page (core and installed applications)
   *   carries a complete configuration whose report permission is the permission of the route.
   * @input  page routes of ADMIN_ROUTES with data.auditLog
   * @output core/logs and at least one more; endpoint, section, event types and modules set;
   *   reportPermission = data.permission
   */
  it('is configured on every log route of the admin', () => {
    const pages: { path: string; data: Route['data'] }[] = [];
    const collect = (routes: Route[], prefix: string) => routes.forEach(route => {
      const path = [prefix, route.path].filter(Boolean).join('/');
      if (route.data?.[AUDIT_LOG_ROUTE_DATA]) pages.push({ path, data: route.data });
      if (route.children) collect(route.children, path);
    });
    collect(ADMIN_ROUTES, '');
    expect(pages.map(p => p.path)).toContain('core/logs');
    expect(pages.length).toBeGreaterThan(1);
    for (const { path, data } of pages) {
      const config: AuditLogPageConfig = data![AUDIT_LOG_ROUTE_DATA];
      expect(config.endpoint).withContext(path).toMatch(/^[a-z-]+\/logs$/);
      expect(config.section).withContext(path).toMatch(/-logs$/);
      expect(config.eventTypes.length).withContext(path).toBeGreaterThan(0);
      expect(config.modules.length).withContext(path).toBeGreaterThan(0);
      expect(config.reportPermission).withContext(path).toBe(data!['permission']);
    }
  });
});
