/**
 * @file password-dialog.service.spec.ts
 * @path src/app/core/services/password-dialog.service.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of PasswordDialogService + PasswordDialogComponent (shared password
 *   dialog): optional parts rendered from the options / defaults, submit null → closes and
 *   resolves true, a text → stays open with the error, '' → stays open without a text, a thrown
 *   error → the default failure text, cancel / close / overlay → false, a new dialog replaces the
 *   open one, the password is cleared and the scroll lock released.
 * @dependencies AdminLocalizationService stub (returns the key path); ScrollLockService spy.
 */

import { TestBed } from '@angular/core/testing';

import { PasswordDialogService } from './password-dialog.service';
import { AdminLocalizationService } from './admin-localization.service';
import { ScrollLockService } from './scroll-lock.service';
import { PasswordDialogComponent } from '../../admin/components/password-dialog/password-dialog.component';

describe('PasswordDialogService', () => {
  let service: PasswordDialogService;
  let scrollLock: jasmine.SpyObj<ScrollLockService>;
  const dialogs = () => document.body.querySelectorAll('app-password-dialog');
  const dialogEl = () => dialogs()[0] as HTMLElement;
  const current = () => (service as any).componentRef?.instance as PasswordDialogComponent | undefined;
  const render = () => (service as any).componentRef?.changeDetectorRef.detectChanges();
  const flushAsync = () => new Promise(resolve => setTimeout(resolve));

  /** Types `password` into the open dialog and submits it. */
  const submit = (password: string) => {
    current()!.password = password;
    current()!.submit();
  };

  beforeEach(() => {
    scrollLock = jasmine.createSpyObj('ScrollLockService', ['lock', 'unlock']);
    TestBed.configureTestingModule({
      providers: [
        { provide: AdminLocalizationService, useValue: { getValue: (path: string) => path } },
        { provide: ScrollLockService, useValue: scrollLock },
      ],
    });
    service = TestBed.inject(PasswordDialogService);
  });
  afterEach(() => dialogs().forEach(el => el.remove()));

  /**
   * @description Every optional part from the options; the submit gets the password; null closes.
   * @input title, message, highlight (danger), warning, label, confirm label; submit 'pw' → null.
   * @output texts rendered (highlight data-tone danger, warning box, label), default cancel;
   *   submit called with 'pw'; true; no dialog; scroll lock + unlock; password cleared.
   */
  it('renders the options and closes after a successful submit', async () => {
    const submitFn = jasmine.createSpy('submit').and.resolveTo(null);
    const result = service.open({
      title: 'T', message: 'M', highlight: 'OFF', highlightTone: 'danger', warning: 'W', label: 'L', confirmLabel: 'OK', submit: submitFn,
    });
    render();
    expect(service.isOpen).toBeTrue();
    expect(dialogEl().querySelector('.pwd-title')!.textContent).toBe('T');
    expect(dialogEl().querySelector('.pwd-message')!.textContent).toContain('M');
    expect(dialogEl().querySelector('.pwd-highlight')!.getAttribute('data-tone')).toBe('danger');
    expect(dialogEl().querySelector('.pwd-warning')!.textContent).toBe('W');
    expect(dialogEl().querySelector('label')!.textContent).toBe('L');
    expect(dialogEl().querySelector('.pwd-btn--primary')!.textContent!.trim()).toBe('OK');
    expect(dialogEl().querySelector('.pwd-btn--secondary')!.textContent!.trim()).toBe('password-dialog.cancel');
    expect(scrollLock.lock).toHaveBeenCalledTimes(1);

    submit('pw');
    expect(current()!.password).toBe('');
    expect(await result).toBeTrue();
    expect(submitFn).toHaveBeenCalledWith('pw');
    expect(dialogs().length).toBe(0);
    expect(scrollLock.unlock).toHaveBeenCalledTimes(1);
  });

  /**
   * @description Without the optional parts only the title, the default label and buttons; an
   *   empty password is not submitted.
   * @input title only; submit with an empty password.
   * @output no message / warning; label password-dialog.label; confirm disabled; submit not called.
   */
  it('uses the defaults and needs a password', () => {
    const submitFn = jasmine.createSpy('submit').and.resolveTo(null);
    service.open({ title: 'T', submit: submitFn });
    render();
    expect(dialogEl().querySelector('.pwd-message')).toBeNull();
    expect(dialogEl().querySelector('.pwd-warning')).toBeNull();
    expect(dialogEl().querySelector('label')!.textContent).toBe('password-dialog.label');
    expect((dialogEl().querySelector('.pwd-btn--primary') as HTMLButtonElement).disabled).toBeTrue();
    current()!.submit();
    expect(submitFn).not.toHaveBeenCalled();
  });

  /**
   * @description Failures keep the dialog open: a text is shown, '' shows none, a thrown error
   *   shows the default failure; then cancel → false.
   * @input submit → 'Wrong'; submit → ''; submit → throws; cancel.
   * @output error 'Wrong'; null; 'password-dialog.failed'; not busy; false; no dialog.
   */
  it('keeps the dialog open on a failure and resolves false on cancel', async () => {
    const answers: Array<() => Promise<string | null>> = [
      () => Promise.resolve('Wrong'), () => Promise.resolve(''), () => Promise.reject(new Error('x')),
    ];
    const result = service.open({ title: 'T', submit: () => answers.shift()!() });

    submit('a');
    await flushAsync();
    expect(current()!.error).toBe('Wrong');
    expect(current()!.busy).toBeFalse();
    submit('b');
    await flushAsync();
    expect(current()!.error).toBeNull();
    submit('c');
    await flushAsync();
    expect(current()!.error).toBe('password-dialog.failed');

    render();
    (dialogEl().querySelector('.pwd-close') as HTMLButtonElement).click();
    expect(await result).toBeFalse();
    expect(dialogs().length).toBe(0);
  });

  /**
   * @description A new dialog replaces the open one (it resolves false); a late answer of the
   *   replaced one changes nothing; the overlay cancels.
   * @input open A, submit (pending); open B; A's answer null; click the overlay of B.
   * @output A false; one dialog; B without error; B false.
   */
  it('replaces the open dialog', async () => {
    let finishA!: (value: string | null) => void;
    const a = service.open({ title: 'A', submit: () => new Promise(resolve => (finishA = resolve)) });
    submit('x');
    const b = service.open({ title: 'B', submit: () => Promise.resolve(null) });
    expect(await a).toBeFalse();
    finishA(null);
    await flushAsync();
    expect(dialogs().length).toBe(1);
    expect(current()!.error).toBeNull();

    render();
    (dialogEl().querySelector('.pwd-overlay') as HTMLElement).click();
    expect(await b).toBeFalse();
    expect(service.isOpen).toBeFalse();
  });
});
