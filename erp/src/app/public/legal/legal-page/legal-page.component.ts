/**
 * @file legal-page.component.ts
 * @path src/app/public/legal/legal-page/legal-page.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Page of a legal document (privacy policy, terms, cookies policy) in any public
 *   application: the document of the route (legal-page.config.ts) in the current language, its
 *   sections, the "change cookie settings" / "more information" paragraphs of the document and
 *   the translated "effective from" footer. Dark look by default, light in a light public area.
 * @note Loading goes through LegalDocsService, which caches by slug + language (prefetched by
 *   AppBootstrapService, so the page usually renders without a network wait).
 * @dependencies BasePublicComponent (texts of the area), LegalDocsService, CookieConsentService,
 *   LegalDocumentSectionsComponent.
 */

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntil } from 'rxjs/operators';
import { BasePublicComponent } from '../../base-public.component';
import { routePublicArea } from '../../public-area';
import { LegalDocsService } from '../../../shared/services/legal-docs.service';
import { CookieConsentService } from '../../../shared/services/cookie-consent.service';
import { LegalDocumentSectionsComponent } from '../legal-document-sections/legal-document-sections.component';
import { LEGAL_DOCUMENT_DATA, LEGAL_PAGES, LegalDocumentSlug } from './legal-page.config';

@Component({
  selector: 'app-legal-page',
  standalone: true,
  imports: [RouterLink, LegalDocumentSectionsComponent],
  templateUrl: './legal-page.component.html',
  styleUrl: './legal-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Light look in a light public area (legal-page.component.css).
  host: { '[class.legal--light]': 'lightTheme' },
})
export class LegalPageComponent extends BasePublicComponent {
  /** Document of the route (privacy policy when the route has none). */
  readonly slug: LegalDocumentSlug = inject(ActivatedRoute).snapshot.data[LEGAL_DOCUMENT_DATA] ?? 'gdpr';
  /** What the page shows for its document. */
  readonly page = LEGAL_PAGES[this.slug];
  protected readonly translationKey = this.page.translationKey;

  /** Light look of the area of the layout that shows the page. */
  protected readonly lightTheme = routePublicArea()?.theme === 'light';

  /** The loaded document (null until it arrives). */
  data: any = null;

  /** Protected: the template builds the translated footer with it (effectiveFooter()). */
  protected readonly legalDocsService = inject(LegalDocsService);
  private readonly cookieConsentService = inject(CookieConsentService);

  protected override onInit(): void {
    this.currentLanguage$
      .pipe(takeUntil(this.destroy$))
      .subscribe(lang => this.loadDocument(lang));
  }

  /**
   * @description Loads the document in the language; a failure keeps the shown document.
   * @param lang Language code.
   */
  private loadDocument(lang: string): void {
    this.legalDocsService.getDocument(this.slug, lang)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: res => {
          this.data = res;
          this.cdr.markForCheck();
        },
        error: err => console.error(`Error loading legal document ${this.slug}:`, err),
      });
  }

  /** @description Reopens the cookie bar in the settings state (the consent can change any time). */
  openCookieSettings(): void {
    this.cookieConsentService.openSettings();
  }
}
