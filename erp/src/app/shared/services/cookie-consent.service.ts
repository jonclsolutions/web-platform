/**
 * @file cookie-consent.service.ts
 * @path src/app/shared/services/cookie-consent.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Manages the cookie consent state (localStorage) and provides it to the rest of the
 * application - mainly to the Google Analytics loader (AnalyticsService, driven by
 * `consent$.analytics`) and to `openSettings()`, which reopens the bar in the expanded state.
 *
 *
 * @note Every decision is also recorded on the server (GDPR Art. 7(1) - the consent must be
 * demonstrable, VT-12): `POST /api/cookie-consents` with a random `consentId` (kept with the
 * decision in the browser, so one visitor's decisions can be matched), the version and the
 * categories. Anonymous - no IP address or user agent is stored. Sent with `navigator.sendBeacon`
 * (delivered even when the visitor leaves the page at once; fetch keepalive as the fallback);
 * a failure never blocks the cookie bar - the decision stays valid in the browser.
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CookieConsentCategories {
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}

export interface CookieConsentState extends CookieConsentCategories {
  necessary: true;
  timestamp: string;
  version: number;
  /** Random id of the visitor's consent record on the server (UUID); missing in decisions stored by older versions. */
  consentId?: string;
}

@Injectable({ providedIn: 'root' })
export class CookieConsentService {

  private readonly STORAGE_KEY = 'rpsw_cookie_consent';
  /** Raise on any change of what / how data is collected - forces the bar to show again to
   *  everyone, also to those who accepted an older version. */
  private readonly CONSENT_VERSION = 1;
  /** After this many days the consent is invalid and the bar shows again. */
  private readonly MAX_AGE_DAYS = 180;

  private readonly consentSubject = new BehaviorSubject<CookieConsentState | null>(this.readStored());
  /** Current consent state - null until the user accepted anything. */
  readonly consent$ = this.consentSubject.asObservable();

  private readonly openSettingsSubject = new Subject<void>();
  /** Signal for CookieConsentComponent to reopen in the expanded state
   *  (used by the "Cookie settings" button). */
  readonly openSettingsRequested$ = this.openSettingsSubject.asObservable();

  get current(): CookieConsentState | null {
    return this.consentSubject.value;
  }

  /**
   * @description Checks whether the user has a valid (and fresh enough) stored consent.
   */
  hasValidConsent(): boolean {
    const c = this.current;
    if (!c || c.version !== this.CONSENT_VERSION) return false;

    const ageMs = Date.now() - new Date(c.timestamp).getTime();
    const maxAgeMs = this.MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    return ageMs < maxAgeMs;
  }

  /**
   * @description Stores the consent with the given categories (necessary ones are always included).
   * @param categories State of the optional categories.
   */
  save(categories: CookieConsentCategories): void {
    const state: CookieConsentState = {
      necessary: true,
      functional: categories.functional,
      analytics: categories.analytics,
      marketing: categories.marketing,
      timestamp: new Date().toISOString(),
      version: this.CONSENT_VERSION,
      consentId: this.current?.consentId ?? this.newConsentId(),
    };

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    } catch {
      // localStorage unavailable (e.g. strict private mode) - the consent then
      // does not persist between visits, the bar shows again.
    }

    this.consentSubject.next(state);
    this.record(state);
  }

  /** Shortcut for the "Accept all" button. */
  acceptAll(): void {
    this.save({ functional: true, analytics: true, marketing: true });
  }

  /** Shortcut for the "Necessary only" button. */
  rejectNonEssential(): void {
    this.save({ functional: false, analytics: false, marketing: false });
  }

  /**
   * @description Requests reopening the bar in the expanded (settings) state.
   *              Called from the "Cookie settings" button.
   */
  openSettings(): void {
    this.openSettingsSubject.next();
  }

  /**
   * @description Sends the decision to the server as the proof of consent - fire and forget.
   * @param state Stored decision.
   */
  private record(state: CookieConsentState): void {
    const url = `${environment.base_api_url}/cookie-consents`;
    const body = JSON.stringify({
      consent_id: state.consentId,
      version: state.version,
      functional: state.functional,
      analytics: state.analytics,
      marketing: state.marketing,
    });
    try {
      const queued = typeof navigator.sendBeacon === 'function'
        && navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      if (!queued) {
        fetch(url, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json', Accept: 'application/json' } })
          .catch(() => { /* offline / blocked - the decision stays valid in the browser */ });
      }
    } catch {
      // Beacon / fetch unavailable - recording the proof must never break the cookie bar.
    }
  }

  /** @description New random UUID of a consent record (crypto.randomUUID or a v4 from random bytes). */
  private newConsentId(): string {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }

  private readStored(): CookieConsentState | null {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? JSON.parse(raw) as CookieConsentState : null;
    } catch {
      return null;
    }
  }
}