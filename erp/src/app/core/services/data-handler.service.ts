/**
 * @file data-handler.service.ts
 * @path src/app/core/services/data-handler.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Centralized HTTP data handler service for administrative operations, providing standard CRUD methods with integrated error reporting.
 * @dependencies
 * - HttpClient: Facilitates secure API communication.
 * - AlertDialogService: Displays the single, authoritative user-facing error dialog upon API failure.
 * - AdminLocalizationService: Static (bundled) localization of the admin UI - source of all
 *   user-visible texts of the error dialog (resolved lazily, see `i18n`).
 *
 * @note Consequence of the lazy lookup: when the first error through `DataHandler` happens before
 * any admin component asked for `AdminLocalizationService` (in the admin this is done by
 * `AdminLayoutComponent` / `BaseDataComponent`), the service is created only then and its JSON
 * only starts loading - that one dialog then shows `'Cannot load text'`.
 * NEVER switch back to eager injection in a class field or the constructor.
 */

import { Injectable, Injector, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AlertDialogService } from './alert-dialog.service';
import { AdminLocalizationService } from './admin-localization.service';
import { environment } from '../../../environments/environment';
import { ApiEnvelope, ApiPage } from '../../shared/interfaces/api-envelope';

/**
 * @description Handles REST API interactions, including header management, serialization, and global error processing.
 * @usage Used exclusively within the 'admin' module for managing authenticated data Sresources.
 * @note SINGLE SOURCE OF TRUTH for error toasts. Consuming
 * components must NOT show their own error toast; they may still branch on
 * `err.status`/`err.error` in their `error:` callback for non-toast cleanup logic
 * (resetting a loading flag, restoring edit state, etc).
 */
@Injectable({
  providedIn: 'root'
})
export class DataHandler {
  private baseUrl = environment.base_api_url;

  /**
   * @description Injector for the LAZY lookup of `AdminLocalizationService` - see the `i18n`
   * getter below. `Injector` itself sends no HTTP request, so its eager injection is safe.
   */
  private readonly injector = inject(Injector);

  /** Cached instance of the `i18n` getter - `undefined` until first use. */
  private _i18n?: AdminLocalizationService;

  /**
   * @description Lazily (on the first read) gets `AdminLocalizationService` from the `Injector`.
   * Deliberately NOT `inject(AdminLocalizationService)` as a class field: `DataHandler` is created
   * while the HTTP interceptor chain is being built and the constructor of
   * `AdminLocalizationService` sends an HTTP request at once -> NG0200.
   */
  private get i18n(): AdminLocalizationService {
    if (!this._i18n) {
      this._i18n = this.injector.get(AdminLocalizationService);
    }
    return this._i18n;
  }

  constructor(
    private http: HttpClient,
    private alertDialogService: AlertDialogService
  ) { }

