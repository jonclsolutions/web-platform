/**
 * @file tos.component.ts
 * @path src/app/public/legal/tos/tos.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @note Document loading goes through LegalDocsService, which caches by slug+language.
 *   If AppBootstrapService already prefetched this doc in the background, this resolves
 *   instantly with no network wait.
 */

import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BasePublicComponent } from '../../base-public.component';
import { LegalDocsService } from '../../../shared/services/legal-docs.service';
import { routePublicArea } from '../../public-area';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-tos',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './tos.component.html',
  styleUrl: '../legal-document.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Light look in a light public area (legal-document.css).
  host: { '[class.legal--light]': 'lightTheme' }
})
export class TosComponent extends BasePublicComponent {

  protected readonly translationKey = 'tos';

  /** Light look of the area of the layout that shows the page. */
  protected readonly lightTheme = routePublicArea()?.theme === 'light';
  data: any = null;

  /** Protected: the template builds the translated footer with it (effectiveFooter()). */
  protected legalDocsService = inject(LegalDocsService);

  protected override onInit(): void {
    this.currentLanguage$
      .pipe(takeUntil(this.destroy$))
      .subscribe((lang) => this.loadTos(lang));
  }

  private loadTos(lang: string): void {
    this.legalDocsService.getDocument('tos', lang)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.data = res;
          this.cdr.markForCheck();
        },
        error: (err) => console.error('Error loading TOS:', err)
      });
  }
}