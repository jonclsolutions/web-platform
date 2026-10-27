/**
 * @file auth.guard.ts
 * @path src/app/core/auth/guards/auth.guard.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Route guard enforcing authentication and permission-based access control for
 * the whole admin area, including every child page of a guarded layout route. A user refused a
 * page is sent to the 403 page of the admin (`/admin/forbidden`).
 * @dependencies
 * - AuthService: Verifies the session and resolves the user's role.
 * - PermissionService: Tells whether the user holds a permission key.
 * - Router: Builds the redirects.
 * @refactor-note (2026-10-27) Admin 403 page: a refused page no longer shows the "Access denied"
 *   dialog over a fallback page - the user lands on `/admin/forbidden` (AdminErrorPageComponent),
 *   which names the refused address (passed in the navigation state, not in the URL). Only the
 *   automatic entry page after login (`/admin` → welcome page) still redirects silently to the
 *   first page the user may open, so a role without the welcome page does not see a 403 after
 *   every login. The error pages themselves are never chosen as a fallback target.
 */

import { Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot, CanActivate, CanActivateChild, RedirectCommand, Route, Router, RouterStateSnapshot, UrlTree
} from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AuthService } from '../auth.service';
import { PermissionService } from '../services/permission.service';

/**
 * Role that bypasses every permission check. Must match `CheckPermission::SYSADMIN_ROLE_NAME`
 * on the backend. Exported so `sysadminGuard` uses the same value instead of its own literal.
 */
export const SYSADMIN_ROLE_NAME = 'sysadmin';

/** Where an unauthenticated visitor is sent. */
const LOGIN_URL = '/auth/login';

/** URL of the admin 403 page (AdminErrorPageComponent, needs no permission - cannot loop). */
export const ADMIN_FORBIDDEN_URL = '/admin/forbidden';

/** Navigation state key carrying the refused address to the 403 page. */
export const DENIED_URL_STATE_KEY = 'deniedUrl';

/** Route data key marking an admin error page (404 / 403) - never used as a fallback target. */
export const ADMIN_ERROR_PAGE_KEY = 'adminErrorPage';

/** Key in a route's `data` holding the required permission, e.g. `data: { permission: 'x-view' }`. */
const PERMISSION_DATA_KEY = 'permission';

/**
 * @description Security barrier of the admin routes.
 * @usage Put it on a layout route TWICE:
 *   `canActivate: [AuthGuard], canActivateChild: [AuthGuard]`.
 * `canActivate` verifies the session when the layout is entered; `canActivateChild` checks the
 * `data.permission` of every page below it, on every navigation. Adding a page therefore only
 * needs a route with `data: { permission: '...' }`; nothing has to be registered in this guard.
 * A permission on a GROUP route (e.g. the whole `shop` section) protects all pages inside it.
 * Another guard with its own rule (see `sysadminGuard`) reports a refusal through `denyAccess()`,
 * so every denial in the admin looks and behaves the same.
 * @note `canActivate` alone is NOT enough for child pages: it receives the layout's own route
 * (which carries no permission) and does not run again while the layout stays active.
 * This guard only decides what the UI shows. The API enforces every permission again.
 */
