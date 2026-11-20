/**
 * @file shop-maintenance.component.ts
 * @path src/app/apps/shop/public/shop-maintenance/shop-maintenance.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Maintenance page of the e-shop - the shared page of BaseMaintenanceComponent
 * (the one maintenance look with a language switcher) with a link back to the web; returns to the
 * catalogue once the e-shop is active.
 * @dependencies
 * - BaseMaintenanceComponent: template, languages, status check.
 * - MaintenanceShellComponent: the one maintenance look (shared with the e-shop / web and the project portal).
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BaseMaintenanceComponent } from '../../../../public/shared/maintenance/base-maintenance.component';
import { MaintenanceShellComponent } from '../../../../shared/components/maintenance-shell/maintenance-shell.component';

@Component({
  selector: 'app-shop-maintenance',
  standalone: true,
  imports: [MaintenanceShellComponent],
  templateUrl: '../../../../public/shared/maintenance/maintenance-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShopMaintenanceComponent extends BaseMaintenanceComponent {
  protected readonly translationKey = 'shop_maintenance';
  protected override readonly translationModule = 'shop';
  protected readonly activeUrl = '/shop/catalog';

  /** @description E-shop status of the API. */
  protected isSectionActive(): Observable<boolean> {
    return this.publicDataService.getFresh<{ is_shop_active: boolean }>('shop/public/status').pipe(map(res => !!res?.is_shop_active));
  }
}
