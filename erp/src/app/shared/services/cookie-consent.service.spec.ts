/**
 * @file cookie-consent.service.spec.ts
 * @path src/app/shared/services/cookie-consent.service.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of CookieConsentService (GDPR / ePrivacy consent): stored consent is
 *   restored, consent validity (version and 180 day expiry), save / accept all / reject
 *   non-essential, storage failures and the "open settings" request stream.
 * @dependencies
 * - Real localStorage ('rpsw_cookie_consent' cleared around tests); jasmine.clock() mockDate.
 */

import { TestBed } from '@angular/core/testing';
import { CookieConsentService, CookieConsentState } from './cookie-consent.service';

const KEY = 'rpsw_cookie_consent';

describe('CookieConsentService', () => {
  /** Creates a fresh service (reads the storage in its field initializer). */
  const create = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    return TestBed.inject(CookieConsentService);
  };

  beforeEach(() => localStorage.removeItem(KEY));
  afterEach(() => {
    localStorage.removeItem(KEY);
    jasmine.clock().uninstall();
  });

  /**
   * @description No consent → invalid; broken stored JSON → no consent; other version → invalid.
   * @input Empty storage; '{broken'; stored version 0.
   * @output current null + invalid; null; invalid.
   */
  it('treats missing, broken and outdated consent as not given', () => {
    expect(create().current).toBeNull();
    expect(create().hasValidConsent()).toBeFalse();

    localStorage.setItem(KEY, '{broken');
    expect(create().current).toBeNull();

    localStorage.setItem(KEY, JSON.stringify({ necessary: true as const, functional: true, analytics: true, marketing: true, timestamp: new Date().toISOString(), version: 0 }));
    expect(create().hasValidConsent()).toBeFalse();
  });

  /**
   * @description save() stores the choice with timestamp + version and emits it; it is valid for
   *   180 days; acceptAll / rejectNonEssential set all optional categories.
   * @input save({functional true, analytics false, marketing false}) on 2026-01-01; +179 d; +181 d.
   * @output Stored + emitted state, necessary always true; valid, valid, invalid; restored by a
   *   new instance; acceptAll → all true; reject → all false.
   */
  it('saves consent and expires it after 180 days', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-01-01T00:00:00Z'));
    const service = create();
    const emitted: any[] = [];
    service.consent$.subscribe(c => emitted.push(c));

    service.save({ functional: true, analytics: false, marketing: false });
    const state: CookieConsentState = { necessary: true, functional: true, analytics: false, marketing: false, timestamp: '2026-01-01T00:00:00.000Z', version: 1 };
    expect(service.current).toEqual(state);
    expect(emitted).toEqual([null, state]);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(state);
    expect(create().current).toEqual(state);

    jasmine.clock().tick(179 * 86400000);
    expect(service.hasValidConsent()).toBeTrue();
    jasmine.clock().tick(2 * 86400000);
    expect(service.hasValidConsent()).toBeFalse();

    service.acceptAll();
    expect([service.current!.functional, service.current!.analytics, service.current!.marketing]).toEqual([true, true, true]);
    service.rejectNonEssential();
    expect([service.current!.functional, service.current!.analytics, service.current!.marketing]).toEqual([false, false, false]);
  });

  /**
   * @description A storage that refuses writes (private mode / quota) does not break the
   *   in-memory consent; openSettings notifies subscribers.
   * @input setItem throws; acceptAll(); openSettings().
   * @output current.analytics true; settings request received.
   */
  it('works without writable storage and forwards settings requests', () => {
    const service = create();
    spyOn(localStorage, 'setItem').and.throwError('QuotaExceeded');
    service.acceptAll();
    expect(service.current!.analytics).toBeTrue();

    let requested = 0;
    service.openSettingsRequested$.subscribe(() => requested++);
    service.openSettings();
    expect(requested).toBe(1);
  });
});
