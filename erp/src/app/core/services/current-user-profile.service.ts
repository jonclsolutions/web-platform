/**
 * @file current-user-profile.service.ts
 * @path src/app/core/services/current-user-profile.service.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Shared TTL-cached accessor for the currently logged-in user's own profile
 * (`core/users/{id}`). PersonalInfoComponent and WelcomePageComponent each fetched exactly
 * this same record independently on every mount - a user landing on the welcome page
 * right after login, then clicking into "Osobní Informace", triggered TWO identical
 * requests for the same data (see backlog task "zbytečně moc dotazů na API"). Consolidated
 * here with a short TTL (own profile rarely changes mid-session) and an explicit
 * `invalidate()` for callers that mutate it (2FA toggle, password change) so the next
 * read anywhere in the app is guaranteed fresh.
 */

import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { DataHandler } from './data-handler.service';
import { AuthService } from '../auth/auth.service';
import { ResourceCacheService } from './resource-cache.service';
import { UserLogin } from '../../shared/interfaces/user';

@Injectable({ providedIn: 'root' })
export class CurrentUserProfileService {
  private readonly TTL_MS = 2 * 60 * 1000;
  private readonly CACHE_KEY_PREFIX = 'current-user-profile:';

  private dataHandler = inject(DataHandler);
  private authService = inject(AuthService);
  private resourceCache = inject(ResourceCacheService);

  /**
   * @description Vrací profil aktuálně přihlášeného uživatele. `core/users/{id}` vrací
   * zdroj NEobalený v `{ data: ... }` (viz UserController::show()), proto `dataHandler.get()`.
   */
  getProfile(): Observable<UserLogin> {
    const userId = this.authService.getUserId();
    const key = `${this.CACHE_KEY_PREFIX}${userId}`;
    return this.resourceCache.get<UserLogin>(
      key,
      () => this.dataHandler.get<UserLogin>(`core/users/${userId}`),
      this.TTL_MS
    );
  }

  /** Zavolat po jakékoliv mutaci vlastního profilu (2FA toggle, změna hesla, ...). */
  invalidate(): void {
    const userId = this.authService.getUserId();
    this.resourceCache.invalidate(`${this.CACHE_KEY_PREFIX}${userId}`);
  }
}