/**
 * @file auth.guard.ts
 * @path src/app/core/auth/guards/auth.guard.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Route guard responsible for enforcing authentication and granular permission-based access control.
 * @dependencies
 * - AuthService: Used to verify the current authentication session status and resolve the user's role.
 * - PermissionService: Used to validate specific user permissions for protected routes.
 * - Router: Used to handle navigation redirects for unauthorized users.
 * @refactor-note (2026-08-6) GRANULARIZACE PERMISSION SYSTÉMU (viz api.php,
 *      has-permission.directive.ts a base-data.component.ts stejné datum): opraveny
 *      dva nesrovnalosti, které vyšly najevo až s příchodem OR syntaxe u `edit-legal`/
 *      `web-settings` routy (`core-legal-documents-view|core-legal-config-view`):
 *      1) Guard dřív volal `permissionService.hasPermission(requiredPermission)`
 *         s CELÝM řetězcem `route.data['permission']` bez rozdělení na `|` - u
 *         jednoho klíče to fungovalo náhodou (žádný `|` v řetězci), ale u OR klíče by
 *         to hledalo v poli permissions doslovný string s pipe uvnitř, což tam nikdy
 *         nebude - route by byla nedostupná ÚPLNĚ VŠEM, sysadmina nevyjímaje. Opraveno
 *         stejným `split('|').some(...)` vzorem jako *appHasPermission direktiva.
 *      2) Guard NEOBCHÁZEL kontrolu pro roli `sysadmin` (na rozdíl od backendového
 *         `CheckPermission` middlewaru, který sysadmin bezpodmínečně bypassuje - viz
 *         CheckPermission.php). Dosud to fungovalo jen náhodou, protože sysadmin role
 *         má v DB přiřazené všechny permissions; nová permission nepřiřazená ručně
 *         sysadmin roli by frontend guard zablokoval, i když by ji backend API
 *         propustil. Doplněn stejný bypass jako v sysadminGuard (authService.getUserRole()
 *         === 'sysadmin'), ať se frontend chová konzistentně s backendem - backend
 *         zůstává zdrojem pravdy, tohle je jen UX pojistka proti false-negative
 *         zablokování nejvyšší role kvůli chybějícímu ručnímu přiřazení permission.
 */

import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AuthService } from '../auth.service';
import { PermissionService } from '../services/permission.service';

/**
 * @description Guard that acts as a security barrier for administrative routes.
 * @usage Applied in application routing configuration to protect routes based on login state and required permissions.
 * @note Implements a dual-layer check: first for session validity, and second for role-based permission requirements defined in route data.
 */
@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  /**
   * @description Role name that bypasses every permission check unconditionally - viz
   * refactor-note (2026-08-6) v hlavičce souboru. Musí sedět s hodnotou použitou v
   * `sysadminGuard` a s `CheckPermission::SYSADMIN_ROLE_NAME` na backendu.
   */
  private static readonly SYSADMIN_ROLE_NAME = 'sysadmin';

  constructor(
    private authService: AuthService, 
    private router: Router,
    private permissionService: PermissionService
  ) {}

  /**
   * @description Determines if a route can be activated.
   * @param route The snapshot of the route being accessed.
   * @param state The router state snapshot.
   * @returns {Observable<boolean | UrlTree>} True if allowed, otherwise a UrlTree for redirection.
   * @note If the user is unauthenticated, they are redirected to login. If authenticated but lacking permissions, they are redirected to the dashboard.
   */
  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> {
    return this.authService.checkAuth().pipe(
      take(1),
      map(isLoggedIn => {
        if (!isLoggedIn) {
          return this.router.createUrlTree(['/auth/login']);
        }

        if (this.authService.getUserRole() === AuthGuard.SYSADMIN_ROLE_NAME) {
          return true;
        }

        const requiredPermission = route.data['permission'] as string;
        if (requiredPermission) {
          if (this.hasAnyPermission(requiredPermission)) {
            return true;
          } else {
            console.warn(`AuthGuard: Access denied. Missing permission: '${requiredPermission}'.`);
            return this.router.createUrlTree(['/admin/dashboard']);
          }
        }
        
        return true;
      })
    );
  }

  /**
   * @description Checks whether the current user holds any of the given permission key(s).
   * Supports OR syntax ('klic1|klic2'), same as the *appHasPermission directive and the
   * backend CheckPermission middleware.
   * @param permission One permission key, or several separated by '|'.
   */
  private hasAnyPermission(permission: string): boolean {
    return permission.split('|').some(p => this.permissionService.hasPermission(p));
  }
}