/**
 * @file cookie-consent.service.spec.ts
 * @path src/app/shared/services/cookie-consent.service.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of CookieConsentService (GDPR / ePrivacy consent): stored consent is
 *   restored, consent validity (version and 180 day expiry), save / accept all / reject
 *   non-essential, storage failures, the "open settings" request stream and the server record of
 *   every decision (VT-12: beacon / fetch fallback, one consent id per visitor, never breaking).
 * @dependencies
 * - Real localStorage ('rpsw_cookie_consent' cleared around tests); jasmine.clock() mockDate;
 *   navigator.sendBeacon / window.fetch spied (no request leaves the test).
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

  let beacon: jasmine.Spy;

  beforeEach(() => {
    localStorage.removeItem(KEY);
    beacon = spyOn(navigator, 'sendBeacon').and.returnValue(true);
  });

  /** JSON body of a beacon call. */
  const beaconBody = (call: number) => (beacon.calls.argsFor(call)[1] as Blob).text().then(t => JSON.parse(t));
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
    const state: CookieConsentState = { necessary: true, functional: true, analytics: false, marketing: false, timestamp: '2026-01-01T00:00:00.000Z', version: 1, consentId: service.current!.consentId };
    expect(state.consentId).toMatch(/^[0-9a-f-]{36}$/);
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

  /**
   * @description Every decision is recorded on the server: beacon to /api/cookie-consents with a
   *   UUID consent id (the same for all decisions of the visitor, kept in the stored state), the
   *   version and the categories - nothing else.
   * @input acceptAll(); rejectNonEssential(); a new service instance (reload) + acceptAll().
   * @output 3 beacons to '/api/cookie-consents' (application/json); bodies with one UUID consent_id,
   *   version 1 and the categories; stored consentId = that id.
   */
  it('records every decision anonymously on the server', async () => {
    const service = create();
    service.acceptAll();
    service.rejectNonEssential();
    create().acceptAll();

    expect(beacon).toHaveBeenCalledTimes(3);
    expect(beacon.calls.argsFor(0)[0]).toBe('/api/cookie-consents');
    expect((beacon.calls.argsFor(0)[1] as Blob).type).toBe('application/json');
    const [first, second, third] = await Promise.all([beaconBody(0), beaconBody(1), beaconBody(2)]);
    expect(first).toEqual({ consent_id: jasmine.stringMatching(/^[0-9a-f-]{36}$/), version: 1, functional: true, analytics: true, marketing: true });
    expect(second).toEqual({ ...first, functional: false, analytics: false, marketing: false });
    expect(third.consent_id).toBe(first.consent_id);
    expect(JSON.parse(localStorage.getItem(KEY)!).consentId).toBe(first.consent_id);
  });

  /**
   * @description A refused beacon falls back to fetch keepalive; a failing fetch, a throwing
   *   beacon and a browser without randomUUID never break the decision.
   * @input sendBeacon → false (fetch rejects); sendBeacon throws; randomUUID missing.
   * @output fetch POST keepalive JSON; consent stored each time; a v4 UUID generated.
   */
  it('falls back to fetch and never breaks the cookie bar', async () => {
    const fetchSpy = spyOn(window, 'fetch').and.returnValue(Promise.reject(new Error('offline')));
    beacon.and.returnValue(false);
    const service = create();
    service.acceptAll();
    const [url, init] = fetchSpy.calls.mostRecent().args as [string, RequestInit];
    expect(url).toBe('/api/cookie-consents');
    expect(init).toEqual(jasmine.objectContaining({ method: 'POST', keepalive: true }));
    expect(JSON.parse(init.body as string).analytics).toBeTrue();
    await Promise.resolve();

    beacon.and.throwError('blocked');
    service.rejectNonEssential();
    expect(service.current!.analytics).toBeFalse();

    localStorage.removeItem(KEY);
    beacon.and.returnValue(true);
    const randomUUID = crypto.randomUUID;
    (crypto as any).randomUUID = undefined;
    try {
      create().acceptAll();
    } finally {
      (crypto as any).randomUUID = randomUUID;
    }
    expect(JSON.parse(localStorage.getItem(KEY)!).consentId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
