/**
 * @file auth.guard.ts
 * @path src/app/core/auth/guards/auth.guard.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Route guard responsible for enforcing authentication and granular permission-based access control.
 * @dependencies
 * - AuthService: Used to verify the current authentication session status.
 * - PermissionService: Used to validate specific user permissions for protected routes.
 * - Router: Used to handle navigation redirects for unauthorized users.
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
        
        const requiredPermission = route.data['permission'] as string;
        if (requiredPermission) {
          if (this.permissionService.hasPermission(requiredPermission)) {
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
}