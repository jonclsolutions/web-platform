/**
 * @file cookie-consent.component.ts
 * @path src/app/public/legal/cookie-consent/cookie-consent.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Cookie consent bar of the public web - three actions (Accept all / Necessary only
 * / Settings), where "Settings" expands a panel with 4 categories (Necessary always on and
 * locked, Functional / Analytics / Marketing with their own switches).
 * @dependencies
 * - BasePublicComponent: Provides `t` (translations), `cdr`, `destroy$`.
 * - CookieConsentService: Storing / reading the consent state (localStorage) and the signal for
 *   reopening the bar.
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

  /** Whether the bar is visible at all (hidden once a valid consent is stored). */
  visible = false;
  /** Whether the panel with the categories is expanded. */
  showSettings = false;

  /** Unsaved selection of the settings panel before "Save settings" is sent. */
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
   * @description Accepts all categories and closes the bar.
   */
  acceptAll(): void {
    this.consentService.acceptAll();
    this.close();
  }

  /**
   * @description Refuses everything except the necessary cookies and closes the bar.
   */
  rejectNonEssential(): void {
    this.consentService.rejectNonEssential();
    this.close();
  }

  /**
   * @description Expands / collapses the panel with the categories.
   */
  toggleSettings(): void {
    this.showSettings = !this.showSettings;
    this.cdr.markForCheck();
  }

  /**
   * @description Saves the current selection of categories of the settings panel.
   */
  saveSettings(): void {
    this.consentService.save(this.draft);
    this.close();
  }

  /**
   * @description Prepares `draft` from the existing consent (if any), so the panel does not open
   *              empty every time the user reopens it.
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