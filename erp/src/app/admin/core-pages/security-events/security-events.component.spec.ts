/**
 * @file security-events.component.spec.ts
 * @path src/app/admin/core-pages/security-events/security-events.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of SecurityEventsComponent – the security events page: 14-day severity
 *   chart (data, bar segments, day filter, tooltip side), retention setting and purge, and the
 *   triage modal (status + notes, false-positive confirmation).
 * @dependencies
 * - src/testing/admin-test-helpers.ts (all admin doubles)
 */

import { ComponentFixture, TestBed, fakeAsync, discardPeriodicTasks } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { SecurityEventsComponent } from './security-events.component';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('SecurityEventsComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<SecurityEventsComponent>;
  let component: SecurityEventsComponent;

  const today = () => new Date().toISOString().slice(0, 10);
  /** DataHandler.get answers per URL: stats and settings. */
  const answer = (stats: any[] = [], retention: any = { id: 1, retention_days: 30 }) => {
    (ctx.dataHandler as any).get.and.callFake((url: string) =>
      url.startsWith('core/security_events/stats') ? of({ data: stats }) : of(retention));
  };

  beforeEach(async () => {
    ctx = createAdminTestContext();
    await TestBed.configureTestingModule({ imports: [SecurityEventsComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(SecurityEventsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  /**
   * @description Events are sorted by last occurrence, newest first (also after clearing filters).
   * @input  new component; clearFilters()
   * @output filters { sort_by: 'last_seen_at', sort_direction: 'desc' }
   */
  it('sorts by last occurrence', () => {
    expect(component.filters).toEqual({ sort_by: 'last_seen_at', sort_direction: 'desc' });
    component.filters = { name: 'x' };
    component.clearFilters();
    expect(component.filters).toEqual({ sort_by: 'last_seen_at', sort_direction: 'desc' });
  });

  /**
   * @description Init loads the table, the 14-day stats and the retention setting.
   * @input  ngOnInit(); stats [{ today, critical, 3 }, { today, info, 2 }]; retention 30
   * @output get('core/security_events/stats?days=14'); 14 chart days; today total 5 (critical 3, info 2); chartMaxTotal 5; retentionDays 30
   */
  it('loads stats and settings on init', fakeAsync(() => {
    answer([{ day: today(), severity: 'critical', total: 3 }, { day: today(), severity: 'info', total: 2 }]);
    component.ngOnInit();
    expect((ctx.dataHandler as any).get).toHaveBeenCalledWith('core/security_events/stats?days=14');
    expect(component.chartDays.length).toBe(14);
    const last = component.chartDays[13];
    expect(last).toEqual({ day: today(), info: 2, warning: 0, critical: 3, total: 5 });
    expect(component.chartMaxTotal).toBe(5);
    expect(component.retentionDays).toBe(30);
    expect(component.statsLoading).toBeFalse();
    expect(component.settingsLoading).toBeFalse();
    discardPeriodicTasks();
  }));

  /**
   * @description Rows outside the 14-day window are ignored; a failed stats call shows an empty chart.
   * @input  stats row for '2000-01-01'; then stats request failing
   * @output all totals 0; after failure chartDays []
   */
  it('ignores old rows and survives a stats error', fakeAsync(() => {
    answer([{ day: '2000-01-01', severity: 'info', total: 9 }]);
    component.ngOnInit();
    expect(component.chartDays.every(d => d.total === 0)).toBeTrue();
    (ctx.dataHandler as any).get.and.returnValue(throwError(() => new Error('x')));
    (component as any).loadStats();
    expect(component.chartDays).toEqual([]);
    discardPeriodicTasks();
  }));

  /**
   * @description Small severities keep a minimum visible share (14 %) of the bar.
   * @input  today: info 98, critical 2 (max total 100)
   * @output segment heights sum to 100 %; critical exactly 14 %
   */
  it('gives small segments a minimum visible height', fakeAsync(() => {
    answer([{ day: today(), severity: 'info', total: 98 }, { day: today(), severity: 'critical', total: 2 }]);
    component.ngOnInit();
    const seg = component.chartSegments[13];
    expect(seg.critical).toBeCloseTo(14, 5);
    expect(seg.info + seg.warning + seg.critical).toBeCloseTo(100, 5);
    discardPeriodicTasks();
  }));

  /**
   * @description Clicking a chart day filters the table to that day.
   * @input  filterByChartDay('2026-03-04')
   * @output filters date_from '2026-03-04 00:00:00', date_to '2026-03-04 23:59:59'; filters panel open; page 1; reload
   */
  it('filters the table by a chart day', () => {
    component.filterByChartDay('2026-03-04');
    expect(component.filters).toEqual(jasmine.objectContaining({ date_from: '2026-03-04 00:00:00', date_to: '2026-03-04 23:59:59' }));
    expect(component.isFilterVisible).toBeTrue();
    expect(component.currentPage).toBe(1);
    expect(ctx.genericTable.invalidateEndpoint).toHaveBeenCalledWith('core/security_events');
  });

  /**
   * @description The tooltip opens to the side that keeps it inside the window.
   * @input  column centred at x=20, at the middle and at window width - 20
   * @output 'left', 'center', 'right'; hoveredChartIndex set, cleared on leave
   */
  it('places the chart tooltip inside the window', () => {
    const at = (x: number) => ({ currentTarget: { getBoundingClientRect: () => ({ left: x - 5, width: 10 }) } } as any);
    component.onChartColumnEnter(at(20), 0);
    expect(component.tooltipHorizontal).toBe('left');
    component.onChartColumnEnter(at(window.innerWidth / 2), 1);
    expect(component.tooltipHorizontal).toBe('center');
    component.onChartColumnEnter(at(window.innerWidth - 20), 2);
    expect(component.tooltipHorizontal).toBe('right');
    expect(component.hoveredChartIndex).toBe(2);
    component.onChartColumnLeave();
    expect(component.hoveredChartIndex).toBeNull();
  });

  /**
   * @description Saving the retention sends the chosen number of days.
   * @input  retentionDays 60; saveRetention(); API returns { retention_days: 60 }
   * @output put('core/security_settings', { retention_days: 60 }); success alert; settingsSaving false
   */
  it('saves the retention period', () => {
    (ctx.dataHandler as any).put.and.returnValue(of({ retention_days: 60 }));
    component.retentionDays = 60;
    component.saveRetention();
    expect((ctx.dataHandler as any).put).toHaveBeenCalledWith('core/security_settings', { retention_days: 60 });
    expect(ctx.alert.open).toHaveBeenCalledWith('security-events.saved_title', 'security-events.retention_updated_message', 'success');
    expect(component.settingsSaving).toBeFalse();
  });

  /**
   * @description Purging old events asks first, then deletes and reloads table and stats.
   * @input  confirm → true; purgeOldEvents(); API { message: 'Deleted 5' }
   * @output delete('core/security_events/purge'); alert with 'Deleted 5'; stats reloaded
   */
  it('purges old events after confirmation', async () => {
    answer();
    (ctx.dataHandler as any).delete.and.returnValue(of({ message: 'Deleted 5' }));
    await component.purgeOldEvents();
    expect((ctx.dataHandler as any).delete).toHaveBeenCalledWith('core/security_events/purge');
    expect(ctx.alert.open).toHaveBeenCalledWith('security-events.purge_done_title', 'Deleted 5', 'success');
    expect((ctx.dataHandler as any).get).toHaveBeenCalledWith('core/security_events/stats?days=14');
  });

  /**
   * @description A cancelled purge deletes nothing.
   * @input  confirm → false
   * @output delete not called
   */
  it('does not purge when cancelled', async () => {
    ctx.confirm.open.and.returnValue(Promise.resolve(false));
    await component.purgeOldEvents();
    expect((ctx.dataHandler as any).delete).not.toHaveBeenCalled();
  });

  /**
   * @description Editing a row opens the triage modal with its status and notes.
   * @input  handleEditFormOpened({ id: 3, status: 'investigating', notes: 'n' }); then a row without status
   * @output triageItem set; triageStatus 'investigating', notes 'n'; default status 'new'
   */
  it('opens the triage modal', () => {
    component.handleEditFormOpened({ id: 3, status: 'investigating', notes: 'n' });
    expect(component.triageStatus).toBe('investigating');
    expect(component.triageNotes).toBe('n');
    component.handleEditFormOpened({ id: 4 });
    expect(component.triageStatus).toBe('new');
    expect(component.triageNotes).toBe('');
  });

  /**
   * @description Saving the triage updates status and notes of the event.
   * @input  triage { id: 3 }, status 'resolved', notes 'ok'; saveTriage()
   * @output put('core/security_events/3', { status: 'resolved', notes: 'ok' }); modal closed; success alert
   */
  it('saves the triage', async () => {
    component.handleEditTriage({ id: 3 });
    component.triageStatus = 'resolved';
    component.triageNotes = 'ok';
    await component.saveTriage();
    expect((ctx.dataHandler as any).put).toHaveBeenCalledWith('core/security_events/3', { status: 'resolved', notes: 'ok' });
    expect(component.triageItem).toBeNull();
    expect(ctx.alert.open).toHaveBeenCalledWith('security-events.saved_title', 'security-events.status_updated_message', 'success');
  });

  /**
   * @description Marking as false positive needs an extra confirmation.
   * @input  status 'false_positive'; confirm → false
   * @output confirm asked; put not called; modal stays open
   */
  it('asks before marking a false positive', async () => {
    ctx.confirm.open.and.returnValue(Promise.resolve(false));
    component.handleEditTriage({ id: 3 });
    component.triageStatus = 'false_positive';
    await component.saveTriage();
    expect(ctx.confirm.open).toHaveBeenCalledWith('security-events.mark_false_positive_confirm_title', 'security-events.mark_false_positive_confirm_message');
    expect((ctx.dataHandler as any).put).not.toHaveBeenCalled();
    expect(component.triageItem).not.toBeNull();
  });

  /**
   * @description The modal cannot be closed while saving.
   * @input  triageSaving true → closeTriageModal(); false → closeTriageModal()
   * @output still open, then closed
   */
  it('keeps the triage modal open while saving', () => {
    component.handleEditTriage({ id: 3 });
    component.triageSaving = true;
    component.closeTriageModal();
    expect(component.triageItem).not.toBeNull();
    component.triageSaving = false;
    component.closeTriageModal();
    expect(component.triageItem).toBeNull();
  });

  /**
   * @description Only filter, report and export toolbar actions exist; the report needs core-security-view.
   * @input  toolbarButtons with granted []
   * @output actions toggleFilters, openGraphBuilder (showIf false), exportActiveTable
   */
  it('builds the toolbar', () => {
    ctx.permissions.granted = new Set();
    const buttons = component.toolbarButtons;
    expect(buttons.map(b => b.action)).toEqual(['toggleFilters', 'openGraphBuilder', 'exportActiveTable']);
    expect(buttons[1].showIf).toBeFalse();
  });

  /**
   * @description Chart day labels use the admin date locale.
   * @input  formatChartDayLabel('2026-03-04')
   * @output '4. 3.' (cs-CZ numeric day and month)
   */
  it('formats chart labels in the admin locale', () => {
    expect(component.formatChartDayLabel('2026-03-04')).toBe(new Date('2026-03-04T00:00:00').toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' }));
  });

  /**
   * @description The page renders.
   * @input  detectChanges() with empty stats
   * @output text contains 'security-events.table_header'
   */
  it('renders the page', fakeAsync(() => {
    answer();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('security-events.table_header');
    discardPeriodicTasks();
  }));
});
