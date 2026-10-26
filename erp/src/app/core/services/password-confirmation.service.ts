/**
 * @file password-confirmation.service.ts
 * @path src/app/core/services/password-confirmation.service.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026-10-26
 * @description Step-up re-authentication of the admin (OWASP ASVS V2 "re-authentication before
 *   sensitive operations"). The API refuses an operation on a sysadmin account (create / promote /
 *   demote / edit / delete / restore) and a change of the e-mail access policy with 403
 *   `PASSWORD_CONFIRMATION_REQUIRED` + `scope` until the acting user confirms the operation with
 *   the own password (`POST /confirm-password {password, scope}` → 204). The confirmation is
 *   single-use, bound to the user, the login token and the scope, and valid 10 minutes - a stolen
 *   session alone can therefore neither add a second sysadmin nor remove the others.
 *   `confirm(scope)` opens PasswordConfirmDialogComponent and resolves `true` once the API accepted
 *   the password, `false` when the user cancelled. Wrong password = error in the dialog, it stays
 *   open; 5 wrong passwords lock the confirmation for 15 minutes (429).
 * @note The password lives only in the dialog field and in the one request - it is never stored,
 *   logged or kept in memory after the request (GDPR art. 32, data minimisation).
 * @note HttpClient and AdminLocalizationService are taken LAZILY from the Injector: this service is
 *   a dependency of PasswordConfirmationInterceptor, which is built while HttpClient itself is
 *   being constructed (eager injection = circular DI, NG0200; same reason as in DataHandler).
 * @dependencies
 * - PasswordConfirmDialogComponent: the password prompt (created dynamically like ConfirmDialog).
 * - AdminLocalizationService: texts of the admin section `password-confirm`.
 */

import { ApplicationRef, ComponentRef, EmbeddedViewRef, EnvironmentInjector, Injectable, Injector, createComponent, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PasswordConfirmDialogComponent } from '../../admin/components/password-confirm-dialog/password-confirm-dialog.component';
import { AdminLocalizationService } from './admin-localization.service';

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
  private readonly environmentInjector = inject(EnvironmentInjector);
  private readonly appRef = inject(ApplicationRef);

  private componentRef?: ComponentRef<PasswordConfirmDialogComponent>;
  /** Resolver of the open dialog - called with `false` when the dialog is replaced. */
  private openResolve?: (confirmed: boolean) => void;
  /** The confirmation in progress - parallel callers of the same scope share it. */
  private pending: { scope: string; promise: Promise<boolean> } | null = null;

  /**
   * @description Asks for the password and confirms `scope` at the API.
   * @param scope Operation scope from the API (`user:12`, `user:new`, `users:trash`, `email-policy`).
   * @returns Promise - `true` = confirmed (repeat the operation now), `false` = cancelled.
   * @note A second call while a dialog is open: same scope → the same promise; another scope →
   *   the open dialog is cancelled (`false`) and the new one opens.
   */
  confirm(scope: string): Promise<boolean> {
    if (this.pending?.scope === scope) {
      return this.pending.promise;
    }
    this.close();

    const promise = new Promise<boolean>(resolve => this.open(scope, resolve));
    const entry = { scope, promise };
    this.pending = entry;
    promise.finally(() => {
      if (this.pending === entry) this.pending = null;
    });
    return promise;
  }

  /**
   * @description Creates the dialog and wires submit / cancel.
   * @param scope Operation scope.
   * @param resolve Resolver of the confirm() promise.
   */
  private open(scope: string, resolve: (confirmed: boolean) => void): void {
    const ref = createComponent(PasswordConfirmDialogComponent, { environmentInjector: this.environmentInjector });
    this.componentRef = ref;
    this.openResolve = resolve;
    this.appRef.attachView(ref.hostView);
    document.body.appendChild((ref.hostView as EmbeddedViewRef<unknown>).rootNodes[0] as HTMLElement);
    ref.instance.setTexts({
      title: this.t('title'),
      message: this.t('message'),
      label: this.t('label'),
      confirm: this.t('confirm'),
      cancel: this.t('cancel'),
    });

    const cancelSub = ref.instance.cancelled.subscribe(() => {
      this.close(ref);
      resolve(false);
    });
    const submitSub = ref.instance.submitted.subscribe(async (password: string) => {
      const error = await this.send(password, scope);
      if (this.componentRef !== ref) return;     // closed meanwhile
      if (error === null) {
        this.close(ref);
        resolve(true);
      } else {
        ref.instance.showError(error);
      }
    });
    ref.onDestroy(() => {
      cancelSub.unsubscribe();
      submitSub.unsubscribe();
    });
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
   * @description Destroys the open dialog (only `ref` when given); an unfinished one resolves `false`.
   * @param ref Dialog to close (undefined = the current one).
   */
  private close(ref?: ComponentRef<PasswordConfirmDialogComponent>): void {
    const current = this.componentRef;
    if (!current || (ref && ref !== current)) return;
    this.componentRef = undefined;
    const replacedResolve = ref ? undefined : this.openResolve;
    this.openResolve = undefined;
    this.appRef.detachView(current.hostView);
    current.destroy();
    replacedResolve?.(false);
  }

  /**
   * @description Text of the admin section `password-confirm`.
   * @param key Key inside the section.
   */
  private t(key: string): string {
    return this.injector.get(AdminLocalizationService).getValue(`password-confirm.${key}`);
  }
}
