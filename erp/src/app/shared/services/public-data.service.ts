/**
 * @file public-data.service.ts
 * @path src/app/shared/services/public-data.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Public API access of the frontend: GET / POST with the API envelope unwrapped,
 *   the cached site settings (company details, social links), storage URLs and no-cache reads.
 * @note siteSettings$ acts as an in-memory cache populated once by AppBootstrapService
 *   during APP_INITIALIZER. Components should read from siteSettingsValue$ instead of
 *   calling getSiteSettings() themselves, to avoid redundant requests and loading flicker.
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
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
   * @param context Optional HTTP context (e.g. SKIP_ADMIN_AUTH_CONTEXT of a client portal).
   */
  get<T>(endpoint: string, params?: any, headers?: Record<string, string>, context?: HttpContext): Observable<T> {
    return this.getWithMeta<T>(endpoint, params, headers, context).pipe(map(res => this.payload(res)));
  }

  /**
   * @description GET keeping the whole envelope `{data, meta?, message?}`.
   * @param endpoint Path below the API base URL.
   * @param params Optional query parameters.
   * @param headers Optional request headers (see get()).
   * @param context Optional HTTP context (see get()).
   */
  getWithMeta<T, M = Record<string, any>>(endpoint: string, params?: any, headers?: Record<string, string>, context?: HttpContext): Observable<ApiEnvelope<T, M>> {
    return this.http.get<ApiEnvelope<T, M>>(`${this.apiUrl}/${endpoint}`, { params, headers, context })
      .pipe(catchError(this.handleError));
  }

  /**
   * @description Generic POST method to support various endpoints including FormData.
   * @param headers Optional request headers (see get()).
   * @param context Optional HTTP context (see get()).
   */
  post<T>(endpoint: string, body: any, headers?: Record<string, string>, context?: HttpContext): Observable<T> {
    return this.http.post<ApiEnvelope<T>>(`${this.apiUrl}/${endpoint}`, body, { headers, context })
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

  /**
   * @description GET of a value that can change at any moment (e.g. the maintenance status of
   *   an application, flipped by the admin toggle) - with no-cache headers, so a stale cached
   *   200 never hides a change.
   * @param endpoint Endpoint below the API root (e.g. `shop/public/status`).
   * @returns The payload of the envelope.
   */
  getFresh<T>(endpoint: string): Observable<T> {
    return this.http.get<ApiEnvelope<T>>(`${this.apiUrl}/${endpoint}`, {
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