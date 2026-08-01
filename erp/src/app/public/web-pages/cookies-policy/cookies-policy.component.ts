/**
 * @file cookies-policy.component.ts
 * @path src/app/public/web-pages/cookies-policy/cookies-policy.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @note Document loading goes through LegalDocsService, which caches by slug+language.
 *   If AppBootstrapService already prefetched this doc in the background, this resolves
 *   instantly with no network wait. Stejný vzor jako TosComponent, jen se slugem 'cookies'.
 *
 * @note Navíc oproti TOS/GDPR obsahuje tlačítko pro znovuotevření cookie lišty
 * (CookieConsentService.openSettings()) - nejpřirozenější místo pro "Změnit nastavení
 * cookies" je přímo na téhle stránce, ne jen odkaz v patičce.
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
  styleUrl: './../../../shared/legal-document.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CookiesPolicyComponent extends BasePublicComponent {

  protected readonly translationKey = 'cookies_policy';
  data: any = null;

  private legalDocsService = inject(LegalDocsService);
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
   * @description Znovu otevře cookie lištu v rozbaleném (nastavovacím) stavu, ať uživatel
   *              může kdykoli změnit svůj souhlas přímo z téhle stránky.
   */
  openCookieSettings(): void {
    this.cookieConsentService.openSettings();
  }
}