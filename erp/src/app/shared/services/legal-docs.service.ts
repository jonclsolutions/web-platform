/**
 * @file legal-docs.service.ts
 * @path src/app/shared/services/legal-docs.service.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Caches legal documents (privacy policy / GDPR, terms of service) keyed by
 *   slug + language, so navigating to these pages more than once — or coming back to them
 *   later — never re-triggers a network request. Also exposes preload() so AppBootstrapService
 *   can warm the cache in the background right after startup, without blocking the initial render.
 */

import { Injectable } from '@angular/core';
import { Observable, of, firstValueFrom } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { PublicDataService } from './public-data.service';

@Injectable({ providedIn: 'root' })
export class LegalDocsService {
  /** Key format: `${slug}_${lang}`, e.g. 'gdpr_cz', 'tos_en'. */
  private cache = new Map<string, any>();

  constructor(private publicDataService: PublicDataService) {}

  private cacheKey(slug: string, lang: string): string {
    return `${slug}_${lang}`;
  }

  /**
   * @description Returns the document for the given slug + language. Serves from
   *   cache if already loaded (or preloaded), otherwise fetches and caches it.
   * @param slug 'gdpr' | 'tos' (matches the public/legal/{slug} endpoint)
   * @param lang Language code, e.g. 'cz', 'en'.
   */
  public getDocument(slug: string, lang: string): Observable<any> {
    const key = this.cacheKey(slug, lang);
    if (this.cache.has(key)) {
      return of(this.cache.get(key));
    }

    return this.publicDataService.get(`public/legal/${slug}`, { lang }).pipe(
      tap(data => this.cache.set(key, data)),
      catchError(err => {
        console.error(`[LegalDocsService] Failed to load ${slug} (${lang})`, err);
        return of(null);
      })
    );
  }

  /**
   * @description Fire-and-forget warmup used by AppBootstrapService. Resolves once
   *   the document is in cache (or failed), but is never awaited as part of the
   *   blocking startup sequence — it runs after the app has already rendered.
   */
  public preload(slug: string, lang: string): Promise<void> {
    return firstValueFrom(this.getDocument(slug, lang)).then(() => undefined);
  }
}