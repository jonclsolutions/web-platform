/**
 * @file business-logs.component.spec.ts
 * @path src/app/admin/web-pages/business-logs/business-logs.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of BusinessLogsComponent and business-logs.config.ts – the read-only
 *   audit log of the Web module: translated configuration, event type / module filter options,
 *   chartable columns, toolbar by permission, toolbar actions, loading of web/logs newest first
 *   and the detail view (business_log_id / id fallback).
 * @dependencies
 * - src/testing/admin-test-helpers.ts (all admin doubles)
 */

import { ComponentFixture, TestBed, fakeAsync, discardPeriodicTasks } from '@angular/core/testing';
import { of } from 'rxjs';

import { BusinessLogsComponent } from './business-logs.component';
import { EVENT_TYPE_VALUES, FORM_FIELDS, MODULE_VALUES } from './business-logs.config';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('BusinessLogsComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<BusinessLogsComponent>;
  let component: BusinessLogsComponent;

  const toolbar = () => Object.fromEntries(component.toolbarButtons.map(b => [b.action, b]));
  const filter = (key: string) => component.filterColumns.find(c => c.key === key) as any;

  beforeEach(async () => {
    ctx = createAdminTestContext();
    await TestBed.configureTestingModule({ imports: [BusinessLogsComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(BusinessLogsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  /**
   * @description The log is read-only: only a details button, no form fields; the rest comes from translations.
   * @input  component created
   * @output caption 'business-logs.table_header'; buttons ['details']; FORM_FIELDS []; 7 columns, 5 filters, 11 detail columns
   */
  it('builds a read-only page configuration', () => {
    expect(component.tableCaption).toBe('business-logs.table_header');
    expect(component.buttons.map(b => b.action)).toEqual(['details']);
    expect(FORM_FIELDS).toEqual([]);
    expect(component.tableColumns.map(c => c.key)).toEqual(['id', 'created_at', 'user_plain', 'event_type', 'module', 'description', 'origin']);
    expect(component.filterColumns.map(c => c.key)).toEqual(['id', 'user_plain', 'event_type', 'module', 'origin']);
    expect(component.detailsColumns.length).toBe(11);
    expect(component.t('btn_details')).toBe('business-logs.btn_details');
  });

  /**
   * @description Event type and module filters offer every known value with a translated label.
   * @input  event_type and module filter columns
   * @output values EVENT_TYPE_VALUES (13) / MODULE_VALUES (8); labels 'business-logs.event_soft_delete', 'business-logs.module_translation_web'
   */
  it('offers translated event types and modules', () => {
    expect(filter('event_type').options!.map((o: any) => o.value)).toEqual(EVENT_TYPE_VALUES);
    expect(filter('event_type').options!.find((o: any) => o.value === 'soft_delete')!.label).toBe('business-logs.event_soft_delete');
    expect(filter('module').options!.map((o: any) => o.value)).toEqual(MODULE_VALUES);
    expect(filter('module').options!.find((o: any) => o.value === 'Translation:web')!.label).toBe('business-logs.module_translation_web');
    expect(filter('event_type').options!.every((o: any) => !o.label.includes('undefined'))).toBeTrue();
  });

  /**
   * @description Event type and module can be charted, counted by default.
   * @input  detailsColumns
   * @output graphColumns event_type (EVENT_TYPE_VALUES) and module (MODULE_VALUES), aggregation 'count'
   */
  it('offers chartable columns', () => {
    expect(component.graphColumns).toEqual([
      { key: 'event_type', label: 'business-logs.details_event_type', aggregation: 'count', possibleValues: EVENT_TYPE_VALUES },
      { key: 'module', label: 'business-logs.details_module', aggregation: 'count', possibleValues: MODULE_VALUES }
    ]);
  });

  /**
   * @description A language change rebuilds the configuration.
   * @input  getValue returns 'EN:<path>'; translations$.next({})
   * @output tableCaption 'EN:business-logs.table_header'
   */
  it('rebuilds the configuration when translations change', () => {
    ctx.i18n.getValue.and.callFake((p: string) => `EN:${p}`);
    ctx.i18n.translations$.next({});
    expect(component.tableCaption).toBe('EN:business-logs.table_header');
  });

  /**
   * @description Reports need 'web-view-web-logs'; filters and export are always available.
   * @input  granted []; then all; isFilterVisible true
   * @output openGraphBuilder showIf false; with all true; filter label 'business-logs.toolbar_hide_filters' active
   */
  it('builds the toolbar by permission and filter state', () => {
    ctx.permissions.granted = new Set();
    expect(toolbar()['openGraphBuilder'].showIf).toBeFalse();
    expect(toolbar()['exportActiveTable'].showIf).toBeTrue();
    ctx.permissions.granted = 'all';
    expect(toolbar()['openGraphBuilder'].showIf).toBeTrue();
    expect(toolbar()['toggleFilters'].label).toBe('business-logs.toolbar_filters');
    component.isFilterVisible = true;
    expect(toolbar()['toggleFilters'].label).toBe('business-logs.toolbar_hide_filters');
    expect(toolbar()['toggleFilters'].isActive).toBeTrue();
  });

  /**
   * @description Toolbar actions call their handlers; unknown actions are ignored.
   * @input  handleToolbarAction('toggleFilters' | 'exportActiveTable' | 'openGraphBuilder' | 'toggleTable')
   * @output first three handlers called once; 'toggleTable' (not offered here) does nothing
   */
  it('dispatches the toolbar actions', () => {
    const spies = ['toggleFilters', 'exportActiveTable', 'openGraphBuilder', 'toggleTable'].map(n => spyOn(component as any, n));
    ['toggleFilters', 'exportActiveTable', 'openGraphBuilder', 'toggleTable'].forEach(a => component.handleToolbarAction(a));
    expect(spies.slice(0, 3).every(s => s.calls.count() === 1)).toBeTrue();
    expect(spies[3]).not.toHaveBeenCalled();
  });

  /**
   * @description Logs are sorted newest first; web/logs is loaded after the auth check and on refresh.
   * @input  new component; ngOnInit(); refreshData()
   * @output filters { sort_by: 'created_at', sort_direction: 'desc' }; getPaginatedData('web/logs', …) on init; refresh sorted by created_at
   * @note The first load uses BaseDataComponent.defaultFilters (id desc), not the page filters – see the
   *   findings in docs (claude/unit-tests-2026-10.md); for logs id order equals time order.
   */
  it('loads the newest logs first', fakeAsync(() => {
    expect(component.filters).toEqual({ sort_by: 'created_at', sort_direction: 'desc' });
    component.ngOnInit();
    expect(ctx.genericTable.getPaginatedData.calls.first().args[0]).toBe('web/logs');
    component.refreshData();
    const args = ctx.genericTable.getPaginatedData.calls.mostRecent().args;
    expect(args[0]).toBe('web/logs');
    expect(args[3]).toEqual(jasmine.objectContaining({ sort_by: 'created_at', sort_direction: 'desc' }));
    discardPeriodicTasks();
  }));

  /**
   * @description Details are loaded by business_log_id, falling back to id; rows without an id are ignored.
   * @input  handleViewDetails({ business_log_id: 5, id: 1 }), ({ id: 7 }), ({})
   * @output getOne('web/logs/5'), getOne('web/logs/7'); details shown; third call does nothing
   */
  it('loads the details by business_log_id or id', () => {
    (ctx.dataHandler as any).getOne.and.callFake((url: string) => of({ url }));
    component.handleViewDetails({ business_log_id: 5, id: 1 });
    expect((ctx.dataHandler as any).getOne).toHaveBeenCalledWith('web/logs/5');
    expect(component.selectedItemForDetails).toEqual({ url: 'web/logs/5' });
    expect(component.showDetails).toBeTrue();
    component.handleViewDetails({ id: 7 });
    expect((ctx.dataHandler as any).getOne).toHaveBeenCalledWith('web/logs/7');
    (ctx.dataHandler as any).getOne.calls.reset();
    component.handleViewDetails({});
    expect((ctx.dataHandler as any).getOne).not.toHaveBeenCalled();
  });

  /**
   * @description Closing the details clears the selection.
   * @input  details open; handleCloseDetails()
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
   * @output text contains 'business-logs.table_header'
   */
  it('renders the page', fakeAsync(() => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('business-logs.table_header');
    discardPeriodicTasks();
  }));
});
