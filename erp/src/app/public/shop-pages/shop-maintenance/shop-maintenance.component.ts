/**
 * @file shop-maintenance.component.ts
 * @path src/app/shop/shop-maintenance/shop-maintenance.component.ts
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Presentational component displayed when the e-shop is in maintenance mode. Includes auto-redirection logic to return users to the shop when it comes back online.
 * @dependencies
 * - Router: Used for navigation when the shop status is confirmed as active.
 * - PublicDataService: Used to poll the API for current maintenance status.
 */

import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router'; 
import { PublicDataService } from '../../../shared/services/public-data.service';

/**
 * @description Component shown to users during scheduled shop maintenance.
 * @usage Used as a catch-all view for shop routes when `is_shop_active` is false.
 * @note Performs an initial status check upon initialization to facilitate seamless redirection if maintenance ends while the user is on the page.
 */
@Component({
  selector: 'app-shop-maintenance',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './shop-maintenance.component.html',
  styleUrl: './shop-maintenance.component.css',
})
export class ShopMaintenanceComponent implements OnInit {
  
  private dataService = inject(PublicDataService);
  private router = inject(Router);

  /**
   * @description Lifecycle hook that triggers the status check immediately on component initialization.
   */
  ngOnInit() {
    this.checkStatusAndRedirect();
  }

  /**
   * @description Queries the backend for shop status; if active, forces navigation to the product catalog.
   */
  checkStatusAndRedirect() {
    this.dataService.getShopStatus().subscribe({
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