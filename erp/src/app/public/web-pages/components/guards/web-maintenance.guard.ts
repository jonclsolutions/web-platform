/**
 * @file web-maintenance.guard.ts
 * @path src/app/public/web-pages/components/guards/web-maintenance.guard.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Authentication-level guard that intercepts public web routes to verify if
 * the public web is currently active or in maintenance mode. Mirror of
 * shopMaintenanceGuard, but applied ONCE via canActivateChild on the top-level web layout
 * route (app.routes.ts) instead of duplicated per-child route - blocks the entire public
 * web at once, by design (see task requirement: "blokovat celý web").
 * @dependencies
 * - inject: Angular function for dependency injection in functional guards.
 * - Router: Enables redirection to the maintenance page.
 * - PublicDataService: Fetches the current operational status of the web from the API.
 * - RxJS operators: For handling the asynchronous status response.
 */

import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { map, catchError, of } from 'rxjs';
import { PublicDataService } from '../../../../shared/services/public-data.service';
/**
 * @description Functional route guard ensuring visitors cannot access the public web
 * during maintenance periods.
 * @usage Applied as `canActivateChild` on the root '' route in app.routes.ts.
 * @note Implements a fail-safe strategy: if the API request fails, the user is granted
 * access to prevent the whole public web going dark during a transient outage.
 */
export const webMaintenanceGuard = () => {
  const dataService = inject(PublicDataService);
  const router = inject(Router);

  // Avoid infinite redirection loops by bypassing the guard if already on the maintenance page.
  if (router.url.includes('/web-maintenance')) {
    return true;
  }

  return dataService.getWebStatus().pipe(
    map(res => {
      if (!res.is_web_active) {
        return router.parseUrl('/web-maintenance');
      }
      return true;
    }),
    catchError(() => of(true))
  );
};