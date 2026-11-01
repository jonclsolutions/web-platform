/**
 * @file current-user-profile.service.ts
 * @path src/app/core/services/current-user-profile.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Shared TTL-cached accessor for the currently logged-in user's own profile
 * (`core/users/{id}`), used by PersonalInfoComponent and WelcomePageComponent so the same record
 * is not fetched twice. Short TTL (the own profile rarely changes mid-session) and an explicit
 * `invalidate()` for callers that mutate it (2FA toggle, password change), so the next read
 * anywhere in the app is fresh.
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
   * @description Returns the profile of the logged-in user. `core/users/{id}` returns the resource
   * NOT wrapped in `{ data: ... }` (see UserController::show()), hence `dataHandler.get()`.
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

  /** Call after any mutation of the own profile (2FA toggle, password change, ...). */
  invalidate(): void {
    const userId = this.authService.getUserId();
    this.resourceCache.invalidate(`${this.CACHE_KEY_PREFIX}${userId}`);
  }
}