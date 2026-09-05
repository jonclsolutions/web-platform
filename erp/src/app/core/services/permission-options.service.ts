/**
 * @file permission-options.service.ts
 * @path src/app/core/services/permission-options.service.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description TTL-cached source of `GET core/permissions` (the full, flat list of
 * every permission key in the system), used to build the "extra explicit
 * permissions" multi-select in AdministratorsComponent. Mirrors the existing
 * `RoleOptionsService` caching pattern 1:1 so both list-loading services behave
 * identically from a consumer's point of view.
 * @dependencies
 * - DataHandler: Shared HTTP wrapper used across the admin app for API calls.
 * - shareReplay: Keeps a single in-flight/most-recent request shared across all
 *   subscribers instead of firing a new HTTP request per subscription.
 */

import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { shareReplay, tap, catchError } from 'rxjs/operators';
import { DataHandler } from '../../shared/imports/core-providers';

/** Shape returned by `GET core/permissions` for a single permission row. */
export interface CorePermissionOption {
  id: number;
  permission_key: string;
  description: string | null;
  module: string;
}

/** How long a successful response is considered fresh before refetching. */
const CACHE_TTL_MS = 5 * 60 * 1000;

@Injectable({
  providedIn: 'root'
})
export class PermissionOptionsService {
  private cache$: Observable<CorePermissionOption[]> | null = null;
  private cachedAt = 0;

  constructor(private dataHandler: DataHandler) {}

  /**
   * @description Returns the full permission list, using the TTL cache when fresh.
   * On error, returns an empty array rather than propagating - callers treat "no
   * permissions loaded yet" as a normal, recoverable UI state (same fallback
   * philosophy as RoleOptionsService.loadRolesForces2fa()'s error handler).
   * @returns Observable<CorePermissionOption[]>
   */
  getPermissions(): Observable<CorePermissionOption[]> {
    const isFresh = this.cache$ && (Date.now() - this.cachedAt) < CACHE_TTL_MS;

    if (!isFresh) {
      this.cache$ = this.dataHandler.get<CorePermissionOption[]>('core/permissions').pipe(
        tap(() => { this.cachedAt = Date.now(); }),
        catchError(() => of([])),
        shareReplay(1)
      );
    }

    return this.cache$!;
  }

  /**
   * @description Forces the next getPermissions() call to hit the network again -
   * useful after a sysadmin creates/renames a permission elsewhere in the admin.
   */
  invalidate(): void {
    this.cache$ = null;
    this.cachedAt = 0;
  }
}