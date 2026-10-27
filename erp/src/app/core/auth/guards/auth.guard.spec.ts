/**
 * @file auth.guard.spec.ts
 * @path src/app/core/auth/guards/auth.guard.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of AuthGuard and sysadminGuard: login check, permission keys
 *   ('a|b' = OR, sysadmin bypass), a refused page → the admin 403 page with the refused address in
 *   the navigation state (2026-10-27), the silent redirect of the refused ENTRY page to the first
 *   accessible page (sibling / group / ancestor; redirects, '**', ':param', guarded and error-page
 *   routes skipped), 403 when nothing is accessible.
 * @dependencies
 * - Router stub (createUrlTree returning the joined URL), AuthService / PermissionService stubs.
 */

import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RedirectCommand, Route, Router, RouterStateSnapshot, UrlSegment } from '@angular/router';
import { Component } from '@angular/core';
import { of } from 'rxjs';

import { AuthGuard } from './auth.guard';
import { sysadminGuard } from './sysadmin.guard';
import { AuthService } from '../auth.service';
import { PermissionService } from '../services/permission.service';
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

/**
 * @description Expected 403 result: redirect to /admin/forbidden with the refused address.
 * @param result Guard result.
 * @param deniedUrl Refused address.
 */
function expectForbidden(result: unknown, deniedUrl: string): void {
  expect(result instanceof RedirectCommand).withContext('RedirectCommand').toBeTrue();
  const command = result as RedirectCommand;
  expect(command.redirectTo).toEqual({ url: '/admin/forbidden' } as any);
  expect(command.navigationBehaviorOptions?.state).toEqual({ deniedUrl });
}

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let auth: AuthStub;
  let perms: PermissionStub;

  /** Children of /admin/core: redirect, welcome page, users, param route, guarded route, error
   *  page, route without page and children, group. */
  const coreChildren: Route[] = [
    { path: '', redirectTo: 'welcome-page', pathMatch: 'full' },
    { path: 'welcome-page', component: PageComponent, data: { permission: 'welcome' } },
    { path: 'users', component: PageComponent, data: { permission: 'users' } },
    { path: ':id', component: PageComponent },
    { path: 'guarded', component: PageComponent, canActivate: [() => true] },
    { path: 'redirect', redirectTo: 'users' },
    { path: 'oops', component: PageComponent, data: { adminErrorPage: 'forbidden' } },
    { path: 'empty' },
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
    spyOn(console, 'warn');

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: PermissionService, useValue: perms },
        { provide: Router, useValue: { createUrlTree: (commands: string[]) => ({ url: commands.join('/') }) } }
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
   *   passes without permissions, a missing key is denied with a console warning and the admin
   *   403 page (even when another page would be accessible - the page exists, it is closed).
   * @input Required 'users | list' with 'list' granted; 'users' as sysadmin; 'users' as admin
   *   with 'list' granted, URL '/admin/core/users?tab=2'.
   * @output true; true; RedirectCommand to /admin/forbidden, state deniedUrl '/admin/core/users?tab=2';
   *   warning naming the URL and the key.
   */
  it('evaluates OR permission keys and the sysadmin bypass', () => {
    perms.granted = new Set(['list']);
    expect(guard.canActivateChild(leafSnap('users', 'users | list'), state('/x'))).toBeTrue();

    auth.session.role = 'sysadmin';
    expect(guard.canActivateChild(leafSnap('users', 'users'), state('/x'))).toBeTrue();

    auth.session.role = 'admin';
    expectForbidden(guard.canActivateChild(leafSnap('users', 'users'), state('/admin/core/users?tab=2')), '/admin/core/users?tab=2');
    expect(console.warn).toHaveBeenCalledWith("AuthGuard: Access to '/admin/core/users?tab=2' denied. Missing permission: 'users'.");
  });

  /**
   * @description The refused ENTRY page (target of the '' redirect, opened automatically after
   *   login) redirects silently to the first accessible page: sibling (redirects, '**', ':param',
   *   guarded and error-page routes skipped; groups searched), then an ancestor; nothing
   *   accessible → the 403 page with the address built from the route.
   * @input Entry 'welcome-page' refused; granted {list}; {dash}; nothing.
   * @output '/admin/core/group/list'; '/admin/dash'; 403 with deniedUrl '/admin/core/welcome-page'.
   */
  it('redirects a refused entry page to the first accessible page', () => {
    const denied = () => guard.denyAccess(leafSnap('welcome-page', 'welcome'));

    perms.granted = new Set(['list']);
    expect(denied()).toEqual({ url: '/admin/core/group/list' } as any);
    perms.granted = new Set(['dash']);
    expect(denied()).toEqual({ url: '/admin/dash' } as any);
    perms.granted = new Set();
    expectForbidden(denied(), '/admin/core/welcome-page');
  });

  /**
   * @description A route chain without any '' redirect is never treated as an entry page.
   * @input Denied leaf 'x' directly under a root without redirect children; 'dash'-like grants irrelevant.
   * @output 403 with deniedUrl '/x'.
   */
  it('treats routes without an entry redirect as normal pages', () => {
    const root = snap(null, '', null);
    const leaf = snap({ path: 'x', component: PageComponent }, 'x', root, { permission: 'x' });
    expectForbidden(guard.denyAccess(leaf), '/x');
  });

  /**
   * @description sysadminGuard: sysadmin passes, anyone else gets AuthGuard.denyAccess with the URL.
   * @input role sysadmin; role admin with 'welcome' granted, URL '/admin/core/users'.
   * @output true; 403 with deniedUrl '/admin/core/users'.
   */
  it('sysadminGuard allows only the sysadmin role', () => {
    const run = () => TestBed.runInInjectionContext(() => sysadminGuard(leafSnap('users'), state('/admin/core/users')));
    auth.session.role = 'sysadmin';
    expect(run()).toBeTrue();
    auth.session.role = 'admin';
    perms.granted = new Set(['welcome']);
    expectForbidden(run(), '/admin/core/users');
  });
});
