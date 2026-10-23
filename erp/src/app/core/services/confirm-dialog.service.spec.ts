/**
 * @file confirm-dialog.service.spec.ts
 * @path src/app/core/services/confirm-dialog.service.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of ConfirmDialogService: the dialog is mounted with the texts and the
 *   scroll lock, confirm → true, cancel → false, the dialog is removed afterwards and a dialog
 *   replaced by a newer one resolves false (bugfix 2026-10-23); the scroll lock is released once.
 * @dependencies
 * - Real ConfirmDialogComponent; ScrollLockService spy.
 */

import { TestBed } from '@angular/core/testing';

import { ConfirmDialogService } from './confirm-dialog.service';
import { ScrollLockService } from './scroll-lock.service';
import { ConfirmDialogComponent } from '../../admin/components/confirm-dialog/confirm-dialog.component';

describe('ConfirmDialogService', () => {
  let service: ConfirmDialogService;
  let scrollLock: jasmine.SpyObj<ScrollLockService>;
  const dialogs = () => document.body.querySelectorAll('app-confirm-dialog');
  const current = () => (service as any).componentRef?.instance as ConfirmDialogComponent | undefined;

  beforeEach(() => {
    scrollLock = jasmine.createSpyObj('ScrollLockService', ['lock', 'unlock']);
    TestBed.configureTestingModule({ providers: [{ provide: ScrollLockService, useValue: scrollLock }] });
    service = TestBed.inject(ConfirmDialogService);
  });
  afterEach(() => dialogs().forEach(el => el.remove()));

  /**
   * @description Confirm resolves true and removes the dialog; lock / unlock exactly once each.
   * @input open('Delete?', 'Really?'); confirm().
   * @output Mounted with title / message, visible; true; no dialog; lock 1×, unlock 1×.
   */
  it('resolves true on confirm and cleans up', async () => {
    const result = service.open('Delete?', 'Really?');
    expect(dialogs().length).toBe(1);
    expect(current()!.title).toBe('Delete?');
    expect(current()!.message).toBe('Really?');
    expect(current()!.isVisible).toBeTrue();

    current()!.confirm();
    expect(await result).toBeTrue();
    expect(dialogs().length).toBe(0);
    expect(current()).toBeUndefined();
    expect(scrollLock.lock).toHaveBeenCalledTimes(1);
    expect(scrollLock.unlock).toHaveBeenCalledTimes(1);
  });

  /**
   * @description Button labels: the caller's labels win, then the surface defaults, then the
   *   component's English fallback (finding #20).
   * @input open() without labels; setDefaultLabels(Ano / Ne); open() without and with labels; setDefaultLabels(null).
   * @output 'Confirm' / 'Cancel'; 'Ano' / 'Ne'; caller 'Remove' + default 'Ne' for the missing one; 'Confirm' / 'Cancel' again.
   */
  it('uses caller labels, then the defaults, then the fallback', () => {
    service.open('T', 'M');
    expect([current()!.confirmLabel, current()!.cancelLabel]).toEqual(['Confirm', 'Cancel']);
    service.setDefaultLabels({ confirm: 'Ano', cancel: 'Ne' });
    service.open('T', 'M');
    expect([current()!.confirmLabel, current()!.cancelLabel]).toEqual(['Ano', 'Ne']);
    service.open('T', 'M', { confirm: 'Remove' });
    expect([current()!.confirmLabel, current()!.cancelLabel]).toEqual(['Remove', 'Ne']);
    service.setDefaultLabels(null);
    service.open('T', 'M', { confirm: '', cancel: undefined });
    expect([current()!.confirmLabel, current()!.cancelLabel]).toEqual(['Confirm', 'Cancel']);
    current()!.cancel();
  });

  /**
   * @description Cancel resolves false.
   * @input open(); cancel().
   * @output false, dialog removed.
   */
  it('resolves false on cancel', async () => {
    const result = service.open('T', 'M');
    current()!.cancel();
    expect(await result).toBeFalse();
    expect(dialogs().length).toBe(0);
  });

  /**
   * @description A second open() replaces the first dialog and settles its promise as false.
   * @input open('1'); open('2'); confirm() of the second.
   * @output first false; second true; only one dialog at a time.
   */
  it('settles a replaced dialog as not confirmed', async () => {
    const first = service.open('1', 'a');
    const second = service.open('2', 'b');
    expect(await first).toBeFalse();
    expect(dialogs().length).toBe(1);
    expect(current()!.title).toBe('2');
    current()!.confirm();
    expect(await second).toBeTrue();
  });
});
