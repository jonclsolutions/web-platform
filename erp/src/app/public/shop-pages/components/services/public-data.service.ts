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
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError, map } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../../../environments/environment';

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

  constructor(private http: HttpClient) { }

  /**
   * @description Fetches a paginated/filtered list of products.
   * @param params Key-value pairs representing filter criteria.
   * @returns Observable of product result sets.
   */
  getProducts(params: any = {}): Observable<any> {
    let httpParams = new HttpParams();
    Object.keys(params).forEach(key => {
      const value = params[key];
      if (value !== null && value !== undefined && value !== '') {
        httpParams = httpParams.set(key, value.toString());
      }
    });

    return this.http.get<any>(`${this.apiUrl}/products`, { params: httpParams })
      .pipe(catchError(this.handleError));
  }

  /**
   * @description Retrieves the full list of categories for filter navigation.
   */
  getCategories(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/categories`, { 
      params: new HttpParams().set('no_pagination', 'true') 
    }).pipe(catchError(this.handleError));
  }

  /**
   * @description Fetches active shipping methods for the current shop configuration.
   */
  getShippingMethods(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/shipping-methods`, {
      params: new HttpParams().set('no_pagination', 'true')
    }).pipe(catchError(this.handleError));
  }

  /**
   * @description Fetches active payment methods for the checkout flow.
   */
  getPaymentMethods(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/payment-methods`, {
      params: new HttpParams().set('no_pagination', 'true')
    }).pipe(catchError(this.handleError));
  }

  /**
   * @description Fetches detailed information for a specific product.
   * @param slugOrId Identifier used to look up the product.
   */
  getProductDetail(slugOrId: string | number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/products/${slugOrId}`)
      .pipe(catchError(this.handleError));
  }

  /**
   * @description Verifies real-time stock availability for a specific product/variant.
   * @param productId Unique product identifier.
   * @param variantId Optional variant identifier.
   * @param requestedQuantity Quantity to validate.
   * @returns Observable boolean representing stock status.
   */
  checkStockAvailability(productId: string | number, variantId: number | null, requestedQuantity: number): Observable<boolean> {
    return this.http.get<{ available: boolean }>(`${this.apiUrl}/products/${productId}/check-stock`, {
      params: {
        variant_id: variantId ? variantId.toString() : '',
        quantity: requestedQuantity.toString()
      }
    }).pipe(
      map(res => res.available), 
      catchError(this.handleError)
    );
  }

  /**
   * @description Validates a discount coupon code against the cart total.
   * @param code The string code provided by the user.
   * @param orderAmount Total cart value for verification.
   */
  validateCoupon(code: string, orderAmount: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/coupons/validate`, {
      code: code,
      order_amount: orderAmount
    });
  }

  /**
   * @description Submits order data to the checkout workflow.
   * @param payload User and order details.
   */
  createOrder(payload: any): Observable<any> {
    return this.http.post<any>(`${environment.base_api_url}/shop/checkout/create-order`, payload);
  }

  /**
   * @description Centralized error handler for HTTP requests.
   * @param error Standard HttpErrorResponse object.
   * @note Translates specific status codes (404, 422, 500) into actionable error messages.
   */
  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Při komunikaci s e-shopem nastala chyba.';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Chyba sítě: ${error.error.message}`;
    } else {
      console.error(`Status: ${error.status}, Body:`, error.error);
      switch (error.status) {
        case 404: errorMessage = 'Požadovaná data nebyla nalezena.'; break;
        case 422: errorMessage = error.error?.message || 'Požadované množství není dostupné.'; break;
        case 500: errorMessage = 'Chyba na straně serveru.'; break;
      }
    }
    return throwError(() => new Error(errorMessage));
  }
}