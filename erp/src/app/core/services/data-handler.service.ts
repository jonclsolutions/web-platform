/**
 * @file data-handler.service.ts
 * @path src/app/core/services/data-handler.service.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Centralized HTTP data handler service for administrative operations, providing standard CRUD methods with integrated error reporting.
 * @dependencies
 * - HttpClient: Facilitates secure API communication.
 * - AlertDialogService: Displays user-facing error dialogs upon API failure.
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AlertDialogService } from './alert-dialog.service';
import { environment } from '../../../environments/environment';

/**
 * @description Handles REST API interactions, including header management, serialization, and global error processing.
 * @usage Used exclusively within the 'admin' module for managing authenticated data resources.
 * @note Implements a centralized error handling strategy that transforms technical HTTP errors into human-readable alerts.
 */
@Injectable({
  providedIn: 'root'
})
export class DataHandler {
  private baseUrl = environment.base_api_url;

  constructor(
    private http: HttpClient,
    private alertDialogService: AlertDialogService
  ) { }

  /**
   * @description Constructs appropriate headers for the request based on payload type.
   * @param data The payload intended for the request.
   * @returns {HttpHeaders} Configured headers for the request.
   * @note If payload is FormData, 'Content-Type' is omitted to allow the browser to auto-set the multipart boundary.
   */
  private getHeaders(data?: any): HttpHeaders {
    let headersConfig: any = {
      'Accept': 'application/json'
    };

    if (!(data instanceof FormData)) {
      headersConfig['Content-Type'] = 'application/json';
    }

    return new HttpHeaders(headersConfig);
  }

  /**
   * @description Processes and standardizes HTTP error responses from the backend.
   * @param error The raw HttpErrorResponse object.
   * @returns {Observable<never>} An observable that throws a normalized error.
   * @note Handles various HTTP status codes (403, 422, 500) and displays a modal dialog to the end user.
   */
  private handleError = (error: HttpErrorResponse): Observable<never> => {
    let errorMessage = 'An unknown error occurred!';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Client-side error: ${error.error.message}`;
    } else {
      console.error(
        `Backend returned code ${error.status}, ` +
        `response body: ${JSON.stringify(error.error)}`);

      if (error.status === 0) {
        errorMessage = 'Unable to connect to the server. Please check your network connection or if the API is running.';
      } else if (error.status === 403) {
        if (error.error && error.error.error_code === 'CANNOT_DELETE_OWN_ACCOUNT') {
          errorMessage = 'Cannot delete the user you are currently logged in as.';
        } else if (error.error && error.error.message) {
            errorMessage = error.error.message;
        } else {
          errorMessage = 'An error occurred while deleting the item.';
        }
      } else if (error.status === 422 && error.error && error.error.errors) {
        const validationErrors = Object.values(error.error.errors).flat().join('; ');
        errorMessage = `Validation error (${error.status}): ${validationErrors}`;
      } else if (error.status >= 400 && error.status < 500) {
        if (error.error && error.error.message) {
          errorMessage = `Client error (${error.status}): ${error.error.message}`;
        } else if (error.error && error.error.errors) {
          const validationErrors = Object.values(error.error.errors).flat().join('; ');
          errorMessage = `Validation error (${error.status}): ${validationErrors}`;
        } else {
          errorMessage = `Client error: ${error.status} ${error.statusText || ''}`;
        }
     } else if (error.status >= 500) {
        const text = error.statusText ? error.statusText.trim() : '';
        errorMessage = `Server error (${error.status}): ${text !== '' ? text : 'Internal Server Error'}`;
      }
    }
    console.error(`API Error: ${errorMessage}`);

    this.alertDialogService.open('API Error', errorMessage, 'danger');

    return throwError(() => new Error(errorMessage));
  };

  /**
   * @description Fetches a collection of items, automatically unwrapping the 'data' key if present.
   * @param apiUrl The relative path to the resource endpoint.
   * @param params Optional query parameters.
   * @returns {Observable<T[]>} A stream containing the item collection.
   */
  getCollection<T>(apiUrl: string, params?: any): Observable<T[]> {
    let httpParams = new HttpParams();
    
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.append(key, params[key]);
        }
      });
    }

    return this.http.get<T[] | { data: T[] }>(`${this.baseUrl}/${apiUrl}`, { 
      headers: this.getHeaders(),
      params: httpParams 
    }).pipe(
      map(response => {
        if (response && typeof response === 'object' && 'data' in response) {
          return (response as { data: T[] }).data;
        }
        return response as T[];
      }),
      catchError(this.handleError)
    );
  }

  /**
   * @description Fetches a paginated result set from the API.
   * @param apiUrl The relative path to the resource.
   * @returns {Observable<T>} The raw response object (e.g., paginated metadata).
   */
  getPaginatedCollection<T>(apiUrl: string): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}/${apiUrl}`, { headers: this.getHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * @description Performs a generic GET request.
   * @param apiUrl The relative path to the resource.
   * @returns {Observable<T>} The raw response object.
   */
  get<T>(apiUrl: string): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}/${apiUrl}`, { headers: this.getHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * @description Fetches a single resource, unwrapping it from the 'data' property.
   * @param apiUrl The relative path to the resource.
   * @returns {Observable<T>} The unwrapped entity.
   */
  getOne<T>(apiUrl: string): Observable<T> {
    return this.http.get<{ data: T }>(`${this.baseUrl}/${apiUrl}`, { headers: this.getHeaders() }).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  /**
   * @description Performs a POST request and unwraps the result from the 'data' property.
   * @param apiUrl The endpoint path.
   * @param data The payload.
   * @returns {Observable<T>} The created entity.
   */
  post<T>(apiUrl: string, data: any): Observable<T> {
    return this.http.post<{ data: T }>(`${this.baseUrl}/${apiUrl}`, data, { headers: this.getHeaders(data) }).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  /**
   * @description Performs a PUT request (full update) and unwraps the result.
   */
  put<T>(apiUrl: string, data: any): Observable<T> {
    return this.http.put<{ data: T }>(`${this.baseUrl}/${apiUrl}`, data, { headers: this.getHeaders(data) }).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  /**
   * @description Performs a PATCH request (partial update) and unwraps the result.
   */
  patch<T>(apiUrl: string, data: any): Observable<T> {
    return this.http.patch<{ data: T }>(`${this.baseUrl}/${apiUrl}`, data, { headers: this.getHeaders(data) }).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  /**
   * @description Performs a DELETE request.
   */
  delete(apiUrl: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${apiUrl}`, { headers: this.getHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * @description Performs a POST request specifically for multipart FormData (e.g., file uploads).
   */
  upload<T>(apiUrl: string, formData: FormData): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}/${apiUrl}`, formData, { headers: this.getHeaders(formData) }).pipe(
      catchError(this.handleError)
    );
  }
}