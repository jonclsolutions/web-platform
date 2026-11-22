/**
 * @file workspace-usage.service.spec.ts
 * @path src/app/apps/js-creator/admin/shared/workspace-usage.service.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of WorkspaceUsageService: refresh stores the usage, fits() answers from
 *   it (true while unknown).
 * @dependencies src/testing/admin-test-helpers.ts (DataHandler spy).
 */

import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { WorkspaceUsageService } from './workspace-usage.service';
import { createAdminTestContext } from '../../../../../testing/admin-test-helpers';

describe('WorkspaceUsageService', () => {
  /**
   * @description Before loading every size fits; after loading 900 of 1000 bytes, 100 fit and
   *   101 do not.
   * @input fits(1e9) before refresh; usage {used 900, quota 1000}
   * @output true; fits(100) true, fits(101) false
   */
  it('checks whether files fit into the quota', () => {
    const ctx = createAdminTestContext();
    ctx.dataHandler.get.and.returnValue(of({ used_bytes: 900, quota_bytes: 1000, trash_bytes: 0, counts: { folders: 0, images: 0, fonts: 0, templates: 0 } }));
    TestBed.configureTestingModule({ providers: ctx.providers });
    const service = TestBed.inject(WorkspaceUsageService);

    expect(service.fits(1e9)).toBeTrue();
    service.refresh();
    expect(service.usage()?.used_bytes).toBe(900);
    expect(service.fits(100)).toBeTrue();
    expect(service.fits(101)).toBeFalse();
  });
});
