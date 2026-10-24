/**
 * @file public-data.service.ts
 * @path src/app/shared/services/public-data.service.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Service providing public API access to shop settings, legal documents, and contact forms.
 * @note siteSettings$ acts as an in-memory cache populated once by AppBootstrapService
 *   during APP_INITIALIZER. Components should read from siteSettingsValue$ instead of
 *   calling getSiteSettings() themselves, to avoid redundant requests and loading flicker.
 * @refactor-note (2026-08) Přidána `getWebStatus()` - mirror `getShopStatus()`, používá
 *   `webMaintenanceGuard` k rozhodnutí, jestli přesměrovat na /web-maintenance.
 * @refactor-note (2026-10-21) Removed unused code (no reference in TS, templates or
 *   string literals): `getCachedSettingsSnapshot`.
 * @refactor-note (2026-10-24) Open finding #6: the API answers `{data, meta?}` - every method
 *   returns the payload (`data`); getWithMeta() keeps the envelope for answers with `meta`
 *   (e.g. `has_more_older_messages` of the project portal message pages).
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../interfaces/api-envelope';

@Injectable({
  providedIn: 'root'
})
export class PublicDataService {
  private readonly apiUrl = environment.base_api_url;

  constructor(private http: HttpClient) { }

  // ── Site settings cache ─────────────────────────────────────────
  /** Populated once at bootstrap (see AppBootstrapService). Null until first load. */
  private siteSettings$ = new BehaviorSubject<any>(null);
  readonly siteSettingsValue$ = this.siteSettings$.asObservable();

  setCachedSettings(settings: any): void {
    this.siteSettings$.next(settings);
  }

  // ── Generic HTTP helpers ─────────────────────────────────────────
  /**
   * @description Generic GET.
   * @param endpoint Path below the API base URL.
   * @param params Optional query parameters.
   * @param headers Optional request headers (e.g. the project portal `Authorization` - credentials
   *   never go into the URL, see open finding #1).
   */
  get<T>(endpoint: string, params?: any, headers?: Record<string, string>): Observable<T> {
    return this.getWithMeta<T>(endpoint, params, headers).pipe(map(res => this.payload(res)));
  }

  /**
   * @description GET keeping the whole envelope `{data, meta?, message?}`.
   * @param endpoint Path below the API base URL.
   * @param params Optional query parameters.
   * @param headers Optional request headers (see get()).
   */
  getWithMeta<T, M = Record<string, any>>(endpoint: string, params?: any, headers?: Record<string, string>): Observable<ApiEnvelope<T, M>> {
    return this.http.get<ApiEnvelope<T, M>>(`${this.apiUrl}/${endpoint}`, { params, headers })
      .pipe(catchError(this.handleError));
  }

  /**
   * @description Generic POST method to support various endpoints including FormData.
   * @param headers Optional request headers (see get()).
   */
  post<T>(endpoint: string, body: any, headers?: Record<string, string>): Observable<T> {
    return this.http.post<ApiEnvelope<T>>(`${this.apiUrl}/${endpoint}`, body, { headers })
      .pipe(map(res => this.payload(res)), catchError(this.handleError));
  }

  /**
   * @description Payload of an answer; null for an answer without a body (204).
   * @param res Envelope or null.
   */
  private payload<T>(res: ApiEnvelope<T> | null): T {
    return (res?.data ?? null) as T;
  }

  getStorageUrl(path: string): string {
    if (!path) return '';
    return path.startsWith('http') ? path : `/storage/${path}`;
  }

  /**
   * @description Direct fetch of site settings. Used by AppBootstrapService at startup.
   *   Components elsewhere in the app should prefer siteSettingsValue$ (cached) instead
   *   of calling this again, to avoid a duplicate request and a second loading state.
   */
  getSiteSettings(): Observable<any> {
    return this.get<any>('public/legal/config');
  }

  getShopStatus(): Observable<{ is_shop_active: boolean }> {
    return this.http.get<ApiEnvelope<{ is_shop_active: boolean }>>(`${this.apiUrl}/shop/public/status`, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    }).pipe(map(res => this.payload(res)), catchError(this.handleError));
  }

  /**
   * @description Fetches whether the public web is currently active or in maintenance
   * mode - used by webMaintenanceGuard. No-cache headers for the same reason as
   * getShopStatus(): the status can flip at any moment via the admin toggle, we never
   * want a stale cached 200 masking an active maintenance window.
   */
  getWebStatus(): Observable<{ is_web_active: boolean }> {
    return this.http.get<ApiEnvelope<{ is_web_active: boolean }>>(`${this.apiUrl}/web/public/status`, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    }).pipe(map(res => this.payload(res)), catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    console.error(`[PublicDataService Error] Status: ${error.status}, URL: ${error.url}`, error.error);
    return throwError(() => error);
  }
}