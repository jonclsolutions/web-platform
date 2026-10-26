/**
 * @file password-confirmation.interceptor.ts
 * @path src/app/core/interceptors/password-confirmation.interceptor.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026-10-26
 * @description Step-up re-authentication for every admin call: a request refused with 403
 *   `PASSWORD_CONFIRMATION_REQUIRED` (+ `scope`) opens the password prompt
 *   (PasswordConfirmationService) and, once confirmed, is sent ONCE more - the calling component
 *   just sees the successful answer. Cancelled → the original 403 reaches the caller (DataHandler
 *   shows `data-handler.password_confirmation_required`). The confirmation request itself and a
 *   repeated request are never intercepted again (no loops).
 * @note Registered as the FIRST HTTP interceptor (app.config.ts): the inner chain (token,
 *   loading indicator) has already finished the refused request while the dialog is open, so the
 *   global loading overlay does not cover the dialog; the repeat runs through the full chain again.
 * @dependencies
 * - PasswordConfirmationService: the prompt and the POST /confirm-password.
 */

import { Injectable } from '@angular/core';
import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable, catchError, from, switchMap, throwError } from 'rxjs';
import { PASSWORD_CONFIRMATION_PATH, PASSWORD_CONFIRMATION_REQUIRED, PasswordConfirmationService } from '../services/password-confirmation.service';

/**
 * @description Asks for the password on a refusal and repeats the request once.
 */
@Injectable()
export class PasswordConfirmationInterceptor implements HttpInterceptor {
  constructor(private passwordConfirmation: PasswordConfirmationService) { }

  /**
   * @param req Outgoing request.
   * @param next Rest of the chain.
   * @returns The answer - of the repeat when the password was confirmed.
   */
  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (req.url.endsWith(PASSWORD_CONFIRMATION_PATH)) {
      return next.handle(req);
    }

    return next.handle(req).pipe(
      catchError((error: unknown) => {
        const scope = this.confirmationScope(error);
        if (scope === null) {
          return throwError(() => error);
        }
        return from(this.passwordConfirmation.confirm(scope)).pipe(
          // The repeat goes to `next` directly - a second refusal is not prompted again.
          switchMap(confirmed => confirmed ? next.handle(req) : throwError(() => error))
        );
      })
    );
  }

  /**
   * @description Scope of a refusal waiting for the confirmation.
   * @param error Error of the request.
   * @returns The scope, or null when it is another error.
   */
  private confirmationScope(error: unknown): string | null {
    if (!(error instanceof HttpErrorResponse) || error.status !== 403) return null;
    const body = error.error as { error_code?: unknown; scope?: unknown } | null;
    return body?.error_code === PASSWORD_CONFIRMATION_REQUIRED && typeof body.scope === 'string' && body.scope
      ? body.scope
      : null;
  }
}
