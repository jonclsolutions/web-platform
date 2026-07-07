/**
 * @file catalog.component.ts
 * @path src/app/public/shop-pages/catalog/catalog.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Manages the public product catalog interface, including category filtering, pagination, and dynamic product listing.
 * @dependencies
 * - ShopPublicService: Handles API communication for fetching products and categories.
 * - ProductBuilderComponent: UI component for rendering individual product cards.
 * - PaginationButtonsBuilderComponent: UI component for navigating through product result pages.
 * - Angular Signals: Used for efficient state management of product data and loading states.
 */

import { Component, OnInit, signal } from '@angular/core';

import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ShopPublicService } from '../components/services/public-data.service';
import { ProductBuilderComponent } from '../components/builders/product-builder/product-builder.component';
import { PaginationButtonsBuilderComponent } from '../components/builders/pagination-buttons-builder/pagination-buttons-builder.component';

/**
 * @description Configuration object for catalog UI labels and routing constants.
 */
const CATALOG_CONFIG = {
  ENDPOINTS: { PRODUCT_DETAIL_BASE: '/shop/products' },
  TEXTS: {
    HEADER: 'Katalog produktů',
    TOTAL_FOUND: 'Celkem nalezeno',
    ITEMS_UNIT: 'položek',
    EMPTY_STATE: 'Nebyly nalezeny žádné produkty odpovídající výběru.'
  }
};

/**
 * @description Component for displaying the public product catalog.
 * @usage Provides a filtered, paginated view of products that users can browse and navigate.
 * @note Implements reactive state using Signals to ensure optimal performance when handling filter updates and pagination.
 */
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

  /**
   * @description Data structure holding current search and filtering criteria.
   * @note Empty strings are preferred over null for compatibility with typical backend query builders like Laravel.
   */
  filters: any = {
    page: 1,
    per_page: 15,
    search: '',
    category_id: '',
    sort_by: 'created_at',
    sort_direction: 'desc'
  };

  constructor(private shopService: ShopPublicService) {}

  ngOnInit(): void {
    this.loadInitialData();
  }

  /**
   * @description Initializes the component by fetching category definitions and the default product list.
   */
  loadInitialData(): void {
    this.shopService.getCategories().subscribe({
      next: (res) => this.categories.set(res.data || res),
      error: (err) => console.error('Chyba kategorií:', err)
    });

    this.loadProducts();
  }

  /**
   * @description Refreshes the product list based on the current state of the filter object.
   * @note Sanitizes the filter payload by removing empty properties before submitting to the API.
   */
  loadProducts(): void {
    this.isLoading.set(true);

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
        this.products.set([]);
      }
    });
  }

  /**
   * @description Toggles the visibility of the filtering sidebar.
   */
  toggleFilters(): void {
    this.showFilters.update(v => !v);
  }

  /**
   * @description Triggers a re-fetch of products when filters are modified; resets page to 1.
   */
  applyFilters(): void {
    this.filters.page = 1;
    this.loadProducts();
  }

  /**
   * @description Handles pagination navigation.
   * @param page The target page number.
   */
  onPageChange(page: number): void {
    this.filters.page = page;
    this.loadProducts();
  }

  /**
   * @description Updates the number of items displayed per page and resets the pagination index.
   * @param amount The number of items per page.
   */
  onItemsPerPageChange(amount: number): void {
    this.filters.per_page = amount;
    this.filters.page = 1;
    this.loadProducts();
  }

  /**
   * @description Constructs the canonical URL for a product detail page.
   * @param slug The unique identifier/slug of the product.
   * @returns Full relative URI for the product.
   */
  getProductUrl(slug: string): string {
    return `${this.config.ENDPOINTS.PRODUCT_DETAIL_BASE}/${slug}`;
  }
}