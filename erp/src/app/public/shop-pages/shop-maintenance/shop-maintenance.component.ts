/**
 * @file shop-maintenance.component.ts
 * @path src/app/public/shop-pages/shop-maintenance/shop-maintenance.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Maintenance page of the e-shop - the shared page of BaseMaintenanceComponent
 * (same look and language dropdown as the web one) with a link back to the web; returns to the
 * catalogue once the e-shop is active.
 * @dependencies
 * - BaseMaintenanceComponent: template, languages, status check.
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Observable, map } from 'rxjs';
import { BaseMaintenanceComponent } from '../../shared/maintenance/base-maintenance.component';

@Component({
  selector: 'app-shop-maintenance',
  standalone: true,
  imports: [RouterLink, UpperCasePipe],
  templateUrl: '../../shared/maintenance/maintenance-page.component.html',
  styleUrls: ['../../shared-styles/maintenance.css', './shop-maintenance.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShopMaintenanceComponent extends BaseMaintenanceComponent {
  protected readonly translationKey = 'shop_maintenance';
  protected override readonly translationModule = 'shop';
  protected readonly activeUrl = '/shop/catalog';
  override readonly homeLink = '/home';

  /** @description E-shop status of the API. */
  protected isSectionActive(): Observable<boolean> {
    return this.publicDataService.getShopStatus().pipe(map(res => !!res?.is_shop_active));
  }
}
