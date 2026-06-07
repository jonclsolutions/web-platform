import { Component, HostListener } from '@angular/core';

import { RouterModule, Router } from '@angular/router';
import { CartService } from '../services/cart.service';
@Component({
  selector: 'app-shop-header',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './shop-header.component.html',
  styleUrls: ['./shop-header.component.css']
})
export class ShopHeaderComponent {
  isScrolled = false;

  showLang = false;
  showCurrency = false;
  selectedLang = 'CZ';
  selectedCurrency = 'CZK';

  constructor(
    private router: Router,
    public cartService: CartService // <-- Zpřístupní službu pro HTML šablonu
  ) {}

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