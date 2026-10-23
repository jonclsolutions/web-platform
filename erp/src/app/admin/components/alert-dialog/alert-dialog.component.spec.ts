/**
 * @file alert-dialog.component.spec.ts
 * @path src/app/admin/components/alert-dialog/alert-dialog.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of AlertDialogComponent – the toast stack used by AlertDialogService
 *   (auto-hide for success/info, manual close, exit animation, CSS class per type).
 * @dependencies
 * - none (standalone component, no services)
 */

import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { AlertDialogComponent, AlertToastItem } from './alert-dialog.component';

describe('AlertDialogComponent', () => {
  let fixture: ComponentFixture<AlertDialogComponent>;
  let component: AlertDialogComponent;

  const toast = (id: number, type: AlertToastItem['type'] = 'info'): AlertToastItem =>
    ({ id, title: `Title ${id}`, message: `Message ${id}`, type });

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AlertDialogComponent] }).compileComponents();
    fixture = TestBed.createComponent(AlertDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  /**
   * @description New toasts are shown on top of the stack.
   * @input  addToast(1) then addToast(2)
   * @output toasts ids [2, 1]; both titles rendered
   */
  it('adds new toasts on top', () => {
    component.addToast(toast(1, 'warning'));
    component.addToast(toast(2, 'warning'));
    expect(component.toasts.map(t => t.id)).toEqual([2, 1]);
    const titles = Array.from(fixture.nativeElement.querySelectorAll('.dialog-title')).map((e: any) => e.textContent.trim());
    expect(titles).toEqual(['Title 2', 'Title 1']);
  });

  /**
   * @description Success and info toasts hide automatically after 5 s (+220 ms exit animation).
   * @input  addToast(success); 5000 ms pass, then 220 ms
   * @output toastClosed emits 1 after 5000 ms; toast removed after the animation
   */
  it('auto-hides success toasts after 5 seconds', fakeAsync(() => {
    const closed: number[] = [];
    component.toastClosed.subscribe(id => closed.push(id));
    component.addToast(toast(1, 'success'));
    tick(4999);
    expect(closed).toEqual([]);
    tick(1);
    expect(closed).toEqual([1]);
    expect(component.toasts[0].leaving).toBeTrue();
    tick(220);
    expect(component.toasts).toEqual([]);
  }));

  /**
   * @description Warning and danger toasts stay until the user closes them.
   * @input  addToast(danger); 10 s pass
   * @output toast still present, toastClosed not emitted
   */
  it('keeps danger toasts until closed', fakeAsync(() => {
    const closed: number[] = [];
    component.toastClosed.subscribe(id => closed.push(id));
    component.addToast(toast(1, 'danger'));
    tick(10000);
    expect(component.toasts.length).toBe(1);
    expect(closed).toEqual([]);
  }));

  /**
   * @description Clicking ✕ closes only that toast and does not bubble to the toast click.
   * @input  two toasts; closeClick(1, event)
   * @output event.stopPropagation() called; toastClosed emits 1; toast 2 untouched
   */
  it('closeClick() closes one toast and stops propagation', fakeAsync(() => {
    const closed: number[] = [];
    component.toastClosed.subscribe(id => closed.push(id));
    component.addToast(toast(1, 'warning'));
    component.addToast(toast(2, 'warning'));
    const event = jasmine.createSpyObj<Event>('Event', ['stopPropagation']);
    component.closeClick(1, event);
    tick(220);
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(closed).toEqual([1]);
    expect(component.toasts.map(t => t.id)).toEqual([2]);
  }));

  /**
   * @description Closing the same toast twice emits only once.
   * @input  ok(1) twice
   * @output toastClosed emitted once
   */
  it('ok() is idempotent', fakeAsync(() => {
    const closed: number[] = [];
    component.toastClosed.subscribe(id => closed.push(id));
    component.addToast(toast(1, 'warning'));
    component.ok(1);
    component.ok(1);
    tick(220);
    expect(closed).toEqual([1]);
  }));

  /**
   * @description Closing a success toast manually cancels its auto-hide timer.
   * @input  addToast(success); ok(1) after 1 s; 5 s pass
   * @output toastClosed emitted exactly once
   */
  it('manual close cancels the auto-hide timer', fakeAsync(() => {
    const closed: number[] = [];
    component.toastClosed.subscribe(id => closed.push(id));
    component.addToast(toast(1, 'success'));
    tick(1000);
    component.ok(1);
    tick(6000);
    expect(closed).toEqual([1]);
  }));

  /**
   * @description Each toast type gets its own CSS class; unknown types fall back to info.
   * @input  getDialogClass('warning' | 'danger' | 'success' | 'info' | 'other')
   * @output 'warning-dialog', 'danger-dialog', 'success-dialog', 'info-dialog', 'info-dialog'
   */
  it('getDialogClass() maps the type to a CSS class', () => {
    expect(component.getDialogClass('warning')).toBe('warning-dialog');
    expect(component.getDialogClass('danger')).toBe('danger-dialog');
    expect(component.getDialogClass('success')).toBe('success-dialog');
    expect(component.getDialogClass('info')).toBe('info-dialog');
    expect(component.getDialogClass('other' as any)).toBe('info-dialog');
  });

  /**
   * @description Without a title the type is shown as the heading (titlecase).
   * @input  addToast({ title: '', type: 'warning' })
   * @output heading text 'Warning'
   */
  it('uses the type as heading when the title is empty', () => {
    component.addToast({ id: 1, title: '', message: 'm', type: 'warning' });
    expect(fixture.nativeElement.querySelector('.dialog-title').textContent.trim()).toBe('Warning');
  });

  /**
   * @description Destroying the component clears pending auto-hide timers.
   * @input  addToast(info); ngOnDestroy(); 6 s pass
   * @output toastClosed never emitted
   */
  it('ngOnDestroy() clears pending timers', fakeAsync(() => {
    const closed: number[] = [];
    component.toastClosed.subscribe(id => closed.push(id));
    component.addToast(toast(1, 'info'));
    component.ngOnDestroy();
    tick(6000);
    expect(closed).toEqual([]);
  }));
});
