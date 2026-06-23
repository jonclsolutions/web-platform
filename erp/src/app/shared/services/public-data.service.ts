import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PublicDataService {
  private apiUrl = environment.base_api_url;

  constructor(private http: HttpClient) { }

  /**
   * Pomocná metoda pro získání URL k souborům ve storage.
   * Vzhledem k proxy nastavení v Angularu, `/storage/` cesta projde na backend.
   */
  getStorageUrl(path: string): string {
    if (!path) return '';
    // Pokud cesta již začíná http, vracíme ji tak, jak je
    if (path.startsWith('http')) return path;
    
    // Jinak vracíme cestu začínající /storage/ (proxy zajistí přesměrování)
    return `/storage/${path}`;
  }

  getLegalDocument(slug: 'gdpr' | 'tos'): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/public/legal/${slug}`)
      .pipe(catchError(this.handleError));
  }

  getPaymentMethods(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/shop/public/payment-methods`)
      .pipe(catchError(this.handleError));
  }

  getSiteSettings(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/public/legal/config`)
      .pipe(catchError(this.handleError));
  }

  submitContactForm(formData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/raw_request_commissions`, formData)
      .pipe(catchError(this.handleError));
  }
  /**
   * Odeslání poptávky na zakázkovou tvorbu
   */
  postRawRequestCommission(formData: FormData): Observable<any> {
    return this.http.post(`${this.apiUrl}/raw_request_commissions`, formData)
      .pipe(catchError(this.handleError));
  }
  submitOrder(formData: FormData): Observable<any> {
    return this.http.post(`${this.apiUrl}/sales_orders`, formData)
      .pipe(catchError(this.handleError));
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

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Při komunikaci se serverem nastala chyba.';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Klientova chyba: ${error.error.message}`;
    } else {
      console.error(`Backend error: ${error.status}, URL: ${error.url}, body:`, error.error);
      errorMessage = `Server vrátil chybu ${error.status}`;
    }
    return throwError(() => new Error(errorMessage));
  }
}