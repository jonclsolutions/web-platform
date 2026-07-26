/**
 * @file welcome-page.component.ts
 * @path src/app/admin/web-pages/welcome-page/welcome-page.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Uvítací stránka po přihlášení - vidí ji každý uživatel s oprávněním
 *              `web-view-welcome-page` (viz routes). Obsahuje jen nesenzitivní údaje
 *              (jméno, e-mail, role, datum vytvoření účtu) a rychlý odkaz na nahlášení
 *              chyby. Citlivé přehledy (počty uživatelů, tickety, systémové logy) zůstávají
 *              výhradně na Dashboardu, chráněném samostatným `web-view-dashboard` oprávněním.
 * @dependencies
 * - AuthService: Poskytuje roli/e-mail aktuálně přihlášeného uživatele ze session.
 * - DataHandler: Přímé volání GET `core/users/{id}` pro profil - žádný CRUD nad tabulkou
 *   tu nedává smysl, proto se nedědí BaseDataComponent (na rozdíl od Dashboardu, který
 *   pořád potřebuje agregační dotazy nad více zdroji).
 * @note `dataHandler.get()` se používá záměrně místo `dataHandler.getOne()` - endpoint
 *       `core/users/{id}` vrací zdroj NEobalený v `{ data: ... }` (viz UserController::show()),
 *       stejný vzorec, jaký už správně používá Dashboard přes `EntityCrudService.getOne()`.
 */

import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { DataHandler } from '../../../core/services/data-handler.service';
import { UserLogin } from '../../../shared/interfaces/user';
import { NavSection } from './welcome-page.interface';
@Component({
  selector: 'app-welcome-page',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './welcome-page.component.html',
  styleUrl: './welcome-page.component.css',
})
export class WelcomePageComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private dataHandler = inject(DataHandler);
  private cd = inject(ChangeDetectorRef);

  userData: UserLogin | null = null;
  userEmail: string | null = null;
  userRole: string | null = null;

  isLoadingProfile = true;
  errorMessage: string | null = null;

  /** Rychlý odkaz na nahlášení chyby - stejný tvar (NavSection) jako karty na Dashboardu. */
  readonly helpSection: NavSection = {
    title: 'Nahlásit chybu',
    icon: '🐞',
    route: '/admin/intranet/knowledge-base/support-form',
    description: 'Narazili jste na problém nebo máte nápad na zlepšení? Dejte nám vědět.',
    color: 'rose',
  };

  private emailSub?: Subscription;

  ngOnInit(): void {
    this.userRole = this.authService.getUserRole();

    this.emailSub = this.authService.userEmail$.subscribe(email => {
      this.userEmail = email;
      this.cd.markForCheck();
    });

    this.loadUserProfile();
  }

  /**
   * @description Načte profil aktuálně přihlášeného uživatele (jméno, datum vytvoření účtu).
   */
  private loadUserProfile(): void {
    const userId = this.authService.getUserId();
    if (!userId) {
      this.isLoadingProfile = false;
      return;
    }

    this.dataHandler.get<any>(`core/users/${userId}`).subscribe({
      next: (response) => {
        this.userData = response?.data ?? response;
        this.isLoadingProfile = false;
        this.cd.markForCheck();
      },
      error: () => {
        this.errorMessage = 'Nepodařilo se načíst váš profil.';
        this.isLoadingProfile = false;
        this.cd.markForCheck();
      }
    });
  }

  get welcomeMessage(): string {
    const name = this.userData?.full_name ?? this.userEmail ?? 'uživateli';
    return `Vítejte v administraci, ${name}`;
  }

  get currentDateTime(): string {
    return new Date().toLocaleDateString('cs-CZ', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  formatDate(iso?: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('cs-CZ', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  ngOnDestroy(): void {
    this.emailSub?.unsubscribe();
  }
}