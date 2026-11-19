/**
 * @file apps.component.spec.ts
 * @path src/app/admin/core-pages/apps/apps.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of AppsComponent (page "Applications"): one row per application the
 *   user may open with the link to its landing page, its state (health, diagnosis) from
 *   `core/apps/status` and its maintenance switch; refresh; the quiet refresh every 10 s;
 *   failed status; the empty state.
 * @dependencies src/testing/admin-test-helpers.ts (auth, permission, i18n stubs).
 */

import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';

import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';

import { AppsComponent } from './apps.component';
import { AppStatusControlComponent } from '../../components/app-status/app-status-control.component';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';
import { requiresApps } from '../../../../testing/requires-apps';

describe('AppsComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<AppsComponent>;
  const diag = (errors: number) => ({ response_ms: 12, activity_24h: 40, errors_24h: errors, last_activity_at: '2026-11-14T10:00:00+01:00', last_error_at: null });
  const statuses = [
    { id: 'shop', health: 'offline', active: false, maintenance_message: 'Inventura', diagnostics: diag(0), checked_at: '2026-11-14T11:00:00+01:00' },
    { id: 'project-portal', health: 'warning', active: true, maintenance_message: null, diagnostics: diag(2), checked_at: '2026-11-14T11:00:00+01:00' },
  ];

  beforeEach(async () => {
    ctx = createAdminTestContext({ granted: [] });
    (ctx.dataHandler as any).get.and.returnValue(of(statuses));
    await TestBed.configureTestingModule({ imports: [AppsComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(AppsComponent);
  });

  afterEach(() => fixture.destroy());

  /**
   * @description Cards of the applications the user may open, with name, description and the
   *   "Manage" link to the first page of the application the user may open.
   * @input view-eshop + shop-orders-view, view-project-portal + project-portal-projects-view; render.
   * @output 2 cards: e-shop → /admin/shop/orders, project portal → /admin/project-portal/projects;
   *   names / descriptions from admin-layout; no empty state.
   */
  it('shows the applications the user may open', () => {
    requiresApps('web', 'shop', 'project-portal');
    ctx.permissions.granted = new Set(['view-eshop', 'shop-orders-view', 'view-project-portal', 'project-portal-projects-view']);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const cards = Array.from(el.querySelectorAll('.apps-card'));
    expect(cards.length).toBe(2);
    expect(cards[0].querySelector('.wp-link-title')!.textContent!.trim()).toBe('admin-layout.module_shop');
    expect(cards[0].querySelector('.wp-link-desc')!.textContent!.trim()).toBe('admin-layout.app_description_shop');
    expect(Array.from(el.querySelectorAll('a.apps-card-manage')).map(a => a.getAttribute('href')))
      .toEqual(['/admin/shop/orders', '/admin/project-portal/projects']);
    expect(el.querySelector('.apps-empty')).toBeNull();
  });

  /**
   * @description Each row shows the state of the application from `core/apps/status` (forced
   *   load), the diagnosis and the maintenance switch of the application; refresh asks again.
   * @input Same permissions; shop offline, portal warning with 2 errors; refresh().
   * @output GET core/apps/status; rows `apps-card--offline` / `--warning` with the health texts;
   *   offline note at the shop; 5 figures per row, errors of the portal marked; switch controls
   *   for shop and project-portal without their own state; a second request on refresh.
   */
  it('shows the state and diagnosis of each application', () => {
    requiresApps('web', 'shop', 'project-portal');
    ctx.permissions.granted = new Set(['view-eshop', 'shop-orders-view', 'view-project-portal', 'project-portal-projects-view']);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect((ctx.dataHandler as any).get).toHaveBeenCalledWith('core/apps/status');
    const cards = Array.from(el.querySelectorAll('.apps-card'));
    expect(cards.map(c => c.className.includes('apps-card--offline') ? 'offline' : c.className.includes('apps-card--warning') ? 'warning' : '?')).toEqual(['offline', 'warning']);
    expect(cards[0].querySelector('.apps-health')!.textContent!.trim()).toBe('app-status.health_offline');
    expect(cards[0].textContent).toContain('apps.public_offline_note');
    expect(cards[1].querySelector('.apps-health')!.textContent!.trim()).toBe('app-status.health_warning');
    expect(cards[1].textContent).toContain('apps.health_hint_warning');
    expect(cards[0].querySelectorAll('.apps-diag > div').length).toBe(5);
    expect(cards[1].querySelector('.apps-diag--bad dd')!.textContent!.trim()).toBe('2');
    const controls = fixture.debugElement.queryAll(By.directive(AppStatusControlComponent)).map(d => d.componentInstance as AppStatusControlComponent);
    expect(controls.map(c => [c.appId, c.showState])).toEqual([['shop', false], ['project-portal', false]]);

    fixture.componentInstance.refresh();
    expect((ctx.dataHandler as any).get).toHaveBeenCalledTimes(2);
  });

  /**
   * @description The states refresh themselves quietly every 10 s while the tab is visible and
   *   stop with the page.
   * @input render; 10 s; hidden tab 10 s; visible 10 s; destroy; 10 s.
   * @output getQuietly('core/apps/status') 1×, still 1× while hidden, 2×, still 2× after destroy.
   */
  it('refreshes the states every 10 seconds', fakeAsync(() => {
    const quiet = (ctx.dataHandler as any).getQuietly as jasmine.Spy;
    quiet.and.returnValue(of(statuses));
    fixture.detectChanges();
    tick(AppsComponent.POLL_INTERVAL_MS);
    expect(quiet).toHaveBeenCalledOnceWith('core/apps/status');

    const hidden = spyOnProperty(document, 'hidden').and.returnValue(true);
    tick(AppsComponent.POLL_INTERVAL_MS);
    expect(quiet).toHaveBeenCalledTimes(1);
    hidden.and.returnValue(false);
    tick(AppsComponent.POLL_INTERVAL_MS);
    expect(quiet).toHaveBeenCalledTimes(2);

    fixture.destroy();
    tick(AppsComponent.POLL_INTERVAL_MS);
    expect(quiet).toHaveBeenCalledTimes(2);
  }));

  /**
   * @description A failed status request is announced; the rows stay with the unknown state.
   * @input Status request fails; one application.
   * @output Alert 'apps.status_failed'; row `apps-card--unknown`.
   */
  it('reports a failed status request', () => {
    requiresApps('shop');
    (ctx.dataHandler as any).get.and.returnValue(throwError(() => new Error('down')));
    ctx.permissions.granted = new Set(['view-eshop', 'shop-orders-view']);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.apps-error')!.textContent!.trim()).toBe('apps.status_failed');
    expect(el.querySelector('.apps-card')!.className).toContain('apps-card--unknown');
  });

  /**
   * @description Without any application the page says so.
   * @input No permission; render.
   * @output No card; the empty text.
   */
  it('shows the empty state', () => {
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.apps-card').length).toBe(0);
    expect(el.querySelector('.apps-empty')!.textContent!.trim()).toBe('apps.empty');
  });
});
