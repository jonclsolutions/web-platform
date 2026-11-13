/**
 * @file portal-logs.component.spec.ts
 * @path src/app/apps/project-portal/admin/portal-logs/portal-logs.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of PortalLogsComponent and portal-logs.config.ts – the read-only audit log
 *   of the project portal: configuration, chartable columns, toolbar by permission and filter
 *   state, toolbar actions, loading of project-portal/logs and the detail view.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (all admin doubles)
 */

import { ComponentFixture, TestBed, fakeAsync, discardPeriodicTasks } from '@angular/core/testing';
import { of } from 'rxjs';

import { PortalLogsComponent } from './portal-logs.component';
import { EVENT_TYPE_VALUES, FORM_FIELDS, MODULE_VALUES } from './portal-logs.config';
import { AdminTestContext, createAdminTestContext } from '../../../../../testing/admin-test-helpers';

describe('PortalLogsComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<PortalLogsComponent>;
  let component: PortalLogsComponent;

  const toolbar = () => Object.fromEntries(component.toolbarButtons.map(b => [b.action, b]));

  beforeEach(async () => {
    ctx = createAdminTestContext();
    await TestBed.configureTestingModule({ imports: [PortalLogsComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(PortalLogsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  /**
   * @description The log is read-only: only the details button, no form fields.
   * @input  component created
   * @output buttons ['details']; FORM_FIELDS []; 7 columns; 5 filters; 11 detail columns; caption and
   *   headers from the project-portal-logs section
   */
  it('builds a read-only configuration', () => {
    expect(component.buttons.map(b => b.action)).toEqual(['details']);
    expect(FORM_FIELDS).toEqual([]);
    expect(component.tableColumns.map(c => c.key)).toEqual(['id', 'created_at', 'user_plain', 'event_type', 'module', 'description', 'origin']);
    expect(component.filterColumns.map(c => c.key)).toEqual(['id', 'user_plain', 'event_type', 'module', 'origin']);
    expect(component.detailsColumns.length).toBe(11);
    expect(component.tableCaption).toBe('project-portal-logs.table_header');
    expect(component.tableColumns[1].header).toBe('project-portal-logs.col_time');
    expect(component.buttons[0].header_name).toBe('project-portal-logs.btn_details');
  });

  /**
   * @description Event type and module can be charted (count) with their known values.
   * @input  graphColumns
   * @output event_type (44 values) and module (8 values)
   */
  it('offers chartable columns', () => {
    expect(component.graphColumns.map(g => [g.key, g.aggregation, g.possibleValues!.length])).toEqual([
      ['event_type', 'count', 44], ['module', 'count', 8]
    ]);
  });

  /**
   * @description The event / module filters use the values the API writes (exact-match filter of
   *   project-portal/logs), with translated labels; no module name of the former web log.
   * @input  filterColumns event_type / module
   * @output modules Project … ProjectPortal with module_* labels; events with event_* labels; no 'WebProject' / 'login'
   */
  it('filters by the real event types and modules', () => {
    const opts = (key: string) => (component.filterColumns.find(c => c.key === key) as any).options;
    expect(opts('module').map((o: any) => o.value)).toEqual(MODULE_VALUES);
    expect(opts('module')[0]).toEqual({ value: 'Project', label: 'project-portal-logs.module_project' });
    expect(opts('module')[7]).toEqual({ value: 'ProjectPortal', label: 'project-portal-logs.module_project_portal' });
    expect(opts('event_type').map((o: any) => o.value)).toEqual(EVENT_TYPE_VALUES);
    expect(opts('event_type')[0]).toEqual({ value: 'create', label: 'project-portal-logs.event_create' });
    expect(MODULE_VALUES).not.toContain('WebProject');
    expect(EVENT_TYPE_VALUES).not.toContain('login');
  });

  /**
   * @description Reports need 'project-portal-view-logs'; filters label follows the state.
   * @input  granted []; then all and filters open
   * @output openGraphBuilder hidden without permission; toolbar_hide_filters active when open, toolbar_filters when closed
   */
  it('builds the toolbar by permission and filter state', () => {
    ctx.permissions.granted = new Set();
    expect(toolbar()['openGraphBuilder'].showIf).toBeFalse();
    expect(toolbar()['exportActiveTable'].showIf).toBeTrue();
    ctx.permissions.granted = 'all';
    expect(toolbar()['openGraphBuilder'].showIf).toBeTrue();
    expect(toolbar()['toggleFilters'].label).toBe('project-portal-logs.toolbar_filters');
    component.isFilterVisible = true;
    expect(toolbar()['toggleFilters'].label).toBe('project-portal-logs.toolbar_hide_filters');
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
   * @description project-portal/logs is loaded after the auth check and on refresh.
   * @input  ngOnInit(); filters { module: 'ProjectThread' }; refreshData()
   * @output getPaginatedData('project-portal/logs', …); refresh with module 'ProjectThread'
   */
  it('loads the logs', fakeAsync(() => {
    component.ngOnInit();
    expect(ctx.genericTable.getPaginatedData.calls.first().args[0]).toBe('project-portal/logs');
    component.filters = { module: 'ProjectThread' };
    component.refreshData();
    expect(ctx.genericTable.getPaginatedData.calls.mostRecent().args[3]).toEqual(jasmine.objectContaining({ module: 'ProjectThread' }));
    discardPeriodicTasks();
  }));

  /**
   * @description Details are loaded by id and can be closed; rows without id are ignored.
   * @input  handleViewDetails({ id: 4 }); ({}); handleCloseDetails()
   * @output getOne('project-portal/logs/4'); details shown; no request without id; closed and cleared
   */
  it('shows and closes the details', () => {
    (ctx.dataHandler as any).getOne.and.returnValue(of({ id: 4 }));
    component.handleViewDetails({ id: 4 });
    expect((ctx.dataHandler as any).getOne).toHaveBeenCalledWith('project-portal/logs/4');
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
   * @output text contains the translated header
   */
  it('renders the page', fakeAsync(() => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('project-portal-logs.table_header');
    discardPeriodicTasks();
  }));
});
