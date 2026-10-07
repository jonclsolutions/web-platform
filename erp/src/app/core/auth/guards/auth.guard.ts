/**
 * @file auth.guard.ts
 * @path src/app/core/auth/guards/auth.guard.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Route guard enforcing authentication and permission-based access control for
 * the whole admin area, including every child page of a guarded layout route. A denied user is
 * told so and redirected to a page they are allowed to open.
 * @dependencies
 * - AuthService: Verifies the session and resolves the user's role.
 * - PermissionService: Tells whether the user holds a permission key.
 * - Router: Builds the redirects and reports when a navigation has settled.
 * - AlertDialogService: Shows the "insufficient permissions" message.
 * - AdminLocalizationService: Translated texts of that message (`shared.access_denied_*`).
 */

import { Injectable, inject } from '@angular/core';
import {
  ActivatedRouteSnapshot, CanActivate, CanActivateChild, NavigationCancel, NavigationCancellationCode,
  NavigationEnd, NavigationError, NavigationSkipped, Route, Router, RouterStateSnapshot, UrlTree
} from '@angular/router';
import { Observable, of } from 'rxjs';
import { filter, map, startWith, switchMap, take, timeout } from 'rxjs/operators';
import { AuthService } from '../auth.service';
import { PermissionService } from '../services/permission.service';
import { AlertDialogService } from '../../services/alert-dialog.service';
import { AdminLocalizationService } from '../../services/admin-localization.service';

/**
 * Role that bypasses every permission check. Must match `CheckPermission::SYSADMIN_ROLE_NAME`
 * on the backend. Exported so `sysadminGuard` uses the same value instead of its own literal.
 */
export const SYSADMIN_ROLE_NAME = 'sysadmin';

/** Where an unauthenticated visitor is sent. */
const LOGIN_URL = '/auth/login';

/**
 * Page a user is sent to after being denied access to another page. CHANGE THIS ONE LINE to
 * redirect elsewhere. If the user may not open this page either, the guard falls back to the
 * first page they can open (see `findAccessibleUrl()`), so no value here can cause a redirect loop.
 */
const ACCESS_DENIED_URL = '/admin/core/welcome-page';

/** Key in a route's `data` holding the required permission, e.g. `data: { permission: 'x-view' }`. */
const PERMISSION_DATA_KEY = 'permission';

/** Translation paths of the "insufficient permissions" dialog (admin i18n, section `shared`). */
const ACCESS_DENIED_TITLE_KEY = 'shared.access_denied_title';
const ACCESS_DENIED_MESSAGE_KEY = 'shared.access_denied_message';

