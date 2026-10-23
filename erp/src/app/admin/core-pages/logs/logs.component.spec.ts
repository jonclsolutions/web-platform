/**
 * @file logs.component.spec.ts
 * @path src/app/admin/core-pages/logs/logs.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of CoreLogsComponent – the read-only core system log: newest first,
 *   only filter / report / export toolbar actions, details by business_log_id.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (all admin doubles)
 */

import { ComponentFixture, TestBed, fakeAsync, discardPeriodicTasks } from '@angular/core/testing';
import { of } from 'rxjs';

import { CoreLogsComponent } from './logs.component';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('CoreLogsComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<CoreLogsComponent>;
  let component: CoreLogsComponent;

  beforeEach(async () => {
    ctx = createAdminTestContext();
    await TestBed.configureTestingModule({ imports: [CoreLogsComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(CoreLogsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  /**
   * @description Logs are sorted newest first and read from core/logs.
   * @input  new component
   * @output apiEndpoint 'core/logs'; filters { sort_by: 'created_at', sort_direction: 'desc' }; tableCaption 'core-logs.table_header'
   */
  it('shows the newest logs first', () => {
    expect(component.apiEndpoint).toBe('core/logs');
    expect(component.filters).toEqual({ sort_by: 'created_at', sort_direction: 'desc' });
    expect(component.tableCaption).toBe('core-logs.table_header');
  });

  /**
   * @description The log is read-only: the toolbar has no create and no trash action.
   * @input  toolbarButtons
   * @output actions ['toggleFilters', 'openGraphBuilder', 'exportActiveTable']
   */
  it('offers only read-only toolbar actions', () => {
    expect(component.toolbarButtons.map(b => b.action)).toEqual(['toggleFilters', 'openGraphBuilder', 'exportActiveTable']);
  });

  /**
   * @description The report button needs the 'view-core' permission.
   * @input  granted []
   * @output openGraphBuilder showIf false
   */
  it('hides the report button without view-core', () => {
    ctx.permissions.granted = new Set();
    expect(component.toolbarButtons.find(b => b.action === 'openGraphBuilder')!.showIf).toBeFalse();
  });

  /**
   * @description Only filter, report and export toolbar actions do something; create/trash are ignored.
   * @input  handleToolbarAction('toggleFilters'), ('openGraphBuilder'), ('handleCreateFormOpened'), ('toggleTable')
   * @output isFilterVisible true; showGraphBuilder true; showCreateForm false; showTrashTable false
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
   * @description Details are loaded by business_log_id when the row has one, otherwise by id.
   * @input  handleViewDetails({ id: 1, business_log_id: 77 }), then ({ id: 5 })
   * @output getOne('core/logs/77'), then getOne('core/logs/5'); showDetails true
   */
  it('loads details by business_log_id or id', () => {
    (ctx.dataHandler as any).getOne.and.returnValue(of({ id: 77 }));
    component.handleViewDetails({ id: 1, business_log_id: 77 });
    component.handleViewDetails({ id: 5 });
    expect((ctx.dataHandler as any).getOne.calls.allArgs()).toEqual([['core/logs/77'], ['core/logs/5']]);
    expect(component.showDetails).toBeTrue();
    expect(component.selectedItemForDetails).toEqual({ id: 77 });
  });

  /**
   * @description Rows without any id do not open details; closing clears them.
   * @input  handleViewDetails({}); handleCloseDetails()
   * @output getOne not called; showDetails false; selectedItemForDetails null
   */
  it('ignores rows without id and closes details', () => {
    component.handleViewDetails({});
    expect((ctx.dataHandler as any).getOne).not.toHaveBeenCalled();
    component.showDetails = true;
    component.handleCloseDetails();
    expect(component.showDetails).toBeFalse();
    expect(component.selectedItemForDetails).toBeNull();
  });

  /**
   * @description After login the logs are loaded; a reload uses the current filters.
   * @input  ngOnInit(); refreshData()
   * @output getPaginatedData('core/logs', …); invalidateEndpoint('core/logs')
   */
  it('loads and reloads the logs', fakeAsync(() => {
    component.ngOnInit();
    expect(ctx.genericTable.getPaginatedData.calls.argsFor(0)[0]).toBe('core/logs');
    component.refreshData();
    expect(ctx.genericTable.invalidateEndpoint).toHaveBeenCalledWith('core/logs');
    discardPeriodicTasks();
  }));

  /**
   * @description The page renders its title.
   * @input  detectChanges()
   * @output text contains 'core-logs.table_header'
   */
  it('renders the page', fakeAsync(() => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('core-logs.table_header');
    discardPeriodicTasks();
  }));
});
