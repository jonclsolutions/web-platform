/**
 * @file generic-table.service.ts
 * @path src/app/core/services/generic-table.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Provides generic pagination, caching, and preloading logic for data-driven tables within the admin panel.
 * @dependencies
 * - DataHandler: Used to perform the actual HTTP requests for collection data.
 */

import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, shareReplay } from 'rxjs/operators';
import { DataHandler } from './data-handler.service';
import { ApiPage } from '../../shared/interfaces/api-envelope';

export interface FilterParams {
  [key: string]: string | number | boolean | undefined | null;
}

/**
 * @description One page of a list as the API answers it: items in `data`, pagination in `meta`
 *   (`{total, per_page, current_page, last_page}`, open finding #6 - the keys were flat beside
 *   `data` before).
 */
export type PaginatedResponse<T> = ApiPage<T>;

interface CacheEntry {
  observable: Observable<PaginatedResponse<any>>;
  timestamp: number;
}

/**
 * @description Manages state and caching for paginated data tables.
 * @usage Injected into admin list components to handle server-side pagination, search filtering, and performance optimizations.
 * @note The cache is safe even for large (tens of thousands of rows) tables - only the REQUESTED
 * page (15-50 rows) is cached, never "everything". The memory footprint grows only with the
 * pages / filters the user really visited, not with the table size.
 * @note The cache key is per user - switching the logged-in user means new (empty) cache keys,
 * never shared with the previous user.
 */
@Injectable({
  providedIn: 'root'
})
export class GenericTableService {
  /**
   * @description Time (ms) a cached page counts as "fresh" and triggers no new HTTP request. 3
   * minutes is a compromise between "the admin sees reasonably current data without a manual
   * refresh" and "no needless API load on fast back-and-forth navigation". The manual refresh
   * button (see `invalidateEndpoint`) and data mutations (create / update / delete / restore,
   * through PaginatedListStore.forceFullRefresh()) always bypass the TTL.
   */
  public readonly CACHE_TTL_MS = 3 * 60 * 1000;

  /** @description sessionStorage key under which `AuthService.persistSession()` stores the ID of the logged-in user. Must stay in sync with auth.service.ts. */
  private readonly USER_ID_STORAGE_KEY = 'userId';

  /** @description Fallback segment of the cache key when nobody is logged in (sessionStorage empty) - tells "logged out" apart from a real ID, so they never collide. */
  private readonly ANONYMOUS_CACHE_SEGMENT = '__anon__';

  private pageCache = new Map<string, CacheEntry>();

  constructor(private dataHandler: DataHandler) {}

  /**
   * @description Fetches a paginated result set with support for filters and caching.
   * @note When the cached page is younger than `CACHE_TTL_MS`, it is returned WITHOUT a network
   * request (shareReplay observable of the previous call). Otherwise the cache entry is dropped
   * and a real fetch with a new timestamp is made.
   */
  getPaginatedData<T>(
    endpoint: string,
    page: number = 1,
    perPage: number = 15,
    filters: FilterParams = {}
  ): Observable<PaginatedResponse<T>> {
    const cacheKey = this.getCacheKey(endpoint, page, perPage, filters);
    const cached = this.pageCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL_MS) {
      return cached.observable as Observable<PaginatedResponse<T>>;
    }

    let params = new HttpParams();
    params = params.append('page', page.toString());
    params = params.append('per_page', perPage.toString());
    for (const key in filters) {
      const value = filters[key];
      if (value !== undefined && value !== null && value !== '') {
        params = params.append(key, value.toString());
      }
    }

    const dataObservable = this.dataHandler
      .getPaginatedCollection<T>(`${endpoint}?${params.toString()}`)
      .pipe(
        // A failed request must not be served from the cache.
        catchError(err => {
          if (this.pageCache.get(cacheKey)?.observable === dataObservable) {
            this.pageCache.delete(cacheKey);
          }
          return throwError(() => err);
        }),
        shareReplay(1)
      );

    this.pageCache.set(cacheKey, { observable: dataObservable, timestamp: Date.now() });
    return dataObservable;
  }

  /**
   * @description Proactively fetches adjacent pages to improve perceived performance during pagination.
   * @note Respects the TTL like `getPaginatedData()` - an adjacent page that is already freshly
   * cached is not downloaded again.
   */
  preloadAdjacentPages<T>(
    endpoint: string,
    currentPage: number,
    totalPages: number,
    perPage: number,
    preloadRange: number = 1,
    filters: FilterParams = {}
  ): void {
    const pagesToPreload: number[] = [];

    for (let i = 1; i <= preloadRange; i++) {
      const prevPage = currentPage - i;
      if (prevPage >= 1) pagesToPreload.push(prevPage);

      const nextPage = currentPage + i;
      if (nextPage <= totalPages) pagesToPreload.push(nextPage);
    }

    pagesToPreload.forEach((page) => {
      const cacheKey = this.getCacheKey(endpoint, page, perPage, filters);
      const cached = this.pageCache.get(cacheKey);
      const isFresh = cached && (Date.now() - cached.timestamp) < this.CACHE_TTL_MS;

      if (!isFresh) {
        this.getPaginatedData<T>(endpoint, page, perPage, filters).subscribe({
          error: (err) => console.error(`Failed to preload ${cacheKey}:`, err)
        });
      }
    });
  }

  /**
   * @description Invalidates ALL cached pages / filters of the endpoint ACROSS ALL users (all
   * combinations of page / perPage / filters / userId). Use after a data mutation (create /
   * update / delete / restore) or from the "Refresh" button of a table - ENDPOINT-SCOPED, other
   * tables stay untouched.
   */
  invalidateEndpoint(endpoint: string): void {
    const prefix = `${endpoint}|`;
    Array.from(this.pageCache.keys())
      .filter(key => key.startsWith(prefix))
      .forEach(key => this.pageCache.delete(key));
  }

  /**
   * @description Invalidates the WHOLE cache across all endpoints and all users - used by the
   * global refresh button of the admin header (see TableRefreshBusService) and, as a security
   * measure, automatically on EVERY change of the logged-in user - see
   * `AuthService.persistSession()` / `clearAuthData()`. Sends no network request by itself - it
   * only ensures the next read (the open page and future navigation) is always a real fetch,
   * not stale data.
   */
  invalidateAll(): void {
    this.pageCache.clear();
  }

  /**
   * @description Builds the cache key identifying the combination endpoint + pagination +
   * filters + LOGGED-IN USER.
   */
  private getCacheKey(
    endpoint: string,
    page: number,
    perPage: number,
    filters: FilterParams
  ): string {
    const sortedFilterKeys = Object.keys(filters).sort();
    const normalizedFilters = sortedFilterKeys.reduce((acc, key) => {
      const value = filters[key];
      if (value !== undefined && value !== null && value !== '') {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, any>);

    const userId = this.getCurrentUserIdForCacheKey();
    return `${endpoint}|${userId}|${page}|${perPage}|${JSON.stringify(normalizedFilters)}`;
  }

  /**
   * @description Returns the ID of the logged-in user for the cache key, or a neutral placeholder
   * when nobody is logged in. Reads `sessionStorage` directly (the same key that
   * `AuthService.persistSession()` sets) to avoid a circular DI dependency on `AuthService`
   * (which injects `GenericTableService` for `invalidateAll()` on login / logout - see
   * auth.service.ts).
   */
  private getCurrentUserIdForCacheKey(): string {
    return sessionStorage.getItem(this.USER_ID_STORAGE_KEY) ?? this.ANONYMOUS_CACHE_SEGMENT;
  }
} 
