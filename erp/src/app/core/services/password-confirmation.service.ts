/**
 * @file password-confirmation.service.ts
 * @path src/app/core/services/password-confirmation.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Step-up re-authentication of the admin (OWASP ASVS V2 "re-authentication before
 *   sensitive operations"). The API refuses an operation on a sysadmin account (create / promote /
 *   demote / edit / delete / restore) and a change of the e-mail access policy with 403
 *   `PASSWORD_CONFIRMATION_REQUIRED` + `scope` until the acting user confirms the operation with
 *   the own password (`POST /confirm-password {password, scope}` → 204). The confirmation is
 *   single-use, bound to the user, the login token and the scope, and valid 10 minutes - a stolen
 *   session alone can therefore neither add a second sysadmin nor remove the others.
 *   `confirm(scope)` opens the shared password dialog and resolves `true` once the API accepted
 *   the password, `false` when the user cancelled. Wrong password = error in the dialog, it stays
 *   open; 5 wrong passwords lock the confirmation for 15 minutes (429).
 * @note The password lives only in the dialog field and in the one request - it is never stored,
 *   logged or kept in memory after the request (GDPR art. 32, data minimisation).
 * @note HttpClient, AdminLocalizationService and PasswordDialogService are taken LAZILY from the Injector: this service is
 *   a dependency of PasswordConfirmationInterceptor, which is built while HttpClient itself is
 *   being constructed (eager injection = circular DI, NG0200; same reason as in DataHandler).
 * @dependencies
 * - PasswordDialogService: the shared password prompt (PasswordDialogComponent).
 * - AdminLocalizationService: texts of the admin section `password-confirm`.
 */

import { Injectable, Injector, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminLocalizationService } from './admin-localization.service';
import { PasswordDialogService } from './password-dialog.service';

/** URL path of the confirmation endpoint (also used by the interceptor to skip it). */
export const PASSWORD_CONFIRMATION_PATH = '/confirm-password';

/** Error code of an API refusal waiting for the confirmation. */
export const PASSWORD_CONFIRMATION_REQUIRED = 'PASSWORD_CONFIRMATION_REQUIRED';

/**
 * @description Opens the password prompt and confirms the operation scope at the API.
 * @usage `if (await passwordConfirmation.confirm('user:' + id)) { … }` - or let
 *   PasswordConfirmationInterceptor ask automatically on a refused request.
 */
@Injectable({ providedIn: 'root' })
export class PasswordConfirmationService {
  private readonly injector = inject(Injector);

  /** The confirmation in progress - parallel callers of the same scope share it. */
  private pending: { scope: string; promise: Promise<boolean> } | null = null;

  /**
   * @description Asks for the password and confirms `scope` at the API.
   * @param scope Operation scope from the API (`user:12`, `user:new`, `users:trash`, `email-policy`).
   * @returns Promise - `true` = confirmed (repeat the operation now), `false` = cancelled.
   * @note A second call while a dialog is open: same scope → the same promise; another scope →
   *   the open dialog is replaced (`false`) and the new one opens.
   */
  confirm(scope: string): Promise<boolean> {
    if (this.pending?.scope === scope) {
      return this.pending.promise;
    }
    const promise = this.injector.get(PasswordDialogService).open({
      title: this.t('title'),
      message: this.t('message'),
      submit: password => this.send(password, scope),
    });
    const entry = { scope, promise };
    this.pending = entry;
    promise.finally(() => {
      if (this.pending === entry) this.pending = null;
    });
    return promise;
  }

  /**
   * @description Sends the password; maps the answer to an error text.
   * @param password Typed password.
   * @param scope Operation scope.
   * @returns null = confirmed (204); otherwise the translated error to show.
   */
  private async send(password: string, scope: string): Promise<string | null> {
    try {
      await firstValueFrom(this.injector.get(HttpClient).post(
        `${environment.base_api_url}${PASSWORD_CONFIRMATION_PATH}`, { password, scope }
      ));
      return null;
    } catch (e) {
      const err = e as HttpErrorResponse;
      if (err?.status === 403 && err.error?.error_code === 'PASSWORD_INCORRECT') return this.t('wrong_password');
      if (err?.status === 429) return this.t('too_many');
      return this.t('failed');
    }
  }

  /**
   * @description Text of the admin section `password-confirm`.
   * @param key Key inside the section.
   */
  private t(key: string): string {
    return this.injector.get(AdminLocalizationService).getValue(`password-confirm.${key}`);
  }
}
