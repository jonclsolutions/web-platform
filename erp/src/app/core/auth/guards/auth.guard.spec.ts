/**
 * @file auth.guard.spec.ts
 * @path src/app/core/auth/guards/auth.guard.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of AuthGuard and sysadminGuard: login check, permission keys
 *   ('a|b' = OR, sysadmin bypass), the fallback redirect when access is denied (preferred welcome
 *   page, first accessible sibling / ancestor route, nothing → false) and the access-denied
 *   toast (only after the navigation settled, waits for translations, 3 s fallback, silent on the
 *   default landing page).
 * @dependencies
 * - Router stub (events Subject + createUrlTree returning the joined URL), AuthService /
 *   PermissionService stubs, AlertDialogService spy, AdminLocalizationService stub with a
 *   controllable translations$ stream.
 */

import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot, NavigationCancel, NavigationCancellationCode, NavigationEnd, NavigationSkipped,
  NavigationSkippedCode, Route, Router, RouterStateSnapshot, UrlSegment
} from '@angular/router';
import { Component } from '@angular/core';
import { BehaviorSubject, Subject, of } from 'rxjs';

import { AuthGuard } from './auth.guard';
import { sysadminGuard } from './sysadmin.guard';
import { AuthService } from '../auth.service';
import { PermissionService } from '../services/permission.service';
import { AlertDialogService } from '../../services/alert-dialog.service';
import { AdminLocalizationService } from '../../services/admin-localization.service';
import { AuthStub, PermissionStub, createAuthStub, createPermissionStub } from '../../../../testing/admin-test-helpers';

/** Dummy routed component. */
@Component({ standalone: true, template: '' })
class PageComponent {}

/**
 * @description Builds a fake ActivatedRouteSnapshot chain node.
 * @param routeConfig Route config of the node (null for the root).
 * @param path URL path of the node ('' = no segment).
 * @param parent Parent node.
 * @param data Route data.
 * @returns Snapshot-like object with parent / pathFromRoot / url / data.
 */
