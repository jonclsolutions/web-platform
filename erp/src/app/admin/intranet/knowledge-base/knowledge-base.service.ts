/**
 * @file knowledge-base.service.ts
 * @path src/app/admin/intranet/knowledge-base/knowledge-base.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Loads the internal manual from the API: the menu and single pages in the given
 * language, already filtered by the permissions of the signed-in user (the API decides - see
 * App\Support\KnowledgeBase\KnowledgeBase). Cached per user and language for 10 minutes.
 * @note Plain HttpClient on purpose (not DataHandler): a page the user may not open answers 404,
 *   which the article shows as "page not found" - without the global error toast. The auth
 *   interceptor adds the access token as for every API call.
 * @dependencies HttpClient, ResourceCacheService, AuthService (user of the cache key), environment.
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ResourceCacheService } from '../../../core/services/resource-cache.service';
import { AuthService } from '../../../core/auth/auth.service';
import { KBMenuItem, KBPage } from '../../../shared/interfaces/kb-content';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class KnowledgeBaseService {
  private readonly TTL_MS = 10 * 60 * 1000;

  private readonly http = inject(HttpClient);
  private readonly cache = inject(ResourceCacheService);
  private readonly auth = inject(AuthService);

  /**
   * @description Menu of the pages the user may open; an error = empty menu.
   * @param lang Admin language code.
   */
  menu(lang: string): Observable<KBMenuItem[]> {
    return this.cache.get(
      `knowledge-base:menu:${this.auth.getUserId()}:${lang}`,
      () => this.http.get<{ data: KBMenuItem[] }>(`${environment.base_api_url}/knowledge-base`, { params: { lang } })
        .pipe(map(res => Array.isArray(res?.data) ? res.data : [])),
      this.TTL_MS
    ).pipe(catchError(() => of([] as KBMenuItem[])));
  }

  /**
   * @description One page with the sections the user may see; null when it does not exist, is
   *   not allowed or cannot be loaded.
   * @param id Page id.
   * @param lang Admin language code.
   */
  page(id: string, lang: string): Observable<KBPage | null> {
    return this.cache.get(
      `knowledge-base:page:${this.auth.getUserId()}:${lang}:${id}`,
      () => this.http.get<{ data: KBPage }>(`${environment.base_api_url}/knowledge-base/pages/${encodeURIComponent(id)}`, { params: { lang } })
        .pipe(map(res => res?.data ?? null)),
      this.TTL_MS
    ).pipe(catchError(() => of(null)));
  }
}
