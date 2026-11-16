/**
 * @file portal-maintenance.component.spec.ts
 * @path src/app/apps/project-portal/public/maintenance/portal-maintenance.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the maintenance of the public project portal: the guard of the
 *   portal pages, the 503 operator of the portal requests and the maintenance page (text of the
 *   administrator / default text, return only to a portal address once online again).
 * @dependencies createPublicPageContext (PublicDataService stub), ProjectPortalLocalizationService
 *   stub (getValue returns the key), Router (real, spied).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, convertToParamMap } from '@angular/router';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';

import { PortalMaintenanceComponent } from './portal-maintenance.component';
import { leaveOnMaintenance, projectPortalMaintenanceGuard } from './portal-maintenance';
import { ProjectPortalLocalizationService, PROJECT_PORTAL_AVAILABLE_LANGUAGES } from '../project-portal-localization.service';
import { PublicPageContext, createPublicPageContext } from '../../../../../testing/public-test-helpers';

describe('Project portal maintenance', () => {
  let ctx: PublicPageContext;

  /** Configures the module with the status answer and the `return` address. */
  function setup(status: Observable<any>, returnTo: string | null = '/projects/abc'): void {
    ctx = createPublicPageContext();
    ctx.publicData.getFresh.and.returnValue(status);
    TestBed.configureTestingModule({
      imports: [PortalMaintenanceComponent],
      providers: [
        ...ctx.providers,
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(returnTo ? { return: returnTo } : {}) } } },
        { provide: ProjectPortalLocalizationService, useValue: {
          translations$: new BehaviorSubject({}), availableLanguages: PROJECT_PORTAL_AVAILABLE_LANGUAGES,
          getValue: (k: string) => k, getCurrentLanguage: () => 'cz', setLanguage: jasmine.createSpy('setLanguage'),
        } },
      ],
    });
  }

  /** Runs the guard for the address. */
  function guard(url: string): Observable<boolean | UrlTree> {
    return TestBed.runInInjectionContext(() => projectPortalMaintenanceGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot)) as Observable<boolean | UrlTree>;
  }

  /**
   * @description The guard lets the visitor in while the portal is online or the status fails,
   *   and sends him to the maintenance page with the address to return to while it is off.
   * @input online; off; failing status.
   * @output true; UrlTree /projects/maintenance?return=%2Fprojects%2Fabc; true; status from
   *   project-portal/public/status.
   */
  it('guards the portal pages', () => {
    setup(of({ is_portal_active: true, maintenance_message: null }));
    let result: boolean | UrlTree | undefined;
    guard('/projects/abc').subscribe(r => result = r);
    expect(result).toBeTrue();
    expect(ctx.publicData.getFresh).toHaveBeenCalledWith('project-portal/public/status');

    ctx.publicData.getFresh.and.returnValue(of({ is_portal_active: false, maintenance_message: 'x' }));
    guard('/projects/abc').subscribe(r => result = r);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/projects/maintenance?return=%2Fprojects%2Fabc');

    ctx.publicData.getFresh.and.returnValue(throwError(() => new Error('down')));
    guard('/projects/abc').subscribe(r => result = r);
    expect(result).toBeTrue();
  });

  /**
   * @description A 503 of a portal request opens the maintenance page (error still delivered);
   *   other errors do nothing.
   * @input error 503 at /projects/abc; error 404.
   * @output navigate(['/projects/maintenance'], {return: current url}) once; caller got both errors.
   */
  it('leaves for the maintenance page on a 503', () => {
    setup(of({}));
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    const errors: number[] = [];
    throwError(() => ({ status: 503 })).pipe(leaveOnMaintenance(router)).subscribe({ error: e => errors.push(e.status) });
    throwError(() => ({ status: 404 })).pipe(leaveOnMaintenance(router)).subscribe({ error: e => errors.push(e.status) });
    expect(navigate).toHaveBeenCalledOnceWith(['/projects/maintenance'], { queryParams: { return: router.url } });
    expect(errors).toEqual([503, 404]);
  });

  /**
   * @description The page shows the text of the administrator (or the default text) while the
   *   portal is off.
   * @input status off with 'Back at 6 pm'; then without a text.
   * @output title key, 'Back at 6 pm'; 'maintenance_text'.
   */
  it('shows the maintenance text', () => {
    setup(of({ is_portal_active: false, maintenance_message: 'Back at 6 pm' }));
    let fixture: ComponentFixture<PortalMaintenanceComponent> = TestBed.createComponent(PortalMaintenanceComponent);
    fixture.detectChanges();
    const text = () => (fixture.nativeElement as HTMLElement).textContent!;
    expect(text()).toContain('maintenance_title');
    expect(text()).toContain('Back at 6 pm');

    TestBed.resetTestingModule();
    setup(of({ is_portal_active: false, maintenance_message: null }));
    fixture = TestBed.createComponent(PortalMaintenanceComponent);
    fixture.detectChanges();
    expect(text()).toContain('maintenance_text');
  });

  /**
   * @description Online again: back to the portal address of `return`; an outside or unsafe
   *   address is never followed.
   * @input online with return /projects/abc; with //evil.example; with https://evil.example.
   * @output navigateByUrl('/projects/abc'); no navigation twice.
   */
  it('returns only to a portal address', () => {
    setup(of({ is_portal_active: true, maintenance_message: null }));
    let navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    TestBed.createComponent(PortalMaintenanceComponent).detectChanges();
    expect(navigate).toHaveBeenCalledOnceWith('/projects/abc');

    for (const unsafe of ['//evil.example', 'https://evil.example', '/projects/maintenance']) {
      TestBed.resetTestingModule();
      setup(of({ is_portal_active: true, maintenance_message: null }), unsafe);
      navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
      TestBed.createComponent(PortalMaintenanceComponent).detectChanges();
      expect(navigate).not.toHaveBeenCalled();
    }
  });
});
