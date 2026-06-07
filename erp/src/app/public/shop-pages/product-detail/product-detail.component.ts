import { Component, OnInit, signal, computed, effect } from '@angular/core';

import { ActivatedRoute, RouterModule } from '@angular/router';
import { ShopPublicService } from '../components/services/public-data.service';
import { CartService } from '../components/services/cart.service';

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

  // Computed: Obrázky specifické pro variantu
  variantImages = computed(() => this.selectedVariant()?.images || []);

  // Computed: Obecné obrázky produktu, které NEJSOU přiřazeny k žádné variantě
  generalImages = computed(() => {
    const allImgs = this.product()?.images || [];
    return allImgs.filter((img: any) => !img.variant_id);
  });

  // 🛠️ OPRAVENO: Dynamické přepínání ceny zanořeného multoměnového objektu prices
  currentPrice = computed(() => {
    const variant = this.selectedVariant();
    
    if (variant) {
      // Varianta má své vlastní ceny z tabulky shop_product_prices navázané přes variant_id
      return variant.prices?.price_czk_with_vat || 0;
    }
    
    // Hlavní produkt má cenu v objektu prices (kde variant_id je null)
    return this.product()?.prices?.price_czk_with_vat || 0;
  });

  currentStock = computed(() => {
    const variant = this.selectedVariant();
    return variant ? variant.stock_quantity : (this.product()?.stock_quantity || 0);
  });

  isAvailable = computed(() => this.currentStock() > 0);

  // Computed: Vygenerování unikátního itemId pro košík
  currentCartItemId = computed(() => {
    const prod = this.product();
    if (!prod) return '';
    const variant = this.selectedVariant();
    const variantIdStr = variant?.id || 'novariant';
    return `${prod.id}_${variantIdStr}`;
  });

  // Computed: Zjištění, zda je tato konkrétní varianta/produkt již v košíku
  isInCart = computed(() => {
    const itemId = this.currentCartItemId();
    return this.cartService.cartItems().some(item => item.id === itemId);
  });

  constructor(
    private route: ActivatedRoute,
    private shopService: ShopPublicService,
    public cartService: CartService
  ) {
    // Hlídač: Pokud se změní varianta a její sklad je menší než navolené množství, snížíme ho na maximum
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

  loadProduct(id: string): void {
    this.isLoading.set(true);
    this.shopService.getProductDetail(id).subscribe({
      next: (data) => {
        this.product.set(data);
        // Defaultní start: První varianta
        if (data.variants && data.variants.length > 0) {
          this.selectVariant(data.variants[0]);
        } else {
          // Pokud nejsou varianty, vezmeme primární foto produktu
          const primary = data.images?.find((img: any) => img.is_primary);
          this.activeImage.set(primary?.url || data.images?.[0]?.url || 'assets/images/placeholder-product.png');
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Chyba při načítání produktu:', err);
        this.isLoading.set(false);
      }
    });
  }

  selectVariant(variant: any): void {
    this.selectedVariant.set(variant);
    // UX ROZHODNUTÍ: Při výběru varianty okamžitě nastavíme její první fotku
    if (variant.images && variant.images.length > 0) {
      this.activeImage.set(variant.images[0].url);
    } else {
      // Pokud varianta nemá fotky, vrátíme se k hlavní fotce produktu
      const primary = this.product().images?.find((img: any) => img.is_primary);
      this.activeImage.set(primary?.url || this.product().images?.[0]?.url);
    }
  }

  onVariantChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const variantId = Number(selectElement.value);
    const variant = this.product().variants.find((v: any) => v.id === variantId);
    if (variant) {
      this.selectVariant(variant);
    }
  }

  setActiveImage(url: string): void {
    this.activeImage.set(url);
  }

  increaseQuantity(): void {
    this.selectedQuantity.update(q => {
      if (q >= this.currentStock()) {
        return this.currentStock(); // Nepustí dál než je sklad
      }
      return q + 1;
    });
  }

  decreaseQuantity(): void {
    this.selectedQuantity.update(q => Math.max(1, q - 1));
  }

  addToCart(): void {
    if (!this.isAvailable()) {
      alert('Produkt není dostupný');
      return;
    }

    const product = this.product();
    const variant = this.selectedVariant();
    const quantity = this.selectedQuantity();
    const itemId = this.currentCartItemId();

    // Kontrola limitu skladu před vložením
    if (quantity > this.currentStock()) {
      alert(`Nelze objednat více než ${this.currentStock()} ks.`);
      return;
    }

    if (!product.slug) {
      product.slug = this.route.snapshot.paramMap.get('slugOrId');
    }

    const itemInCart = this.cartService.cartItems().find(i => i.id === itemId);

    if (itemInCart) {
      this.cartService.updateItemQuantity(itemId, quantity);
    } else {
      this.cartService.addItem(product, variant, quantity);
    }
    
    // Zobrazit potvrzení úspěšného vložení
    this.addedToCart.set(true);
    setTimeout(() => {
      this.addedToCart.set(false);
    }, 2000);
  }

  getFormattedPrice(value: number): string {
    return new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency: 'CZK',
      minimumFractionDigits: 0
    }).format(value);
  }
}