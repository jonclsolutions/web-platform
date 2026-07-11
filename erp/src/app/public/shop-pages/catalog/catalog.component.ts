/**
 * @file catalog.component.ts
 * @path src/app/public/shop-pages/catalog/catalog.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
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
  ENDPOINTS: { PRODUCT_DETAIL_BASE: '/shop/products' },
  // TEXTY zde zůstávají jako výchozí, pokud je nechceš mít v JSON překladech
  TEXTS: {
    HEADER: 'Katalog produktů',
    TOTAL_FOUND: 'Celkem nalezeno',
    ITEMS_UNIT: 'položek',
    EMPTY_STATE: 'Nebyly nalezeny žádné produkty odpovídající výběru.'
  }
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
  styleUrl: './catalog.component.css',
})
export class CatalogComponent extends BasePublicComponent implements OnInit {

  protected readonly translationKey = 'catalog';
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
        next: (res) => this.categories.set(res.data || res),
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
          this.totalItems.set(response.total || 0);
          this.totalPages.set(response.last_page || 1);
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

  onItemsPerPageChange(amount: number): void {
    this.filters.per_page = amount;
    this.filters.page = 1;
    this.loadProducts();
  }

  getProductUrl(slug: string): string {
    return `${this.config.ENDPOINTS.PRODUCT_DETAIL_BASE}/${slug}`;
  }
}