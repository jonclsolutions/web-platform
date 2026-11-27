/**
 * @file email-template-status.ts
 * @path src/app/admin/components/email-template-editor/email-template-status.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Whether a confirmation e-mail template lacks texts - the dot of the "Actions" menu
 *   (and of its item "Edit confirmation e-mail") on the pages that host EmailTemplateEditorComponent
 *   (Inquiries, Web orders, E-shop orders). It reads the same attention kind of the notifications
 *   as the side menu (`web_inquiry_email_missing`, `shop_order_email_missing`,
 *   `portal_order_email_missing`), so the page and the menu always agree: orange = texts missing in
 *   Czech or an active language (the customer would get Czech / nothing), grey = only a switched
 *   off language being prepared lacks texts.
 * @usage `withEmailTemplateAttention(button, this.emailTemplateStatus.toneOf(KIND), titles)` in the
 *   toolbar config; `this.emailTemplateStatus.refresh()` after the editor closes.
 *   EMAIL_TEMPLATE_QUERY: the address that opens the editor of a page in a language.
 * @dependencies AdminNotificationsService (the kinds of `core/notifications`).
 */

import { Injectable, inject } from '@angular/core';
import { AdminNotificationsService } from '../../../core/services/admin-notifications.service';
import { Button } from '../../../shared/interfaces/button';

/** Action of the toolbar button that opens the e-mail template editor. */
export const EMAIL_TEMPLATE_ACTION = 'openEmailTemplateEditor';

/**
 * Query parameter that opens the editor of the page in a language (`?email-template=pl`) - the
 * link of the window Jazyky to a language's missing e-mail texts (missingPartLinks).
 */
export const EMAIL_TEMPLATE_QUERY = 'email-template';

/** Colour of the dot: orange (a problem now), grey (a language being prepared), none. */
export type EmailTemplateTone = 'attention' | 'preparing' | null;

/** Tooltips of the dot by its colour. */
export interface EmailTemplateTitles {
  attention: string;
  preparing: string;
}

/**
 * @description The toolbar button of the e-mail editor with the dot (other buttons unchanged).
 * @param button A toolbar button.
 * @param tone Colour of the dot (null = none).
 * @param titles Tooltip per colour.
 * @returns The same button, or a copy with `attention`, `attentionTone` and `attentionTitle`.
 */
export function withEmailTemplateAttention(button: Button, tone: EmailTemplateTone, titles: EmailTemplateTitles): Button {
  if (button.action !== EMAIL_TEMPLATE_ACTION || !tone) return button;
  return { ...button, attention: true, attentionTone: tone, attentionTitle: titles[tone] };
}

@Injectable({ providedIn: 'root' })
export class EmailTemplateStatusService {
  private readonly notifications = inject(AdminNotificationsService);

  /**
   * @description Colour of the dot of a template - from its attention kind of the notifications
   *   (a signal: a template reading it is redrawn when the counts change).
   * @param kind Attention kind of the e-mail, e.g. 'web_inquiry_email_missing'.
   * @returns 'attention' (count > 0), 'preparing' (only `preparing`), null (nothing / no kind -
   *   e.g. without the permission to edit the e-mail).
   */
  toneOf(kind: string): EmailTemplateTone {
    const entry = this.notifications.kinds().find(k => k.kind === kind);
    if (!entry) return null;
    if (entry.count > 0) return 'attention';
    return AdminNotificationsService.preparingCount(entry) > 0 ? 'preparing' : null;
  }

  /** @description Asks for the counts again (the e-mail was just edited). */
  refresh(): void {
    this.notifications.refresh();
  }
}
