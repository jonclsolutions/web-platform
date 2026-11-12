/**
 * @file privacy-policy.component.ts
 * @path src/app/public/legal/privacy-policy/privacy-policy.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @note Document loading goes through LegalDocsService, which caches by slug+language.
 *   If AppBootstrapService already prefetched this doc in the background, this resolves
 *   instantly with no network wait.
 */

import { Component, ChangeDetectionStrategy, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BasePublicComponent } from '../../base-public.component';
import { LegalDocsService } from '../../../shared/services/legal-docs.service';
import { routeTranslationModule } from '../legal-route';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './privacy-policy.component.html',
  styleUrl: '../legal-document.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Light look in the e-shop layout (legal-document.css).
  host: { '[class.legal--light]': "translationModule === 'shop'" }
})
export class PrivacyPolicyComponent extends BasePublicComponent {
  protected readonly translationKey = 'privacy_policy';

  /** Translations of the application whose layout shows the page (route data). */
  protected override readonly translationModule = routeTranslationModule();

  @Input() docSlug: 'gdpr' | 'tos' = 'gdpr';
  data: any = null;

  /** Protected: the template builds the translated footer with it (effectiveFooter()). */
  protected legalDocsService = inject(LegalDocsService);

  protected override onInit(): void {
    this.currentLanguage$
      .pipe(takeUntil(this.destroy$))
      .subscribe((lang) => this.loadDocument(lang));
  }

  private loadDocument(lang: string): void {
    this.legalDocsService.getDocument(this.docSlug, lang)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.data = res;
          this.cdr.markForCheck();
        },
        error: (err) => console.error(`Error loading legal document ${this.docSlug}:`, err)
      });
  }
}