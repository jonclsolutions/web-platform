/**
 * @file about-us.component.ts
 * @path src/app/pages/about-us/about-us.component.ts
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Presentational component for the 'About Us' page, rendering static content with dynamically fetched site metadata and social media links.
 * @dependencies
 * - LocalizationService: Supplies translated content for the view.
 * - PublicDataService: Provides access to dynamic site configuration and asset URLs.
 * - Angular Core/Router: Manages component lifecycle and navigation infrastructure.
 */

import { Component, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '../../../shared/imports/web-providers';
import * as Web from '../../../shared/imports/web-providers';
import { PublicDataService } from '../../../shared/services/public-data.service';

/**
 * @description Component displaying corporate information and social contact points.
 * @usage Provides a static content page with dynamic social links injected from site settings.
 * @note Uses OnPush change detection to optimize rendering, triggered by data streams from injected services.
 */
@Component({
  selector: 'app-about-us',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './about-us.component.html',
  styleUrl: './about-us.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AboutUsComponent implements Web.OnInit, Web.OnDestroy {
  /** Localized content object */
  t: any = null;
  /** List of company social media profiles */
  socialLinks: any[] = []; 

  private destroy$ = new Web.Subject<void>();

  constructor(
    private localizationService: Web.LocalizationService,
    private publicDataService: PublicDataService,
    private cdr: ChangeDetectorRef 
  ) { }

  /**
   * @description Initializes data streams for translations and site configuration.
   */
  ngOnInit(): void {
    // 1. Subscribe to translation stream
    this.localizationService.currentTranslations$
      .pipe(Web.takeUntil(this.destroy$))
      .subscribe(translations => {
        if (translations?.about_us) {
          this.t = translations.about_us;
          this.cdr.markForCheck();
        }
      });

    // 2. Load dynamic social media links from public settings API
    this.publicDataService.getSiteSettings()
      .pipe(Web.takeUntil(this.destroy$))
      .subscribe(res => {
        this.socialLinks = res.social_links;
        this.cdr.markForCheck();
      });
  }

  /**
   * @description Resolves the full URL for social media icons.
   * @param path The relative storage path returned by the backend.
   * @returns An absolute URL to the asset.
   */
  getIconUrl(path: string): string {
    return this.publicDataService.getStorageUrl(path);
  }

  /**
   * @description Tears down the component and unsubscribes from active streams to prevent memory leaks.
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}