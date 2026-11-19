/**
 * @file project-portal-session.resolver.spec.ts
 * @path src/app/apps/project-portal/public/project-portal-session.resolver.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of projectPortalSessionResolver: a valid session gives the project, no
 *   session (or the one-time `access` link) redirects to the login of the project keeping
 *   `access` and the section (`?section=` or the section of the address), maintenance (503)
 *   leaves the navigation to the maintenance page.
 * @dependencies portal.testing (PublicDataService stub); TestBed.runInInjectionContext.
 */

import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RedirectCommand, Router, RouterStateSnapshot, UrlTree, convertToParamMap } from '@angular/router';
import { Observable, isObservable } from 'rxjs';
import { projectPortalSessionResolver } from './project-portal-session.resolver';
import { failWith, setUpPortal } from './portal.testing';

describe('projectPortalSessionResolver', () => {
  /** Snapshot of /projects/tok/<child>?<query>. */
  const snapshot = (child: string | null, query: Record<string, string> = {}) => ({
    paramMap: convertToParamMap({ token: 'tok' }),
    queryParamMap: convertToParamMap(query),
    firstChild: child ? { routeConfig: { path: child } } : null,
  } as unknown as ActivatedRouteSnapshot);

  /** Runs the resolver and returns what it gave (synchronous stubs). */
  function resolve(route: ActivatedRouteSnapshot): unknown {
    let value: unknown = 'nothing';
    const result = TestBed.runInInjectionContext(() => projectPortalSessionResolver(route, {} as RouterStateSnapshot));
    if (isObservable(result)) (result as Observable<unknown>).subscribe(v => (value = v)); else value = result;
    return value;
  }
  /** URL of a redirect command. */
  const target = (value: unknown) => TestBed.inject(Router).serializeUrl((value as RedirectCommand).redirectTo as UrlTree);

  /**
   * @description Valid session → the project; 401 → login with the section of the address
   *   (not for the overview); `?section=` wins; `?access=` → login at once with it; 503 → nothing.
   * @input /projects/tok/files (200); 401 on files / overview / ?section=approvals; ?access=abc; 503.
   * @output project 'Web'; /projects/login/tok?section=files; /projects/login/tok;
   *   ?section=approvals; ?access=abc&section=threads without a request; no value, the
   *   maintenance page opens.
   */
  it('gives the project or redirects to the login', () => {
    const ctx = setUpPortal({ start: false });
    expect((resolve(snapshot('files')) as any).name).toBe('Web');

    ctx.replies['/tok'] = failWith(401);
    expect(target(resolve(snapshot('files')))).toBe('/projects/login/tok?section=files');
    expect(target(resolve(snapshot('overview')))).toBe('/projects/login/tok');
    expect(target(resolve(snapshot('files', { section: 'approvals' })))).toBe('/projects/login/tok?section=approvals');

    ctx.get.calls.reset();
    expect(target(resolve(snapshot('threads', { access: 'abc' })))).toBe('/projects/login/tok?access=abc&section=threads');
    expect(ctx.get).not.toHaveBeenCalled();

    ctx.replies['/tok'] = failWith(503);
    expect(resolve(snapshot('files'))).toBe('nothing');
    expect(ctx.navigate).toHaveBeenCalledWith(['/projects/maintenance'], jasmine.anything());
  });
});
