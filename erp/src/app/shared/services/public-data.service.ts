/**
 * @file public-data.service.ts
 * @path src/app/shared/services/public-data.service.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Service providing public API access to shop settings, legal documents, and contact forms.
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PublicDataService {
  private readonly apiUrl = environment.base_api_url;

  constructor(private http: HttpClient) { }

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

  getSiteSettings(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/public/legal/config`)
      .pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    console.error(`[PublicDataService Error] Status: ${error.status}, URL: ${error.url}`, error.error);
    return throwError(() => error);
  }
  getShopStatus(): Observable<{is_shop_active: boolean}> {
    return this.http.get<{is_shop_active: boolean}>(`${this.apiUrl}/shop/public/status`, {
      headers: { 
        'Cache-Control': 'no-cache, no-store, must-revalidate', 
        'Pragma': 'no-cache', 
        'Expires': '0' 
      }
    }).pipe(catchError(this.handleError));
  }
}