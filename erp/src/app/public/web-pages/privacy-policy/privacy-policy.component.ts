/**
 * @file privacy-policy.component.ts
 * @path src/app/public/web-pages/privacy-policy/privacy-policy.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 */

import { Component, ChangeDetectionStrategy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BasePublicComponent } from '../../base-public.component';
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

  protected override onInit(): void {
    this.currentLanguage$
      .pipe(takeUntil(this.destroy$))
      .subscribe((lang) => this.loadDocument(lang));
  }

  private loadDocument(lang: string): void {
    this.publicDataService.get(`public/legal/${this.docSlug}`, { lang })
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