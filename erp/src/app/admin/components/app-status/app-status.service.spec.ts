/**
 * @file app-status.service.spec.ts
 * @path src/app/admin/components/app-status/app-status.service.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of AppStatusService: one shared load of `core/apps/status` (reused for
 *   30 s, forced on demand), the failed state, the switch permission from the manifest and the
 *   switch request to the endpoint of the application with the saved or default maintenance text,
 *   the quiet poll (no loading, no dialog, stale answers ignored).
 * @dependencies src/testing/admin-test-helpers.ts (DataHandler spy, permission stub).
 */

import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { AppStatus, AppStatusService } from './app-status.service';
import { appById } from '../../../apps/apps.registry';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';
import { requiresApps } from '../../../../testing/requires-apps';

describe('AppStatusService', () => {
  let ctx: AdminTestContext;
  let service: AppStatusService;
  const web: AppStatus = { id: 'web', health: 'ok', active: true, maintenance_message: 'Saved text', diagnostics: null, checked_at: 'x' };
  const get = () => (ctx.dataHandler as any).get as jasmine.Spy;

  beforeEach(() => {
    ctx = createAdminTestContext({ granted: [] });
    TestBed.configureTestingModule({ providers: ctx.providers });
    get().and.returnValue(of([web]));
    service = TestBed.inject(AppStatusService);
  });

  /**
   * @description The first load asks the API; a second one within 30 s reuses the answer, a
   *   forced one asks again; a failure sets `failed` and keeps the last states.
   * @input load(); load(); load(true); failing load(true).
   * @output 1, 1, 2 requests; statusOf('web') = web; failed true, statuses kept; loading false.
   */
  it('loads once and reloads on demand', () => {
    service.load();
    service.load();
    expect(get().calls.count()).toBe(1);
    expect(get()).toHaveBeenCalledWith('core/apps/status');
    expect(service.statusOf('web')).toEqual(web);
    expect(service.statusOf('nope')).toBeUndefined();
    service.load(true);
    expect(get().calls.count()).toBe(2);

    get().and.returnValue(throwError(() => new Error('down')));
    service.load(true);
    expect(service.failed()).toBeTrue();
    expect(service.statuses()).toEqual([web]);
    expect(service.loading()).toBeFalse();
  });

  /**
   * @description poll() asks quietly (getQuietly - no error dialog) without the loading state; a
   *   failure sets `failed`, the next success clears it; an answer overtaken by a newer request
   *   is ignored; no poll while a load runs.
   * @input poll() ok; poll() failing; poll() ok; a slow poll overtaken by load(true); poll() during a load.
   * @output loading never true; statuses / failed as described; the slow answer not applied; skipped poll.
   */
  it('polls quietly and ignores stale answers', () => {
    const quiet = (ctx.dataHandler as any).getQuietly as jasmine.Spy;
    quiet.and.returnValue(of([web]));
    service.poll();
    expect(quiet).toHaveBeenCalledWith('core/apps/status');
    expect(get()).not.toHaveBeenCalled();
    expect(service.statusOf('web')).toEqual(web);
    expect(service.loading()).toBeFalse();

    quiet.and.returnValue(throwError(() => new Error('down')));
    service.poll();
    expect(service.failed()).toBeTrue();
    quiet.and.returnValue(of([web]));
    service.poll();
    expect(service.failed()).toBeFalse();

    const slow = new Subject<AppStatus[]>();
    quiet.and.returnValue(slow);
    service.poll();
    const fresh = { ...web, health: 'warning' as const };
    get().and.returnValue(of([fresh]));
    service.load(true);
    slow.next([web]);
    slow.complete();
    expect(service.statusOf('web')).toEqual(fresh);

    const running = new Subject<AppStatus[]>();
    get().and.returnValue(running);
    service.load(true);
    quiet.calls.reset();
    service.poll();
    expect(quiet).not.toHaveBeenCalled();
    running.complete();
  });

  /**
   * @description Switching needs the maintenance permission of the application's manifest.
   * @input No permission; web-set-maintenance-mode; unknown application.
   * @output false; true; false.
   */
  it('knows who may switch an application', () => {
    requiresApps('web');
    expect(service.canSwitch('web')).toBeFalse();
    ctx.permissions.granted = new Set(['web-set-maintenance-mode']);
    expect(service.canSwitch('web')).toBeTrue();
    expect(service.canSwitch('nope')).toBeFalse();
  });

  /**
   * @description The switch goes to the application endpoint with its field names, the saved
   *   text (else the default) and the password; the state changes at once and is reloaded.
   * @input statuses [web saved text]; setActive(web, false, 'pw', 'Default'); without a saved text.
   * @output PUT web/settings {is_web_active: false, web_maintenance_message: 'Saved text',
   *   confirm_password: 'pw'}; web offline; status reloaded; then 'Default'.
   */
  it('switches an application through its endpoint', () => {
    requiresApps('web');
    (ctx.dataHandler as any).put.and.returnValue(of({}));
    service.load();
    get().and.returnValue(of([{ ...web, active: false, health: 'offline', maintenance_message: null }]));

    service.setActive(appById('web')!, false, 'pw', 'Default').subscribe();
    expect((ctx.dataHandler as any).put).toHaveBeenCalledWith('web/settings', {
      is_web_active: false, web_maintenance_message: 'Saved text', confirm_password: 'pw',
    });
    expect(get().calls.count()).toBe(2);
    expect(service.statusOf('web')!.health).toBe('offline');

    service.setActive(appById('web')!, true, 'pw', 'Default').subscribe();
    expect((ctx.dataHandler as any).put.calls.mostRecent().args[1].web_maintenance_message).toBe('Default');
  });
});
