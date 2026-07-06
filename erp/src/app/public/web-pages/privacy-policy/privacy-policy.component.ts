/**
 * @file privacy-policy.component.ts
 * @path src/app/pages/privacy-policy/privacy-policy.component.ts
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Renders legal documentation (GDPR or Terms of Service) dynamically fetched based on the application's selected language and document slug.
 * @dependencies
 * - PublicDataService: Provides access to legal document content from the backend.
 * - LocalizationService: Supplies localized metadata and triggers document refresh on language change.
 */

import { Component, ChangeDetectionStrategy, ChangeDetectorRef, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { switchMap, takeUntil } from 'rxjs/operators';
import * as Web from '../../../shared/imports/web-providers';
import { PublicDataService } from '../../../shared/imports/web-providers';
import { LocalizationService } from '../../../shared/services/localization.service';

/**
 * @description Component for displaying legal documents.
 * @usage Used for displaying GDPR and Terms of Service pages.
 * @note Implements reactive streams to automatically fetch new document versions when the user switches the UI language.
 */
@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './privacy-policy.component.html',
  styleUrl: './privacy-policy.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PrivacyPolicyComponent implements OnInit, OnDestroy {
  /** Input defining the document type; determines which API endpoint is queried */
  @Input() docSlug: 'gdpr' | 'tos' = 'gdpr';
  
  data: any = null;
  t: any = null; 
  private destroy$ = new Web.Subject<void>();

  constructor(
    private publicDataService: PublicDataService,
    private localizationService: LocalizationService,
    private cdr: ChangeDetectorRef
  ) {}

  /**
   * @description Initializes document fetching pipelines.
   */
  ngOnInit(): void {
    // 1. Translations stream: Syncs static text labels with current UI language
    this.localizationService.currentTranslations$
      .pipe(takeUntil(this.destroy$))
      .subscribe(translations => {
        this.t = translations?.privacy_policy;
        this.cdr.markForCheck();
      });

    // 2. Data stream: Reactive fetching triggered by language changes
    this.localizationService.currentLanguage$
      .pipe(
        takeUntil(this.destroy$),
        switchMap((lang) => this.publicDataService.getLegalDocument(this.docSlug, lang))
      )
      .subscribe({
        next: (res) => {
          this.data = res;
          this.cdr.markForCheck();
        },
        error: (err) => console.error(`Error loading legal document ${this.docSlug}:`, err)
      });
  }

  /**
   * @description Tears down subscriptions to ensure memory management.
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}