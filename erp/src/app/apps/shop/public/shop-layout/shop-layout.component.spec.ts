/**
 * @file shop-layout.component.spec.ts
 * @path src/app/apps/shop/public/shop-layout/shop-layout.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of ShopLayoutComponent: the shop shell renders header, router outlet,
 *   footer and the cookie bar, and starts the analytics of the domain (consent-driven).
 * @dependencies
 * - createPublicPageContext.
 */

import { TestBed, discardPeriodicTasks, fakeAsync } from '@angular/core/testing';
import { of } from 'rxjs';

import { ShopLayoutComponent } from './shop-layout.component';
import { createPublicPageContext } from '../../../../../testing/public-test-helpers';
import { AnalyticsService } from '../../../../shared/services/analytics.service';

describe('ShopLayoutComponent', () => {
  /**
   * @description Header, outlet, footer and the cookie bar are part of the layout; the analytics
   *   of the domain is started once (it loads GA only with a Measurement ID and the consent).
   * @input detectChanges().
   * @output app-shop-header, router-outlet, app-shop-footer, app-cookie-consent present;
   *   AnalyticsService.init() called once.
   */
  it('renders header, outlet and footer', fakeAsync(() => {
    const ctx = createPublicPageContext({ translations: {} });
    ctx.publicData.get.and.callFake(((url: string) => of(url === 'public/legal/config' ? { settings: {}, social_links: [] } : [])) as any);
    TestBed.configureTestingModule({ imports: [ShopLayoutComponent], providers: ctx.providers });
    const init = spyOn(TestBed.inject(AnalyticsService), 'init');
    const fixture = TestBed.createComponent(ShopLayoutComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-shop-header')).not.toBeNull();
    expect(el.querySelector('router-outlet')).not.toBeNull();
    expect(el.querySelector('app-shop-footer')).not.toBeNull();
    expect(el.querySelector('app-cookie-consent')).not.toBeNull();
    expect(init).toHaveBeenCalledTimes(1);
    fixture.destroy();
    discardPeriodicTasks();
  }));
});
