/**
 * @file not-found.component.ts
 * @path src/app/pages/not-found/not-found.component.ts
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Presentational component for the 404 error page, providing user feedback on invalid routes and recovery navigation options.
 * @dependencies
 * - Router: Used to capture the failing navigation context.
 * - LocalizationService: Injects localized messaging for the error state.
 */

import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import * as Web from '../../../shared/imports/web-providers';

/**
 * @description Component displayed when a requested route cannot be resolved.
 * @usage Acts as the catch-all handler for invalid URL patterns in the application.
 * @note Tracks the navigation history to inform the user of the URL that caused the error.
 */
@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.css',
})
export class NotFoundComponent implements OnInit, OnDestroy {
  /** Localized content object for 404 messages */
  t: any = null;
  private destroy$ = new Web.Subject<void>();
  /** URL that triggered the not-found state */
  attemptedUrl: string = '';

  constructor(
    private router: Router,
    private localizationService: Web.LocalizationService
  ) {}

  /**
   * @description Initializes translations and extracts the invalid URL from the navigation state.
   */
  ngOnInit(): void {
    this.localizationService.currentTranslations$
      .pipe(Web.takeUntil(this.destroy$))
      .subscribe(translations => {
        if (translations?.not_found) {
          this.t = translations.not_found;
        }
      });

    const navigation = this.router.getCurrentNavigation();
    if (navigation && navigation.previousNavigation) {
      this.attemptedUrl = navigation.previousNavigation.finalUrl?.toString() || '';
    } else {
      this.attemptedUrl = this.router.url;
    }
  }

  /**
   * @description Cleans up resources to prevent memory leaks.
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}