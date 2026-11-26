/**
 * @file unsaved-texts.guard.spec.ts
 * @path src/app/admin/components/translation-editor/unsaved-texts.guard.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the guard of the pages of the texts: it asks the page, a page without
 *   `confirmLeave` (or none) is left at once.
 * @dependencies unsavedTextsGuard
 */

import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { LeaveConfirmable, unsavedTextsGuard } from './unsaved-texts.guard';

describe('unsavedTextsGuard', () => {
  const run = (component: unknown) =>
    unsavedTextsGuard(component as LeaveConfirmable, {} as ActivatedRouteSnapshot, {} as RouterStateSnapshot, {} as RouterStateSnapshot);

  /**
   * @description The answer of the page decides; without the method / a page the way is free.
   * @input pages answering false, a promise of true; {}; null
   * @output false; the promise; true; true
   */
  it('asks the page before leaving it', async () => {
    expect(run({ confirmLeave: () => false })).toBeFalse();
    expect(await run({ confirmLeave: () => Promise.resolve(true) })).toBeTrue();
    expect(run({})).toBeTrue();
    expect(run(null)).toBeTrue();
  });
});
