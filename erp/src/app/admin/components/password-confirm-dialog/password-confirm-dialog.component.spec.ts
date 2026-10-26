/**
 * @file password-confirm-dialog.component.spec.ts
 * @path src/app/admin/components/password-confirm-dialog/password-confirm-dialog.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026-10-26
 * @description Unit tests of PasswordConfirmDialogComponent (step-up password prompt): the field
 *   is focused, submit emits the password once and clears it, cancel is blocked while checking,
 *   an error re-enables the form, texts are applied, the scroll lock is released exactly once.
 * @dependencies
 * - ScrollLockService spy.
 */

import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';

import { PasswordConfirmDialogComponent } from './password-confirm-dialog.component';
import { ScrollLockService } from '../../../core/services/scroll-lock.service';

describe('PasswordConfirmDialogComponent', () => {
  let fixture: ComponentFixture<PasswordConfirmDialogComponent>;
  let component: PasswordConfirmDialogComponent;
  let scrollLock: jasmine.SpyObj<ScrollLockService>;
  const input = () => fixture.nativeElement.querySelector('#pwc-password') as HTMLInputElement;

  beforeEach(() => {
    scrollLock = jasmine.createSpyObj('ScrollLockService', ['lock', 'unlock']);
    TestBed.configureTestingModule({
      imports: [PasswordConfirmDialogComponent],
      providers: [{ provide: ScrollLockService, useValue: scrollLock }],
    });
    fixture = TestBed.createComponent(PasswordConfirmDialogComponent);
    component = fixture.componentInstance;
  });

  /**
   * @description Opening locks the scroll and focuses the password field (a password field,
   *   autocomplete current-password); the default English texts are shown.
   * @input createComponent; detectChanges; tick.
   * @output lock 1×; focused input type=password, autocomplete=current-password; title 'Confirm with your password'.
   */
  it('locks the scroll and focuses the password field', () => {
    fixture.detectChanges();
    expect(scrollLock.lock).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(input());
    expect(input().type).toBe('password');
    expect(input().getAttribute('autocomplete')).toBe('current-password');
    expect(fixture.nativeElement.querySelector('#pwc-title').textContent).toContain('Confirm with your password');
  });

  /**
   * @description Submit emits the password once, clears the field and blocks the form; an empty
   *   password or a second submit while checking emits nothing; cancel is blocked while checking.
   * @input submit() empty; password 'S3cret!'; submit() twice; cancel().
   * @output submitted ['S3cret!'] once; password ''; busy; no cancelled.
   */
  it('submits once and blocks while checking', fakeAsync(() => {
    const submitted: string[] = [];
    let cancelled = 0;
    component.submitted.subscribe(v => submitted.push(v));
    component.cancelled.subscribe(() => cancelled++);
    fixture.detectChanges();
    tick();

    component.submit();
    expect(submitted).toEqual([]);

    component.password = 'S3cret!';
    component.submit();
    component.submit();
    component.cancel();
    expect(submitted).toEqual(['S3cret!']);
    expect(component.password).toBe('');
    expect(component.busy).toBeTrue();
    expect(cancelled).toBe(0);
  }));

  /**
   * @description An error re-enables the form, is shown as an alert and refocuses the field;
   *   cancel then emits and clears the password.
   * @input submit 'x'; showError('Wrong'); detectChanges; tick; password 'y'; cancel().
   * @output busy false; alert 'Wrong', aria-invalid; focused; cancelled 1×; password ''.
   */
  it('shows an error and allows cancel', fakeAsync(() => {
    let cancelled = 0;
    component.cancelled.subscribe(() => cancelled++);
    fixture.detectChanges();
    tick();
    component.password = 'x';
    component.submit();
    component.showError('Wrong');
    fixture.detectChanges();
    tick();

    expect(component.busy).toBeFalse();
    const alert = fixture.nativeElement.querySelector('[role=alert]') as HTMLElement;
    expect(alert.textContent).toContain('Wrong');
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(input());

    component.password = 'y';
    component.cancel();
    expect(cancelled).toBe(1);
    expect(component.password).toBe('');
  }));

  /**
   * @description Translated texts are rendered; clicking the overlay cancels, a click inside does not.
   * @input setTexts(cz texts); click on the container; click on the overlay.
   * @output Czech title / buttons; cancelled 1× (overlay only).
   */
  it('applies texts and cancels on the overlay', fakeAsync(() => {
    let cancelled = 0;
    component.cancelled.subscribe(() => cancelled++);
    component.setTexts({ title: 'Potvrďte heslem', message: 'Zpráva', label: 'Heslo', confirm: 'Potvrdit', cancel: 'Zrušit' });
    fixture.detectChanges();
    tick();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('#pwc-title')!.textContent).toContain('Potvrďte heslem');
    expect(el.querySelector('.confirm_button')!.textContent).toContain('Potvrdit');
    expect(el.querySelector('.neutral_button')!.textContent).toContain('Zrušit');

    (el.querySelector('.dialog-container') as HTMLElement).click();
    expect(cancelled).toBe(0);
    (el.querySelector('.dialog-overlay') as HTMLElement).click();
    expect(cancelled).toBe(1);
  }));

  /**
   * @description Destroy clears the password and unlocks the scroll exactly once; the delayed
   *   focus after an error of a destroyed dialog does not fail.
   * @input password 'z'; showError('e'); destroy() without detectChanges; ngOnDestroy() again; tick.
   * @output password ''; unlock 1×; no error.
   */
  it('releases the scroll lock once', fakeAsync(() => {
    component.password = 'z';
    component.showError('e');
    fixture.destroy();
    component.ngOnDestroy();
    tick();
    expect(component.password).toBe('');
    expect(scrollLock.unlock).toHaveBeenCalledTimes(1);
  }));
});
