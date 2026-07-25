/**
 * @file privacy-policy.component.ts
 * @path src/app/public/web-pages/privacy-policy/privacy-policy.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @note Document loading goes through LegalDocsService, which caches by slug+language.
 *   If AppBootstrapService already prefetched this doc in the background, this resolves
 *   instantly with no network wait.
 */

import { Component, ChangeDetectionStrategy, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BasePublicComponent } from '../../base-public.component';
import { LegalDocsService } from '../../../shared/services/legal-docs.service';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './privacy-policy.component.html',
  styleUrl: './privacy-policy.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PrivacyPolicyComponent extends BasePublicComponent {
  protected readonly translationKey = 'privacy_policy';

  @Input() docSlug: 'gdpr' | 'tos' = 'gdpr';
  data: any = null;

  private legalDocsService = inject(LegalDocsService);

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