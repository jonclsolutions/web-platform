/**
 * @file dashboard.component.spec.ts
 * @path src/app/apps/project-portal/admin/dashboard/dashboard.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of ProjectPortalDashboardComponent: tiles requested only for the
 *   allowed pages, shortcuts by permission, the recent activity of the portal log, the event
 *   labels and the state of the public portal in the header (status control of 'project-portal').
 * @dependencies src/testing/admin-test-helpers.ts (DataHandler spy, permission stub, i18n stub).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';

import { ProjectPortalDashboardComponent } from './dashboard.component';
import { AppStatusControlComponent } from '../../../../admin/components/app-status/app-status-control.component';
import { AdminTestContext, createAdminTestContext } from '../../../../../testing/admin-test-helpers';

describe('ProjectPortalDashboardComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<ProjectPortalDashboardComponent>;
  let component: ProjectPortalDashboardComponent;
  const ACTIVITY_URL = 'project-portal/logs?per_page=8&sort_by=created_at&sort_direction=desc';
  const totals: Record<string, number> = {
    'project-portal/sales_leads?per_page=1': 4,
    'project-portal/sales_orders?per_page=1': 2,
    'project-portal/projects?per_page=1': 3,
    'project-portal/logs?per_page=1': 70,
  };
  const urls = () => (ctx.dataHandler as any).getPaginatedCollection.calls.allArgs().map((a: any[]) => a[0]);

  beforeEach(async () => {
    ctx = createAdminTestContext();
    (ctx.dataHandler as any).getPaginatedCollection.and.callFake((url: string) =>
      url === ACTIVITY_URL ? of({ data: [{ id: 1, event_type: 'create' }, { id: 2, event_type: 'error' }] }) : of({ data: [], meta: { total: totals[url] } }));
    (ctx.dataHandler as any).get.and.returnValue(of([]));
    await TestBed.configureTestingModule({ imports: [ProjectPortalDashboardComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(ProjectPortalDashboardComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  /**
   * @description With all permissions every tile and the activity are loaded; the texts come
   *   from the section of the portal dashboard.
   * @input ngOnInit(), all permissions.
   * @output tiles salesLeads 4, salesOrders 2, projects 3, portalLogs 70; 2 activity rows;
   *   t('header_title') = 'project-portal-dashboard.header_title'.
   */
  it('loads the tiles and the activity', () => {
    component.ngOnInit();
    expect(component.quickStats.map(s => [s.key, s.value])).toEqual([['salesLeads', 4], ['salesOrders', 2], ['projects', 3], ['portalLogs', 70]]);
    expect(component.recentActivity.length).toBe(2);
    expect(component.t('header_title')).toBe('project-portal-dashboard.header_title');
    expect(component.eventTypeLabel('error')).toBe('dashboard.ev_label_error');
  });

  /**
   * @description Only the allowed tiles and shortcuts; without the log permission no activity.
   * @input granted ['project-portal-projects-view'].
   * @output one request (projects); no log requests; shortcut /admin/project-portal/projects.
   */
  it('respects the permissions', () => {
    ctx.permissions.granted = new Set(['project-portal-projects-view']);
    component.ngOnInit();
    expect(urls()).toEqual(['project-portal/projects?per_page=1']);
    expect(component.visibleNavSections.map(s => s.route)).toEqual(['/admin/project-portal/projects']);
  });

  /**
   * @description The header shows the state of the public portal.
   * @input render.
   * @output appId 'project-portal'; AppStatusControlComponent with appId 'project-portal'.
   */
  it('shows the state of the portal in the header', () => {
    fixture.detectChanges();
    expect(component.appId).toBe('project-portal');
    const control = fixture.debugElement.query(By.directive(AppStatusControlComponent)).componentInstance as AppStatusControlComponent;
    expect(control.appId).toBe('project-portal');
  });
});
