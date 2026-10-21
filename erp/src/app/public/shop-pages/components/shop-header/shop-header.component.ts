/**
 * @file shop-header.component.ts
 * @path src/app/public/shop-pages/components/shop-header/shop-header.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Presentational component for the e-shop header, handling UI state for navigation, language/currency selection, and cart access.
 * @dependencies
 * - CartService: Provides reactive access to cart item counts and status.
 * - PublicDataService: Fetches global site branding and configuration.
 * - Angular Router: Enables navigation to cart or shop pages.
 * - LocalizationService: Translations and languages of the `shop` module.
 *
 * @refactor-note (2026-10-21) Lokalizace 1:1 jako PublicHeaderComponent: v konstruktoru
 *   `setModule('shop')`, texty ze sekce `header` v `translations/shop/{lang}.json`, přepínač
 *   jazyků plní `fetchLanguages()` (jazyky modulu shop) a volá `setLanguage()`. Natvrdo psané
 *   volby CZ/EN a `selectedLang` odstraněny - aktivní jazyk je `currentLanguage$`.
 */

import { Component, OnInit, OnDestroy, HostListener, ChangeDetectorRef } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CartService } from '../services/cart.service';
import { PublicDataService } from '../../../../shared/services/public-data.service';
import { LocalizationService, LangMeta } from '../../../../shared/services/localization.service';
import { CommonModule } from '@angular/common';

/**
 * @description Component for the e-shop navigation header.
 * @usage Provides a persistent navigation bar with user preferences (lang/currency) and cart status.
 * @note Implements HostListeners to react to scroll events for sticky UI effects and global clicks for closing dropdown menus.
 */
@Component({
  selector: 'app-shop-header',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './shop-header.component.html',
  styleUrls: ['../../shared-styles/theme.css', './shop-header.component.css']
})
export class ShopHeaderComponent implements OnInit, OnDestroy {
  isScrolled = false;
  showLang = false;
  showCurrency = false;

  selectedCurrency = 'EUR'; // Default system currency

  siteSettings: any = null;

  /** Texts of the `header` section of the shop translations. */
  t: any = null;
  /** Active languages of the shop module. */
  availableLanguages: LangMeta[] = [];
  currentLanguage$: Observable<string>;

  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    public cartService: CartService,
    private publicDataService: PublicDataService,
    private localizationService: LocalizationService,
    private cdr: ChangeDetectorRef
  ) {
    this.localizationService.setModule('shop');
    this.currentLanguage$ = this.localizationService.currentLanguage$;
  }

  /**
   * @description Initializes shop languages, header texts and site branding.
   */
  ngOnInit(): void {
    this.localizationService.fetchLanguages().subscribe(res => {
      this.availableLanguages = res.languages;
      this.cdr.markForCheck();
    });

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
   * @description Closes dropdown menus when clicking outside the dropdown container.
   * @param event The DOM click event.
   */
  @HostListener('document:click', ['$event'])
  clickout(event: any) {
    if (!event.target.closest('.custom-dropdown')) {
      this.showLang = false;
      this.showCurrency = false;
    }
  }

  toggleLang() { this.showLang = !this.showLang; this.showCurrency = false; }
  toggleCurrency() { this.showCurrency = !this.showCurrency; this.showLang = false; }

  /**
   * @description Switches the shop language (reloads the shop translations).
   * @param code Language code from `availableLanguages`.
   */
  selectLang(code: string) { this.localizationService.setLanguage(code); }

  /**
   * @description Updates selected currency. 
   * @note Placeholder for future application-wide currency conversion logic.
   */
  selectCurrency(val: string) { 
    this.selectedCurrency = val; 
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