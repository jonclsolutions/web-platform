import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-product-builder',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './product-builder.component.html',
  styleUrl: './product-builder.component.css',
})
export class ProductBuilderComponent {
  @Input() product: any;

  getThumbnailUrl(): string {
    if (!this.product) return 'assets/images/placeholder-product.png';

    // 1. Priorita: primary_image objekt
    if (this.product.primary_image?.url) {
      return this.product.primary_image.url;
    }

    // 2. Druhá volba: Prohledáme pole images
    if (this.product.images && this.product.images.length > 0) {
      const primary = this.product.images.find((img: any) => img.is_primary);
      if (primary?.url) return primary.url;
      return this.product.images[0].url;
    }

    // 3. Poslední záchrana
    return 'assets/images/placeholder-product.png';
  }

  // 🛠️ UPRAVENO: Nyní správně pracuje s EUR a řeší TS4111 indexovou notací
  getFormattedPrice(): string {
    // Přístup k ceně pomocí závorkové notace kvůli TS4111
    const price = this.product?.prices?.['price_eur_with_vat'] || 0;
    
    return new Intl.NumberFormat('cs-CZ', { 
      style: 'currency', 
      currency: 'EUR',
      minimumFractionDigits: 2 // U EUR je běžné zobrazovat 2 desetinná místa
    }).format(price);
  }
}