@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate, CanActivateChild {

  constructor(
    private authService: AuthService,
    private router: Router,
    private permissionService: PermissionService
  ) {}

  /**
   * @description Decides whether the guarded route itself may be entered.
   * @param route Snapshot of the route being activated.
   * @param state Router state of the navigation.
   * @returns True when allowed; a UrlTree to the login page for an unauthenticated visitor;
   *   otherwise the result of the permission check (see `authorize()`).
   */
  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree | RedirectCommand> {
    return this.authService.checkAuth().pipe(
      take(1),
      map(isLoggedIn => isLoggedIn ? this.authorize(route, state.url) : this.router.createUrlTree([LOGIN_URL]))
    );
  }

  /**
   * @description Decides whether a page below the guarded route may be entered. Runs for every
   * level of the child path (group route and page) on every navigation.
   * @param childRoute Snapshot of the child route being activated.
   * @param state Router state of the navigation.
   * @returns True when allowed, otherwise the result of the permission check (see `authorize()`).
   * @note Synchronous on purpose: the session was already verified by `canActivate` of the same
   * layout route, which the router always completes first.
   */
  canActivateChild(
    childRoute: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean | UrlTree | RedirectCommand {
    return this.authorize(childRoute, state.url);
  }

  /**
   * @description Single exit for every refused navigation in the admin: decides where the user
   * ends up instead.
   * @param route Snapshot of the route that was refused.
   * @param url Refused URL (default: built from the route snapshot).
   * @returns The 403 page (`ADMIN_FORBIDDEN_URL`) with the refused address in the navigation
   *   state; for the admin's ENTRY page (opened by the application itself right after login) a
   *   silent redirect to the first page the user may open, when there is one.
   * @note The 403 page is a page of its own instead of a dialog over another page: the user sees
   * at once that the page exists but is closed to them, and Back returns to where they came from.
   * The 403 route needs no permission, so the redirect can never loop.
   */
  public denyAccess(route: ActivatedRouteSnapshot, url?: string): UrlTree | RedirectCommand {
    if (this.isDefaultLanding(route)) {
      const fallbackUrl = this.findAccessibleUrl(route);
      if (fallbackUrl) {
        return this.router.createUrlTree([fallbackUrl]);
      }
    }

    const deniedUrl = url ?? '/' + route.pathFromRoot.flatMap(snapshot => snapshot.url.map(segment => segment.path)).join('/');
    return new RedirectCommand(this.router.createUrlTree([ADMIN_FORBIDDEN_URL]), { state: { [DENIED_URL_STATE_KEY]: deniedUrl } });
  }

  /**
   * @description Permission check shared by both guard hooks.
   * @param route Snapshot of the route to check.
   * @param url Requested URL, used only for the console warning.
   * @returns True when the route needs no permission or the user holds it; otherwise the result
   *   of `denyAccess()`.
   */
  private authorize(route: ActivatedRouteSnapshot, url: string): boolean | UrlTree | RedirectCommand {
    const required = route.data[PERMISSION_DATA_KEY] as string | undefined;
    if (this.isAllowed(required)) {
      return true;
    }

    console.warn(`AuthGuard: Access to '${url}' denied. Missing permission: '${required}'.`);
    return this.denyAccess(route, url);
  }

  /**
   * @description Evaluates a permission requirement for the current user.
   * @param permission One permission key, several separated by `|` (any of them is enough, same
   *   syntax as the `*appHasPermission` directive and the backend middleware), or nothing.
   * @returns True when no permission is required, the user is a sysadmin, or holds one of the keys.
   */
  private isAllowed(permission: string | undefined): boolean {
    if (!permission) return true;
    if (this.authService.getUserRole() === SYSADMIN_ROLE_NAME) return true;
    return permission.split('|').some(key => this.permissionService.hasPermission(key.trim()));
  }

  /**
   * @description Tells whether the refused route is the ENTRY page of the admin: the target of
   * the outermost `path: ''` redirect above it (`/admin` -> `core/dashboard`), which is what the
   * application opens by itself after login.
   * @param denied Snapshot of the route that was refused.
   * @returns True only for that entry page. The default page of a section (`/admin/shop` ->
   *   `dashboard`) does not count: the user chose that section themselves.
   */
  private isDefaultLanding(denied: ActivatedRouteSnapshot): boolean {
    const chain = denied.pathFromRoot;
    const entryRedirect = (snapshot: ActivatedRouteSnapshot) =>
      snapshot.routeConfig?.children?.find(route => route.path === '' && typeof route.redirectTo === 'string')?.redirectTo;

    const index = chain.findIndex(snapshot => entryRedirect(snapshot) !== undefined);
    if (index === -1) return false;

    const relativePath = chain.slice(index + 1).flatMap(snapshot => snapshot.url.map(segment => segment.path)).join('/');
    return relativePath === entryRedirect(chain[index]);
  }

  /**
   * @description Finds the first page the user is allowed to open, looked up in the route
   * configuration itself (used when the automatic entry page of the admin is refused).
   * @param denied Snapshot of the route that was refused.
   * @returns Absolute URL of an accessible page, or null when the user can open no page at all.
   * @note The automatic search starts in the refused page's own section (its parent route) and
   * widens to the ancestors, so a user refused in Core lands on another Core page before a Web or
   * Shop one. Every candidate is verified with the SAME check that
   * just refused the request, so the redirect can never bounce back and loop, and no list of
   * landing pages per role has to be maintained here.
   * @refactor-note (2026-10-27) The preferred target (the core welcome page) was removed: the
   * search runs only when that very page (the entry page) was refused, so it could never be chosen.
   */
  private findAccessibleUrl(denied: ActivatedRouteSnapshot): string | null {
    // Ancestors that own a route table, nearest first, each with the URL segments leading to it.
    const anchors: { base: string[]; routes: Route[] }[] = [];
    for (let anchor = denied.parent; anchor; anchor = anchor.parent) {
      const routes = anchor.routeConfig?.children;
      if (routes) {
        anchors.push({ base: anchor.pathFromRoot.flatMap(snapshot => snapshot.url.map(segment => segment.path)), routes });
      }
    }

    for (const { base, routes } of anchors) {
      const path = this.findAccessiblePath(routes);
      if (path !== null) {
        return '/' + [...base, path].filter(Boolean).join('/');
      }
    }
    return null;
  }

  /**
   * @description Tells whether a route may be considered as a redirect target at all.
   * @param route Route configuration entry.
   * @returns False for redirects, wildcard and parameterised paths (no concrete URL), the admin
   *   error pages (404 / 403 are no destination of their own), for routes
   *   with guards of their own (`canActivate` / `canMatch`, e.g. the sysadmin-only page, whose
   *   outcome cannot be evaluated here) and for routes whose own permission the user lacks.
   */
  private isCandidate(route: Route): boolean {
    const path = route.path;
    if (path === undefined || route.redirectTo !== undefined || path === '**' || path.includes(':')) return false;
    if (route.data?.[ADMIN_ERROR_PAGE_KEY]) return false;
    if (route.canActivate?.length || route.canMatch?.length) return false;
    return this.isAllowed(route.data?.[PERMISSION_DATA_KEY]);
  }

  /**
   * @description Depth-first search of a route table for the first page the user may open.
   * @param routes Route configuration to search, in declaration order.
   * @returns Path of the page relative to the searched table, or null when none is accessible.
   * @note A route that is not a candidate is skipped together with everything below it, exactly
   * as the guard would refuse it.
   */
  private findAccessiblePath(routes: Route[]): string | null {
    for (const route of routes) {
      if (!this.isCandidate(route)) continue;

      if (route.component || route.loadComponent) {
        return route.path!;
      }

      const childPath = this.findAccessiblePath(route.children ?? []);
      if (childPath !== null) {
        return [route.path, childPath].filter(Boolean).join('/');
      }
    }
    return null;
  }
}
