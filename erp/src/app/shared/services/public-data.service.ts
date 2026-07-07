/**
 * @file public-data.service.ts
 * @path src/app/shared/services/public-data.service.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Service providing public API access to shop settings, legal documents, and contact forms.
 * @dependencies
 * - HttpClient: Handles all HTTP communication with the backend API.
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

/**
 * @description Service responsible for fetching public-facing data.
 * @usage Used across various public components to retrieve site configuration and handle submissions.
 * @note Implements global error handling for all HTTP requests to ensure uniform error reporting.
 */
@Injectable({
  providedIn: 'root'
})
export class PublicDataService {
  private apiUrl = environment.base_api_url;

  constructor(private http: HttpClient) { }

  /**
   * @description Constructs the public URL for storage assets.
   * @param path The relative path or URL of the asset.
   * @returns {string} The formatted public URL.
   * @note If the path starts with 'http', it is returned as is. Otherwise, it is prepended with '/storage/'.
   */
  getStorageUrl(path: string): string {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `/storage/${path}`;
  }

  /**
   * @description Fetches a specific legal document by its slug.
   * @param slug The unique identifier for the document.
   * @param lang The requested language code.
   * @returns {Observable<any>} The document content.
   */
  getLegalDocument(slug: string, lang: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/public/legal/${slug}`, { 
      params: { lang: lang } 
    }).pipe(catchError(this.handleError));
  }

  /**
   * @description Retrieves available payment methods for the public e-shop.
   * @returns {Observable<any[]>} An array of payment method configurations.
   */
  getPaymentMethods(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/shop/public/payment-methods`)
      .pipe(catchError(this.handleError));
  }

  /**
   * @description Fetches the global configuration settings for the site.
   * @returns {Observable<any>} The site settings object.
   */
  getSiteSettings(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/public/legal/config`)
      .pipe(catchError(this.handleError));
  }

  /**
   * @description Submits a contact form request.
   * @param formData The data object to be sent.
   * @returns {Observable<any>} The server response.
   */
  submitContactForm(formData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/raw_request_commissions`, formData)
      .pipe(catchError(this.handleError));
  }

  /**
   * @description Posts a raw custom production request.
   * @param formData The FormData object containing form fields and potential attachments.
   * @returns {Observable<any>} The server response.
   */
  postRawRequestCommission(formData: FormData): Observable<any> {
    return this.http.post(`${this.apiUrl}/raw_request_commissions`, formData)
      .pipe(catchError(this.handleError));
  }

  /**
   * @description Submits an order form as part of the sales process.
   * @param formData The FormData object containing order details.
   * @returns {Observable<any>} The server response.
   */
  submitOrder(formData: FormData): Observable<any> {
    return this.http.post(`${this.apiUrl}/sales_orders`, formData)
      .pipe(catchError(this.handleError));
  }

  /**
   * @description Checks the current operational status of the e-shop form maintanance break.
   * @returns {Observable<{is_shop_active: boolean}>} The shop status object.
   * @note Prevents browser caching by including explicit no-cache headers to ensure accurate status retrieval.
   */
  getShopStatus(): Observable<{is_shop_active: boolean}> {
    return this.http.get<{is_shop_active: boolean}>(`${this.apiUrl}/shop/public/status`, {
      headers: { 
        'Cache-Control': 'no-cache, no-store, must-revalidate', 
        'Pragma': 'no-cache', 
        'Expires': '0' 
      }
    }).pipe(catchError(this.handleError));
  }

  /**
   * @description Normalizes and handles HTTP error responses.
   * @param error The error response object from HttpClient.
   * @returns {Observable<never>} An observable that throws a formatted error message.
   * @note Logs detailed error information to the console for debugging purposes while returning a user-friendly string.
   */
  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An error occurred during communication with the server.';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Client-side error: ${error.error.message}`;
    } else {
      console.error(`Backend error: ${error.status}, URL: ${error.url}, body:`, error.error);
      errorMessage = `Server returned error status: ${error.status}`;
    }
    return throwError(() => new Error(errorMessage));
  }
}