  /**
   * @description Returns a translated text of the `data-handler` section with the named
   * placeholders (`{status}`, `{message}`, ...) filled in.
   * @param key Key INSIDE the `data-handler` section (without the section prefix), e.g. `'network_error'`.
   * @param params Values of the placeholders - object key = placeholder name without braces.
   * @returns {string} Ready text in the current admin language.
   * @note The substitution runs in ONE pass through a callback, not by chaining `.replace()`:
   * the values come from the backend (error message, validation texts) and may contain `{...}`
   * or `$&` / `$1` themselves - they are never evaluated as another placeholder or a special
   * replacement pattern. A placeholder without a value in `params` stays in the text unchanged
   * (an easily visible error in the JSON).
   */
  private t(key: string, params: Record<string, string | number> = {}): string {
    const template = this.i18n.getValue(`data-handler.${key}`);
    return template.replace(/\{(\w+)\}/g, (placeholder: string, name: string) =>
      Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : placeholder
    );
  }

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
   * @description Processes and standardizes HTTP error responses from the backend,
   * shows the SINGLE authoritative toast for it, then rethrows the ORIGINAL
   * `HttpErrorResponse` unchanged (not a repackaged plain `Error`) so consuming
   * components can still inspect `err.status`/`err.error` for their own non-toast
   * cleanup logic without ever showing a second toast themselves.
   * @param error The raw HttpErrorResponse object.
   * @returns {Observable<never>} An observable that throws the original error.
   */
  private handleError = (error: HttpErrorResponse): Observable<never> => {
    let errorMessage = this.t('unknown_error');
    if (error.error instanceof ErrorEvent) {
      errorMessage = this.t('client_side_error', { message: error.error.message });
    } else {
      console.error(
        `Backend returned code ${error.status}, ` +
        `response body: ${JSON.stringify(error.error)}`);

      if (error.status === 0) {
        errorMessage = this.t('network_error');
      } else if (error.status === 403) {
        if (error.error && error.error.error_code === 'CANNOT_DELETE_OWN_ACCOUNT') {
          errorMessage = this.t('cannot_delete_own_account');
        } else if (error.error?.error_code === 'PASSWORD_CONFIRMATION_REQUIRED') {
          // Step-up confirmation cancelled in the password dialog (2026-10-26).
          errorMessage = this.t('password_confirmation_required');
        } else if (error.error && error.error.message) {
            errorMessage = error.error.message;
        } else {
          errorMessage = this.t('forbidden_fallback');
        }
      } else if (error.status === 422 && error.error?.error_code === 'EMAIL_POLICY_SELF_LOCKOUT') {
        // A policy change that would lock out the acting sysadmin (2026-10-24) - translated text.
        errorMessage = this.t('email_policy_self_lockout');
      } else if (error.status === 422 && error.error && error.error.errors) {
        const validationErrors = Object.values(error.error.errors).flat().join('; ');
        errorMessage = this.t('validation_error', { status: error.status, errors: validationErrors });
      } else if (error.status >= 400 && error.status < 500) {
        if (error.error && error.error.message) {
          errorMessage = this.t('client_error_with_message', { status: error.status, message: error.error.message });
        } else if (error.error && error.error.errors) {
          const validationErrors = Object.values(error.error.errors).flat().join('; ');
          errorMessage = this.t('validation_error', { status: error.status, errors: validationErrors });
        } else {
          // `.trim()` - an empty `statusText` (common with HTTP/2) would leave a trailing space.
          errorMessage = this.t('client_error', { status: error.status, statusText: error.statusText || '' }).trim();
        }
     } else if (error.status >= 500) {
        const text = error.statusText ? error.statusText.trim() : '';
        errorMessage = this.t('server_error', {
          status: error.status,
          statusText: text !== '' ? text : this.t('server_error_default_text')
        });
      }
    }
    console.error(`API Error: ${errorMessage}`);

    this.alertDialogService.open(this.t('dialog_title'), errorMessage, 'danger');

    return throwError(() => error);
  };