function snap(routeConfig: Route | null, path: string, parent: ActivatedRouteSnapshot | null, data: Record<string, any> = {}): ActivatedRouteSnapshot {
  const node: any = {
    routeConfig,
    parent,
    data,
    url: path ? path.split('/').map(p => new UrlSegment(p, {})) : []
  };
  node.pathFromRoot = parent ? [...parent.pathFromRoot, node] : [node];
  return node as ActivatedRouteSnapshot;
}

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let auth: AuthStub;
  let perms: PermissionStub;
  let events: Subject<any>;
  let alert: jasmine.SpyObj<AlertDialogService>;
  let translations$: BehaviorSubject<Record<string, any> | null>;
  let texts: Record<string, string> | null;

  /** Children of /admin/core: redirect, welcome page, users, param route, guarded route, group. */
  const coreChildren: Route[] = [
    { path: '', redirectTo: 'welcome-page', pathMatch: 'full' },
    { path: 'welcome-page', component: PageComponent, data: { permission: 'welcome' } },
    { path: 'users', component: PageComponent, data: { permission: 'users' } },
    { path: ':id', component: PageComponent },
    { path: 'guarded', component: PageComponent, canActivate: [() => true] },
    { path: 'redirect', redirectTo: 'users' },
    { path: 'group', children: [{ path: 'list', component: PageComponent, data: { permission: 'list' } }] }
  ];
  const coreRoute: Route = { path: 'core', children: coreChildren };
  const adminChildren: Route[] = [coreRoute, { path: '**', component: PageComponent }, { path: 'dash', loadComponent: () => Promise.resolve(PageComponent), data: { permission: 'dash' } }];
  const adminRoute: Route = { path: 'admin', children: adminChildren };

  /**
   * @description Snapshot of /admin/core/<leaf> with the leaf's data.
   * @param leaf Leaf path.
   * @param permission Required permission of the leaf.
   */
  function leafSnap(leaf: string, permission?: string): ActivatedRouteSnapshot {
    const root = snap({ path: '', children: [adminRoute] } as Route, '', null);
    const admin = snap(adminRoute, 'admin', root);
    const core = snap(coreRoute, 'core', admin);
    const config = coreChildren.find(r => r.path === leaf) ?? { path: leaf, component: PageComponent };
    return snap(config, leaf, core, permission ? { permission } : {});
  }

  const state = (url: string) => ({ url } as RouterStateSnapshot);

  beforeEach(() => {
    auth = createAuthStub();
    perms = createPermissionStub([]);
    events = new Subject<any>();
    alert = jasmine.createSpyObj('AlertDialogService', ['open']);
    texts = null;
    translations$ = new BehaviorSubject<Record<string, any> | null>(null);
    const i18n = {
      translations$,
      getValue: (key: string) => texts?.[key] ?? 'Cannot load text'
    };
    spyOn(console, 'warn');

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: PermissionService, useValue: perms },
        { provide: AlertDialogService, useValue: alert },
        { provide: AdminLocalizationService, useValue: i18n },
        { provide: Router, useValue: { events, createUrlTree: (commands: string[]) => ({ url: commands.join('/') }) } }
      ]
    });
    guard = TestBed.inject(AuthGuard);
  });

  /**
   * @description Not logged in → redirect to the login page; logged in without a required
   *   permission → allowed.
   * @input checkAuth false; checkAuth true with a route without data.permission.
   * @output UrlTree '/auth/login'; true.
   */
  it('redirects anonymous users to the login page and lets logged-in users in', () => {
    let result: any;
    auth.checkAuth.and.returnValue(of(false));
    guard.canActivate(leafSnap('free'), state('/admin/core/free')).subscribe(r => (result = r));
    expect(result).toEqual({ url: '/auth/login' } as any);

    auth.checkAuth.and.returnValue(of(true));
    guard.canActivate(leafSnap('free'), state('/admin/core/free')).subscribe(r => (result = r));
    expect(result).toBeTrue();
  });

  /**
   * @description Permission keys: any key of 'a | b' is enough (spaces trimmed), sysadmin
   *   passes without permissions, a missing key is denied with a console warning.
   * @input Required 'users | list' with 'list' granted; 'users' as sysadmin; 'users' as admin.
   * @output true; true; redirect + warning naming the URL and the key.
   */
  it('evaluates OR permission keys and the sysadmin bypass', () => {
    perms.granted = new Set(['list']);
    expect(guard.canActivateChild(leafSnap('users', 'users | list'), state('/x'))).toBeTrue();

    auth.session.role = 'sysadmin';
    expect(guard.canActivateChild(leafSnap('users', 'users'), state('/x'))).toBeTrue();

    auth.session.role = 'admin';
    expect(guard.canActivateChild(leafSnap('users', 'users'), state('/admin/core/users'))).toEqual({ url: '/admin/core/group/list' } as any);
    expect(console.warn).toHaveBeenCalledWith("AuthGuard: Access to '/admin/core/users' denied. Missing permission: 'users'.");
  });

  /**
   * @description Fallback target: the welcome page when accessible, otherwise the first
   *   accessible sibling (redirects, '**', ':param', guarded routes skipped; groups searched),
   *   otherwise an accessible route of an ancestor, otherwise false.
   * @input Granted {welcome}; {list}; {dash}; nothing.
   * @output '/admin/core/welcome-page'; '/admin/core/group/list'; '/admin/dash'; false.
   */
  it('finds the closest accessible fallback route', () => {
    const denied = () => guard.denyAccess(leafSnap('users', 'users'));

    perms.granted = new Set(['welcome']);
    expect(denied()).toEqual({ url: '/admin/core/welcome-page' } as any);
    perms.granted = new Set(['list']);
    expect(denied()).toEqual({ url: '/admin/core/group/list' } as any);
    perms.granted = new Set(['dash']);
    expect(denied()).toEqual({ url: '/admin/dash' } as any);
    perms.granted = new Set();
    expect(denied()).toBeFalse();
  });

  /**
   * @description The toast is shown after the navigation settles (a redirect-cancel is ignored)
   *   and only once translations are loaded.
   * @input Denied 'users'; NavigationCancel(Redirect); NavigationSkipped; translations arrive.
   * @output No toast before translations; then open(title, message, 'warning') once.
   */
  it('shows the access-denied toast after navigation with loaded texts', fakeAsync(() => {
    perms.granted = new Set(['list']);
    guard.denyAccess(leafSnap('users', 'users'));

    events.next(new NavigationCancel(1, '/x', 'redirect', NavigationCancellationCode.Redirect));
    events.next(new NavigationSkipped(1, '/x', 'same', NavigationSkippedCode.IgnoredSameUrlNavigation));
    expect(alert.open).not.toHaveBeenCalled();

    texts = { 'shared.access_denied_title': 'Denied', 'shared.access_denied_message': 'No access' };
    translations$.next({ loaded: true });
    expect(alert.open).toHaveBeenCalledOnceWith('Denied', 'No access', 'warning');

    events.next(new NavigationEnd(2, '/y', '/y'));
    expect(alert.open).toHaveBeenCalledTimes(1);
  }));

  /**
   * @description Translations that never load → the toast still appears after 3 s with the
   *   fallback texts.
   * @input Denied without fallback (no permission at all); NavigationEnd; 3000 ms.
   * @output Nothing at 2999 ms; open('Cannot load text', 'Cannot load text', 'warning') at 3000 ms.
   */
  it('falls back to the default texts after the translations timeout', fakeAsync(() => {
    expect(guard.denyAccess(leafSnap('users', 'users'))).toBeFalse();
    events.next(new NavigationEnd(1, '/x', '/x'));
    tick(2999);
    expect(alert.open).not.toHaveBeenCalled();
    tick(1);
    expect(alert.open).toHaveBeenCalledOnceWith('Cannot load text', 'Cannot load text', 'warning');
  }));

  /**
   * @description Being redirected away from the section's default landing page (the target of
   *   the '' redirect) is silent when a fallback exists; without a fallback the toast shows.
   * @input Denied 'welcome-page' with 'list' granted; then with nothing granted.
   * @output Redirect + no toast; false + toast.
   */
  it('stays silent when the default landing page is not accessible but a fallback is', fakeAsync(() => {
    texts = { 'shared.access_denied_title': 'T', 'shared.access_denied_message': 'M' };
    perms.granted = new Set(['list']);
    expect(guard.denyAccess(leafSnap('welcome-page', 'welcome'))).toEqual({ url: '/admin/core/group/list' } as any);
    events.next(new NavigationEnd(1, '/x', '/x'));
    expect(alert.open).not.toHaveBeenCalled();

    perms.granted = new Set();
    expect(guard.denyAccess(leafSnap('welcome-page', 'welcome'))).toBeFalse();
    events.next(new NavigationEnd(2, '/x', '/x'));
    expect(alert.open).toHaveBeenCalledOnceWith('T', 'M', 'warning');
  }));

  /**
   * @description A route chain without any '' redirect is never treated as a default landing.
   * @input Denied leaf directly under a root without redirect children; nothing granted.
   * @output false + toast.
   */
  it('treats routes without an entry redirect as normal pages', fakeAsync(() => {
    texts = { 'shared.access_denied_title': 'T', 'shared.access_denied_message': 'M' };
    const root = snap(null, '', null);
    const leaf = snap({ path: 'x', component: PageComponent }, 'x', root, { permission: 'x' });
    expect(guard.denyAccess(leaf)).toBeFalse();
    events.next(new NavigationEnd(1, '/x', '/x'));
    expect(alert.open).toHaveBeenCalledTimes(1);
  }));

  /**
   * @description sysadminGuard: sysadmin passes, anyone else gets AuthGuard.denyAccess.
   * @input role sysadmin; role admin with 'welcome' granted.
   * @output true; redirect to the welcome page.
   */
  it('sysadminGuard allows only the sysadmin role', () => {
    const run = () => TestBed.runInInjectionContext(() => sysadminGuard(leafSnap('users'), state('/admin/core/users')));
    auth.session.role = 'sysadmin';
    expect(run()).toBeTrue();
    auth.session.role = 'admin';
    perms.granted = new Set(['welcome']);
    expect(run()).toEqual({ url: '/admin/core/welcome-page' } as any);
  });
});
