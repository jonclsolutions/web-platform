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
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

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

  getCachedSettingsSnapshot(): any {
    return this.siteSettings$.value;
  }

  // ── Generic HTTP helpers ─────────────────────────────────────────
  get<T>(endpoint: string, params?: any): Observable<T> {
    return this.http.get<T>(`${this.apiUrl}/${endpoint}`, { params })
      .pipe(catchError(this.handleError));
  }

  /**
   * @description Generic POST method to support various endpoints including FormData.
   */
  post<T>(endpoint: string, body: any): Observable<T> {
    return this.http.post<T>(`${this.apiUrl}/${endpoint}`, body)
      .pipe(catchError(this.handleError));
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
    return this.http.get<any>(`${this.apiUrl}/public/legal/config`)
      .pipe(catchError(this.handleError));
  }

  getShopStatus(): Observable<{ is_shop_active: boolean }> {
    return this.http.get<{ is_shop_active: boolean }>(`${this.apiUrl}/shop/public/status`, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    }).pipe(catchError(this.handleError));
  }

  /**
   * @description Fetches whether the public web is currently active or in maintenance
   * mode - used by webMaintenanceGuard. No-cache headers for the same reason as
   * getShopStatus(): the status can flip at any moment via the admin toggle, we never
   * want a stale cached 200 masking an active maintenance window.
   */
  getWebStatus(): Observable<{ is_web_active: boolean }> {
    return this.http.get<{ is_web_active: boolean }>(`${this.apiUrl}/web/public/status`, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    }).pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    console.error(`[PublicDataService Error] Status: ${error.status}, URL: ${error.url}`, error.error);
    return throwError(() => error);
  }
}