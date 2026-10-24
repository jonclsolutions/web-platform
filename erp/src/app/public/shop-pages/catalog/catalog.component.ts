/**
 * @file catalog.component.ts
 * @path src/app/public/shop-pages/catalog/catalog.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @refactor-note (2026-10-21) Removed unused code (no reference in TS, templates or
 *   string literals): `onItemsPerPageChange`, `getProductUrl`.
 * @refactor-note (2026-10-21) Lokalizace 1:1 jako veřejný web: `translationModule = 'shop'`, všechny texty ze sekce
 *   `catalog` v `translations/shop/{lang}.json`. Odstraněno `CATALOG_CONFIG.TEXTS` (výchozí texty
 *   v kódu; HEADER/TOTAL_FOUND/ITEMS_UNIT se navíc nikde nepoužívaly).
 * @refactor-note (2026-10-24) Open finding #6 (one API envelope `{data, meta?}`): categories are
 *  the payload list, the product page carries the pagination in `meta`.
 */

import { Component, OnInit, signal, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BasePublicComponent } from '../../base-public.component';
import { ShopPublicService } from '../components/services/public-data.service';
import { ProductBuilderComponent } from '../components/builders/product-builder/product-builder.component';
import { PaginationButtonsBuilderComponent } from '../components/builders/pagination-buttons-builder/pagination-buttons-builder.component';
import { takeUntil } from 'rxjs/operators';

const CATALOG_CONFIG = {
  ENDPOINTS: { PRODUCT_DETAIL_BASE: '/shop/products' }
};

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [
    RouterModule,
    FormsModule,
    ProductBuilderComponent,
    PaginationButtonsBuilderComponent
  ],
  templateUrl: './catalog.component.html',
  styleUrls: ['../shared-styles/theme.css', './catalog.component.css'],
})
export class CatalogComponent extends BasePublicComponent implements OnInit {

  protected readonly translationKey = 'catalog';
  protected override readonly translationModule = 'shop';
  readonly config = CATALOG_CONFIG; // Zpět v komponentě
  
  private shopService = inject(ShopPublicService);

  products = signal<any[]>([]);
  categories = signal<any[]>([]);
  totalItems = signal(0);
  totalPages = signal(1);
  isLoading = signal(false);
  showFilters = signal(false);

  filters: any = {
    page: 1,
    per_page: 15,
    search: '',
    category_id: '',
    sort_by: 'created_at',
    sort_direction: 'desc'
  };

  override ngOnInit(): void {
    super.ngOnInit();
    this.loadInitialData();
  }

  loadInitialData(): void {
    this.shopService.getCategories()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => this.categories.set(Array.isArray(res) ? res : []),
        error: (err) => console.error('Chyba kategorií:', err)
      });

    this.loadProducts();
  }

  loadProducts(): void {
    this.isLoading.set(true);

    const activeFilters = Object.keys(this.filters)
      .filter(key => this.filters[key] !== '' && this.filters[key] !== null)
      .reduce((obj: any, key) => {
        obj[key] = this.filters[key];
        return obj;
      }, {});

    this.shopService.getProducts(activeFilters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.products.set(response.data || []);
          this.totalItems.set(response.meta?.total || 0);   // pagination in meta (finding #6)
          this.totalPages.set(response.meta?.last_page || 1);
          this.isLoading.set(false);
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Chyba produktů:', err);
          this.isLoading.set(false);
          this.products.set([]);
          this.cdr.markForCheck();
        }
      });
  }

  toggleFilters(): void {
    this.showFilters.update(v => !v);
  }

  applyFilters(): void {
    this.filters.page = 1;
    this.loadProducts();
  }

  onPageChange(page: number): void {
    this.filters.page = page;
    this.loadProducts();
  }
}