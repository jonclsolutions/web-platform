/**
 * @file analytics.service.spec.ts
 * @path src/app/shared/services/analytics.service.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of AnalyticsService (Google Consent Mode v2): everything denied by
 *   default, consent updates mirrored to the dataLayer, gtag loaded only once and only when a
 *   measurement id exists AND analytics consent was given (GDPR - no tracking script before
 *   consent).
 * @dependencies
 * - PublicDataService / CookieConsentService stubs with Subjects; document.head.appendChild
 *   spied (no real script request); window.dataLayer reset per test.
 */

import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';

import { AnalyticsService } from './analytics.service';
import { PublicDataService } from './public-data.service';
import { CookieConsentService, CookieConsentState } from './cookie-consent.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let settings$: BehaviorSubject<any>;
  let consent$: BehaviorSubject<CookieConsentState | null>;
  let scripts: HTMLScriptElement[];
  const layer = () => (window as any).dataLayer as unknown[][];
  const consent = (analytics: boolean, marketing = false): CookieConsentState =>
    ({ necessary: true, functional: false, analytics, marketing, timestamp: '', version: 1 });

  beforeEach(() => {
    delete (window as any).dataLayer;
    settings$ = new BehaviorSubject<any>(null);
    consent$ = new BehaviorSubject<CookieConsentState | null>(null);
    scripts = [];
    spyOn(document.head, 'appendChild').and.callFake(<T extends Node>(n: T) => { scripts.push(n as any); return n; });
    const cookieStub = { consent$, get current() { return consent$.value; } };
    TestBed.configureTestingModule({
      providers: [
        { provide: PublicDataService, useValue: { siteSettingsValue$: settings$ } },
        { provide: CookieConsentService, useValue: cookieStub }
      ]
    });
    service = TestBed.inject(AnalyticsService);
  });
  afterEach(() => delete (window as any).dataLayer);

  /**
   * @description Default state denies all storage; without consent no script is loaded even with
   *   a measurement id; init() twice subscribes once.
   * @input init() ×2; settings with google_analytics_id; no consent.
   * @output One 'consent default' entry with all denied + wait 500; no script.
   */
  it('denies everything by default and loads nothing without consent', () => {
    service.init();
    service.init();
    settings$.next({ settings: { google_analytics_id: 'G-1' } });

    expect(layer().length).toBe(1);
    expect(layer()[0]).toEqual(['consent', 'default', {
      analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', wait_for_update: 500
    }]);
    expect(scripts.length).toBe(0);
  });

  /**
   * @description Analytics consent + id → gtag script once with js / config entries; marketing
   *   choices map to the ad_* signals; a later id change does not load a second script.
   * @input consent analytics only; id G-1; consent analytics + marketing; id G-2.
   * @output 1 script ?id=G-1; consent update granted/denied; config G-1; still 1 script.
   */
  it('loads gtag once after analytics consent', () => {
    service.init();
    consent$.next(consent(true));
    expect(scripts.length).toBe(0);
    settings$.next({ settings: { google_analytics_id: 'G-1' } });

    expect(scripts.length).toBe(1);
    expect(scripts[0].src).toBe('https://www.googletagmanager.com/gtag/js?id=G-1');
    expect(scripts[0].async).toBeTrue();
    expect(layer()).toContain(['consent', 'update', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' }]);
    expect(layer()).toContain(['config', 'G-1']);
    expect(layer().some(e => e[0] === 'js' && e[1] instanceof Date)).toBeTrue();

    consent$.next(consent(true, true));
    expect(layer()).toContain(['consent', 'update', { analytics_storage: 'granted', ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted' }]);
    settings$.next({ settings: { google_analytics_id: 'G-2' } });
    settings$.next({ settings: {} });
    expect(scripts.length).toBe(1);
  });

  /**
   * @description Consent without analytics keeps the script away; revoking is pushed as denied.
   * @input id G-1; consent analytics false.
   * @output No script; consent update with analytics_storage 'denied'.
   */
  it('respects refused analytics consent', () => {
    service.init();
    settings$.next({ settings: { google_analytics_id: 'G-1' } });
    consent$.next(consent(false));
    expect(scripts.length).toBe(0);
    expect(layer()[layer().length - 1]).toEqual(['consent', 'update', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' }]);
  });
});
