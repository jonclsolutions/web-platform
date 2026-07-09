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
 */

import { Component, OnInit, HostListener, ChangeDetectorRef } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { CartService } from '../services/cart.service';
import { PublicDataService } from '../../../../shared/services/public-data.service';
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
  styleUrls: ['./shop-header.component.css']
})
export class ShopHeaderComponent implements OnInit {
  isScrolled = false;
  showLang = false;
  showCurrency = false;
  
  selectedLang = 'CZ';
  selectedCurrency = 'EUR'; // Default system currency
  
  siteSettings: any = null;

  constructor(
    private router: Router,
    public cartService: CartService,
    private publicDataService: PublicDataService,
    private cdr: ChangeDetectorRef
  ) {}

  /**
   * @description Initializes site branding and settings from the Public API.
   */
  ngOnInit(): void {
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

  selectLang(val: string) { this.selectedLang = val; }

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
}