/** Longest wait for the admin translations before the dialog is shown with whatever is available. */
const TRANSLATIONS_WAIT_MS = 3000;

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

  private alertDialogService = inject(AlertDialogService);
  private i18n = inject(AdminLocalizationService);

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
  ): Observable<boolean | UrlTree> {
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
  ): boolean | UrlTree {
    return this.authorize(childRoute, state.url);
  }

  /**
   * @description Single exit for every refused navigation in the admin: informs the user and
   * decides where they end up instead.
   * @param route Snapshot of the route that was refused.
   * @returns A UrlTree to `ACCESS_DENIED_URL` (or, when the user may not open it, to the first
   *   page they can open); false (navigation cancelled) when the user can open no page at all.
   * @note The dialog is skipped in exactly one case: the refused page is the admin's ENTRY page
   * (the dashboard the application opens by itself right after login) and there is another page
   * to send the user to. They did not ask for that page themselves, so a "no permission" message
   * after every login would only confuse, e.g. a shop-only role.
   */
  public denyAccess(route: ActivatedRouteSnapshot): UrlTree | false {
    const fallbackUrl = this.findAccessibleUrl(route);

    if (!fallbackUrl || !this.isDefaultLanding(route)) {
      this.notifyAccessDenied();
    }

    return fallbackUrl ? this.router.createUrlTree([fallbackUrl]) : false;
  }

  /**
   * @description Permission check shared by both guard hooks.
   * @param route Snapshot of the route to check.
   * @param url Requested URL, used only for the console warning.
   * @returns True when the route needs no permission or the user holds it; otherwise the result
   *   of `denyAccess()`.
   */
  private authorize(route: ActivatedRouteSnapshot, url: string): boolean | UrlTree {
    const required = route.data[PERMISSION_DATA_KEY] as string | undefined;
    if (this.isAllowed(required)) {
      return true;
    }

    console.warn(`AuthGuard: Access to '${url}' denied. Missing permission: '${required}'.`);
    return this.denyAccess(route);
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
   * @description Shows the "insufficient permissions" dialog once the navigation has settled,
   * i.e. on top of the page the user actually ends up on, and once its texts are available.
   * @note Waiting matters on a full page load (URL typed into the address bar): the guard runs
   * before the admin layout exists and before the translations are loaded. The cancellation that
   * merely announces the redirect is skipped; the dialog opens when the redirected navigation
   * ends, when the navigation was rejected without a redirect, or when the router skips the
   * redirect because the user already is on the target page (e.g. a refused link clicked on the
   * welcome page).
   */
  private notifyAccessDenied(): void {
    this.router.events.pipe(
      filter(event =>
        event instanceof NavigationEnd ||
        event instanceof NavigationSkipped ||
        event instanceof NavigationError ||
        (event instanceof NavigationCancel && event.code !== NavigationCancellationCode.Redirect)
      ),
      take(1),
      switchMap(() => this.accessDeniedTexts())
    ).subscribe(([title, message]) => this.alertDialogService.open(title, message, 'warning'));
  }

  /**
   * @description Resolves the title and message of the dialog, waiting for the admin translations
   * when they are not loaded yet.
   * @returns Emits once: the translated pair as soon as it is available; after
   *   `TRANSLATIONS_WAIT_MS` whatever the localization service returns at that moment, so a key
   *   that is really missing from the JSON stays visible as a placeholder instead of the dialog
   *   silently never appearing.
   * @note "Not loaded yet" is recognised by both lookups returning the SAME text: the service
   * answers every unknown path with one placeholder, whereas a real title and message differ.
   * The lookup is repeated on each `translations$` emission, which is how the service announces
   * that a language file has been loaded.
   */
  private accessDeniedTexts(): Observable<[string, string]> {
    const read = (): [string, string] => [
      this.i18n.getValue(ACCESS_DENIED_TITLE_KEY),
      this.i18n.getValue(ACCESS_DENIED_MESSAGE_KEY),
    ];

    return this.i18n.translations$.pipe(
      startWith(null),
      map(read),
      filter(([title, message]) => title !== message),
      take(1),
      timeout({ first: TRANSLATIONS_WAIT_MS, with: () => of(read()) })
    );
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
   * @description Finds where to send a user who may not open the requested page:
   * `ACCESS_DENIED_URL` when they may open it, otherwise the first page they are allowed to open,
   * looked up in the route configuration itself.
   * @param denied Snapshot of the route that was refused.
   * @returns Absolute URL of an accessible page, or null when the user can open no page at all.
   * @note The automatic search starts in the refused page's own section (its parent route) and
   * widens to the ancestors, so a user refused in Core lands on another Core page before a Web or
   * Shop one. Every candidate, including `ACCESS_DENIED_URL`, is verified with the SAME check that
   * just refused the request, so the redirect can never bounce back and loop, and no list of
   * landing pages per role has to be maintained here.
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

    const preferred = ACCESS_DENIED_URL.split('/').filter(Boolean);
    const preferredIsAccessible = anchors.some(({ base, routes }) =>
      base.length <= preferred.length &&
      base.every((segment, index) => segment === preferred[index]) &&
      this.isPathAccessible(routes, preferred.slice(base.length))
    );
    if (preferredIsAccessible) {
      return ACCESS_DENIED_URL;
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
   * @returns False for redirects, wildcard and parameterised paths (no concrete URL), for routes
   *   with guards of their own (`canActivate` / `canMatch`, e.g. the sysadmin-only page, whose
   *   outcome cannot be evaluated here) and for routes whose own permission the user lacks.
   */
  private isCandidate(route: Route): boolean {
    const path = route.path;
    if (path === undefined || route.redirectTo !== undefined || path === '**' || path.includes(':')) return false;
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

  /**
   * @description Tells whether one concrete page of a route table may be opened by the user.
   * @param routes Route configuration the path is relative to.
   * @param segments Path of the page split into URL segments.
   * @returns True when the path leads to a page and every route on the way is a candidate.
   */
  private isPathAccessible(routes: Route[], segments: string[]): boolean {
    return routes.some(route => {
      if (!this.isCandidate(route)) return false;

      const own = route.path!.split('/').filter(Boolean);
      if (own.length > segments.length || own.some((part, index) => part !== segments[index])) return false;

      const rest = segments.slice(own.length);
      return rest.length === 0
        ? !!(route.component || route.loadComponent)
        : this.isPathAccessible(route.children ?? [], rest);
    });
  }
}