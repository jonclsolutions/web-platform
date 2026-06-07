import { Component, ChangeDetectionStrategy, inject, OnDestroy } from '@angular/core';

import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';

// Import tvého Core namespace
import * as Core from '../../../shared/imports/core-providers';

// Importy specifické pro tuto komponentu
import { UserLogin } from '../../../shared/interfaces/user';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import { LoadingService } from '../../../core/services/loading.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent extends BaseDataComponent<UserLogin> implements Core.OnInit, OnDestroy {
  
  public override loadingService = inject(LoadingService);
  
  override apiEndpoint = 'core/users';
  userData: UserLogin | null = null;

  // 🔐 Vlastnosti tahající data přímo z Auth systému bez čekání na API
  userEmail: string | null = null;
  userRole: string | null = null;
  private emailSubscription: Subscription | undefined;

  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: Core.ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService, 
  ) {
    super(dataHandler, cd, genericTableService);
  }

  override ngOnInit(): void {
    super.ngOnInit();

    // 1. Získáme roli ihned
    this.userRole = this.authService.getUserRole();

    // 2. Přihlásíme se k odběru e-mailu ihned (stejně jako admin-layout)
    this.emailSubscription = this.authService.userEmail$.subscribe(email => {
      this.userEmail = email;
      this.cd.markForCheck();
    });

    // 3. Spustíme HTTP volání z API pro zbytek dat (např. full_name)
    this.loadUserProfile();
  }

  private loadUserProfile(): void {
    const userId = this.authService.getUserId();
    if (!userId) return;

    if (this.loadingService.isLoadingSnapshot) return;

    this.getItemDetails(parseInt(userId, 10))
      .subscribe({
        next: (response: any) => {
          // Laravel Resource obal
          this.userData = response.data ? response.data : response;
          this.cd.markForCheck();
        },
        error: (err) => {
          this.errorMessage = 'Nepodařilo se načíst detailní profil.';
          this.cd.markForCheck();
          console.error('Dashboard Error:', err);
        }
      });
  }

  get welcomeMessage(): string {
    return this.userEmail ? `Vítejte zpět, ${this.userEmail}!` : 'Vítejte v systému!';
  }

  override ngOnDestroy(): void {
    if (this.emailSubscription) {
      this.emailSubscription.unsubscribe();
    }
  }
}