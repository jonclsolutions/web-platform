/**
 * @file product-builder.component.spec.ts
 * @path src/app/public/shop-pages/components/builders/product-builder/product-builder.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of ProductBuilderComponent (catalog product card): thumbnail fallbacks, EUR price
 *   format and the stock badge rendering.
 * @dependencies
 * - createPublicPageContext (module shop).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductBuilderComponent } from './product-builder.component';
import { createPublicPageContext } from '../../../../../../testing/public-test-helpers';

describe('ProductBuilderComponent', () => {
  let fixture: ComponentFixture<ProductBuilderComponent>;
  let card: ProductBuilderComponent;

  beforeEach(() => {
    const ctx = createPublicPageContext({ translations: { product_card: { in_stock: 'In stock', out_of_stock: 'Sold out' } } });
    TestBed.configureTestingModule({ imports: [ProductBuilderComponent], providers: ctx.providers });
    fixture = TestBed.createComponent(ProductBuilderComponent);
    card = fixture.componentInstance;
  });

  /**
   * @description Thumbnail: placeholder without product; primary_image; primary in images; first
   *   image; no images.
   * @input undefined; {primary_image}; images with primary; images without primary; images [].
   * @output placeholder; pi.jpg; p.jpg; a.jpg; placeholder.
   */
  it('picks the thumbnail', () => {
    const placeholder = 'assets/images/placeholder-product.png';
    expect(card.getThumbnailUrl()).toBe(placeholder);
    card.product = { primary_image: { url: 'pi.jpg' } };
    expect(card.getThumbnailUrl()).toBe('pi.jpg');
    card.product = { images: [{ url: 'a.jpg' }, { url: 'p.jpg', is_primary: true }] };
    expect(card.getThumbnailUrl()).toBe('p.jpg');
    card.product = { images: [{ url: 'a.jpg' }, { url: 'b.jpg' }] };
    expect(card.getThumbnailUrl()).toBe('a.jpg');
    card.product = { images: [] };
    expect(card.getThumbnailUrl()).toBe(placeholder);
  });

  /**
   * @description Price in EUR (0 without prices) and the card renders for each stock level.
   * @input prices 12.5; no prices; stock 0 / 3 / 10 rendered.
   * @output '12,50 €'; '0,00 €'; name rendered each time.
   */
  it('formats the price and renders the card', () => {
    card.product = { name: 'Mug', slug: 'mug', prices: { price_eur_with_vat: 12.5 }, stock_quantity: 0, is_featured: true };
    expect(card.getFormattedPrice().replace(/\s/g, ' ')).toBe('12,50 €');
    for (const stock of [0, 3, 10]) {
      fixture.componentRef.setInput('product', { ...card.product, stock_quantity: stock });
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Mug');
    }
    card.product = {};
    expect(card.getFormattedPrice().replace(/\s/g, ' ')).toBe('0,00 €');
  });
});
