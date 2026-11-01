/**
 * @file cookies-policy.component.ts
 * @path src/app/public/web-pages/cookies-policy/cookies-policy.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @note Document loading goes through LegalDocsService, which caches by slug+language.
 *   If AppBootstrapService already prefetched this doc in the background, this resolves
 *   instantly with no network wait. Same pattern as TosComponent, only with the slug 'cookies'.
 *
 * @note Unlike TOS / GDPR it also has a button that reopens the cookie bar
 * (CookieConsentService.openSettings()) - the most natural place for "Change cookie settings"
 * is this page, not only a link in the footer.
 */

import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BasePublicComponent } from '../../base-public.component';
import { LegalDocsService } from '../../../shared/services/legal-docs.service';
import { CookieConsentService } from '../../../shared/services/cookie-consent.service';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-cookies-policy',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './cookies-policy.component.html',
  styleUrl: '../shared-styles/legal-document.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CookiesPolicyComponent extends BasePublicComponent {

  protected readonly translationKey = 'cookies_policy';
  data: any = null;

  /** Protected: the template builds the translated footer with it (effectiveFooter()). */
  protected legalDocsService = inject(LegalDocsService);
  private cookieConsentService = inject(CookieConsentService);

  protected override onInit(): void {
    this.currentLanguage$
      .pipe(takeUntil(this.destroy$))
      .subscribe((lang) => this.loadDocument(lang));
  }

  private loadDocument(lang: string): void {
    this.legalDocsService.getDocument('cookies', lang)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.data = res;
          this.cdr.markForCheck();
        },
        error: (err) => console.error('Error loading cookies policy:', err)
      });
  }

  /**
   * @description Reopens the cookie bar in the expanded (settings) state, so the user can change
   *              the consent at any time directly from this page.
   */
  openCookieSettings(): void {
    this.cookieConsentService.openSettings();
  }
}