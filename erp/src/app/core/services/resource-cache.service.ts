/**
 * @file resource-cache.service.ts
 * @path src/app/core/services/resource-cache.service.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Generic, keyed TTL cache for arbitrary GET requests that don't go through
 * GenericTableService (single-record endpoints, aggregations, no_pagination collections).
 * Generalizes the pattern already used by RoleOptionsService, so it doesn't have to be
 * hand-rolled again for every non-tabular page (dashboards, settings screens, profile
 * pages) - see backlog task "zbytečně moc dotazů na API".
 * @note RoleOptionsService is left untouched as its own small dedicated class - this
 * service is for new call sites going forward. Retrofitting RoleOptionsService onto this
 * would be a pure no-behaviour-change refactor and can be done separately if desired.
 */

import { Injectable } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';

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

    const obs$ = loader().pipe(shareReplay(1));
    this.cache.set(key, { obs$, timestamp: Date.now() });
    return obs$;
  }

  /** Zneplatní jeden konkrétní klíč (např. po uložení formuláře). */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /** Zneplatní všechny klíče začínající daným prefixem (např. celou stránku najednou). */
  invalidatePrefix(prefix: string): void {
    Array.from(this.cache.keys())
      .filter(k => k.startsWith(prefix))
      .forEach(k => this.cache.delete(k));
  }

  invalidateAll(): void {
    this.cache.clear();
  }
}