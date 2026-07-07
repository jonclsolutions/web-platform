/**
 * @file generic-table.service.ts
 * @path src/app/core/services/generic-table.service.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Provides generic pagination, caching, and preloading logic for data-driven tables within the admin panel.
 * @dependencies
 * - DataHandler: Used to perform the actual HTTP requests for collection data.
 */

import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { DataHandler } from './data-handler.service';

export interface FilterParams {
  [key: string]: string | number | boolean | undefined | null;
}

export interface PaginatedResponse<T> {
  current_page: number;
  data: T[];
  first_page_url: string;
  from: number;
  last_page: number;
  last_page_url: string;
  links: any[];
  next_page_url: string | null;
  path: string;
  per_page: number;
  prev_page_url: string | null;
  to: number;
  total: number;
}

/**
 * @description Manages state and caching for paginated data tables.
 * @usage Injected into admin list components to handle server-side pagination, search filtering, and performance optimizations.
 * @note Implements an LRU-like caching mechanism using Map and shareReplay to minimize API load during rapid user navigation.
 */
@Injectable({
  providedIn: 'root'
})
export class GenericTableService {
  private pageCache = new Map<string, Observable<PaginatedResponse<any>>>();
  private lastFilterParams: FilterParams = {};

  constructor(private dataHandler: DataHandler) {}

  /**
   * @description Fetches a paginated result set with support for filters and caching.
   * @param endpoint API resource path.
   * @param page Current page number.
   * @param perPage Items per page count.
   * @param filters Key-value pairs for API-side filtering.
   * @returns {Observable<PaginatedResponse<T>>} Stream containing the paginated data.
   * @note If filter parameters change compared to previous calls, the cache is automatically cleared to ensure data integrity.
   */
  getPaginatedData<T>(
    endpoint: string,
    page: number = 1,
    perPage: number = 15,
    filters: FilterParams = {}
  ): Observable<PaginatedResponse<T>> {
    if (JSON.stringify(filters) !== JSON.stringify(this.lastFilterParams)) {
      this.clearCache();
      this.lastFilterParams = { ...filters };
    }

    const cacheKey = this.getCacheKey(endpoint, page, perPage, filters);
    if (this.pageCache.has(cacheKey)) {
      return this.pageCache.get(cacheKey) as Observable<PaginatedResponse<T>>;
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
      .getPaginatedCollection<PaginatedResponse<T>>(`${endpoint}?${params.toString()}`)
      .pipe(
        tap(() => console.log(`Fetched from API: ${cacheKey}`)),
        shareReplay(1)
      );

    this.pageCache.set(cacheKey, dataObservable);
    return dataObservable;
  }

  /**
   * @description Proactively fetches adjacent pages to improve perceived performance during pagination.
   * @param endpoint API resource path.
   * @param currentPage Current active page.
   * @param totalPages Total available pages for range bounds.
   * @param perPage Items per page.
   * @param preloadRange Number of neighboring pages to fetch.
   * @param filters Active filters context.
   * @note Silently handles errors so preloading failures do not impact the main UI flow.
   */
  preloadAdjacentPages<T>(
    endpoint: string,
    currentPage: number,
    totalPages: number,
    perPage: number,
    preloadRange: number = 2,
    filters: FilterParams = {}
  ): void {
    const pagesToPreload: number[] = [];

    for (let i = 1; i <= preloadRange; i++) {
      const page = currentPage - i;
      if (page >= 1) {
        pagesToPreload.push(page);
      }
    }

    for (let i = 1; i <= preloadRange; i++) {
      const page = currentPage + i;
      if (page <= totalPages) {
        pagesToPreload.push(page);
      }
    }

    pagesToPreload.forEach((page) => {
      const cacheKey = this.getCacheKey(endpoint, page, perPage, filters);
      if (!this.pageCache.has(cacheKey)) {
        this.getPaginatedData<T>(endpoint, page, perPage, filters).subscribe({
          error: (err) => console.error(`Failed to preload ${cacheKey}:`, err)
        });
      }
    });
  }

  /**
   * @description Resets the internal cache store.
   */
  clearCache(): void {
    this.pageCache.clear();
  }

  /**
   * @description Generates a unique string key for the pageCache map based on request parameters.
   * @returns {string} Normalized cache key.
   * @note Sorts filter keys alphabetically to ensure consistent keys regardless of input object order.
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
    return `${endpoint}-${page}-${perPage}-${JSON.stringify(normalizedFilters)}`;
  }

  /**
   * @description Fetches all available records bypassing standard pagination.
   * @param endpoint API resource path.
   * @param filters Filter parameters.
   * @returns {Observable<T[]>} Stream of all matching records.
   * @note Appends 'no_pagination' flag to inform the API to disable result splitting.
   */
  getAllData<T>(endpoint: string, filters: FilterParams = {}): Observable<T[]> {
    let params = new HttpParams();

    for (const key in filters) {
      const value = filters[key];
      if (value !== undefined && value !== null && value !== '') {
        params = params.append(key, value.toString());
      }
    }

    params = params.append('no_pagination', 'true');
    return this.dataHandler.getCollection<T>(`${endpoint}?${params.toString()}`);
  }
}