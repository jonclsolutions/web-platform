import { Component, OnInit, signal } from '@angular/core';

import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ShopPublicService } from '../components/services/public-data.service';
import { ProductBuilderComponent } from '../components/builders/product-builder/product-builder.component';
import { PaginationButtonsBuilderComponent } from '../components/builders/pagination-buttons-builder/pagination-buttons-builder.component';

const CATALOG_CONFIG = {
  ENDPOINTS: { PRODUCT_DETAIL_BASE: '/shop/products' },
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
export class CatalogComponent implements OnInit {
  readonly config = CATALOG_CONFIG;

  products = signal<any[]>([]);
  categories = signal<any[]>([]);
  totalItems = signal(0);
  totalPages = signal(1);
  isLoading = signal(false);
  showFilters = signal(false);

  // Inicializace filtrů tak, aby neposílaly "null" jako řetězec
  filters: any = {
    page: 1,
    per_page: 15,
    search: '',
    category_id: '', // Prázdný string je pro Laravel lepší než null
    sort_by: 'created_at',
    sort_direction: 'desc'
  };

  constructor(private shopService: ShopPublicService) {}

  ngOnInit(): void {
    this.loadInitialData();
  }

  loadInitialData(): void {
    // 1. Načtení kategorií
    this.shopService.getCategories().subscribe({
      next: (res) => this.categories.set(res.data || res),
      error: (err) => console.error('Chyba kategorií:', err)
    });

    // 2. Načtení produktů
    this.loadProducts();
  }

  loadProducts(): void {
    this.isLoading.set(true);

    // Očištění filtrů před odesláním (odstraní prázdné hodnoty)
    const activeFilters = Object.keys(this.filters)
      .filter(key => this.filters[key] !== '' && this.filters[key] !== null)
      .reduce((obj: any, key) => {
        obj[key] = this.filters[key];
        return obj;
      }, {});

    this.shopService.getProducts(activeFilters).subscribe({
      next: (response) => {
        this.products.set(response.data || []);
        this.totalItems.set(response.total || 0);
        this.totalPages.set(response.last_page || 1);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Chyba produktů:', err);
        this.isLoading.set(false);
        this.products.set([]); // Reset při chybě
      }
    });
  }

  toggleFilters(): void {
    this.showFilters.update(v => !v);
  }

  // Tato metoda se volá při změně jakéhokoliv filtru v HTML
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