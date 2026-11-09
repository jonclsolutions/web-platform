/**
 * @file guest.guard.ts
 * @path src/app/core/auth/guards/guest.guard.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Route guard of the login page: a user with a session restorable in this tab - a
 * login with "Remember me" that was not logged out (any tab, also after a browser restart), or a
 * login without it in this same tab - goes straight to the admin instead of logging in again.
 * After a logout, an expired session, a login without "Remember me" in another tab, or without any
 * session the login page is shown and the full login (with 2FA) is required.
 * @dependencies
 * - AuthService: `checkAuth()` - restores the session with one refresh call, only when the session
 *   hint says one may exist (no request otherwise).
 * - Router: the redirect to the admin.
 * @note The guard checks the server-side session only. A password saved in the browser never
 * logs anybody in - it is only filled into the form.
 */

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs/operators';
import { AuthService } from '../auth.service';

/** Where a signed-in user opening the login page is sent (the page after a login). */
export const ADMIN_HOME_URL = '/admin/core/welcome-page';

/**
 * @description Shows the login page only to a visitor without a valid session.
 * @usage `canActivate: [guestGuard]` on the login route.
 * @returns true (show the login page) or a redirect to ADMIN_HOME_URL.
 */
export const guestGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AuthService).checkAuth().pipe(
    take(1),
    map(signedIn => (signedIn ? router.parseUrl(ADMIN_HOME_URL) : true))
  );
};
