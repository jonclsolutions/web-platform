/**
 * @file web-maintenance.component.spec.ts
 * @path src/app/public/web-pages/web-maintenance/web-maintenance.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of WebMaintenanceComponent and webMaintenanceGuard: the maintenance page sends
 *   the visitor home as soon as the web is active again (status error only logged) and shows the
 *   contacts; the guard redirects to the maintenance page while the web is off, lets everything
 *   through on errors and never blocks the maintenance page itself.
 * @refactor-note (2026-10-23) The old spec had no router providers (NG0201 ActivatedRoute) -
 *   rewritten with createPublicPageContext.
 * @dependencies
 * - createPublicPageContext (status endpoint spies), Router spied.
 */

import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';

import { WebMaintenanceComponent } from './web-maintenance.component';
import { webMaintenanceGuard } from '../components/guards/web-maintenance.guard';
import { PublicPageContext, createPublicPageContext } from '../../../../testing/public-test-helpers';

describe('WebMaintenanceComponent', () => {
  let ctx: PublicPageContext;
  let router: Router;

  beforeEach(() => {
    ctx = createPublicPageContext({ settings: { settings: { contact_email: 'help@x.cz', contact_phone: '777' }, social_links: [{ url: 'https://fb', icon_path: 'fb.svg', name: 'FB' }] } });
    TestBed.configureTestingModule({ imports: [WebMaintenanceComponent], providers: ctx.providers });
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  /**
   * @description Active web → redirect home; inactive → stays and shows contacts; error → logged.
   * @input is_web_active true; false; error.
   * @output navigate(['/home']); no navigation + 'help@x.cz' rendered; console.error.
   */
  it('redirects home once the web is active again', () => {
    TestBed.createComponent(WebMaintenanceComponent).detectChanges();
    expect(router.navigate).toHaveBeenCalledWith(['/home']);

    (router.navigate as jasmine.Spy).calls.reset();
    ctx.publicData.getWebStatus.and.returnValue(of({ is_web_active: false }));
    const fixture = TestBed.createComponent(WebMaintenanceComponent);
    fixture.detectChanges();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('help@x.cz');

    spyOn(console, 'error');
    ctx.publicData.getWebStatus.and.returnValue(throwError(() => new Error('down')));
    fixture.componentInstance.checkStatusAndRedirect();
    expect(console.error).toHaveBeenCalled();
  });

  /**
   * @description Guard: maintenance URL passes immediately; web off → UrlTree '/web-maintenance';
   *   web on → true; status error → true (a broken status endpoint must not lock the site).
   * @input router.url '/web-maintenance'; '/' with off / on / error.
   * @output true (no request); UrlTree; true; true.
   */
  it('guards the web by its maintenance status', () => {
    const run = () => TestBed.runInInjectionContext(() => webMaintenanceGuard());
    const value = (result: any) => { let v: any; (result as Observable<any>).subscribe(r => (v = r)); return v; };
    const url = spyOnProperty(router, 'url', 'get').and.returnValue('/web-maintenance');
    expect(run()).toBeTrue();
    expect(ctx.publicData.getWebStatus).not.toHaveBeenCalled();

    url.and.returnValue('/');
    ctx.publicData.getWebStatus.and.returnValue(of({ is_web_active: false }));
    const tree = value(run());
    expect(tree instanceof UrlTree).toBeTrue();
    expect(router.serializeUrl(tree)).toBe('/web-maintenance');

    ctx.publicData.getWebStatus.and.returnValue(of({ is_web_active: true }));
    expect(value(run())).toBeTrue();
    ctx.publicData.getWebStatus.and.returnValue(throwError(() => new Error('x')));
    expect(value(run())).toBeTrue();
  });
});
