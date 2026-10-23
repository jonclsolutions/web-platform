/**
 * @file dashboard.component.spec.ts
 * @path src/app/admin/web-pages/dashboard/dashboard.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of DashboardComponent – the dashboard of the Web module: statistics
 *   only for the sections the user may see (urgent open tickets, failed counts), hero / secondary
 *   stats, log-scaled bars and the distribution bar, recent activity with its breakdown,
 *   navigation tiles by permission, refresh past the cache, icons, date / event formatting and
 *   switching the public web between live and maintenance mode (password confirmation).
 * @dependencies
 * - src/testing/admin-test-helpers.ts (DataHandler spy, permission stub, alert spy, i18n stub),
 *   ResourceCacheService (real, spied on for the error paths)
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { DashboardComponent } from './dashboard.component';
import { ResourceCacheService } from '../../../core/services/resource-cache.service';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('DashboardComponent (web)', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;

  const totals: Record<string, number> = {
    'web/news?per_page=1': 12, 'web/support_tickets?status=open&per_page=1': 3, 'web/job_applications?per_page=1': 0,
    'web/sales_leads?per_page=1': 40, 'web/sales_orders?per_page=1': 5, 'web/raw_request_commissions?per_page=1': 9,
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
      url === ACTIVITY_URL ? of({ data: logs }) : of({ total: totals[url] }));
    (ctx.dataHandler as any).get.and.returnValue(of({ is_web_active: true, web_maintenance_message: 'Brzy zpět' }));
    await TestBed.configureTestingModule({ imports: [DashboardComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  /**
   * @description With all permissions every statistic is loaded; open tickets > 0 are marked urgent.
   * @input  ngOnInit(), all permissions
   * @output 7 stats in order news … webLogs with their totals; openTickets urgent; loadingStats false; lastUpdatedAt set
   */
  it('loads all statistics', () => {
    component.ngOnInit();
    expect(component.quickStats.map(s => [s.key, s.value])).toEqual([
      ['news', 12], ['openTickets', 3], ['jobApps', 0], ['leads', 40], ['salesOrders', 5], ['rawRequests', 9], ['webLogs', 900]
    ]);
    expect(component.quickStats.filter(s => s.urgent).map(s => s.key)).toEqual(['openTickets']);
    expect(component.loadingStats).toBeFalse();
    expect(component.lastUpdatedAt).toEqual(jasmine.any(Date));
    expect(component.t('header_title')).toBe('web-dashboard.header_title');
  });

  /**
   * @description Only allowed statistics are requested; a failed one shows '—' and is never urgent.
   * @input  granted ['web-news-view', 'web-support-tickets-view']; tickets request fails
   * @output stats news 12, openTickets '—' (urgent false); no request for leads; no activity and no maintenance request
   */
  it('requests only allowed statistics and survives a failed one', () => {
    ctx.permissions.granted = new Set(['web-news-view', 'web-support-tickets-view']);
    (ctx.dataHandler as any).getPaginatedCollection.and.callFake((url: string) =>
      url.startsWith('web/support_tickets') ? throwError(() => new Error('x')) : of({ total: totals[url] }));
    component.ngOnInit();
    expect(component.quickStats.map(s => [s.key, s.value, s.urgent])).toEqual([['news', 12, false], ['openTickets', '—', false]]);
    expect(urls()).not.toContain('web/sales_leads?per_page=1');
    expect(urls()).not.toContain(ACTIVITY_URL);
    expect((ctx.dataHandler as any).get).not.toHaveBeenCalledWith('web/settings');
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
   * @description Errors of the statistics / activity / maintenance streams end the loading state without an unhandled error.
   * @input  ResourceCacheService.get returns an error
   * @output loadingStats false, isRefreshing false, loadingActivity false; maintenance state unchanged (isWebActive true)
   */
  it('ends loading when the cached streams fail', () => {
    spyOn(TestBed.inject(ResourceCacheService), 'get').and.returnValue(throwError(() => new Error('x')));
    component.isRefreshing = true;
    component.ngOnInit();
    expect(component.loadingStats).toBeFalse();
    expect(component.isRefreshing).toBeFalse();
    expect(component.loadingActivity).toBeFalse();
    expect(component.isWebActive).toBeTrue();
  });

  /**
   * @description The hero stat is the first one or the chosen one; the dropdown opens and closes.
   * @input  stats loaded; toggleHeroDropdown(); selectHeroStat('leads'); toggle + closeHeroDropdown(); unknown key
   * @output hero news → leads; secondary without leads; dropdown closed; unknown key falls back to the first stat
   */
  it('lets the user choose the hero statistic', () => {
    component.ngOnInit();
    expect(component.heroStat?.key).toBe('news');
    component.toggleHeroDropdown();
    expect(component.heroDropdownOpen).toBeTrue();
    component.selectHeroStat('leads');
    expect(component.heroStat?.key).toBe('leads');
    expect(component.secondaryStats.map(s => s.key)).not.toContain('leads');
    expect(component.heroDropdownOpen).toBeFalse();
    component.toggleHeroDropdown();
    component.closeHeroDropdown();
    expect(component.heroDropdownOpen).toBeFalse();
    component.selectHeroStat('nope');
    expect(component.heroStat?.key).toBe('news');
  });

  /**
   * @description Bars use a log scale (largest = 100 %, minimum 8 %, zero or '—' = 4 %).
   * @input  stats loaded (max 900); news 12; jobApps 0; a '—' stat; then all stats '—' except one
   * @output webLogs 100; news between 8 and 100; jobApps 4; '—' 4; failed stats do not change the scale
   */
  it('computes logarithmic stat bars', () => {
    component.ngOnInit();
    const stat = (k: string) => component.quickStats.find(s => s.key === k)!;
    expect(component.statBarPct(stat('webLogs'))).toBe(100);
    expect(component.statBarPct(stat('news'))).toBeGreaterThanOrEqual(8);
    expect(component.statBarPct(stat('news'))).toBeLessThan(100);
    expect(component.statBarPct(stat('jobApps'))).toBe(4);
    expect(component.statBarPct({ ...stat('news'), value: '—' })).toBe(4);
    component.quickStats = [{ ...stat('news') }, { ...stat('webLogs'), value: '—' }];
    expect(component.statBarPct(component.quickStats[0])).toBe(100);
  });

  /**
   * @description The distribution bar is sorted by value, sums to ~100 %, gives zero a small share and fades the opacity.
   * @input  stats loaded (7 numeric values, jobApps 0); then one '—' value
   * @output first segment webLogs opacity 1; last jobApps with pct > 0 and opacity 0.22; pct sum ≈ 100; '—' left out
   */
  it('computes the distribution segments', () => {
    component.ngOnInit();
    const seg = component.distributionSegments;
    expect(seg[0].key).toBe('webLogs');
    expect(seg[0].opacity).toBe(1);
    expect(seg[seg.length - 1].key).toBe('jobApps');
    expect(seg[seg.length - 1].pct).toBeGreaterThan(0);
    expect(seg[seg.length - 1].opacity).toBe(0.22);
    expect(seg.reduce((s, x) => s + x.pct, 0)).toBeCloseTo(100, 0);
    component.quickStats[0].value = '—';
    expect(component.distributionSegments.map(s => s.key)).not.toContain('news');
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
      url === ACTIVITY_URL ? of([{ id: 9, event_type: 'export' }]) : of({ total: 1 }));
    component.ngOnInit();
    expect(component.recentActivity.map(l => l.id)).toEqual([9]);
    (ctx.dataHandler as any).getPaginatedCollection.and.callFake((url: string) =>
      url === ACTIVITY_URL ? throwError(() => new Error('x')) : of({ total: 1 }));
    component.refresh();
    expect(component.recentActivity).toEqual([]);
    expect(component.maxBreakdownCount).toBe(1);
  });

  /**
   * @description Refresh bypasses the cache and is ignored while running.
   * @input  ngOnInit(); refresh(); refresh() while isRefreshing
   * @output second round of requests; isRefreshing false at the end; no third round while refreshing
   */
  it('refresh() reloads past the cache', () => {
    component.ngOnInit();
    const first = urls().length;
    component.refresh();
    expect(urls().length).toBe(first * 2);
    expect(component.isRefreshing).toBeFalse();
    component.isRefreshing = true;
    component.refresh();
    expect(urls().length).toBe(first * 2);
  });

  /**
   * @description Navigation tiles follow the permissions.
   * @input  granted ['web-news-view', 'web-view-web-logs']
   * @output tile routes ['/admin/web/edit-news', '/admin/web/business-logs']
   */
  it('shows navigation tiles by permission', () => {
    ctx.permissions.granted = new Set(['web-news-view', 'web-view-web-logs']);
    expect(component.visibleNavSections.map(s => s.route)).toEqual(['/admin/web/edit-news', '/admin/web/business-logs']);
    ctx.permissions.granted = 'all';
    expect(component.visibleNavSections.length).toBe(8);
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
   * @description Event types get translated labels and colour classes; unknown ones stay as they are.
   * @input  eventTypeLabel('soft_delete'), ('custom'); eventTypeClass('payment'), ('custom')
   * @output 'web-dashboard.ev_label_soft_delete', 'custom'; 'ev-create', 'ev-default'
   */
  it('maps event types to labels and classes', () => {
    expect(component.eventTypeLabel('soft_delete')).toBe('web-dashboard.ev_label_soft_delete');
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

  describe('maintenance mode', () => {
    /**
     * @description The current web state is loaded for users with web-set-maintenance-mode.
     * @input  web/settings { is_web_active: false, web_maintenance_message: 'Brzy zpět' }; then null / empty message
     * @output isWebActive false, message 'Brzy zpět'; null answer changes nothing; missing message → ''
     */
    it('loads the maintenance state', () => {
      (ctx.dataHandler as any).get.and.returnValue(of({ is_web_active: false, web_maintenance_message: 'Brzy zpět' }));
      component.ngOnInit();
      expect((ctx.dataHandler as any).get).toHaveBeenCalledWith('web/settings');
      expect(component.isWebActive).toBeFalse();
      expect(component.webMaintenanceMessage).toBe('Brzy zpět');
      (ctx.dataHandler as any).get.and.returnValue(of(null));
      component.refresh();
      expect(component.isWebActive).toBeFalse();
      (ctx.dataHandler as any).get.and.returnValue(of({ is_web_active: 1 }));
      component.refresh();
      expect(component.isWebActive).toBeTrue();
      expect(component.webMaintenanceMessage).toBe('');
    });

    /**
     * @description The modal targets the opposite state and can be cancelled (password cleared).
     * @input  isWebActive true; openWebMaintenanceModal(); type password; cancelWebMaintenanceModal()
     * @output pendingWebTargetState false; modal open; after cancel closed and password ''
     */
    it('opens and cancels the modal', () => {
      component.isWebActive = true;
      component.openWebMaintenanceModal();
      expect(component.pendingWebTargetState).toBeFalse();
      expect(component.showWebMaintenanceModal).toBeTrue();
      component.webConfirmPasswordValue = 'secret';
      component.cancelWebMaintenanceModal();
      expect(component.showWebMaintenanceModal).toBeFalse();
      expect(component.webConfirmPasswordValue).toBe('');
    });

    /**
     * @description The change needs the admin password.
     * @input  password '   '; submitWebMaintenanceChange()
     * @output alert ('web-dashboard.maintenance_error_title', '…maintenance_error_missing_password', 'danger'); put not called
     */
    it('requires the password', () => {
      component.webConfirmPasswordValue = '   ';
      component.submitWebMaintenanceChange();
      expect(ctx.alert.open).toHaveBeenCalledWith('web-dashboard.maintenance_error_title', 'web-dashboard.maintenance_error_missing_password', 'danger');
      expect((ctx.dataHandler as any).put).not.toHaveBeenCalled();
    });

    /**
     * @description Switching to maintenance sends the state, the default message when empty and the password.
     * @input  isWebActive true; open modal; message ''; password 'pw'; submit
     * @output put('web/settings', { is_web_active: false, web_maintenance_message: 'web-dashboard.maintenance_default_message', confirm_password: 'pw' }); isWebActive false; '…maintenance_success_maintenance'
     */
    it('switches the web to maintenance', () => {
      component.isWebActive = true;
      component.webMaintenanceMessage = '';
      component.openWebMaintenanceModal();
      component.webConfirmPasswordValue = 'pw';
      component.submitWebMaintenanceChange();
      expect((ctx.dataHandler as any).put).toHaveBeenCalledWith('web/settings', {
        is_web_active: false, web_maintenance_message: 'web-dashboard.maintenance_default_message', confirm_password: 'pw'
      });
      expect(component.isWebActive).toBeFalse();
      expect(component.showWebMaintenanceModal).toBeFalse();
      expect(ctx.alert.open).toHaveBeenCalledWith('web-dashboard.maintenance_success_title', 'web-dashboard.maintenance_success_maintenance', 'success');
    });

    /**
     * @description Switching back to live keeps the custom message.
     * @input  isWebActive false; message 'Brzy zpět'; password 'pw'; submit
     * @output put with is_web_active true and 'Brzy zpět'; isWebActive true; '…maintenance_success_active'
     */
    it('switches the web back to live', () => {
      component.isWebActive = false;
      component.webMaintenanceMessage = 'Brzy zpět';
      component.openWebMaintenanceModal();
      component.webConfirmPasswordValue = 'pw';
      component.submitWebMaintenanceChange();
      expect((ctx.dataHandler as any).put.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({ is_web_active: true, web_maintenance_message: 'Brzy zpět' }));
      expect(component.isWebActive).toBeTrue();
      expect(ctx.alert.open).toHaveBeenCalledWith('web-dashboard.maintenance_success_title', 'web-dashboard.maintenance_success_active', 'success');
    });

    /**
     * @description A rejected change (e.g. wrong password) shows the server message or a generic one.
     * @input  put fails with { error: { message: 'Wrong password' } }, then with {}
     * @output alert ('web-dashboard.maintenance_error_auth_title', 'Wrong password', 'danger'); then '…maintenance_error_generic'; state unchanged
     */
    it('reports a rejected change', () => {
      component.isWebActive = true;
      component.webConfirmPasswordValue = 'bad';
      (ctx.dataHandler as any).put.and.returnValue(throwError(() => ({ error: { message: 'Wrong password' } })));
      component.submitWebMaintenanceChange();
      expect(ctx.alert.open).toHaveBeenCalledWith('web-dashboard.maintenance_error_auth_title', 'Wrong password', 'danger');
      (ctx.dataHandler as any).put.and.returnValue(throwError(() => ({})));
      component.submitWebMaintenanceChange();
      expect(ctx.alert.open).toHaveBeenCalledWith('web-dashboard.maintenance_error_auth_title', 'web-dashboard.maintenance_error_generic', 'danger');
      expect(component.isWebActive).toBeTrue();
    });
  });

  /**
   * @description The dashboard renders stats, tiles and the maintenance card; a language change re-renders.
   * @input  detectChanges(); translations$.next({})
   * @output text contains 'web-dashboard.header_title', 'web-dashboard.nav_news_title', 'web-dashboard.maintenance_status_active'
   */
  it('renders the dashboard', () => {
    fixture.detectChanges();
    ctx.i18n.translations$.next({});
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('web-dashboard.header_title');
    expect(text).toContain('web-dashboard.nav_news_title');
    expect(text).toContain('web-dashboard.maintenance_status_active');
  });
});
