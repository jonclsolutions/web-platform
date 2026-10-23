/**
 * @file catalog.component.spec.ts
 * @path src/app/public/shop-pages/catalog/catalog.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of CatalogComponent: categories and the first product page on start, only
 *   non-empty filters sent, filter changes reset to page 1, paging, filter panel toggle and
 *   error handling of both requests.
 * @dependencies
 * - createPublicPageContext; ShopPublicService spy.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { CatalogComponent } from './catalog.component';
import { ShopPublicService } from '../components/services/public-data.service';
import { createPublicPageContext } from '../../../../testing/public-test-helpers';

describe('CatalogComponent', () => {
  let fixture: ComponentFixture<CatalogComponent>;
  let page: CatalogComponent;
  let shop: jasmine.SpyObj<ShopPublicService>;
  const products = { data: [{ id: 1, name: 'Mug', slug: 'mug', stock_quantity: 3, prices: { price_eur_with_vat: 10 }, images: [] }], total: 31, last_page: 3 };

  /** Creates the page with the given service answers. */
  function create(categories: any = of({ data: [{ id: 1, name: 'Cups' }] }), list: any = of(products)): void {
    shop = jasmine.createSpyObj('ShopPublicService', ['getCategories', 'getProducts']);
    shop.getCategories.and.returnValue(categories);
    shop.getProducts.and.returnValue(list);
    const ctx = createPublicPageContext({ translations: { catalog: {}, product_card: {} } });
    TestBed.configureTestingModule({ imports: [CatalogComponent], providers: [...ctx.providers, { provide: ShopPublicService, useValue: shop }] });
    fixture = TestBed.createComponent(CatalogComponent);
    page = fixture.componentInstance;
    fixture.detectChanges();
  }

  /**
   * @description Start: categories (paginated or plain list) and page 1 with default sorting;
   *   empty filters are not sent; product cards rendered.
   * @input Default answers.
   * @output categories [Cups]; getProducts({page 1, per_page 15, sort_by, sort_direction}); total 31, pages 3; 'Mug' rendered.
   */
  it('loads categories and the first page', () => {
    create();
    expect(page.categories()).toEqual([{ id: 1, name: 'Cups' }]);
    expect(shop.getProducts).toHaveBeenCalledWith({ page: 1, per_page: 15, sort_by: 'created_at', sort_direction: 'desc' });
    expect([page.totalItems(), page.totalPages(), page.isLoading()]).toEqual([31, 3, false]);
    expect(fixture.nativeElement.textContent).toContain('Mug');
  });

  /**
   * @description Filters reset to page 1; paging keeps them; filter panel toggles.
   * @input onPageChange(3); search 'mug' + applyFilters(); toggleFilters() ×2.
   * @output page 3 request; {page 1, search 'mug', …}; true → false.
   */
  it('filters and pages the products', () => {
    create(of([{ id: 2 }]), of({}));
    expect(page.categories()).toEqual([{ id: 2 }]);
    expect([page.products(), page.totalItems(), page.totalPages()]).toEqual([[], 0, 1]);
    page.onPageChange(3);
    expect(shop.getProducts.calls.mostRecent().args[0].page).toBe(3);
    page.filters.search = 'mug';
    page.applyFilters();
    expect(shop.getProducts.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ page: 1, search: 'mug' }));
    page.toggleFilters();
    expect(page.showFilters()).toBeTrue();
    page.toggleFilters();
    expect(page.showFilters()).toBeFalse();
  });

  /**
   * @description Request errors are logged; the product list becomes empty and loading stops.
   * @input Both requests failing.
   * @output console.error ×2; products []; isLoading false.
   */
  it('handles failing requests', () => {
    spyOn(console, 'error');
    create(throwError(() => new Error('x')), throwError(() => new Error('y')));
    expect(console.error).toHaveBeenCalledTimes(2);
    expect(page.products()).toEqual([]);
    expect(page.isLoading()).toBeFalse();
  });
});
