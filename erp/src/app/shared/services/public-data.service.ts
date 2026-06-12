import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PublicDataService {
  // Pokud proxy v angular.json nefunguje, použij natvrdo: 'http://127.0.0.1:8000/api'
  private apiUrl = environment.base_api_url;

  constructor(private http: HttpClient) { }

  getPaymentMethods(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/shop/public/payment-methods`)
      .pipe(catchError(this.handleError));
  }

  submitContactForm(formData: any): Observable<any> {
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
    }).pipe(
      // Přidáno catchError, aby Guard při chybě API nezpůsobil pád aplikace
      catchError(this.handleError)
    );
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Při komunikaci se serverem nastala chyba.';
    
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Klientova chyba: ${error.error.message}`;
    } else {
      // Zde logujeme status pro snadnější ladění v Network tabu
      console.error(`Backend error: ${error.status}, URL: ${error.url}, body:`, error.error);
      errorMessage = `Server vrátil chybu ${error.status}`;
    }
    
    return throwError(() => new Error(errorMessage));
  }
}