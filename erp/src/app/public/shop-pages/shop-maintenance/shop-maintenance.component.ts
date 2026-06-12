import { Component, OnInit, inject } from '@angular/core'; // 🟢 Přidán OnInit a inject
import { Router, RouterLink } from '@angular/router'; 
import { PublicDataService } from '../../../shared/services/public-data.service';
@Component({
  selector: 'app-shop-maintenance',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './shop-maintenance.component.html',
  styleUrl: './shop-maintenance.component.css',
})
export class ShopMaintenanceComponent implements OnInit { // 🟢 Implementuj OnInit
  
  // Injekce závislostí
  private dataService = inject(PublicDataService);
  private router = inject(Router);

  ngOnInit() {
    this.checkStatusAndRedirect();
  }

  checkStatusAndRedirect() {
    this.dataService.getShopStatus().subscribe({
      next: (res) => {
        // Pokud je shop aktivní, okamžitě uživatele pošli do katalogu
        if (res.is_shop_active) {
          this.router.navigate(['/shop/catalog']);
        }
      },
      error: (err) => {
        console.error('Chyba při kontrole stavu shopu:', err);
      }
    });
  }
}