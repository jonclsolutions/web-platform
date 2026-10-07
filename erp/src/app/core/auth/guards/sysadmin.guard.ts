/**
 * @file sysadmin.guard.ts
 * @path src/app/core/auth/guards/sysadmin.guard.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Route guard restricting a route strictly to the 'sysadmin' role. Unlike the rest
 * of the app (permission-key based, see AuthGuard and HasPermissionDirective), this check is
 * intentionally tied to the role name itself: the role management page must stay usable only by
 * a sysadmin, whatever permissions other roles are given in the future.
 * @dependencies
 * - AuthService: Provides the current user's role name.
 * - AuthGuard: Single definition of the sysadmin role name (`SYSADMIN_ROLE_NAME`) and the shared
 *   handling of a refused navigation (`denyAccess()`).
 */

import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthService } from '../auth.service';
import { AuthGuard, SYSADMIN_ROLE_NAME } from './auth.guard';

/**
 * @description Allows the navigation for a sysadmin and refuses everyone else.
 * @usage `canActivate: [sysadminGuard]` on a route that has no `data.permission`.
 * @param route Snapshot of the route being activated.
 * @returns True for a sysadmin; otherwise whatever `AuthGuard.denyAccess()` decides (the
 *   "insufficient permissions" dialog plus a redirect to a page the user may open).
 * @note The refusal is delegated to AuthGuard so it behaves exactly like a missing permission.
 * (The former fixed target `/admin/dashboard` stopped existing when the pages moved under
 * `web/`, `core/` and `shop/`.) The API enforces the same restriction; this guard only keeps the
 * page out of reach in the UI.
 */
export const sysadminGuard: CanActivateFn = (route) => {
  return inject(AuthService).getUserRole() === SYSADMIN_ROLE_NAME
    ? true
    : inject(AuthGuard).denyAccess(route);
};