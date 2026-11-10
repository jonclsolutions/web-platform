/**
 * @file welcome-page.component.ts
 * @path src/app/admin/core-pages/welcome-page/welcome-page.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Welcome page after login - seen by every user with the `web-view-welcome-page`
 *              permission (see routes). Holds only non-sensitive data (name, e-mail, role,
 *              account creation date) and a quick link for reporting a bug. Sensitive
 *              overviews (user counts, tickets, system logs) stay on the Dashboard only,
 *              protected by the separate `web-view-dashboard` permission.
 * @dependencies
 * - AuthService: Provides the role / e-mail of the logged-in user from the session.
 * - CurrentUserProfileService: TTL-cached read of the own profile, shared with
 *   PersonalInfoComponent.
 * - AdminLocalizationService: Static i18n of the admin UI.
 * @note The endpoint `core/users/{id}` returns the resource NOT wrapped in `{ data: ... }` (see
 *       UserController::show()) - handled by `CurrentUserProfileService`.
 */

import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { CurrentUserProfileService } from '../../../core/services/current-user-profile.service';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';
import { UserLogin } from '../../../shared/interfaces/user';
import { PageHelpComponent } from '../../components/page-help/page-help.component';

@Component({
  selector: 'app-welcome-page',
  standalone: true,
  imports: [CommonModule, RouterModule, PageHelpComponent],
  templateUrl: './welcome-page.component.html',
  styleUrls: ['../../shared-styles/welcome-page.css', './welcome-page.component.css'],
})
export class WelcomePageComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private profileService = inject(CurrentUserProfileService);
  private cd = inject(ChangeDetectorRef);

  public readonly i18n = inject(AdminLocalizationService);
  public get strings(): any { return this.i18n.getMergedSection('welcome-page'); }
  public t(key: string): string { return this.i18n.getValue(`welcome-page.${key}`); }

  userData: UserLogin | null = null;
  userEmail: string | null = null;
  userRole: string | null = null;

  isLoadingProfile = true;
  errorMessage: string | null = null;

  private emailSub?: Subscription;

  constructor() {
    // After switching the admin language, forces the component to re-evaluate the `strings` /
    // `helpSection` / `currentDateTime` output - same reason as in AdminLayoutComponent, done
    // manually (this component does not get the i18n service through BaseDataComponent).
    this.i18n.translations$.pipe(takeUntilDestroyed()).subscribe(() => this.cd.markForCheck());
  }

  ngOnInit(): void {
    this.userRole = this.authService.getUserRole();

    this.emailSub = this.authService.userEmail$.subscribe(email => {
      this.userEmail = email;
      this.cd.markForCheck();
    });

    this.loadUserProfile();
  }

  /**
   * @description Loads the profile of the logged-in user (name, account creation date) through
   * the shared TTL-cached `CurrentUserProfileService`.
   */
  private loadUserProfile(): void {
    const userId = this.authService.getUserId();
    if (!userId) {
      this.isLoadingProfile = false;
      return;
    }

    this.profileService.getProfile().subscribe({
      next: (response) => {
        this.userData = response;  // get() returns the payload (finding #6)
        this.isLoadingProfile = false;
        this.cd.markForCheck();
      },
      error: () => {
        this.errorMessage = this.t('profile_load_error');
        this.isLoadingProfile = false;
        this.cd.markForCheck();
      }
    });
  }

  get welcomeMessage(): string {
    const name = this.userData?.full_name ?? this.userEmail ?? this.t('welcome_default_name');
    return this.t('welcome_message').replace('{name}', name);
  }

  formatDate(iso?: string | null): string {
    if (!iso) return this.t('empty_value');
    return new Date(iso).toLocaleString(this.i18n.getDateLocale(), {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  ngOnDestroy(): void {
    this.emailSub?.unsubscribe();
  }
}