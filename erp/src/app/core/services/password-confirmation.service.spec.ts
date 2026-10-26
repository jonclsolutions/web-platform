/**
 * @file password-confirmation.service.spec.ts
 * @path src/app/core/services/password-confirmation.service.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026-10-26
 * @description Unit tests of PasswordConfirmationService (step-up re-authentication): the dialog
 *   is mounted with the translated texts, the password goes to POST /confirm-password with the
 *   scope, 204 → true, a wrong password / lock / other failure keeps the dialog open with the
 *   matching text, cancel → false, a parallel call of the same scope shares the dialog, another
 *   scope replaces it (the first resolves false), the dialog is always removed afterwards.
 * @dependencies
 * - HttpClientTestingModule; real PasswordConfirmDialogComponent; AdminLocalizationService stub
 *   (returns the key); ScrollLockService spy.
 */

import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { PasswordConfirmationService } from './password-confirmation.service';
import { AdminLocalizationService } from './admin-localization.service';
import { ScrollLockService } from './scroll-lock.service';
import { PasswordConfirmDialogComponent } from '../../admin/components/password-confirm-dialog/password-confirm-dialog.component';
import { environment } from '../../../environments/environment';

describe('PasswordConfirmationService', () => {
  let service: PasswordConfirmationService;
  let httpMock: HttpTestingController;
  const url = `${environment.base_api_url}/confirm-password`;
  const dialogs = () => document.body.querySelectorAll('app-password-confirm-dialog');
  const current = () => (service as any).componentRef?.instance as PasswordConfirmDialogComponent | undefined;
  const flushAsync = () => new Promise(resolve => setTimeout(resolve));

  /** Types `password` into the open dialog and submits it. */
  const submit = (password: string) => {
    current()!.password = password;
    current()!.submit();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: AdminLocalizationService, useValue: { getValue: (path: string) => path } },
        { provide: ScrollLockService, useValue: jasmine.createSpyObj('ScrollLockService', ['lock', 'unlock']) },
      ],
    });
    service = TestBed.inject(PasswordConfirmationService);
    httpMock = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    httpMock.verify();
    dialogs().forEach(el => el.remove());
  });

  /**
   * @description The correct password confirms the scope: POST {password, scope}, true, dialog removed.
   * @input confirm('user:7'); submit 'S3cret!'; 204.
   * @output texts = password-confirm.* keys; body {password:'S3cret!', scope:'user:7'}; true; no dialog.
   */
  it('confirms the scope with the password', async () => {
    const result = service.confirm('user:7');
    expect(dialogs().length).toBe(1);
    expect(current()!.texts).toEqual({
      title: 'password-confirm.title', message: 'password-confirm.message', label: 'password-confirm.label',
      confirm: 'password-confirm.confirm', cancel: 'password-confirm.cancel',
    });

    submit('S3cret!');
    const req = httpMock.expectOne(url);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ password: 'S3cret!', scope: 'user:7' });
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(await result).toBeTrue();
    expect(dialogs().length).toBe(0);
  });

  /**
   * @description Failures keep the dialog open with the matching text; then cancel → false.
   * @input submit → 403 PASSWORD_INCORRECT; submit → 429; submit → 500; submit → 403 other code; cancel.
   * @output errors wrong_password, too_many, failed, failed; false; no dialog.
   */
  it('shows failures and resolves false on cancel', async () => {
    const result = service.confirm('email-policy');
    const fail = async (status: number, body: any) => {
      submit('x');
      httpMock.expectOne(url).flush(body, { status, statusText: 'Error' });
      await flushAsync();
      return current()!.error;
    };

    expect(await fail(403, { error_code: 'PASSWORD_INCORRECT' })).toBe('password-confirm.wrong_password');
    expect(await fail(429, { retry_after: 900 })).toBe('password-confirm.too_many');
    expect(await fail(500, null)).toBe('password-confirm.failed');
    expect(await fail(403, { error_code: 'OTHER' })).toBe('password-confirm.failed');
    expect(dialogs().length).toBe(1);

    current()!.cancel();
    expect(await result).toBeFalse();
    expect(dialogs().length).toBe(0);
  });

  /**
   * @description Parallel calls: the same scope shares the open dialog; another scope replaces it
   *   (the first resolves false); after settling, a new call opens a new dialog.
   * @input confirm('user:1') twice; confirm('user:2'); cancel; confirm('user:2') again; cancel.
   * @output same promise; first false; one dialog at a time; a new promise after settling.
   */
  it('shares the same scope and replaces another', async () => {
    const a = service.confirm('user:1');
    expect(service.confirm('user:1')).toBe(a);
    const b = service.confirm('user:2');
    expect(await a).toBeFalse();
    expect(dialogs().length).toBe(1);

    current()!.cancel();
    expect(await b).toBeFalse();
    const c = service.confirm('user:2');
    expect(c).not.toBe(b);
    current()!.cancel();
    expect(await c).toBeFalse();
  });

  /**
   * @description An answer arriving after the dialog was replaced changes nothing (no error shown
   *   in the new dialog, the replaced call stays false).
   * @input confirm('user:1'); submit; confirm('user:2'); answer 204 for the first; cancel the second.
   * @output first false; second dialog without error; second false.
   */
  it('ignores the answer of a replaced dialog', async () => {
    const a = service.confirm('user:1');
    submit('x');
    const b = service.confirm('user:2');
    httpMock.expectOne(url).flush(null, { status: 204, statusText: 'No Content' });
    await flushAsync();

    expect(await a).toBeFalse();
    expect(current()!.error).toBeNull();
    expect(dialogs().length).toBe(1);
    current()!.cancel();
    expect(await b).toBeFalse();
  });
});
