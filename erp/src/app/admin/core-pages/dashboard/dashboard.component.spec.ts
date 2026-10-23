/**
 * @file dashboard.component.spec.ts
 * @path src/app/admin/core-pages/dashboard/dashboard.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of CoreDashboardComponent – the core dashboard: statistics only for the
 *   sections the user may see, hero / secondary stat, recent activity with its breakdown,
 *   navigation tiles by permission, refresh and value formatting.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (DataHandler spy, permission stub, i18n stub),
 *   ResourceCacheService (real)
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { CoreDashboardComponent } from './dashboard.component';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('CoreDashboardComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<CoreDashboardComponent>;
  let component: CoreDashboardComponent;

  const totals: Record<string, number> = {
    'core/users?per_page=1': 12, 'core/roles?per_page=1': 3, 'legal/document-sections?per_page=1': 40,
    'core/external_links?per_page=1': 5, 'core/logs?per_page=1': 900
  };
  const logs = [
    { id: 1, event_type: 'create' }, { id: 2, event_type: 'create' }, { id: 3, event_type: 'login_failed' },
    { id: 4, event_type: 'something_else' }
  ];

  beforeEach(async () => {
    localStorage.removeItem('userRole');
    ctx = createAdminTestContext();
    (ctx.dataHandler as any).getPaginatedCollection.and.callFake((url: string) =>
      url.startsWith('core/logs?per_page=8') ? of({ data: logs }) : of({ total: totals[url] }));
    await TestBed.configureTestingModule({ imports: [CoreDashboardComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(CoreDashboardComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => localStorage.removeItem('userRole'));

  /**
   * @description Only statistics the user is allowed to see are requested and shown.
   * @input  granted ['core-administrators-view', 'view-core'], not sysadmin; ngOnInit()
   * @output stats users 12 and coreLogs 900 only; no request for roles/legal/links
   */
  it('loads only the allowed statistics', () => {
    ctx.permissions.granted = new Set(['core-administrators-view', 'view-core']);
    component.ngOnInit();
    expect(component.quickStats.map(s => [s.key, s.value])).toEqual([['users', 12], ['coreLogs', 900]]);
    const urls = (ctx.dataHandler as any).getPaginatedCollection.calls.allArgs().map((a: any[]) => a[0]);
    expect(urls).not.toContain('core/roles?per_page=1');
    expect(component.loadingStats).toBeFalse();
    expect(component.lastUpdatedAt).toEqual(jasmine.any(Date));
  });

  /**
   * @description The roles statistic is shown only to sysadmin (role stored as 'userRole').
   * @input  localStorage userRole 'sysadmin'; all permissions
   * @output stats include roles = 3
   */
  it('shows the roles statistic to sysadmin', () => {
    localStorage.setItem('userRole', 'sysadmin');
    component.ngOnInit();
    expect(component.quickStats.find(s => s.key === 'roles')?.value).toBe(3);
  });

  /**
   * @description A failed statistic shows '—' instead of breaking the dashboard.
   * @input  core/users request fails
   * @output users value '—'; other stats still shown
   */
  it('shows a dash for a failed statistic', () => {
    (ctx.dataHandler as any).getPaginatedCollection.and.callFake((url: string) =>
      url === 'core/users?per_page=1' ? throwError(() => new Error('x')) : of({ total: totals[url] ?? 0, data: [] }));
    component.ngOnInit();
    expect(component.quickStats.find(s => s.key === 'users')?.value).toBe('—');
    expect(component.quickStats.find(s => s.key === 'externalLinks')?.value).toBe(5);
  });

  /**
   * @description The hero stat is the first one or the chosen one; the rest are secondary.
   * @input  stats loaded; selectHeroStat('coreLogs')
   * @output heroStat users before, coreLogs after; secondaryStats without coreLogs; dropdown closed
   */
  it('lets the user choose the hero statistic', () => {
    component.ngOnInit();
    expect(component.heroStat?.key).toBe('users');
    component.toggleHeroDropdown();
    component.selectHeroStat('coreLogs');
    expect(component.heroStat?.key).toBe('coreLogs');
    expect(component.secondaryStats.map(s => s.key)).not.toContain('coreLogs');
    expect(component.heroDropdownOpen).toBeFalse();
  });

  /**
   * @description Stat bars use a log scale with a minimum width.
   * @input  stats users 12, coreLogs 900; value 0
   * @output coreLogs 100 %; users between 8 and 100; zero → 4
   */
  it('computes logarithmic stat bars', () => {
    component.ngOnInit();
    const users = component.quickStats.find(s => s.key === 'users')!;
    const logsStat = component.quickStats.find(s => s.key === 'coreLogs')!;
    expect(component.statBarPct(logsStat)).toBe(100);
    expect(component.statBarPct(users)).toBeGreaterThanOrEqual(8);
    expect(component.statBarPct(users)).toBeLessThan(100);
    expect(component.statBarPct({ ...users, value: 0 })).toBe(4);
  });

  /**
   * @description Recent activity (8 newest logs) is loaded and grouped by event kind.
   * @input  logs: 2× create, 1× login_failed, 1× unknown
   * @output request 'core/logs?per_page=8&sort_by=created_at&sort_direction=desc'; breakdown ev-create 2 first, ev-delete 1, ev-default 1; create bar 100 %
   */
  it('loads recent activity and its breakdown', () => {
    component.ngOnInit();
    expect((ctx.dataHandler as any).getPaginatedCollection).toHaveBeenCalledWith('core/logs?per_page=8&sort_by=created_at&sort_direction=desc');
    expect(component.recentActivity.length).toBe(4);
    expect(component.activityBreakdown[0]).toEqual({ classKey: 'ev-create', labelKey: 'breakdown_create_label', count: 2 });
    expect(component.activityBreakdown.map(b => b.classKey)).toContain('ev-default');
    expect(component.breakdownBarPct(component.activityBreakdown[0])).toBe(100);
  });

  /**
   * @description Without the logs permission no activity is requested.
   * @input  granted ['core-administrators-view']
   * @output recentActivity []; no request for core/logs?per_page=8…
   */
  it('skips activity without the logs permission', () => {
    ctx.permissions.granted = new Set(['core-administrators-view']);
    component.ngOnInit();
    expect(component.recentActivity).toEqual([]);
    const urls = (ctx.dataHandler as any).getPaginatedCollection.calls.allArgs().map((a: any[]) => a[0]);
    expect(urls.some((u: string) => u.startsWith('core/logs?per_page=8'))).toBeFalse();
  });

  /**
   * @description Refresh bypasses the 2-minute cache and is ignored while running.
   * @input  ngOnInit(); refresh()
   * @output statistics requested again (second round of calls); isRefreshing false at the end
   */
  it('refresh() reloads past the cache', () => {
    component.ngOnInit();
    const first = (ctx.dataHandler as any).getPaginatedCollection.calls.count();
    component.refresh();
    expect((ctx.dataHandler as any).getPaginatedCollection.calls.count()).toBe(first * 2);
    expect(component.isRefreshing).toBeFalse();
  });

  /**
   * @description Navigation tiles follow the permissions.
   * @input  granted ['core-external-links-view']
   * @output visible tile routes include '/admin/core/external-links' and exclude '/admin/core/administrators'
   */
  it('shows navigation tiles by permission', () => {
    ctx.permissions.granted = new Set(['core-external-links-view']);
    const routes = component.visibleNavSections.map(s => s.route);
    expect(routes).toContain('/admin/core/external-links');
    expect(routes).not.toContain('/admin/core/administrators');
  });

  /**
   * @description Event types get translated labels and colour classes; unknown ones stay as they are.
   * @input  eventTypeLabel('login_success'), ('custom'); eventTypeClass('restore'), ('custom')
   * @output 'core-dashboard.ev_label_login_success', 'custom'; 'ev-restore', 'ev-default'
   */
  it('maps event types to labels and classes', () => {
    expect(component.eventTypeLabel('login_success')).toBe('core-dashboard.ev_label_login_success');
    expect(component.eventTypeLabel('custom')).toBe('custom');
    expect(component.eventTypeClass('restore')).toBe('ev-restore');
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

  /**
   * @description The dashboard renders.
   * @input  detectChanges()
   * @output at least one navigation tile title rendered
   */
  it('renders the dashboard', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('core-dashboard.nav_administrators_title');
  });
  /**
   * @description Without any statistic permission the stats finish loading at once (bugfix
   *   2026-10-23, was stuck in loading); failing stats / activity streams stop their spinners;
   *   an array answer of the activity is taken as is; the hero dropdown closes.
   * @input granted []; stats cache loader erroring; activity answering an array; closeHeroDropdown.
   * @output quickStats [], loadingStats false, no stat request; loading flags false; activity array kept.
   */
  it('finishes loading without stats and on errors', () => {
    ctx.permissions.granted = new Set();
    component.ngOnInit();
    expect([component.quickStats, component.loadingStats]).toEqual([[], false]);
    expect((ctx.dataHandler as any).getPaginatedCollection).not.toHaveBeenCalled();

    ctx.permissions.granted = 'all';
    const cache = (component as any).resourceCache;
    const get = spyOn(cache, 'get').and.returnValue(throwError(() => new Error('x')));
    (component as any).loadStats();
    (component as any).loadRecentActivity();
    expect([component.loadingStats, component.loadingActivity, component.isRefreshing]).toEqual([false, false, false]);

    get.and.callThrough();
    cache.invalidate((component as any).ACTIVITY_CACHE_KEY);
    (ctx.dataHandler as any).getPaginatedCollection.and.returnValue(of([{ id: 1, event_type: 'create' }]));
    (component as any).loadRecentActivity();
    expect(component.recentActivity.length).toBe(1);

    component.heroDropdownOpen = true;
    component.closeHeroDropdown();
    expect(component.heroDropdownOpen).toBeFalse();
  });
});
