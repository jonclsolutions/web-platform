import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { PublicDataService } from '../../../../shared/services/public-data.service';
import { map, catchError, of } from 'rxjs';

export const shopMaintenanceGuard = () => {
  const dataService = inject(PublicDataService);
  const router = inject(Router);

  // 1. ZÁKLADNÍ POJISTKA: Pokud uživatel je na maintenance, nic nekontroluj
  if (router.url.includes('/shop-maintenance')) {
    return true; 
  }

  return dataService.getShopStatus().pipe(
    map(res => {
      // 2. Pokud je údržba, pošli ho na stránku údržby
      if (!res.is_shop_active) {
        return router.parseUrl('/shop-maintenance');
      }
      return true;
    }),
    catchError(() => of(true)) // Při chybě API raději pustit dál
  );
};