/**
 * @file product-builder.component.ts
 * @path src/app/public/shop-pages/components/builders/product-builder/product-builder.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Presentational component responsible for rendering individual product cards within the catalog, handling thumbnail resolution and price formatting.
 * @dependencies
 * - CommonModule: Standard Angular utilities for structural directives.
 * - RouterModule: Enables navigation to specific product detail pages via templates.
 */

import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

/**
 * @description Component for building and displaying a product card.
 * @usage Used in catalog and listing views to represent a product entry.
 * @note Implements logic to gracefully handle missing image assets and formatted currency strings.
 */
@Component({
  selector: 'app-product-builder',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './product-builder.component.html',
  styleUrl: './product-builder.component.css',
})
export class ProductBuilderComponent {
  /** The product data object containing metadata, prices, and image arrays */
  @Input() product: any;

  /**
   * @description Resolves the primary thumbnail URL for the product.
   * @returns A URL string or a fallback placeholder path.
   * @note Prioritizes explicitly defined primary images, then searches the image collection, finally falls back to a default asset.
   */
  getThumbnailUrl(): string {
    if (!this.product) return 'assets/images/placeholder-product.png';

    // 1. Primary image object priority
    if (this.product.primary_image?.url) {
      return this.product.primary_image.url;
    }

    // 2. Search image array for marked primary or default to first index
    if (this.product.images && this.product.images.length > 0) {
      const primary = this.product.images.find((img: any) => img.is_primary);
      if (primary?.url) return primary.url;
      return this.product.images[0].url;
    }

    // 3. Fallback to placeholder
    return 'assets/images/placeholder-product.png';
  }

  /**
   * @description Formats the product price in EUR for display.
   * @returns A localized formatted string (e.g., "1.234,56 €").
   * @note Uses bracket notation for price lookup to avoid TS4111 indexing errors when accessing dynamic property keys.
   */
  getFormattedPrice(): string {
    const price = this.product?.prices?.['price_eur_with_vat'] || 0;
    
    return new Intl.NumberFormat('cs-CZ', { 
      style: 'currency', 
      currency: 'EUR',
      minimumFractionDigits: 2
    }).format(price);
  }
}