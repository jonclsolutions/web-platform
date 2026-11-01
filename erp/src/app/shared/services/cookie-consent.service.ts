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
 * @note Client-side only (localStorage) for now. Server-side logging of the consent (as proof
 * for an inspection by the data protection authority) is not implemented yet - when added, the
 * API call goes into `save()` without changing the public interface of the service.
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';

export interface CookieConsentCategories {
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}

export interface CookieConsentState extends CookieConsentCategories {
  necessary: true;
  timestamp: string;
  version: number;
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
    };

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    } catch {
      // localStorage unavailable (e.g. strict private mode) - the consent then
      // does not persist between visits, the bar shows again.
    }

    this.consentSubject.next(state);

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

  private readStored(): CookieConsentState | null {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? JSON.parse(raw) as CookieConsentState : null;
    } catch {
      return null;
    }
  }
}