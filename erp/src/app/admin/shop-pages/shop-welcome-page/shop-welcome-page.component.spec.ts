/**
 * @file shop-welcome-page.component.spec.ts
 * @path src/app/admin/shop-pages/shop-welcome-page/shop-welcome-page.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of ShopWelcomePageComponent – the landing page of the E-shop module:
 *   translated texts and quick-link cards shown only for the pages the user may open.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (i18n stub returning key paths, permission stub)
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShopWelcomePageComponent } from './shop-welcome-page.component';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('ShopWelcomePageComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<ShopWelcomePageComponent>;
  let component: ShopWelcomePageComponent;

  const setup = async (granted: string[] | 'all') => {
    ctx = createAdminTestContext({ granted });
    await TestBed.configureTestingModule({ imports: [ShopWelcomePageComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(ShopWelcomePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  const cardLinks = (): string[] =>
    Array.from(fixture.nativeElement.querySelectorAll('a.wp-link-card')).map((a: any) => a.getAttribute('href'));

  /**
   * @description Texts come from the 'shop-welcome-page' i18n section.
   * @input  t('card_orders_title'); strings section
   * @output 'shop-welcome-page.card_orders_title'; getMergedSection('shop-welcome-page')
   */
  it('reads texts from the shop-welcome-page section', async () => {
    await setup('all');
    expect(component.t('card_orders_title')).toBe('shop-welcome-page.card_orders_title');
    expect(component.strings.header).toBe('shop-welcome-page.header');
    expect(ctx.i18n.getMergedSection).toHaveBeenCalledWith('shop-welcome-page');
  });

  /**
   * @description With all permissions all 10 cards are shown, in menu order.
   * @input  granted 'all'
   * @output 10 links, first '/admin/shop/products', last '/admin/shop/logs'
   */
  it('shows every card to a user with all permissions', async () => {
    await setup('all');
    const links = cardLinks();
    expect(links.length).toBe(10);
    expect(links[0]).toBe('/admin/shop/products');
    expect(links[9]).toBe('/admin/shop/logs');
  });

  /**
   * @description Cards are gated by the same permission keys as the left menu.
   * @input  granted ['shop-orders-view', 'shop-coupons-view']
   * @output only '/admin/shop/orders' and '/admin/shop/coupons'
   */
  it('shows only the cards the user may open', async () => {
    await setup(['shop-orders-view', 'shop-coupons-view']);
    expect(cardLinks()).toEqual(['/admin/shop/orders', '/admin/shop/coupons']);
  });

  /**
   * @description Each card renders its translated title and description.
   * @input  granted ['shop-view-logs']
   * @output card text contains 'shop-welcome-page.card_logs_title' and '…card_logs_desc'
   */
  it('renders title and description of a card', async () => {
    await setup(['shop-view-logs']);
    const text = fixture.nativeElement.querySelector('a.wp-link-card').textContent;
    expect(text).toContain('shop-welcome-page.card_logs_title');
    expect(text).toContain('shop-welcome-page.card_logs_desc');
  });
});
