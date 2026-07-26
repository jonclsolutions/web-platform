/**
 * @file sysadmin.guard.ts
 * @path src/app/core/auth/guards/sysadmin.guard.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Route guard restricting access to a route strictly to the 'sysadmin' role.
 *              Unlike the rest of the app (permission-key based, see HasPermissionDirective),
 *              this check is intentionally hardcoded against the role name itself - the role
 *              management page must stay visible/usable only to sysadmin regardless of which
 *              permissions get assigned to other roles in the future.
 * @dependencies
 * - AuthService: Provides the current user's primary role name.
 */

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth.service';

export const sysadminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.getUserRole() === 'sysadmin') {
    return true;
  }

  router.navigate(['/admin/dashboard']);
  return false;
};