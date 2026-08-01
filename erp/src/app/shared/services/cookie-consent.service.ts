/**
 * @file cookie-consent.service.ts
 * @path src/app/shared/services/cookie-consent.service.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Spravuje stav souhlasu s cookies (localStorage) a poskytuje ho zbytku aplikace
 * - hlavně budoucímu loaderu Google Analytics (fáze 2), který se bude řídit podle
 * `consent$.analytics`, a odkazu "Nastavení cookies" v patičce (fáze 3), který zavolá
 * `openSettings()` a znovu otevře lištu v rozbaleném stavu.
 *
 * @note (2026) Zatím čistě klientské řešení (localStorage). Server-side logování souhlasu
 * (pro doložení při kontrole ÚOOÚ) je naplánované na pozdější fázi - až se přidá, půjde
 * volání API dovnitř metody `save()`, na místo označené `@future-note` níže, beze změny
 * veřejného rozhraní služby (komponenty, co ji používají, se nemusí měnit).
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
  /** Zvednout při jakékoli změně v tom, co/jak se sbírá - vynutí to nové zobrazení lišty
   *  všem, i těm, co už dřív odsouhlasili starší verzi. */
  private readonly CONSENT_VERSION = 1;
  /** Po tolika dnech se souhlas považuje za neplatný a lišta se ukáže znovu. */
  private readonly MAX_AGE_DAYS = 180;

  private readonly consentSubject = new BehaviorSubject<CookieConsentState | null>(this.readStored());
  /** Aktuální stav souhlasu - null, dokud uživatel nic neodsouhlasil. */
  readonly consent$ = this.consentSubject.asObservable();

  private readonly openSettingsSubject = new Subject<void>();
  /** Signál pro CookieConsentComponent, aby se znovu otevřela v rozbaleném stavu
   *  (použije se z odkazu "Nastavení cookies" v patičce - fáze 3). */
  readonly openSettingsRequested$ = this.openSettingsSubject.asObservable();

  get current(): CookieConsentState | null {
    return this.consentSubject.value;
  }

  /**
   * @description Zjistí, jestli má uživatel platný (a dostatečně čerstvý) souhlas uložený.
   */
  hasValidConsent(): boolean {
    const c = this.current;
    if (!c || c.version !== this.CONSENT_VERSION) return false;

    const ageMs = Date.now() - new Date(c.timestamp).getTime();
    const maxAgeMs = this.MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    return ageMs < maxAgeMs;
  }

  /**
   * @description Uloží souhlas s konkrétními kategoriemi (nezbytné jsou vždy zahrnuté).
   * @param categories Stav jednotlivých volitelných kategorií.
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
      // localStorage nedostupný (např. striktní privátní režim) - souhlas se
      // v takovém případě nepersistuje mezi návštěvami, lišta se objeví znovu.
    }

    this.consentSubject.next(state);

    // @future-note (fáze 3): sem přijde POST na backend endpoint pro server-side
    // log souhlasu (timestamp, kategorie, verze) - beze změny veřejného API téhle
    // metody, volající komponenty se nemusí měnit.
  }

  /** Zkratka pro tlačítko "Přijmout vše". */
  acceptAll(): void {
    this.save({ functional: true, analytics: true, marketing: true });
  }

  /** Zkratka pro tlačítko "Jen nezbytné". */
  rejectNonEssential(): void {
    this.save({ functional: false, analytics: false, marketing: false });
  }

  /**
   * @description Vyžádá si znovuotevření lišty v rozbaleném (nastavovacím) stavu.
   *              Volá se z odkazu "Nastavení cookies" v patičce (fáze 3).
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