/**
 * @file shop-public.service.ts
 * @path src/app/public/shop-pages/components/services/public-data.service.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Provides a centralized service for fetching public-facing e-shop data from the API, including product catalogs, cart validation, and checkout operations.
 * @dependencies
 * - HttpClient: Facilitates HTTP communication with the backend.
 * - RxJS: Handles asynchronous data streams and error handling.
 * - environment: Provides base API URL configuration.
 * @refactor-note (2026-10-21) Removed unused code (no reference in TS, templates or
 *   string literals): `checkStockAvailability`.
 * @refactor-note (2026-10-21) Chybové hlášky `handleError()` přesunuty do sekce `api_errors` shop
 *   překladů (`LocalizationService.getText()`, chybějící klíč se chová jako všude jinde - vrátí
 *   se klíč). `handleError` je teď arrow funkce, protože se předává do `catchError()` bez
 *   `bind` a nově používá `this`.
 * @bugfix-note (2026-10-23) Open finding #53: a 422 showed the English API message; 422 / 429 map to
 *   the translated `api_errors` texts now.
 * @refactor-note (2026-10-24) Open finding #6: the API answers `{data, meta?}`. getProducts()
 *   returns the page (`data` + `meta` pagination); every other method returns the payload
 *   (`data`), so the callers no longer guess (`res.data || res`).
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../../../environments/environment';
import { LocalizationService } from '../../../../shared/services/localization.service';
import { ApiEnvelope, ApiPage } from '../../../../shared/interfaces/api-envelope';

/**
 * @description Service for handling all public e-shop API interactions.
 * @usage Consumed by storefront components to display products, handle cart validation, and process orders.
 * @note Implements standard error handling to translate HTTP error codes into user-friendly messages.
 */
@Injectable({
  providedIn: 'root'
})
export class ShopPublicService {
  /** Base endpoint for public e-shop routes (Laravel: shop/public) */
  private readonly apiUrl = `${environment.base_api_url}/shop/public`;

  constructor(private http: HttpClient, private localizationService: LocalizationService) { }

  /**
   * @description Fetches a paginated/filtered list of products.
   * @param params Key-value pairs representing filter criteria.
   * @returns Observable of the page `{data, meta: {total, per_page, current_page, last_page}}`.
   */
  getProducts(params: any = {}): Observable<ApiPage<any>> {
    let httpParams = new HttpParams();
    Object.keys(params).forEach(key => {
      const value = params[key];
      if (value !== null && value !== undefined && value !== '') {
        httpParams = httpParams.set(key, value.toString());
      }
    });

    return this.http.get<ApiPage<any>>(`${this.apiUrl}/products`, { params: httpParams })
      .pipe(catchError(this.handleError));
  }

  /**
   * @description Retrieves the full list of categories for filter navigation.
   */
  getCategories(): Observable<any> {
    return this.http.get<ApiEnvelope<any[]>>(`${this.apiUrl}/categories`, {
      params: new HttpParams().set('no_pagination', 'true') 
    }).pipe(map(r => r.data), catchError(this.handleError));
  }

  /**
   * @description Fetches active shipping methods for the current shop configuration.
   */
  getShippingMethods(): Observable<any> {
    return this.http.get<ApiEnvelope<any[]>>(`${this.apiUrl}/shipping-methods`, {
      params: new HttpParams().set('no_pagination', 'true')
    }).pipe(map(r => r.data), catchError(this.handleError));
  }

  /**
   * @description Fetches active payment methods for the checkout flow.
   */
  getPaymentMethods(): Observable<any> {
    return this.http.get<ApiEnvelope<any[]>>(`${this.apiUrl}/payment-methods`, {
      params: new HttpParams().set('no_pagination', 'true')
    }).pipe(map(r => r.data), catchError(this.handleError));
  }

  /**
   * @description Fetches detailed information for a specific product.
   * @param slugOrId Identifier used to look up the product.
   */
  getProductDetail(slugOrId: string | number): Observable<any> {
    return this.http.get<ApiEnvelope<any>>(`${this.apiUrl}/products/${slugOrId}`)
      .pipe(map(r => r.data), catchError(this.handleError));
  }

  /**
   * @description Validates a discount coupon code against the cart total.
   * @param code The string code provided by the user.
   * @param orderAmount Total cart value for verification.
   */
  validateCoupon(code: string, orderAmount: number): Observable<any> {
    return this.http.post<ApiEnvelope<any>>(`${this.apiUrl}/coupons/validate`, {
      code: code,
      order_amount: orderAmount
    }).pipe(map(r => r.data));
  }

  /**
   * @description Submits order data to the checkout workflow.
   * @param payload User and order details.
   */
  createOrder(payload: any): Observable<any> {
    return this.http.post<ApiEnvelope<any>>(`${environment.base_api_url}/shop/checkout/create-order`, payload).pipe(map(r => r.data));
  }

  /**
   * @description Centralized error handler for HTTP requests.
   * @param error Standard HttpErrorResponse object.
   * @note Translates specific status codes (404, 422, 500) into actionable error messages.
   */
  private handleError = (error: HttpErrorResponse) => {
    const text = (key: string) => this.localizationService.getText(`api_errors.${key}`);
    let errorMessage = text('generic');
    if (error.error instanceof ErrorEvent) {
      errorMessage = text('network').replace('{message}', error.error.message);
    } else {
      console.error(`Status: ${error.status}, Body:`, error.error);
      switch (error.status) {
        case 404: errorMessage = text('not_found'); break;
        // Translated only - the API message is English (finding #53).
        case 422: errorMessage = text('quantity_unavailable'); break;
        case 429: errorMessage = text('too_many_requests'); break;
        case 500: errorMessage = text('server'); break;
      }
    }
    return throwError(() => new Error(errorMessage));
  };
}