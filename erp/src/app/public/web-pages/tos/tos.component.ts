/**
 * @file tos.component.ts
 * @path src/app/pages/tos/tos.component.ts
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Renders Terms of Service (TOS) legal documentation by fetching live content based on language state.
 * @dependencies
 * - PublicDataService: Retrieves legal text from server.
 * - LocalizationService: Triggers document refresh on language toggles.
 */

import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { switchMap, takeUntil } from 'rxjs/operators';
import * as Web from '../../../shared/imports/web-providers';
import { PublicDataService } from '../../../shared/imports/web-providers';
import { LocalizationService } from '../../../shared/services/localization.service';

/**
 * @description Page component for displaying Terms of Service.
 * @usage Static legal disclosure page.
 * @note Uses the switchMap operator to ensure that whenever the user changes the site language, the legal text is automatically requested in the correct language.
 */
@Component({
  selector: 'app-tos',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './tos.component.html',
  styleUrl: './tos.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TosComponent implements OnInit, OnDestroy {
  data: any = null;
  t: any = null; 
  private destroy$ = new Web.Subject<void>();

  constructor(
    private publicDataService: PublicDataService,
    private localizationService: LocalizationService,
    private cdr: ChangeDetectorRef
  ) { }

  /**
   * @description Initializes localization stream and document fetching pipeline.
   */
  ngOnInit(): void {
    // 1. Translations stream: Syncs static labels
    this.localizationService.currentTranslations$
      .pipe(takeUntil(this.destroy$))
      .subscribe(translations => {
        this.t = translations?.tos;
        this.cdr.markForCheck();
      });

    // 2. Data stream: Fetches legal content reactively
    this.localizationService.currentLanguage$
      .pipe(
        takeUntil(this.destroy$),
        switchMap((lang) => this.publicDataService.getLegalDocument('tos', lang))
      )
      .subscribe({
        next: (res) => {
          this.data = res;
          this.cdr.markForCheck();
        },
        error: (err) => console.error('Error loading TOS:', err)
      });
  }

  /**
   * @description Cleans up resources.
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}