/**
 * @file alert-dialog.service.spec.ts
 * @path src/app/core/services/alert-dialog.service.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of AlertDialogService: one toast container mounted to <body> lazily,
 *   every open() adds a toast and its promise resolves when exactly that toast is closed.
 * @dependencies
 * - Real AlertDialogComponent created dynamically; container element removed after each test.
 */

import { TestBed, fakeAsync, flush } from '@angular/core/testing';

import { AlertDialogService } from './alert-dialog.service';
import { AlertDialogComponent } from '../../admin/components/alert-dialog/alert-dialog.component';

describe('AlertDialogService', () => {
  let service: AlertDialogService;
  const containers = () => document.body.querySelectorAll('app-alert-dialog');

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AlertDialogService);
  });
  afterEach(() => containers().forEach(el => el.remove()));

  /**
   * @description Two toasts share one container; closing the second resolves only its promise;
   *   the type defaults to 'info'.
   * @input open('A', 'a', 'warning'); open('B', 'b'); ok() on the second toast.
   * @output 1 container, 2 toasts (B first, type info); second promise resolved, first pending.
   */
  it('mounts one container and resolves the promise of the closed toast', fakeAsync(() => {
    expect(containers().length).toBe(0);
    let first = false;
    let second = false;
    service.open('A', 'a', 'warning').then(() => (first = true));
    service.open('B', 'b').then(() => (second = true));

    expect(containers().length).toBe(1);
    const instance = (service as any).componentRef.instance as AlertDialogComponent;
    expect(instance.toasts.map(t => [t.title, t.type])).toEqual([['B', 'info'], ['A', 'warning']]);

    instance.ok(instance.toasts[0].id);
    flush();
    expect(second).toBeTrue();
    expect(first).toBeFalse();

    instance.ok(instance.toasts.find(t => t.title === 'A')!.id);
    flush();
    expect(first).toBeTrue();
  }));

  /**
   * @description A close event for an unknown toast id is ignored.
   * @input toastClosed.emit(999) after one open().
   * @output Pending promise stays pending, no error.
   */
  it('ignores close events of unknown toasts', fakeAsync(() => {
    let resolved = false;
    service.open('A', 'a', 'danger').then(() => (resolved = true));
    (service as any).componentRef.instance.toastClosed.emit(999);
    flush();
    expect(resolved).toBeFalse();
  }));
});
