/**
 * @file email-template-status.spec.ts
 * @path src/app/admin/components/email-template-editor/email-template-status.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the e-mail template status (the dot of the Actions menu): the colour
 *   read from the attention kind of the notifications (the same as the side menu) and the editor
 *   button marked with it.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (providers); AdminNotificationsService (real, kinds set).
 */

import { TestBed } from '@angular/core/testing';
import { EMAIL_TEMPLATE_ACTION, EmailTemplateStatusService, withEmailTemplateAttention } from './email-template-status';
import { AdminNotificationsService } from '../../../core/services/admin-notifications.service';
import { createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('EmailTemplateStatus', () => {
  /**
   * @description The colour follows the kind: a count = orange, only `preparing` = grey, nothing
   *   or no kind (no permission) = none; refresh asks the notifications again.
   * @input kinds web_inquiry_email_missing 3; then 0 + preparing pl 12; then 0; unknown kind; refresh().
   * @output 'attention'; 'preparing'; null; null; notifications.refresh called.
   */
  it('reads the colour from the notifications', () => {
    const ctx = createAdminTestContext();
    TestBed.configureTestingModule({ providers: ctx.providers });
    const service = TestBed.inject(EmailTemplateStatusService);
    const notifications = TestBed.inject(AdminNotificationsService);
    const set = (count: number, preparing?: Record<string, number>) => notifications.kinds.set([
      { kind: 'web_inquiry_email_missing', module: 'web', link: '/admin/web/user-request', count, attention: true, preparing },
    ]);

    set(3);
    expect(service.toneOf('web_inquiry_email_missing')).toBe('attention');
    set(0, { pl: 12 });
    expect(service.toneOf('web_inquiry_email_missing')).toBe('preparing');
    set(0);
    expect(service.toneOf('web_inquiry_email_missing')).toBeNull();
    expect(service.toneOf('shop_order_email_missing')).toBeNull();

    const refresh = spyOn(notifications, 'refresh');
    service.refresh();
    expect(refresh).toHaveBeenCalled();
  });

  /**
   * @description Only the editor button gets the dot (a copy) with the colour and its tooltip.
   * @input editor button with 'attention' / 'preparing' / null; another button with 'attention'.
   * @output copies with attention + tone + the title of the tone; the same objects otherwise.
   */
  it('marks the button of the editor only', () => {
    const titles = { attention: 'Texts missing', preparing: 'Being prepared' };
    const editor = { action: EMAIL_TEMPLATE_ACTION, label: 'E-mail', class: '' };
    const other = { action: 'export', label: 'Export', class: '' };
    expect(withEmailTemplateAttention(editor, 'attention', titles)).toEqual({ ...editor, attention: true, attentionTone: 'attention', attentionTitle: 'Texts missing' });
    expect(withEmailTemplateAttention(editor, 'preparing', titles)).toEqual({ ...editor, attention: true, attentionTone: 'preparing', attentionTitle: 'Being prepared' });
    expect(withEmailTemplateAttention(editor, null, titles)).toBe(editor);
    expect(withEmailTemplateAttention(other, 'attention', titles)).toBe(other);
  });
});
