/**
 * @file cookie-consent.component.ts
 * @path src/app/public/web-pages/components/cookie-consent/cookie-consent.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Lišta souhlasu s cookies pro veřejný web - tři akce (Přijmout vše / Jen
 * nezbytné / Nastavení), kde "Nastavení" rozbalí panel se 4 kategoriemi (Nezbytné vždy
 * zapnuté a needitovatelné, Funkční/Analytické/Marketingové s vlastními přepínači).
 * @dependencies
 * - BasePublicComponent: Poskytuje `t` (překlady), `cdr`, `destroy$`.
 * - CookieConsentService: Ukládání/čtení stavu souhlasu (localStorage), signál pro
 *   znovuotevření z patičky (fáze 3 - zatím nenapojeno).
 */

import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntil } from 'rxjs/operators';
import { BasePublicComponent } from '../../base-public.component';
import { CookieConsentCategories, CookieConsentService } from '../../../shared/services/cookie-consent.service';
@Component({
  selector: 'app-cookie-consent',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cookie-consent.component.html',
  styleUrl: './cookie-consent.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CookieConsentComponent extends BasePublicComponent {

  protected readonly translationKey = 'cookie_consent';

  private consentService = inject(CookieConsentService);

  /** Zda je lišta vůbec vidět (schovaná, jakmile je platný souhlas uložený). */
  visible = false;
  /** Zda je rozbalený panel s jednotlivými kategoriemi. */
  showSettings = false;

  /** Rozpracovaný výběr v panelu nastavení, než se odešle "Uložit nastavení". */
  draft: CookieConsentCategories = {
    functional: false,
    analytics: false,
    marketing: false,
  };

  protected override onInit(): void {
    if (!this.consentService.hasValidConsent()) {
      this.visible = true;
    }
    this.syncDraftFromCurrent();

    this.consentService.openSettingsRequested$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.syncDraftFromCurrent();
        this.visible = true;
        this.showSettings = true;
        this.cdr.markForCheck();
      });
  }

  /**
   * @description Přijme všechny kategorie a lištu zavře.
   */
  acceptAll(): void {
    this.consentService.acceptAll();
    this.close();
  }

  /**
   * @description Odmítne vše kromě nezbytných cookies a lištu zavře.
   */
  rejectNonEssential(): void {
    this.consentService.rejectNonEssential();
    this.close();
  }

  /**
   * @description Rozbalí/sbalí panel s jednotlivými kategoriemi.
   */
  toggleSettings(): void {
    this.showSettings = !this.showSettings;
    this.cdr.markForCheck();
  }

  /**
   * @description Uloží aktuální rozpracovaný výběr kategorií z panelu nastavení.
   */
  saveSettings(): void {
    this.consentService.save(this.draft);
    this.close();
  }

  /**
   * @description Připraví `draft` podle už existujícího souhlasu (pokud nějaký je),
   *              ať se panel neotevírá pokaždé prázdný, když ho uživatel znovu otevře.
   */
  private syncDraftFromCurrent(): void {
    const current = this.consentService.current;
    this.draft = {
      functional: current?.functional ?? false,
      analytics: current?.analytics ?? false,
      marketing: current?.marketing ?? false,
    };
  }

  private close(): void {
    this.visible = false;
    this.showSettings = false;
    this.cdr.markForCheck();
  }
}