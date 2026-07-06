/**
 * @file shop-maintenance.guard.ts
 * @path src/app/shop/guards/shop-maintenance.guard.ts
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Authentication-level guard that intercepts shop-related routes to verify if the e-shop is currently active or in maintenance mode.
 * @dependencies
 * - inject: Angular function for dependency injection in functional guards.
 * - Router: Enables redirection to the maintenance page.
 * - PublicDataService: Fetches the current operational status of the e-shop from the API.
 * - RxJS operators: For handling the asynchronous status response.
 */

import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { PublicDataService } from '../../../../shared/services/public-data.service';
import { map, catchError, of } from 'rxjs';

/**
 * @description Functional route guard ensuring users cannot access shop pages during maintenance periods.
 * @usage Applied to routes within the shop module to redirect traffic to the maintenance page when the system is inactive.
 * @note Implements a fail-safe strategy: if the API request fails, the user is granted access to prevent UI blocking during service outages.
 */
export const shopMaintenanceGuard = () => {
  const dataService = inject(PublicDataService);
  const router = inject(Router);

  // 1. Avoid infinite redirection loops by bypassing the guard if the user is already on the maintenance page
  if (router.url.includes('/shop-maintenance')) {
    return true; 
  }

  // 2. Validate shop activity status against the public API
  return dataService.getShopStatus().pipe(
    map(res => {
      // If the shop is inactive, redirect the user to the dedicated maintenance page
      if (!res.is_shop_active) {
        return router.parseUrl('/shop-maintenance');
      }
      return true;
    }),
    // 3. Fallback: If API communication fails, default to 'true' to ensure availability for the end user
    catchError(() => of(true))
  );
};