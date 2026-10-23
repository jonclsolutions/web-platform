/**
 * @file confirm-dialog.component.spec.ts
 * @path src/app/admin/components/confirm-dialog/confirm-dialog.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of ConfirmDialogComponent – the yes/no dialog used by ConfirmDialogService
 *   (visibility, scroll lock, confirm / cancel events).
 * @dependencies
 * - ScrollLockService (replaced by a spy)
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import { ScrollLockService } from '../../../core/services/scroll-lock.service';

describe('ConfirmDialogComponent', () => {
  let fixture: ComponentFixture<ConfirmDialogComponent>;
  let component: ConfirmDialogComponent;
  let scrollLock: jasmine.SpyObj<ScrollLockService>;

  beforeEach(async () => {
    scrollLock = jasmine.createSpyObj<ScrollLockService>('ScrollLockService', ['lock', 'unlock']);
    await TestBed.configureTestingModule({
      imports: [ConfirmDialogComponent],
      providers: [{ provide: ScrollLockService, useValue: scrollLock }]
    }).compileComponents();
    fixture = TestBed.createComponent(ConfirmDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  /**
   * @description The dialog is hidden until show() is called.
   * @input  new component
   * @output isVisible = false; no overlay in the DOM
   */
  it('is hidden by default', () => {
    expect(component.isVisible).toBeFalse();
    expect(fixture.nativeElement.querySelector('.dialog-overlay')).toBeNull();
  });

  /**
   * @description show() displays the given title and message and locks page scrolling.
   * @input  title 'Delete?', message 'Really?'; show()
   * @output overlay rendered with both texts; scrollLock.lock() called
   */
  it('show() renders the dialog and locks scrolling', () => {
    component.title = 'Delete?';
    component.message = 'Really?';
    component.show();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.dialog-title').textContent.trim()).toBe('Delete?');
    expect(fixture.nativeElement.querySelector('.dialog-body p').textContent.trim()).toBe('Really?');
    expect(scrollLock.lock).toHaveBeenCalledTimes(1);
  });

  /**
   * @description The confirm button emits onConfirm and hides the dialog.
   * @input  show(); click .confirm_button
   * @output onConfirm emitted once; isVisible = false; scrollLock.unlock() called
   */
  it('confirm button emits onConfirm and closes', () => {
    let confirmed = 0;
    component.onConfirm.subscribe(() => confirmed++);
    component.show();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.confirm_button').click();
    expect(confirmed).toBe(1);
    expect(component.isVisible).toBeFalse();
    expect(scrollLock.unlock).toHaveBeenCalledTimes(1);
  });

  /**
   * @description The cancel button emits onCancel (not onConfirm) and hides the dialog.
   * @input  show(); click .neutral_button
   * @output onCancel emitted once; onConfirm not emitted; isVisible = false
   */
  it('cancel button emits onCancel and closes', () => {
    let cancelled = 0;
    let confirmed = 0;
    component.onCancel.subscribe(() => cancelled++);
    component.onConfirm.subscribe(() => confirmed++);
    component.show();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.neutral_button').click();
    expect(cancelled).toBe(1);
    expect(confirmed).toBe(0);
    expect(component.isVisible).toBeFalse();
  });

  /**
   * @description Every lock() has a matching unlock() (scroll is never left blocked).
   * @input  show(); hide()
   * @output lock and unlock each called once
   */
  it('hide() releases the scroll lock taken by show()', () => {
    component.show();
    component.hide();
    expect(scrollLock.lock).toHaveBeenCalledTimes(1);
    expect(scrollLock.unlock).toHaveBeenCalledTimes(1);
  });
});
