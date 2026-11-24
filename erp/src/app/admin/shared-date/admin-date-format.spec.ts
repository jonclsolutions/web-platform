/**
 * @file admin-date-format.spec.ts
 * @path src/app/admin/shared-date/admin-date-format.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the ONE date format of the administration: the kind a column format
 *   means, the pattern from the admin texts (Czech fallback) and the `adminDate` pipe.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (i18n stub: getValue returns the path, getDateLocale by language)
 */

import { TestBed } from '@angular/core/testing';

import { ADMIN_DATE_FALLBACK, adminDateFormat, adminDateKind } from './admin-date-format';
import { AdminDatePipe } from './admin-date.pipe';
import { AdminTestContext, createAdminTestContext } from '../../../testing/admin-test-helpers';

describe('admin date format', () => {
  /**
   * @description Column formats mean a kind: the kinds as they are, Angular names, own patterns
   *   by their letters, nothing = the fallback.
   * @input  undefined (fallback datetime), 'date', 'mediumDate', 'short', 'medium', 'full',
   *   'd.M.yyyy', 'd.M.yyyy H:mm', 'HH:mm:ss'
   * @output datetime, date, date, datetime, datetime_seconds ×2, date, datetime, datetime_seconds
   */
  it('maps column formats to a kind', () => {
    expect(adminDateKind(undefined, 'datetime')).toBe('datetime');
    expect(adminDateKind('date')).toBe('date');
    expect(adminDateKind('mediumDate')).toBe('date');
    expect(adminDateKind('short')).toBe('datetime');
    expect(adminDateKind('medium')).toBe('datetime_seconds');
    expect(adminDateKind('full')).toBe('datetime_seconds');
    expect(adminDateKind('d.M.yyyy')).toBe('date');
    expect(adminDateKind('d.M.yyyy H:mm')).toBe('datetime');
    expect(adminDateKind('HH:mm:ss')).toBe('datetime_seconds');
  });

  /**
   * @description The pattern comes from `shared.<kind>_format`; a missing text (the path back or
   *   'Cannot load text') uses the Czech pattern.
   * @input  texts with an English date pattern; missing texts.
   * @output 'd MMM yyyy'; the fallback patterns.
   */
  it('takes the pattern from the admin texts', () => {
    const texts: Record<string, string> = { 'shared.date_format': 'd MMM yyyy' };
    const i18n = { getValue: (p: string) => texts[p] ?? p };
    expect(adminDateFormat(i18n, 'date')).toBe('d MMM yyyy');
    expect(adminDateFormat(i18n, 'datetime')).toBe(ADMIN_DATE_FALLBACK.datetime);
    expect(adminDateFormat({ getValue: () => 'Cannot load text' }, 'datetime_seconds')).toBe('d. M. yyyy HH:mm:ss');
  });

  describe('AdminDatePipe', () => {
    let ctx: AdminTestContext;

    beforeEach(() => {
      ctx = createAdminTestContext();
      TestBed.configureTestingModule({ providers: [...ctx.providers, AdminDatePipe] });
    });

    /**
     * @description The pipe formats in the admin format and locale; empty / invalid values are ''.
     * @input  '2026-03-04T05:06:07' as date / datetime / datetime_seconds; null; 'x'; English texts + en-US.
     * @output '4. 3. 2026', '4. 3. 2026 05:06', '4. 3. 2026 05:06:07', '', '', '4 Mar 2026'.
     */
    it('formats dates of the administration', () => {
      const pipe = TestBed.inject(AdminDatePipe);
      const at = '2026-03-04T05:06:07';
      expect(pipe.transform(at)).toBe('4. 3. 2026');
      expect(pipe.transform(at, 'datetime')).toBe('4. 3. 2026 05:06');
      expect(pipe.transform(at, 'datetime_seconds')).toBe('4. 3. 2026 05:06:07');
      expect(pipe.transform(null)).toBe('');
      expect(pipe.transform('x')).toBe('');
      ctx.i18n.getValue.and.callFake((p: string) => ({ 'shared.date_format': 'd MMM yyyy' } as any)[p] ?? p);
      ctx.i18n.getDateLocale.and.returnValue('en-US');
      expect(pipe.transform(at)).toBe('4 Mar 2026');
    });
  });
});
