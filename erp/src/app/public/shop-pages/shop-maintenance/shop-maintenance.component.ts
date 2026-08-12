/**
 * @file shop-maintenance.component.ts
 * @path src/app/public/shop-pages/shop-maintenance/shop-maintenance.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @refactor-note (2026-08) Vylepšený vzhled - `loadSiteSettings = true` přidáno, ať
 * komponenta dostane `this.settings`/`this.socialLinks` ze stejné cache jako
 * PublicFooterComponent (žádné nové HTTP volání, jen čtení z BasePublicComponent). Nová
 * šablona zobrazuje sociální ikony a kontaktní údaje (e-mail, telefon), ať návštěvník má
 * i během údržby jak se spojit s firmou.
 */

import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router'; 
import { BasePublicComponent } from '../../base-public.component';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-shop-maintenance',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './shop-maintenance.component.html',
  styleUrl: './shop-maintenance.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShopMaintenanceComponent extends BasePublicComponent {
  protected readonly translationKey = 'shop_maintenance';
  protected override readonly loadSiteSettings = true;
  private router = inject(Router);

  protected override onInit() {
    this.checkStatusAndRedirect();
  }

  /**
   * @description Queries the backend for shop status; if active, forces navigation.
   */
  checkStatusAndRedirect() {
    this.publicDataService.getShopStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.is_shop_active) {
            this.router.navigate(['/shop/catalog']);
          }
        },
        error: (err) => {
          console.error('Error checking shop status during maintenance:', err);
        }
      });
  }
}