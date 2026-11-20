/**
 * @file confirm-dialog.component.spec.ts
 * @path src/app/admin/components/confirm-dialog/confirm-dialog.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of ConfirmDialogComponent – the yes/no dialog used by ConfirmDialogService
 *   (visibility, scroll lock of the shared popup frame, confirm / cancel events, Escape = cancel).
 * @dependencies
 * - ScrollLockService (replaced by a spy), AdminLocalizationService (i18n stub of admin-test-helpers)
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import { ScrollLockService } from '../../../core/services/scroll-lock.service';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';
import { createI18nStub } from '../../../../testing/admin-test-helpers';

describe('ConfirmDialogComponent', () => {
  let fixture: ComponentFixture<ConfirmDialogComponent>;
  let component: ConfirmDialogComponent;
  let scrollLock: jasmine.SpyObj<ScrollLockService>;

  beforeEach(async () => {
    scrollLock = jasmine.createSpyObj<ScrollLockService>('ScrollLockService', ['lock', 'unlock']);
    await TestBed.configureTestingModule({
      imports: [ConfirmDialogComponent],
      providers: [
        { provide: ScrollLockService, useValue: scrollLock },
        { provide: AdminLocalizationService, useValue: createI18nStub() },
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(ConfirmDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  /**
   * @description The dialog is hidden until show() is called.
   * @input  new component
   * @output isVisible = false; no popup frame in the DOM
   */
  it('is hidden by default', () => {
    expect(component.isVisible).toBeFalse();
    expect(fixture.nativeElement.querySelector('app-admin-modal')).toBeNull();
  });

  /**
   * @description show() displays the given title and message and locks page scrolling.
   * @input  title 'Delete?', message 'Really?'; show()
   * @output small prompt frame rendered with both texts; scrollLock.lock() called
   */
  it('show() renders the dialog and locks scrolling', () => {
    component.title = 'Delete?';
    component.message = 'Really?';
    component.show();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.am-title').textContent.trim()).toBe('Delete?');
    expect(fixture.nativeElement.querySelector('.am-body .confirm-message').textContent.trim()).toBe('Really?');
    expect(fixture.nativeElement.querySelector('.am-card').dataset.size).toBe('sm');
    expect(fixture.nativeElement.querySelector('.am-overlay').dataset.level).toBe('prompt');
    expect(scrollLock.lock).toHaveBeenCalledTimes(1);
  });

  /**
   * @description The confirm button emits onConfirm and hides the dialog.
   * @input  show(); click the primary button
   * @output onConfirm emitted once; isVisible = false; scrollLock.unlock() called
   */
  it('confirm button emits onConfirm and closes', () => {
    let confirmed = 0;
    component.onConfirm.subscribe(() => confirmed++);
    component.show();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.am-btn--primary').click();
    fixture.detectChanges();
    expect(confirmed).toBe(1);
    expect(component.isVisible).toBeFalse();
    expect(scrollLock.unlock).toHaveBeenCalledTimes(1);
  });

  /**
   * @description The buttons show the label inputs, not hardcoded Czech (finding #20).
   * @input  defaults; then confirmLabel 'Odstranit', cancelLabel 'Ponechat'
   * @output 'Confirm' / 'Cancel'; then 'Odstranit' / 'Ponechat'
   */
  it('renders the button labels from the inputs', () => {
    component.show();
    fixture.detectChanges();
    const text = (sel: string) => fixture.nativeElement.querySelector(sel).textContent.trim();
    expect([text('.am-btn--primary'), text('.am-btn--secondary')]).toEqual(['Confirm', 'Cancel']);
    fixture.componentRef.setInput('confirmLabel', 'Odstranit');
    fixture.componentRef.setInput('cancelLabel', 'Ponechat');
    fixture.detectChanges();
    expect([text('.am-btn--primary'), text('.am-btn--secondary')]).toEqual(['Odstranit', 'Ponechat']);
  });

  /**
   * @description The cancel button emits onCancel (not onConfirm) and hides the dialog.
   * @input  show(); click the secondary button; show(); Escape
   * @output onCancel emitted once, then twice (Escape cancels); onConfirm not emitted; isVisible = false
   */
  it('cancel button emits onCancel and closes', () => {
    let cancelled = 0;
    let confirmed = 0;
    component.onCancel.subscribe(() => cancelled++);
    component.onConfirm.subscribe(() => confirmed++);
    component.show();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.am-btn--secondary').click();
    fixture.detectChanges();
    expect(cancelled).toBe(1);
    expect(confirmed).toBe(0);
    expect(component.isVisible).toBeFalse();

    component.show();
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect([cancelled, confirmed]).toEqual([2, 0]);
    expect(component.isVisible).toBeFalse();
  });

  /**
   * @description Every lock() has a matching unlock() (scroll is never left blocked).
   * @input  show() + render; hide() + render
   * @output lock and unlock each called once
   */
  it('hide() releases the scroll lock taken by show()', () => {
    component.show();
    fixture.detectChanges();
    component.hide();
    fixture.detectChanges();
    expect(scrollLock.lock).toHaveBeenCalledTimes(1);
    expect(scrollLock.unlock).toHaveBeenCalledTimes(1);
  });
});
