/**
 * @file product-detail.component.ts
 * @path src/app/public/shop-pages/product-detail/product-detail.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 */

import { Component, OnInit, signal, computed, effect, inject } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { BasePublicComponent } from '../../base-public.component';
import { ShopPublicService } from '../components/services/public-data.service';
import { CartService } from '../components/services/cart.service';
import { takeUntil } from 'rxjs/operators';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.css',
})
export class ProductDetailComponent extends BasePublicComponent implements OnInit {
  
  protected readonly translationKey = 'product_detail';

  private route = inject(ActivatedRoute);
  private shopService = inject(ShopPublicService);
  public cartService = inject(CartService);

  // Signály pro reaktivní UI
  product = signal<any>(null);
  selectedVariant = signal<any>(null);
  isLoading = signal(true);
  activeImage = signal<string | null>(null);
  selectedQuantity = signal<number>(1);
  addedToCart = signal<boolean>(false);

  // Computeds pro odvozený stav
  variantImages = computed(() => this.selectedVariant()?.images || []);
  generalImages = computed(() => { 
    const allImgs = this.product()?.images || []; 
    return allImgs.filter((img: any) => !img.variant_id); 
  });
  
  currentPrice = computed(() => { 
    const variant = this.selectedVariant(); 
    const prices = variant ? variant.prices : this.product()?.prices; 
    return prices ? prices['price_eur_with_vat'] || 0 : 0; 
  });

  priceWithoutVat = computed(() => { 
    const item = this.selectedVariant() || this.product(); 
    return item?.prices ? item.prices['price_eur_without_vat'] || 0 : 0; 
  });

  currentStock = computed(() => { 
    const variant = this.selectedVariant(); 
    return variant ? variant.stock_quantity : (this.product()?.stock_quantity || 0); 
  });

  isAvailable = computed(() => this.currentStock() > 0);

  currentCartItemId = computed(() => { 
    const prod = this.product(); 
    if (!prod) return ''; 
    const variant = this.selectedVariant(); 
    const variantIdStr = variant?.id || 'novariant'; 
    return `${prod.id}_${variantIdStr}`; 
  });

  isInCart = computed(() => { 
    const itemId = this.currentCartItemId(); 
    return this.cartService.cartItems().some(item => item.id === itemId); 
  });

  constructor() {
    super();
    // Efekt pro automatickou úpravu množství podle skladu
    effect(() => {
      const stock = this.currentStock();
      if (this.selectedQuantity() > stock) {
        this.selectedQuantity.set(Math.max(1, stock));
      }
    });
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const slugOrId = params.get('slugOrId');
      if (slugOrId) this.loadProduct(slugOrId);
    });
  }

  loadProduct(id: string): void {
    this.isLoading.set(true);
    this.shopService.getProductDetail(id).subscribe({
      next: (data) => {
        this.product.set(data);
        if (data.variants?.length > 0) {
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

  selectVariant(variant: any): void {
    this.selectedVariant.set(variant);
    if (variant.images?.length > 0) {
      this.activeImage.set(variant.images[0].url);
    } else {
      const primary = this.product().images?.find((img: any) => img.is_primary);
      this.activeImage.set(primary?.url || this.product().images?.[0]?.url);
    }
  }

  onVariantChange(event: Event): void {
    const variantId = Number((event.target as HTMLSelectElement).value);
    const variant = this.product().variants.find((v: any) => v.id === variantId);
    if (variant) this.selectVariant(variant);
  }

  setActiveImage(url: string): void { 
    this.activeImage.set(url); 
  }

  increaseQuantity(): void { 
    this.selectedQuantity.update(q => Math.min(q + 1, this.currentStock())); 
  }

  decreaseQuantity(): void { 
    this.selectedQuantity.update(q => Math.max(1, q - 1)); 
  }

  getVariantPrice(variant: any): string { 
    return this.getFormattedPrice(variant.prices?.['price_eur_with_vat'] || 0); 
  }

  getFormattedPrice(value: number): string { 
    return new Intl.NumberFormat('cs-CZ', { 
      style: 'currency', 
      currency: 'EUR', 
      minimumFractionDigits: 2 
    }).format(value); 
  }

  addToCart(): void {
    if (!this.isAvailable()) {
      alert(this.t?.errors?.unavailable || 'Product is currently unavailable.');
      return;
    }
    const product = this.product();
    const variant = this.selectedVariant();
    const quantity = this.selectedQuantity();
    
    if (quantity > this.currentStock()) {
      alert(`${this.t?.errors?.max_stock || 'Cannot order more than'} ${this.currentStock()} ${this.t?.units || 'units'}.`);
      return;
    }
    
    this.cartService.addItem(product, variant, quantity);
    this.addedToCart.set(true);
    setTimeout(() => this.addedToCart.set(false), 2000);
  }
}