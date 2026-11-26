/**
 * @file email-template-status.spec.ts
 * @path src/app/admin/components/email-template-editor/email-template-status.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the e-mail template status (the orange dot of the Actions menu):
 *   reading `missing` of the template API, marking the editor button and the service that asks
 *   the API quietly.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (DataHandler spy).
 */

import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { EMAIL_TEMPLATE_ACTION, EmailTemplateStatusService, emailTemplateHasMissing, withEmailTemplateAttention } from './email-template-status';
import { createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('EmailTemplateStatus', () => {
  /**
   * @description Missing texts = a language of `missing` with at least one key; anything else
   *   (no answer, no / malformed `missing`, only empty lists) is none.
   * @input null, {}, missing [] / 'x' / {cz: []} / {cz: [], en: ['title']}.
   * @output false ×5, true.
   */
  it('reads the missing texts of the API answer', () => {
    expect([null, {}, { missing: [] }, { missing: 'x' }, { missing: { cz: [] } }].map(emailTemplateHasMissing))
      .toEqual([false, false, false, false, false]);
    expect(emailTemplateHasMissing({ missing: { cz: [], en: ['title'] } })).toBeTrue();
  });

  /**
   * @description Only the editor button gets the attention (a copy), and only when needed.
   * @input editor button with / without attention; another button with attention.
   * @output copy with attention + title; the same objects otherwise.
   */
  it('marks the button of the editor only', () => {
    const editor = { action: EMAIL_TEMPLATE_ACTION, label: 'E-mail', class: '' };
    const other = { action: 'export', label: 'Export', class: '' };
    expect(withEmailTemplateAttention(editor, true, 'Texts missing')).toEqual({ ...editor, attention: true, attentionTitle: 'Texts missing' });
    expect(withEmailTemplateAttention(editor, true, 'x')).not.toBe(editor);
    expect(withEmailTemplateAttention(editor, false, 'x')).toBe(editor);
    expect(withEmailTemplateAttention(other, true, 'x')).toBe(other);
  });

  /**
   * @description The service asks the template API quietly; a failure is no attention.
   * @input getQuietly answers missing en; then throws.
   * @output getQuietly(endpoint); true; false.
   */
  it('asks the template API quietly', () => {
    const ctx = createAdminTestContext();
    TestBed.configureTestingModule({ providers: ctx.providers });
    const service = TestBed.inject(EmailTemplateStatusService);
    const quietly = (ctx.dataHandler as any).getQuietly;
    const results: boolean[] = [];

    quietly.and.returnValue(of({ missing: { en: ['title'] } }));
    service.needsAttention('web/settings/raw-request-email-template').subscribe(on => results.push(on));
    quietly.and.returnValue(throwError(() => new Error('x')));
    service.needsAttention('web/settings/raw-request-email-template').subscribe(on => results.push(on));

    expect(quietly).toHaveBeenCalledWith('web/settings/raw-request-email-template');
    expect(results).toEqual([true, false]);
  });
});
