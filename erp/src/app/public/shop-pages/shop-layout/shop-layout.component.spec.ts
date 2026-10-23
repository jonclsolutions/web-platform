/**
 * @file shop-layout.component.spec.ts
 * @path src/app/public/shop-pages/shop-layout/shop-layout.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of ShopLayoutComponent: the shop shell renders header, router outlet and footer.
 * @dependencies
 * - createPublicPageContext.
 */

import { TestBed, discardPeriodicTasks, fakeAsync } from '@angular/core/testing';
import { of } from 'rxjs';

import { ShopLayoutComponent } from './shop-layout.component';
import { createPublicPageContext } from '../../../../testing/public-test-helpers';

describe('ShopLayoutComponent', () => {
  /**
   * @description Header, outlet and footer are part of the layout.
   * @input detectChanges().
   * @output app-shop-header, router-outlet, app-shop-footer present.
   */
  it('renders header, outlet and footer', fakeAsync(() => {
    const ctx = createPublicPageContext({ translations: {} });
    ctx.publicData.get.and.callFake(((url: string) => of(url === 'public/legal/config' ? { settings: {}, social_links: [] } : [])) as any);
    TestBed.configureTestingModule({ imports: [ShopLayoutComponent], providers: ctx.providers });
    const fixture = TestBed.createComponent(ShopLayoutComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-shop-header')).not.toBeNull();
    expect(el.querySelector('router-outlet')).not.toBeNull();
    expect(el.querySelector('app-shop-footer')).not.toBeNull();
    fixture.destroy();
    discardPeriodicTasks();
  }));
});
