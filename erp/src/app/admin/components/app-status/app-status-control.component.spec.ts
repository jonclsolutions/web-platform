/**
 * @file app-status-control.component.spec.ts
 * @path src/app/admin/components/app-status/app-status-control.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of AppStatusControlComponent: the state pill per health, the switch
 *   button only with the permission, the confirmation window (target state, password required,
 *   cancel), a successful switch and a refused one.
 * @dependencies src/testing/admin-test-helpers.ts (DataHandler spy, permission stub, alert spy,
 *   i18n stub returning the key path).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AppStatusControlComponent } from './app-status-control.component';
import { AppStatus } from './app-status.service';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';
import { requiresApps } from '../../../../testing/requires-apps';

describe('AppStatusControlComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<AppStatusControlComponent>;
  let component: AppStatusControlComponent;
  const el = () => fixture.nativeElement as HTMLElement;
  const state = (over: Partial<AppStatus> = {}): AppStatus[] => [{ id: 'web', health: 'ok', active: true, maintenance_message: null, diagnostics: null, checked_at: 'x', ...over }];

  /** Renders the control of the web with the given states and permissions. */
  function create(statuses: AppStatus[], granted: string[] = []): void {
    requiresApps('web');
    ctx = createAdminTestContext({ granted });
    (ctx.dataHandler as any).get.and.returnValue(of(statuses));
    TestBed.configureTestingModule({ imports: [AppStatusControlComponent], providers: ctx.providers });
    fixture = TestBed.createComponent(AppStatusControlComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('appId', 'web');
    fixture.detectChanges();
  }

  /**
   * @description The pill follows the health; without the permission there is no button; a
   *   hidden state (`showState` false) leaves only the button.
   * @input ok; offline; ok with web-set-maintenance-mode and showState false.
   * @output 'app-status.health_ok' (class --ok), no button; '--offline'; only the button
   *   'app-status.switch_off'.
   */
  it('shows the state and the switch by permission', () => {
    create(state());
    expect(el().querySelector('.as-state--ok')!.textContent!.trim()).toBe('app-status.health_ok');
    expect(el().querySelector('.as-switch-btn')).toBeNull();

    TestBed.resetTestingModule();
    create(state({ health: 'offline', active: false }));
    expect(el().querySelector('.as-state--offline')).not.toBeNull();

    TestBed.resetTestingModule();
    create(state(), ['web-set-maintenance-mode']);
    fixture.componentRef.setInput('showState', false);
    fixture.detectChanges();
    expect(el().querySelector('.as-state')).toBeNull();
    expect(el().querySelector('.as-switch-btn')!.textContent!.trim()).toBe('app-status.switch_off');
  });

  /**
   * @description The window asks for the opposite state; an empty password is refused without
   *   a request; cancel closes it.
   * @input Online web; click the button; submit without a password; cancel.
   * @output targetActive false, 'app-status.modal_state_maintenance'; alert missing password,
   *   no PUT; window closed.
   */
  it('opens the confirmation and requires the password', () => {
    create(state(), ['web-set-maintenance-mode']);
    (el().querySelector('.as-switch-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.targetActive).toBeFalse();
    expect(el().querySelector('.password-modal-body strong')!.textContent!.trim()).toBe('app-status.modal_state_maintenance');
    expect(el().querySelector('.modal-warning-box')!.textContent!.trim()).toBe('app-status.modal_warning_off');

    component.submit();
    expect(ctx.alert.open).toHaveBeenCalledWith('app-status.error_title', 'app-status.error_missing_password', 'danger');
    expect((ctx.dataHandler as any).put).not.toHaveBeenCalled();

    (el().querySelector('.btn-modal-secondary') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el().querySelector('.password-modal-card')).toBeNull();
  });

  /**
   * @description A confirmed switch closes the window with a success message; a refused one
   *   keeps the window for another try (the API error dialog of DataHandler announces it, so no
   *   second alert).
   * @input Password 'pw'; PUT ok; then PUT 403.
   * @output PUT web/settings with confirm_password 'pw'; window closed; success alert
   *   'app-status.success_maintenance'; then no alert of the control, window open, not saving.
   */
  it('switches the application or reports the refusal', () => {
    create(state(), ['web-set-maintenance-mode']);
    (ctx.dataHandler as any).put.and.returnValue(of({}));
    component.open();
    component.password = 'pw';
    component.submit();
    expect((ctx.dataHandler as any).put.calls.mostRecent().args[0]).toBe('web/settings');
    expect((ctx.dataHandler as any).put.calls.mostRecent().args[1].confirm_password).toBe('pw');
    expect(component.modalOpen).toBeFalse();
    expect(ctx.alert.open).toHaveBeenCalledWith('app-status.success_title', 'app-status.success_maintenance', 'success');

    (ctx.dataHandler as any).put.and.returnValue(throwError(() => ({ status: 403 })));
    (ctx.alert.open as jasmine.Spy).calls.reset();
    component.open();
    component.password = 'bad';
    component.submit();
    expect(ctx.alert.open).not.toHaveBeenCalled();
    expect(component.modalOpen).toBeTrue();
    expect(component.saving).toBeFalse();
  });
});