  /**
   * @description Fetches a list and returns its `data`.
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

    return this.http.get<ApiEnvelope<T[]>>(`${this.baseUrl}/${apiUrl}`, {
      headers: this.getHeaders(),
      params: httpParams
    }).pipe(
      map(response => this.unwrap<T[]>(response)),
      catchError(this.handleError)
    );
  }

  /**
   * @description Fetches one page of a list: `{data: T[], meta: {total, per_page, current_page, last_page}}`.
   * @param apiUrl The relative path to the resource (with page / filter query).
   * @returns {Observable<ApiPage<T>>} Items and pagination.
   */
  getPaginatedCollection<T>(apiUrl: string): Observable<ApiPage<T>> {
    return this.http.get<ApiPage<T>>(`${this.baseUrl}/${apiUrl}`, { headers: this.getHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * @description GET returning the payload (`data`) of the answer.
   * @param apiUrl The relative path to the resource.
   * @returns {Observable<T>} The payload.
   */
  get<T>(apiUrl: string): Observable<T> {
    return this.getOne<T>(apiUrl);
  }

  /**
   * @description GET keeping the whole envelope `{data, meta?, message?}` - for answers with
   *   extra information beside the payload (e.g. `has_more_older_messages` of a message page).
   * @param apiUrl The relative path to the resource.
   * @returns {Observable<ApiEnvelope<T, M>>} Payload and meta.
   */
  getWithMeta<T, M = Record<string, any>>(apiUrl: string): Observable<ApiEnvelope<T, M>> {
    return this.http.get<ApiEnvelope<T, M>>(`${this.baseUrl}/${apiUrl}`, { headers: this.getHeaders() }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * @description Fetches a single resource (the `data` of the answer).
   * @param apiUrl The relative path to the resource.
   * @returns {Observable<T>} The entity.
   */
  getOne<T>(apiUrl: string): Observable<T> {
    return this.http.get<ApiEnvelope<T>>(`${this.baseUrl}/${apiUrl}`, { headers: this.getHeaders() }).pipe(
      map(response => this.unwrap<T>(response)),
      catchError(this.handleError)
    );
  }

  /**
   * @description Reads the payload of an answer.
   * @param response Raw response body (`{data, …}` or null for 204).
   * @returns The payload, or null.
   */
  private unwrap<T>(response: ApiEnvelope<T> | null): T {
    return (response?.data ?? null) as T;
  }

  /**
   * @description POST keeping the whole envelope `{data, meta?, message?}` - for endpoints that
   *   send extra information beside the record, e.g. `meta.activation_email_sent` of
   *   `POST core/users` (open findings #11, #6).
   * @param apiUrl The endpoint path.
   * @param data The payload.
   * @returns {Observable<ApiEnvelope<T, M>>} Record plus meta.
   */
  postWithMeta<T, M = Record<string, any>>(apiUrl: string, data: any): Observable<ApiEnvelope<T, M>> {
    return this.http.post<ApiEnvelope<T, M>>(`${this.baseUrl}/${apiUrl}`, data, { headers: this.getHeaders(data) }).pipe(
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
    return this.http.post<ApiEnvelope<T>>(`${this.baseUrl}/${apiUrl}`, data, { headers: this.getHeaders(data) }).pipe(
      map(response => this.unwrap<T>(response)),
      catchError(this.handleError)
    );
  }

  /**
   * @description Performs a PUT request (full update) and unwraps the result.
   */
  put<T>(apiUrl: string, data: any): Observable<T> {
    if (data instanceof FormData) {
      return this.postWithMethodOverride<T>(apiUrl, data, 'PUT');
    }
    return this.http.put<ApiEnvelope<T>>(`${this.baseUrl}/${apiUrl}`, data, { headers: this.getHeaders(data) }).pipe(
      map(response => this.unwrap<T>(response)),
      catchError(this.handleError)
    );
  }

  /**
   * @description Performs a PATCH request (partial update) and unwraps the result.
   */
  patch<T>(apiUrl: string, data: any): Observable<T> {
    if (data instanceof FormData) {
      return this.postWithMethodOverride<T>(apiUrl, data, 'PATCH');
    }
    return this.http.patch<ApiEnvelope<T>>(`${this.baseUrl}/${apiUrl}`, data, { headers: this.getHeaders(data) }).pipe(
      map(response => this.unwrap<T>(response)),
      catchError(this.handleError)
    );
  }

  /**
   * @description Sends a `FormData` payload as a real HTTP `POST` with the Laravel method-override
   * field `_method` in the body - the only reliable way to get a multipart (files) body into a
   * PUT / PATCH endpoint, because PHP never parses a multipart body of PUT / PATCH by itself.
   * The Laravel router recognizes the `_method` field of a POST and routes it to the matching
   * PUT / PATCH route - no backend route change needed.
   * @param apiUrl Target path (the same a "real" PUT / PATCH would go to).
   * @param formData Multipart payload the `_method` field is added to.
   * @param method Method Laravel should use inside the application instead of the transport POST.
   */
  private postWithMethodOverride<T>(apiUrl: string, formData: FormData, method: 'PUT' | 'PATCH'): Observable<T> {
    formData.append('_method', method);
    return this.http.post<ApiEnvelope<T>>(`${this.baseUrl}/${apiUrl}`, formData, { headers: this.getHeaders(formData) }).pipe(
      map(response => this.unwrap<T>(response)),
      catchError(this.handleError)
    );
  }

  /**
   * @description Performs a DELETE request; returns the payload (`data`) of an answer with a body
   *   (e.g. `{deleted_count, skipped_count}` of a partly kept trash), null for 204 (finding #6).
   */
  delete<T = void>(apiUrl: string): Observable<T> {
    return this.http.delete<ApiEnvelope<T> | null>(`${this.baseUrl}/${apiUrl}`, { headers: this.getHeaders() }).pipe(
      map(response => this.unwrap<T>(response)),
      catchError(this.handleError)
    );
  }

  /**
   * @description Performs a POST request specifically for multipart FormData (e.g., file uploads)
   *   and returns the payload (`data`) of the answer (finding #6).
   */
  upload<T>(apiUrl: string, formData: FormData): Observable<T> {
    return this.http.post<ApiEnvelope<T>>(`${this.baseUrl}/${apiUrl}`, formData, { headers: this.getHeaders(formData) }).pipe(
      map(response => this.unwrap<T>(response)),
      catchError(this.handleError)
    );
  }

  /**
   * @description Multipart POST to an update endpoint (the caller adds `_method`), returns `data`.
   */
  uploadPut<T>(apiUrl: string, formData: FormData): Observable<T> {
    return this.upload<T>(apiUrl, formData);
  }
}
