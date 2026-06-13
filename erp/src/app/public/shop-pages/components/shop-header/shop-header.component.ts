import { Component, OnInit, HostListener, ChangeDetectorRef } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { CartService } from '../services/cart.service';
import { PublicDataService } from '../../../../shared/services/public-data.service';
@Component({
  selector: 'app-shop-header',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './shop-header.component.html',
  styleUrls: ['./shop-header.component.css']
})
export class ShopHeaderComponent implements OnInit {
  isScrolled = false;
  showLang = false;
  showCurrency = false;
  selectedLang = 'CZ';
  selectedCurrency = 'CZK';
  
  // Dynamická data
  siteSettings: any = null;

  constructor(
    private router: Router,
    public cartService: CartService,
    private publicDataService: PublicDataService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.publicDataService.getSiteSettings().subscribe({
      next: (data) => {
        this.siteSettings = data.settings;
        this.cdr.markForCheck();
      },
      error: (err) => console.error('Chyba při načítání dat pro header:', err)
    });
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    this.isScrolled = window.scrollY > 20;
  }

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
  selectCurrency(val: string) { this.selectedCurrency = val; }
  openCart() { this.router.navigate(['/shop/cart']); }
}