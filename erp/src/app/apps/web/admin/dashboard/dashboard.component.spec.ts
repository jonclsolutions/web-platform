/**
 * @file dashboard.component.spec.ts
 * @path src/app/apps/web/admin/dashboard/dashboard.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of DashboardComponent – the dashboard of the Web module: statistics
 *   only for the sections the user may see (failed counts), hero / secondary
 *   stats, log-scaled bars and the distribution bar, recent activity with its breakdown,
 *   navigation tiles by permission, refresh past the cache (also of the state of the web in the
 *   header), icons and date / event formatting.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (DataHandler spy, permission stub, alert spy, i18n stub),
 *   ResourceCacheService (real, spied on for the error paths), AppStatusService (spied on)
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { DashboardComponent } from './dashboard.component';
import { ResourceCacheService } from '../../../../core/services/resource-cache.service';
import { AppStatusService } from '../../../../admin/components/app-status/app-status.service';
import { AdminTestContext, createAdminTestContext } from '../../../../../testing/admin-test-helpers';

describe('DashboardComponent (web)', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;

  const totals: Record<string, number> = {
    'web/job_applications?per_page=1': 0,
    'web/raw_request_commissions?per_page=1': 9,
    'web/logs?per_page=1': 900
  };
  const logs = [
    { id: 1, event_type: 'create' }, { id: 2, event_type: 'create' }, { id: 3, event_type: 'payment' },
    { id: 4, event_type: 'hard_delete' }, { id: 5, event_type: 'custom' }
  ];
  const ACTIVITY_URL = 'web/logs?per_page=8&sort_by=created_at&sort_direction=desc';
  const urls = () => (ctx.dataHandler as any).getPaginatedCollection.calls.allArgs().map((a: any[]) => a[0]);

  beforeEach(async () => {
    ctx = createAdminTestContext();
    (ctx.dataHandler as any).getPaginatedCollection.and.callFake((url: string) =>
      url === ACTIVITY_URL ? of({ data: logs }) : of({ data: [], meta: { total: totals[url] } }));
    await TestBed.configureTestingModule({ imports: [DashboardComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  /**
   * @description With all permissions every statistic is loaded; none of them is urgent.
   * @input  ngOnInit(), all permissions
   * @output 3 stats in order jobApps, rawRequests, webLogs with their totals; no urgent stat; loadingStats false; lastUpdatedAt set
   */
  it('loads all statistics', () => {
    component.ngOnInit();
    expect(component.quickStats.map(s => [s.key, s.value])).toEqual([
      ['jobApps', 0], ['rawRequests', 9], ['webLogs', 900]
    ]);
    expect(component.quickStats.filter(s => s.urgent)).toEqual([]);
    expect(component.loadingStats).toBeFalse();
    expect(component.lastUpdatedAt).toEqual(jasmine.any(Date));
    expect(component.t('header_title')).toBe('web-dashboard.header_title');
  });

  /**
   * @description Only allowed statistics are requested; a failed one shows '—' and is never urgent.
   * @input  granted ['web-job-applications-view', 'web-user-requests-view']; inquiries request fails
   * @output stats jobApps 0, rawRequests '—' (urgent false); no request for the logs; no activity
   */
  it('requests only allowed statistics and survives a failed one', () => {
    ctx.permissions.granted = new Set(['web-job-applications-view', 'web-user-requests-view']);
    (ctx.dataHandler as any).getPaginatedCollection.and.callFake((url: string) =>
      url.startsWith('web/raw_request_commissions') ? throwError(() => new Error('x')) : of({ data: [], meta: { total: totals[url] } }));
    component.ngOnInit();
    expect(component.quickStats.map(s => [s.key, s.value, !!s.urgent])).toEqual([['jobApps', 0, false], ['rawRequests', '—', false]]);
    expect(urls()).not.toContain('web/logs?per_page=1');
    expect(urls()).not.toContain(ACTIVITY_URL);
    expect(component.recentActivity).toEqual([]);
    expect(component.loadingActivity).toBeFalse();
  });

  /**
   * @description Without any statistic permission the dashboard does not stay in the loading state.
   * @input  granted [] ; ngOnInit()
   * @output quickStats []; loadingStats false; isRefreshing false
   */
  it('finishes loading when no statistic is allowed', () => {
    ctx.permissions.granted = new Set();
    component.ngOnInit();
    expect(component.quickStats).toEqual([]);
    expect(component.loadingStats).toBeFalse();
    expect(component.isRefreshing).toBeFalse();
    expect(component.heroStat).toBeNull();
    expect(component.distributionSegments).toEqual([]);
  });

  /**
   * @description Errors of the statistics / activity streams end the loading state without an unhandled error.
   * @input  ResourceCacheService.get returns an error
   * @output loadingStats false, isRefreshing false, loadingActivity false
   */
  it('ends loading when the cached streams fail', () => {
    spyOn(TestBed.inject(ResourceCacheService), 'get').and.returnValue(throwError(() => new Error('x')));
    component.isRefreshing = true;
    component.ngOnInit();
    expect(component.loadingStats).toBeFalse();
    expect(component.isRefreshing).toBeFalse();
    expect(component.loadingActivity).toBeFalse();
  });

  /**
   * @description The hero stat is the first one or the chosen one; the dropdown opens and closes.
   * @input  stats loaded; toggleHeroDropdown(); selectHeroStat('rawRequests'); toggle + closeHeroDropdown(); unknown key
   * @output hero jobApps → rawRequests; secondary without it; dropdown closed; unknown key falls back to the first stat
   */
  it('lets the user choose the hero statistic', () => {
    component.ngOnInit();
    expect(component.heroStat?.key).toBe('jobApps');
    component.toggleHeroDropdown();
    expect(component.heroDropdownOpen).toBeTrue();
    component.selectHeroStat('rawRequests');
    expect(component.heroStat?.key).toBe('rawRequests');
    expect(component.secondaryStats.map(s => s.key)).not.toContain('rawRequests');
    expect(component.heroDropdownOpen).toBeFalse();
    component.toggleHeroDropdown();
    component.closeHeroDropdown();
    expect(component.heroDropdownOpen).toBeFalse();
    component.selectHeroStat('nope');
    expect(component.heroStat?.key).toBe('jobApps');
  });

  /**
   * @description Bars use a log scale (largest = 100 %, minimum 8 %, zero or '—' = 4 %).
   * @input  stats loaded (max 900); rawRequests 9; jobApps 0; a '—' stat; then all stats '—' except one
   * @output webLogs 100; rawRequests between 8 and 100; jobApps 4; '—' 4; failed stats do not change the scale
   */
  it('computes logarithmic stat bars', () => {
    component.ngOnInit();
    const stat = (k: string) => component.quickStats.find(s => s.key === k)!;
    expect(component.statBarPct(stat('webLogs'))).toBe(100);
    expect(component.statBarPct(stat('rawRequests'))).toBeGreaterThanOrEqual(8);
    expect(component.statBarPct(stat('rawRequests'))).toBeLessThan(100);
    expect(component.statBarPct(stat('jobApps'))).toBe(4);
    expect(component.statBarPct({ ...stat('rawRequests'), value: '—' })).toBe(4);
    component.quickStats = [{ ...stat('rawRequests') }, { ...stat('webLogs'), value: '—' }];
    expect(component.statBarPct(component.quickStats[0])).toBe(100);
  });

  /**
   * @description The distribution bar is sorted by value, sums to ~100 %, gives zero a small share and fades the opacity.
   * @input  stats loaded (3 numeric values, jobApps 0); then one '—' value
   * @output first segment webLogs opacity 1; last (3rd) jobApps with pct > 0 and opacity 0.66; pct sum ≈ 100; '—' left out
   */
  it('computes the distribution segments', () => {
    component.ngOnInit();
    const seg = component.distributionSegments;
    expect(seg[0].key).toBe('webLogs');
    expect(seg[0].opacity).toBe(1);
    expect(seg[seg.length - 1].key).toBe('jobApps');
    expect(seg[seg.length - 1].pct).toBeGreaterThan(0);
    expect(seg[seg.length - 1].opacity).toBe(0.66);
    expect(seg.reduce((s, x) => s + x.pct, 0)).toBeCloseTo(100, 0);
    component.quickStats[1].value = '—';
    expect(component.distributionSegments.map(s => s.key)).not.toContain('rawRequests');
  });

  /**
   * @description Recent activity (8 newest web logs) is loaded and grouped by event kind.
   * @input  logs: 2× create, payment (counts as create), hard_delete, custom
   * @output request ACTIVITY_URL; breakdown ev-create 3 first, ev-delete 1, ev-default 1; create bar 100 %, delete 33 %
   */
  it('loads recent activity and its breakdown', () => {
    component.ngOnInit();
    expect(urls()).toContain(ACTIVITY_URL);
    expect(component.recentActivity.length).toBe(5);
    expect(component.activityBreakdown).toEqual([
      { classKey: 'ev-create', labelKey: 'breakdown_create_label', count: 3 },
      { classKey: 'ev-delete', labelKey: 'breakdown_delete_label', count: 1 },
      { classKey: 'ev-default', labelKey: 'breakdown_default_label', count: 1 }
    ]);
    expect(component.breakdownBarPct(component.activityBreakdown[0])).toBe(100);
    expect(component.breakdownBarPct(component.activityBreakdown[1])).toBe(33);
    expect(component.loadingActivity).toBeFalse();
  });

  /**
   * @description The activity accepts a plain array, a paginated object or a failed request.
   * @input  activity answers [log], then null (request failed)
   * @output recentActivity [log]; then []
   */
  it('accepts every activity response shape', () => {
    (ctx.dataHandler as any).getPaginatedCollection.and.callFake((url: string) =>
      url === ACTIVITY_URL ? of({ data: [{ id: 9, event_type: 'export' }] }) : of({ data: [], meta: { total: 1 } }));
    component.ngOnInit();
    expect(component.recentActivity.map(l => l.id)).toEqual([9]);
    (ctx.dataHandler as any).getPaginatedCollection.and.callFake((url: string) =>
      url === ACTIVITY_URL ? throwError(() => new Error('x')) : of({ data: [], meta: { total: 1 } }));
    component.refresh();
    expect(component.recentActivity).toEqual([]);
    expect(component.maxBreakdownCount).toBe(1);
  });

  /**
   * @description Refresh bypasses the cache (also the state of the web shown in the header) and is
   *   ignored while running.
   * @input  ngOnInit(); refresh(); refresh() while isRefreshing
   * @output appId 'web'; second round of requests; AppStatusService.load(true); isRefreshing false
   *   at the end; no third round while refreshing
   */
  it('refresh() reloads past the cache', () => {
    const status = spyOn(TestBed.inject(AppStatusService), 'load');
    expect(component.appId).toBe('web');
    component.ngOnInit();
    const first = urls().length;
    component.refresh();
    expect(urls().length).toBe(first * 2);
    expect(status).toHaveBeenCalledWith(true);
    expect(component.isRefreshing).toBeFalse();
    component.isRefreshing = true;
    component.refresh();
    expect(urls().length).toBe(first * 2);
  });

  /**
   * @description Navigation tiles follow the permissions.
   * @input  granted ['web-edit-website-view', 'web-view-web-logs']
   * @output tile routes ['/admin/web/edit-website', '/admin/web/logs']
   */
  it('shows navigation tiles by permission', () => {
    ctx.permissions.granted = new Set(['web-edit-website-view', 'web-view-web-logs']);
    expect(component.visibleNavSections.map(s => s.route)).toEqual(['/admin/web/edit-website', '/admin/web/logs']);
    ctx.permissions.granted = 'all';
    expect(component.visibleNavSections.length).toBe(4);
  });

  /**
   * @description Icons are trusted SVG markup; unknown keys give an empty icon.
   * @input  getIcon('mail'), getIcon('unknown')
   * @output SafeHtml containing '<svg'; empty SafeHtml
   */
  it('returns the icons', () => {
    expect(String((component.getIcon('mail') as any).changingThisBreaksApplicationSecurity)).toContain('<svg');
    expect((component.getIcon('unknown') as any).changingThisBreaksApplicationSecurity).toBe('');
  });

  /**
   * @description Event types get translated labels (shared ones from `dashboard`, own ones from
   *   the section of the web dashboard) and colour classes; unknown ones stay as they are.
   * @input  eventTypeLabel('soft_delete'), ('payment'), ('custom'); eventTypeClass('payment'), ('custom')
   * @output 'dashboard.ev_label_soft_delete', 'web-dashboard.ev_label_payment', 'custom'; 'ev-create', 'ev-default'
   */
  it('maps event types to labels and classes', () => {
    expect(component.eventTypeLabel('soft_delete')).toBe('dashboard.ev_label_soft_delete');
    expect(component.eventTypeLabel('payment')).toBe('web-dashboard.ev_label_payment');
    expect(component.eventTypeLabel('custom')).toBe('custom');
    expect(component.eventTypeClass('payment')).toBe('ev-create');
    expect(component.eventTypeClass('custom')).toBe('ev-default');
  });

  /**
   * @description Dates use the admin locale; empty dates show '—'.
   * @input  formatDate(''), formatDate('2026-03-04T05:06:00')
   * @output '—'; cs-CZ formatted date
   */
  it('formats dates', () => {
    expect(component.formatDate('')).toBe('—');
    expect(component.formatDate('2026-03-04T05:06:00')).toBe(new Date('2026-03-04T05:06:00').toLocaleString('cs-CZ', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }));
  });
});
