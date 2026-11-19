/**
 * @file resource-cache.service.ts
 * @path src/app/core/services/resource-cache.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Generic, keyed TTL cache for arbitrary GET requests that don't go through
 * GenericTableService (single-record endpoints, aggregations, no_pagination collections).
 * Generalizes the pattern used by RoleOptionsService, so it doesn't have to be hand-rolled
 * again for every non-tabular page (dashboards, settings screens, profile pages).
 * @note RoleOptionsService stays its own small dedicated class.
 * @security The entries are NOT keyed per user: `clear()` runs on every change of the signed-in
 * user and on logout (AuthService), so one admin never gets the cached answers of another.
 */

import { Injectable } from '@angular/core';
import { Observable, catchError, shareReplay, throwError } from 'rxjs';

interface CacheEntry<T> {
  obs$: Observable<T>;
  timestamp: number;
}

@Injectable({ providedIn: 'root' })
export class ResourceCacheService {
  private readonly DEFAULT_TTL_MS = 3 * 60 * 1000;
  private cache = new Map<string, CacheEntry<any>>();

  /**
   * @description Returns a cached observable for `key` if still within `ttlMs`,
   * otherwise calls `loader()`, caches the (shareReplay'd) result, and returns that.
   * @param key Unique cache key - caller must make it specific enough (include filter
   * params if the same loader can return different data for different inputs).
   * @param loader Factory producing the source Observable - only invoked on a cache miss.
   * @param ttlMs Optional override of the default 3-minute TTL.
   */
  get<T>(key: string, loader: () => Observable<T>, ttlMs: number = this.DEFAULT_TTL_MS): Observable<T> {
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < ttlMs) {
      return cached.obs$ as Observable<T>;
    }

    const obs$: Observable<T> = loader().pipe(
      catchError(err => {
        if (this.cache.get(key)?.obs$ === obs$) {
          this.cache.delete(key);
        }
        return throwError(() => err);
      }),
      shareReplay(1)
    );
    this.cache.set(key, { obs$, timestamp: Date.now() });
    return obs$;
  }

  /** Invalidates one specific key (e.g. after saving a form). */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * @description Drops every entry. Called by AuthService when the signed-in user changes (or
   *   signs out) - the entries are not per user and many answers depend on the permissions of
   *   the user (e.g. the knowledge base) - and by the global "Refresh all" button.
   */
  clear(): void {
    this.cache.clear();
  }
}