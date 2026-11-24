/**
 * @file portal-maintenance.ts
 * @path src/app/apps/project-portal/public/maintenance/portal-maintenance.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Maintenance of the public project portal on the frontend (the API switch is
 *   `project-portal/maintenance`, the public answer `project-portal/public/status`):
 *   - `projectPortalMaintenanceGuard` - the client portal and the order form open the maintenance
 *     page while the portal is off (the address to return to goes along);
 *   - `leaveOnMaintenance()` - a 503 of any portal request (switched off while the page is open)
 *     opens the maintenance page as well.
 * @note Fail-safe like the web / e-shop guards: a failed status request lets the visitor in (the
 *   API itself still refuses with 503).
 * @dependencies PublicDataService (getFresh), Router.
 */

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { MonoTypeOperatorFunction, catchError, map, of, tap } from 'rxjs';
import { PublicDataService } from '../../../../shared/services/public-data.service';
import { stripLanguagePrefix } from '../../../../shared/utils/language-url';

/** Address of the maintenance page of the portal. */
export const PORTAL_MAINTENANCE_URL = '/projects/maintenance';

/** Public status of the portal (GET project-portal/public/status). */
export interface PortalStatus {
  is_portal_active: boolean;
  maintenance_message: string | null;
}

/** Endpoint of the public status. */
export const PORTAL_STATUS_ENDPOINT = 'project-portal/public/status';

/**
 * @description Opens the maintenance page instead of a portal page while the portal is off.
 * @returns true, or the URL tree of the maintenance page with `?return=<requested address>`.
 */
export const projectPortalMaintenanceGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  return inject(PublicDataService).getFresh<PortalStatus>(PORTAL_STATUS_ENDPOINT).pipe(
    map(res => res?.is_portal_active === false
      ? router.createUrlTree([PORTAL_MAINTENANCE_URL], { queryParams: { return: state.url } })
      : true),
    catchError(() => of(true)),
  );
};

/**
 * @description Operator of the portal requests: a 503 (the portal was switched off) opens the
 *   maintenance page with the current address to return to; the error still reaches the caller.
 * @param router Router of the page.
 */
export function leaveOnMaintenance<T>(router: Router): MonoTypeOperatorFunction<T> {
  return tap<T>({
    error: (err: any) => {
      // Router.url carries the language (`/cs/projects/…`); the return address keeps it.
      if (err?.status === 503 && !stripLanguagePrefix(router.url).startsWith(PORTAL_MAINTENANCE_URL)) {
        router.navigate([PORTAL_MAINTENANCE_URL], { queryParams: { return: router.url } });
      }
    },
  });
}
