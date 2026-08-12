/**
 * @file web-maintenance.component.ts
 * @path src/app/public/web-pages/web-maintenance/web-maintenance.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Mirror of ShopMaintenanceComponent - shown when the public web is in
 * maintenance mode, polls status and redirects back to /home once active again.
 * @refactor-note (2026-08) Vylepšený vzhled - `loadSiteSettings = true` přidáno (stejný
 * princip jako ShopMaintenanceComponent), zobrazuje sociální ikony a kontaktní údaje.
 */

import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { takeUntil } from 'rxjs/operators';
import { BasePublicComponent } from '../../base-public.component';

@Component({
  selector: 'app-web-maintenance',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './web-maintenance.component.html',
  styleUrl: './web-maintenance.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WebMaintenanceComponent extends BasePublicComponent {
  protected readonly translationKey = 'web_maintenance';
  protected override readonly loadSiteSettings = true;
  private router = inject(Router);

  protected override onInit() {
    this.checkStatusAndRedirect();
  }

  /**
   * @description Queries the backend for web status; if active, forces navigation home.
   */
  checkStatusAndRedirect() {
    this.publicDataService.getWebStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.is_web_active) {
            this.router.navigate(['/home']);
          }
        },
        error: (err) => {
          console.error('Error checking web status during maintenance:', err);
        }
      });
  }
}