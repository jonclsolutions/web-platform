/**
 * @file shop-maintenance.component.spec.ts
 * @path src/app/public/shop-pages/shop-maintenance/shop-maintenance.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of ShopMaintenanceComponent and shopMaintenanceGuard: the maintenance page goes
 *   to the catalog once the shop is active (errors logged) and shows the contacts with a valid
 *   tel: link (bugfix 2026-10-23); the guard sends visitors to the maintenance page while the shop
 *   is off, lets everything through on errors and never blocks the maintenance page itself.
 * @dependencies
 * - createPublicPageContext (status spies); Router spied.
 */

import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';

import { ShopMaintenanceComponent } from './shop-maintenance.component';
import { shopMaintenanceGuard } from '../components/guards/shop-maintenance.guard';
import { PublicPageContext, createPublicPageContext } from '../../../../testing/public-test-helpers';

describe('ShopMaintenanceComponent', () => {
  let ctx: PublicPageContext;
  let router: Router;

  beforeEach(() => {
    ctx = createPublicPageContext({ settings: { settings: { contact_email: 'shop@x.cz', contact_phone: '+420 777 123 456' }, social_links: [] } });
    TestBed.configureTestingModule({ imports: [ShopMaintenanceComponent], providers: ctx.providers });
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  /**
   * @description Active shop → catalog; inactive → contacts with tel: link without spaces;
   *   error → logged.
   * @input is_shop_active true; false; error.
   * @output navigate(['/shop/catalog']); 'tel:+420777123456'; console.error.
   */
  it('redirects to the catalog once the shop is active', () => {
    TestBed.createComponent(ShopMaintenanceComponent).detectChanges();
    expect(router.navigate).toHaveBeenCalledWith(['/shop/catalog']);
    expect(ctx.localization.setModule).toHaveBeenCalledWith('shop');

    (router.navigate as jasmine.Spy).calls.reset();
    ctx.publicData.getShopStatus.and.returnValue(of({ is_shop_active: false }));
    const fixture = TestBed.createComponent(ShopMaintenanceComponent);
    fixture.detectChanges();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('shop@x.cz');
    expect(fixture.nativeElement.querySelector('a[href^="tel:"]').getAttribute('href')).toBe('tel:+420777123456');

    spyOn(console, 'error');
    ctx.publicData.getShopStatus.and.returnValue(throwError(() => new Error('down')));
    fixture.componentInstance.checkStatusAndRedirect();
    expect(console.error).toHaveBeenCalled();
  });

  /**
   * @description Guard: maintenance URL passes; shop off → UrlTree '/shop-maintenance'; on →
   *   true; status error → true.
   * @input router.url '/shop-maintenance'; '/shop' with off / on / error.
   * @output true (no request); UrlTree; true; true.
   */
  it('guards the shop by its maintenance status', () => {
    const run = () => TestBed.runInInjectionContext(() => shopMaintenanceGuard());
    const value = (result: any) => { let v: any; (result as Observable<any>).subscribe(r => (v = r)); return v; };
    const url = spyOnProperty(router, 'url', 'get').and.returnValue('/shop-maintenance');
    expect(run()).toBeTrue();
    expect(ctx.publicData.getShopStatus).not.toHaveBeenCalled();

    url.and.returnValue('/shop');
    ctx.publicData.getShopStatus.and.returnValue(of({ is_shop_active: false }));
    const tree = value(run());
    expect(tree instanceof UrlTree).toBeTrue();
    expect(router.serializeUrl(tree)).toBe('/shop-maintenance');
    ctx.publicData.getShopStatus.and.returnValue(of({ is_shop_active: true }));
    expect(value(run())).toBeTrue();
    ctx.publicData.getShopStatus.and.returnValue(throwError(() => new Error('x')));
    expect(value(run())).toBeTrue();
  });
});
