/**
 * @file app-status-control.component.spec.ts
 * @path src/app/admin/components/app-status/app-status-control.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of AppStatusControlComponent: the state pill per health, the switch
 *   button only with the permission, the shared password dialog (target state, warning, cancel),
 *   a successful switch and a refused one.
 * @dependencies src/testing/admin-test-helpers.ts (DataHandler spy, permission stub, alert spy,
 *   i18n stub returning the key path); PasswordDialogService spy.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AppStatusControlComponent } from './app-status-control.component';
import { AppStatus } from './app-status.service';
import { PasswordDialogOptions, PasswordDialogService } from '../../../core/services/password-dialog.service';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';
import { requiresApps } from '../../../../testing/requires-apps';

describe('AppStatusControlComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<AppStatusControlComponent>;
  let component: AppStatusControlComponent;
  let passwordDialog: jasmine.SpyObj<PasswordDialogService>;
  /** Options of the last opened password dialog. */
  const dialogOptions = (): PasswordDialogOptions => passwordDialog.open.calls.mostRecent().args[0];
  const el = () => fixture.nativeElement as HTMLElement;
  const state = (over: Partial<AppStatus> = {}): AppStatus[] => [{ id: 'web', health: 'ok', active: true, maintenance_message: null, diagnostics: null, checked_at: 'x', ...over }];

  /** Renders the control of the web with the given states and permissions. */
  function create(statuses: AppStatus[], granted: string[] = []): void {
    requiresApps('web');
    ctx = createAdminTestContext({ granted });
    (ctx.dataHandler as any).get.and.returnValue(of(statuses));
    passwordDialog = jasmine.createSpyObj<PasswordDialogService>('PasswordDialogService', ['open']);
    passwordDialog.open.and.returnValue(Promise.resolve(false));
    TestBed.configureTestingModule({
      imports: [AppStatusControlComponent],
      providers: [...ctx.providers, { provide: PasswordDialogService, useValue: passwordDialog }],
    });
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
   * @description The button opens the shared password dialog for the opposite state; cancel
   *   changes nothing.
   * @input Online web; click the button; the dialog is cancelled (false).
   * @output title / intro / highlight 'app-status.modal_state_maintenance' (warning tone) / warning
   *   off / label / confirm label; no PUT, no alert; open() resolves false.
   */
  it('asks for the password in the shared dialog', async () => {
    create(state(), ['web-set-maintenance-mode']);
    (el().querySelector('.as-switch-btn') as HTMLButtonElement).click();
    expect(dialogOptions()).toEqual(jasmine.objectContaining({
      title: 'app-status.modal_title', message: 'app-status.modal_intro',
      highlight: 'app-status.modal_state_maintenance', highlightTone: 'warning',
      warning: 'app-status.modal_warning_off', label: 'app-status.modal_password_label', confirmLabel: 'app-status.modal_confirm',
    }));
    expect(await component.open()).toBeFalse();
    expect((ctx.dataHandler as any).put).not.toHaveBeenCalled();
    expect(ctx.alert.open).not.toHaveBeenCalled();
  });

  /**
   * @description The submit of the dialog saves the change: success = null (dialog closes) and a
   *   success alert; a refusal = '' (dialog stays open, the API error dialog of DataHandler
   *   announces it, so no second alert).
   * @input submit('pw') with PUT ok; submit('bad') with PUT 403; the dialog resolves true.
   * @output PUT web/settings with confirm_password 'pw' → null; 403 → ''; success alert
   *   'app-status.success_maintenance' after the dialog.
   */
  it('switches the application or reports the refusal', async () => {
    create(state(), ['web-set-maintenance-mode']);
    passwordDialog.open.and.callFake(async options => (await options.submit('pw')) === null);
    (ctx.dataHandler as any).put.and.returnValue(of({}));
    expect(await component.open()).toBeTrue();
    expect((ctx.dataHandler as any).put.calls.mostRecent().args[0]).toBe('web/settings');
    expect((ctx.dataHandler as any).put.calls.mostRecent().args[1].confirm_password).toBe('pw');
    expect(ctx.alert.open).toHaveBeenCalledWith('app-status.success_title', 'app-status.success_maintenance', 'success');

    (ctx.dataHandler as any).put.and.returnValue(throwError(() => ({ status: 403 })));
    expect(await dialogOptions().submit('bad')).toBe('');
  });
});
