/**
 * @file shop-header.component.ts
 * @path src/app/apps/shop/public/components/shop-header/shop-header.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Presentational component for the e-shop header, handling UI state for navigation and cart
 *   access. The language switcher is in the footer (FooterLanguageSwitcherComponent, 2026-11).
 * @dependencies
 * - CartService: Provides reactive access to cart item counts and status.
 * - PublicDataService: Fetches global site branding and configuration.
 * - Angular Router: Enables navigation to cart or shop pages.
 * - LocalizationService: Translations of the `shop` module.
 */

import { Component, OnInit, OnDestroy, HostListener, ChangeDetectorRef } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CartService } from '../services/cart.service';
import { PublicDataService } from '../../../../../shared/services/public-data.service';
import { LocalizationService } from '../../../../../shared/services/localization.service';

/**
 * @description Component for the e-shop navigation header.
 * @usage Provides a persistent navigation bar with contact details and cart status.
 * @note Implements a HostListener to react to scroll events for sticky UI effects.
 */
@Component({
  selector: 'app-shop-header',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './shop-header.component.html',
  styleUrls: ['../../shared-styles/theme.css', './shop-header.component.css']
})
export class ShopHeaderComponent implements OnInit, OnDestroy {
  isScrolled = false;

  siteSettings: any = null;

  /** Texts of the `header` section of the shop translations. */
  t: any = null;

  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    public cartService: CartService,
    private publicDataService: PublicDataService,
    private localizationService: LocalizationService,
    private cdr: ChangeDetectorRef
  ) {
    this.localizationService.setModule('shop');
  }

  /**
   * @description Initializes header texts and site branding.
   */
  ngOnInit(): void {
    this.localizationService.currentTranslations$
      .pipe(takeUntil(this.destroy$))
      .subscribe(translations => {
        this.t = translations?.header ?? null;
        this.cdr.markForCheck();
      });

    this.publicDataService.get<{settings: any}>('public/legal/config')
      .subscribe({
        next: (data) => {
          this.siteSettings = data.settings;
          this.cdr.markForCheck();
        },
        error: (err) => console.error('Error loading header site data:', err)
      });
  }

  /**
   * @description Monitors scroll position to toggle the 'scrolled' class on the header element.
   */
  @HostListener('window:scroll', [])
  onWindowScroll() {
    this.isScrolled = window.scrollY > 20;
  }

  /**
   * @description Navigates to the shopping cart interface.
   */
  openCart() { this.router.navigate(['/shop/cart']); }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}