/**
 * @file release-notes.service.spec.ts
 * @path src/app/admin/components/releases/release-notes.service.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of ReleaseNotesService: one load of `core/releases`, the failed state,
 *   and the per-module notice - nothing on the first visit, only the unseen releases that changed
 *   the module, gone after markSeen.
 * @dependencies src/testing/admin-test-helpers.ts (DataHandler spy).
 */

import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { RELEASE_SEEN_KEY, ReleaseNotes, ReleaseNotesService } from './release-notes.service';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('ReleaseNotesService', () => {
  let ctx: AdminTestContext;
  let service: ReleaseNotesService;
  const notes: ReleaseNotes = {
    current: 'v3',
    releases: [
      { version: 'v3', date: '2026-03-01', changes: [{ type: 'fixed', area: 'shop', part: 'admin', text: 'Shop fix' }] },
      { version: 'v2', date: '2026-02-01', changes: [{ type: 'added', area: 'core', part: 'admin', text: 'Core feature' }] },
      { version: 'v1', date: '2026-01-01', changes: [{ type: 'added', area: 'core', part: 'admin', text: 'Old' }] },
    ],
  };
  const get = () => (ctx.dataHandler as any).get as jasmine.Spy;
  const clearSeen = () => ['core', 'shop', 'web'].forEach(m => localStorage.removeItem(RELEASE_SEEN_KEY + m));

  beforeEach(() => {
    clearSeen();
    ctx = createAdminTestContext({ granted: [] });
    TestBed.configureTestingModule({ providers: ctx.providers });
    get().and.returnValue(of(notes));
    service = TestBed.inject(ReleaseNotesService);
  });

  afterEach(clearSeen);

  /**
   * @description The notes load once; a failure sets `failed`.
   * @input load() twice; a new service with a failing request.
   * @output 1 request to core/releases, current 'v3'; failed true.
   */
  it('loads once', () => {
    service.load();
    service.load();
    expect(get().calls.count()).toBe(1);
    expect(get()).toHaveBeenCalledWith('core/releases');
    expect(service.current()).toBe('v3');

    get().and.returnValue(throwError(() => new Error('down')));
    const other = TestBed.runInInjectionContext(() => new ReleaseNotesService());
    other.load();
    expect(other.failed()).toBeTrue();
  });

  /**
   * @description First visit: nothing, the running version is remembered. After an update only
   *   the releases since the seen version that changed the module; markSeen hides them.
   * @input load(); unseenFor('core') (first); seen core = v1, shop = v2, web = v1; markSeen('core').
   * @output []; core: [v2] (v3 did not change the core); shop: [v3]; web: []; core after markSeen: [].
   */
  it('shows the unseen releases of a module only', () => {
    service.load();
    expect(service.unseenFor('core')).toEqual([]);
    expect(localStorage.getItem(RELEASE_SEEN_KEY + 'core')).toBe('v3');

    localStorage.setItem(RELEASE_SEEN_KEY + 'core', 'v1');
    localStorage.setItem(RELEASE_SEEN_KEY + 'shop', 'v2');
    localStorage.setItem(RELEASE_SEEN_KEY + 'web', 'v1');
    service.markSeen('nothing');
    expect(service.unseenFor('core').map(r => r.version)).toEqual(['v2']);
    expect(service.unseenFor('shop').map(r => r.version)).toEqual(['v3']);
    expect(service.unseenFor('shop')[0].changes.map(c => c.text)).toEqual(['Shop fix']);
    expect(service.unseenFor('web')).toEqual([]);

    service.markSeen('core');
    expect(service.unseenFor('core')).toEqual([]);
  });
});
