/**
 * @file product-detail.component.ts
 * @path src/app/shop/product-detail/product-detail.component.ts
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Handles the product detail page, managing state for variants, quantity selection, and cart integration.
 * @dependencies
 * - ShopPublicService: Fetches detailed product information from the backend API.
 * - CartService: Manages the global shopping cart state.
 * - Angular Signals: Used for reactive updates to stock, price, and UI state.
 */

import { Component, OnInit, signal, computed, effect } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ShopPublicService } from '../components/services/public-data.service';
import { CartService } from '../components/services/cart.service';

/**
 * @description Component for displaying individual product details.
 * @usage Provides a view for users to inspect products, toggle variants, adjust quantities, and add to the cart.
 * @note Uses computed signals to derive UI states like price and stock availability reactively.
 */
@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.css',
})
export class ProductDetailComponent implements OnInit {
  product = signal<any>(null);
  selectedVariant = signal<any>(null);
  isLoading = signal(true);
  activeImage = signal<string | null>(null);
  selectedQuantity = signal<number>(1);
  addedToCart = signal<boolean>(false);

  /** Retrieves images specifically associated with the selected variant */
  variantImages = computed(() => this.selectedVariant()?.images || []);

  /** Filters out general images that are not attached to a specific variant */
  generalImages = computed(() => {
    const allImgs = this.product()?.images || [];
    return allImgs.filter((img: any) => !img.variant_id);
  });

  /** Derives the current selling price in EUR with VAT */
  currentPrice = computed(() => {
    const variant = this.selectedVariant();
    const prices = variant ? variant.prices : this.product()?.prices;
    return prices ? prices['price_eur_with_vat'] || 0 : 0;
  });

  /** Derives the current net price in EUR (without VAT) */
  priceWithoutVat = computed(() => {
    const item = this.selectedVariant() || this.product();
    return item?.prices ? item.prices['price_eur_without_vat'] || 0 : 0;
  });

  /** Derives the available stock based on the currently selected variant or main product */
  currentStock = computed(() => {
    const variant = this.selectedVariant();
    return variant ? variant.stock_quantity : (this.product()?.stock_quantity || 0);
  });

  isAvailable = computed(() => this.currentStock() > 0);

  /** Generates a unique key for tracking the cart item in the global state */
  currentCartItemId = computed(() => {
    const prod = this.product();
    if (!prod) return '';
    const variant = this.selectedVariant();
    const variantIdStr = variant?.id || 'novariant';
    return `${prod.id}_${variantIdStr}`;
  });

  /** Checks if the selected product combination already exists in the cart */
  isInCart = computed(() => {
    const itemId = this.currentCartItemId();
    return this.cartService.cartItems().some(item => item.id === itemId);
  });

  constructor(
    private route: ActivatedRoute,
    private shopService: ShopPublicService,
    public cartService: CartService
  ) {
    /** Auto-adjusts quantity if the stock drops below the current selection */
    effect(() => {
      const stock = this.currentStock();
      if (this.selectedQuantity() > stock) {
        this.selectedQuantity.set(Math.max(1, stock));
      }
    });
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const slugOrId = params.get('slugOrId');
      if (slugOrId) {
        this.loadProduct(slugOrId);
      }
    });
  }

  /**
   * @description Fetches product detail and initializes variant/image state.
   * @param id The product slug or database ID.
   */
  loadProduct(id: string): void {
    this.isLoading.set(true);
    this.shopService.getProductDetail(id).subscribe({
      next: (data) => {
        this.product.set(data);
        if (data.variants && data.variants.length > 0) {
          this.selectVariant(data.variants[0]);
        } else {
          const primary = data.images?.find((img: any) => img.is_primary);
          this.activeImage.set(primary?.url || data.images?.[0]?.url || 'assets/images/placeholder-product.png');
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error loading product detail:', err);
        this.isLoading.set(false);
      }
    });
  }

  /**
   * @description Switches active product variant and updates UI assets.
   * @param variant The variant configuration object.
   */
  selectVariant(variant: any): void {
    this.selectedVariant.set(variant);
    if (variant.images && variant.images.length > 0) {
      this.activeImage.set(variant.images[0].url);
    } else {
      const primary = this.product().images?.find((img: any) => img.is_primary);
      this.activeImage.set(primary?.url || this.product().images?.[0]?.url);
    }
  }

  /**
   * @description Event handler for variant dropdown selection.
   */
  onVariantChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const variantId = Number(selectElement.value);
    const variant = this.product().variants.find((v: any) => v.id === variantId);
    if (variant) {
      this.selectVariant(variant);
    }
  }

  /**
   * @description Updates the primary display image.
   */
  setActiveImage(url: string): void {
    this.activeImage.set(url);
  }

  /**
   * @description Increments quantity, capped by available stock.
   */
  increaseQuantity(): void {
    this.selectedQuantity.update(q => Math.min(q + 1, this.currentStock()));
  }

  /**
   * @description Decrements quantity, floored at 1.
   */
  decreaseQuantity(): void {
    this.selectedQuantity.update(q => Math.max(1, q - 1));
  }

  /**
   * @description Helper to format variant prices.
   */
  getVariantPrice(variant: any): string {
    return this.getFormattedPrice(variant.prices?.['price_eur_with_vat'] || 0);
  }

  /**
   * @description Localizes numeric values to EUR currency format.
   */
  getFormattedPrice(value: number): string {
    return new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2
    }).format(value);
  }

  /**
   * @description Adds the selected product and quantity to the CartService.
   */
  addToCart(): void {
    if (!this.isAvailable()) {
      alert('Product is currently unavailable.');
      return;
    }
    const product = this.product();
    const variant = this.selectedVariant();
    const quantity = this.selectedQuantity();
    if (quantity > this.currentStock()) {
      alert(`Cannot order more than ${this.currentStock()} units.`);
      return;
    }
    if (!product.slug) product.slug = this.route.snapshot.paramMap.get('slugOrId');
    this.cartService.addItem(product, variant, quantity);
    this.addedToCart.set(true);
    setTimeout(() => this.addedToCart.set(false), 2000);
  }
}