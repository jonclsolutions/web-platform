/**
 * @file data-handler.service.ts
 * @path src/app/core/services/data-handler.service.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Centralized HTTP data handler service for administrative operations, providing standard CRUD methods with integrated error reporting.
 * @dependencies
 * - HttpClient: Facilitates secure API communication.
 * - AlertDialogService: Displays the single, authoritative user-facing error dialog upon API failure.
 * - AdminLocalizationService: Statická (bundlovaná) lokalizace admin UI - zdroj všech
 *   uživatelsky viditelných textů chybového dialogu, viz refactor-note (2026-10) níže.
 *
 * @refactor-note (2026-10) BACKLOG "vícejazyčná administrace, žádné hardcoded texty":
 * Všechny uživatelsky viditelné texty v `handleError` (titulek dialogu + všechny
 * varianty chybové zprávy) nahrazeny i18n klíči ze sekce `data-handler`
 * v `assets/i18n/admin/{lang}/{lang}.json`. Služba nededí BaseDataComponent, proto
 * ruční injection `AdminLocalizationService` dle vzoru `WelcomePageComponent`
 * (privátní `t(key)` s automatickým prefixem sekce).
 * - Signatura konstruktoru zůstává beze změny (žádný dopad na existující testy/mocky);
 *   služba se získává LÍNĚ přes `Injector` - viz bugfix-note (2026-10) níže.
 * - Dynamické části zpráv (HTTP status, text z backendu, validační chyby) se do
 *   přeloženého textu dosazují přes pojmenované placeholdery `{status}`, `{message}`,
 *   `{errors}`, `{statusText}` - stejná konvence jako `{name}` ve
 *   `welcome-page.welcome_message`. Viz `t()` níže.
 * - Texty se čtou až V OKAMŽIKU chyby (ne při vytvoření služby), takže dialog je vždy
 *   v aktuálně zvoleném admin jazyce i po jeho přepnutí za běhu.
 * - ZÁMĚRNĚ NEPŘELOŽENO: `console.error` výpisy (diagnostika pro vývojáře, ne UI)
 *   a texty, které přijdou hotové z backendu (`error.error.message`, validační chyby
 *   v `error.error.errors`) - jejich jazyk určuje Laravel API, ne tahle služba.
 * - Žádná změna logiky větvení, HTTP volání ani veřejného API - jen texty.
 *
 * @refactor-note (2026-10-24) Open finding #6 - one response envelope: every read / write
 *   method returns the `data` of `{data, meta?, message?}`; `getPaginatedCollection()` /
 *   `getWithMeta()` / `postWithMeta()` return the whole envelope for callers that need `meta`
 *   (pagination, `has_more_older_messages`, `activation_email_sent`). See `ApiEnvelope`.
 *
 * @note Důsledek: pokud by první chyba přes `DataHandler` nastala dřív, než si
 * `AdminLocalizationService` vyžádá jakákoli admin komponenta (v administraci to dělá
 * `AdminLayoutComponent`/`BaseDataComponent`), služba teprve vznikne a JSON se teprve
 * začne stahovat - tento jeden dialog pak ukáže `'Cannot load text'`.
 * NIKDY nevracet eager injection do pole třídy ani do konstruktoru.
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
 * @note SINGLE SOURCE OF TRUTH for error toasts - see bugfix-note above. Consuming
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
   * @description Injector pro LÍNÉ získání `AdminLocalizationService` - viz getter
   * `i18n` níže a bugfix-note (2026-10) v hlavičce souboru. `Injector` sám žádný HTTP
   * request nespouští, jeho eager injection je proto bezpečná.
   */
  private readonly injector = inject(Injector);

  /** Cache instance pro getter `i18n` - `undefined` do prvního použití. */
  private _i18n?: AdminLocalizationService;

  /**
   * @description Líně (až při prvním čtení) vytáhne `AdminLocalizationService`
   * z `Injector`. ZÁMĚRNĚ ne `inject(AdminLocalizationService)` jako pole třídy:
   * `DataHandler` vzniká uvnitř sestavování řetězce HTTP interceptorů a konstruktor
   * `AdminLocalizationService` hned posílá HTTP request -> NG0200. Viz bugfix-note
   * (2026-10) v hlavičce souboru.
   * @refactor-note (2026-10) BACKLOG "vícejazyčná administrace, žádné hardcoded texty" -
   * viz hlavička souboru.
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
   * @description Vrátí přeložený text ze sekce `data-handler` a dosadí do něj
   * pojmenované placeholdery (`{status}`, `{message}`, ...). Viz refactor-note (2026-10)
   * v hlavičce souboru.
   * @param key Klíč UVNITŘ sekce `data-handler` (bez prefixu sekce), např. `'network_error'`.
   * @param params Hodnoty pro placeholdery - klíč objektu = název placeholderu bez závorek.
   * @returns {string} Hotový text v aktuálně zvoleném admin jazyce.
   * @note Dosazení běží v JEDNOM průchodu přes callback, ne řetězením `.replace()`:
   * hodnoty pocházejí z backendu (chybová zpráva, validační texty) a mohou samy
   * obsahovat `{...}` nebo `$&`/`$1` - ty se tak nikdy nevyhodnotí jako další
   * placeholder ani jako speciální náhradový vzor. Placeholder bez odpovídající
   * hodnoty v `params` zůstane v textu beze změny (snadno viditelná chyba v JSONu).
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
   * @refactor-note (2026-10) Všechny uživatelsky viditelné texty (titulek dialogu
   * i zprávy) nahrazeny i18n klíči sekce `data-handler` - viz hlavička souboru.
   * Větvení podle `error.status` beze změny; `console.error` výpisy zůstávají
   * záměrně nepřeložené (diagnostika, ne UI).
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
        } else if (error.error && error.error.message) {
            errorMessage = error.error.message;
        } else {
          errorMessage = this.t('forbidden_fallback');
        }
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
          // `.trim()` - prázdný `statusText` (běžné u HTTP/2) by jinak nechal mezeru na konci.
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

    // @bugfix-note (2026-08-31): rethrow the ORIGINAL error (not a repackaged plain
    // Error) - see bugfix-note in file header. Consuming components can inspect
    // err.status/err.error for non-toast logic, but must never show a second toast.
    return throwError(() => error);
  };

  /**
   * @description Fetches a list and returns its `data`.
   * @refactor-note (2026-10-24) Open finding #6: the API answers every payload as `{data, meta?}`
   *   (App\Traits\RespondsWithData), so `data` is read without guessing - the tolerance for bare
   *   answers is gone (a bare answer would now be an API bug, caught by its tests).
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
   * @refactor-note (2026-10-24) Returned the raw body before (each caller read its own shape -
   *   `.languages`, `.page_titles`, `.data`, the bare record …, open finding #6); now the same as
   *   getOne(). Callers that need `meta` use getWithMeta().
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
   * @bugfix-note (2026-10-23) post / put / patch read `response.data` unconditionally while many
   *   endpoints answered the bare resource (open finding #6) - both shapes were accepted then.
   * @refactor-note (2026-10-24) The API answers one envelope now (finding #6) - only `data` is
   *   read; an answer without a body (204) gives null.
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
   * @bugfix-note (2026-08-19) `FormData` payload (soubory) se teď posílá jako `POST`
   * s method-override polem `_method=PUT` - viz hlavička souboru. Bez multipart obsahu
   * (běžný JSON payload) beze změny - skutečný HTTP PUT, jako dřív.
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
   * @bugfix-note (2026-08-19) `FormData` payload (soubory) se teď posílá jako `POST`
   * s method-override polem `_method=PATCH` - viz hlavička souboru. Bez multipart obsahu
   * (běžný JSON payload) beze změny - skutečný HTTP PATCH, jako dřív.
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
   * @description Pošle `FormData` payload jako skutečný HTTP `POST` s Laravel method-
   * override polem `_method` v těle requestu - jediný spolehlivý způsob, jak dostat
   * multipart (soubory) tělo do PUT/PATCH endpointu, protože PHP samo o sobě multipart
   * tělo pro PUT/PATCH nikdy neparsuje (viz bugfix-note v hlavičce souboru). Laravel
   * router `_method` pole v POST requestu automaticky rozpozná a nasměruje na
   * odpovídající PUT/PATCH route - žádná úprava backend routes není potřeba.
   * @param apiUrl Cílová cesta (stejná, na kterou by šel "opravdový" PUT/PATCH).
   * @param formData Multipart payload, do kterého se přidá `_method` pole.
   * @param method Metoda, kterou má Laravel uvnitř aplikace použít místo transportního POST.
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
