/**
 * @file email-template-status.ts
 * @path src/app/admin/components/email-template-editor/email-template-status.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Whether a confirmation e-mail template lacks texts - the orange dot of the
 *   "Actions" menu (and of its item "Edit confirmation e-mail") on the pages that host
 *   EmailTemplateEditorComponent (Inquiries, Web orders, E-shop orders). The template API lists
 *   the texts missing per active language (`missing`: language → keys, Czech always checked);
 *   any of them = the customer would not get the whole e-mail in his language.
 * @usage `this.emailTemplateStatus.needsAttention('web/settings/raw-request-email-template')
 *   .subscribe(on => { this.emailTemplateAttention = on; this.cd.markForCheck(); })` in ngOnInit
 *   and after the editor closes; then `withEmailTemplateAttention(button, on, title)` in the
 *   toolbar config.
 * @dependencies DataHandler (getQuietly - a failure is no dot, never an error dialog).
 */

import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { DataHandler } from '../../../core/services/data-handler.service';
import { Button } from '../../../shared/interfaces/button';

/** Action of the toolbar button that opens the e-mail template editor. */
export const EMAIL_TEMPLATE_ACTION = 'openEmailTemplateEditor';

/**
 * @description Whether an answer of a template API lists missing texts.
 * @param stored Answer of the GET endpoint (`{ …, missing: { lang: string[] } }`).
 * @returns true when a language has at least one missing text.
 */
export function emailTemplateHasMissing(stored: unknown): boolean {
  const missing = (stored as { missing?: unknown } | null)?.missing;
  if (!missing || typeof missing !== 'object' || Array.isArray(missing)) return false;
  return Object.values(missing as Record<string, unknown>).some(keys => Array.isArray(keys) && keys.length > 0);
}

/**
 * @description The toolbar button of the e-mail editor with the attention dot (other buttons
 *   unchanged).
 * @param button A toolbar button.
 * @param attention The template lacks texts.
 * @param title Tooltip of the dot.
 * @returns The same button, or a copy with `attention` / `attentionTitle`.
 */
export function withEmailTemplateAttention(button: Button, attention: boolean, title: string): Button {
  if (button.action !== EMAIL_TEMPLATE_ACTION || !attention) return button;
  return { ...button, attention: true, attentionTitle: title };
}

@Injectable({ providedIn: 'root' })
export class EmailTemplateStatusService {
  private readonly dataHandler = inject(DataHandler);

  /**
   * @description Asks the template API whether texts are missing.
   * @param endpoint GET endpoint of the template.
   * @returns true = missing texts; false also on an error (no dot rather than a false alarm).
   */
  needsAttention(endpoint: string): Observable<boolean> {
    return this.dataHandler.getQuietly<unknown>(endpoint).pipe(
      map(emailTemplateHasMissing),
      catchError(() => of(false))
    );
  }
}
