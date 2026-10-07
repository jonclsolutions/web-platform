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
 * @bugfix-note (2026-10) NG0200 "Circular dependency detected for InjectionToken
 * HTTP_INTERCEPTORS" + admin jazyk se nenačetl (všude `'Cannot load text'`):
 * První verze refactoru výše injektovala `AdminLocalizationService` EAGER (pole třídy
 * `inject(AdminLocalizationService)`). `DataHandler` ale vzniká UVNITŘ sestavování
 * řetězce HTTP interceptorů (první request aplikace -> HTTP_INTERCEPTORS ->
 * AuthTokenInterceptor -> AuthService -> GenericTableService -> DataHandler)
 * a `AdminLocalizationService` ve svém konstruktoru hned posílá `http.get()` pro JSON
 * jazyka - tedy request, který potřebuje tentýž, ještě nedostavěný řetězec
 * interceptorů. Angular to vyhodnotí jako kruhovou závislost, `catchError`
 * v `loadLanguage()` chybu spolkne a publikuje prázdný překlad.
 * OPRAVA: `AdminLocalizationService` se z `Injector` vytahuje až při PRVNÍM použití
 * (getter `i18n`), tj. až v `handleError` po dokončeném HTTP requestu, kdy je řetězec
 * interceptorů dávno sestavený. `AdminLocalizationService` beze změny.
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

/**
 * @description Handles REST API interactions, including header management, serialization, and global error processing.
 * @usage Used exclusively within the 'admin' module for managing authenticated data resources.
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
 * @description Fetches a single resource, unwrapping it from the 'data' property
 * WHEN PRESENT. Defensive against backend inconsistency: some controllers wrap their
 * show() response in ['data' => ...], others return the resource directly - see
 * getCollection() above for the same defensive pattern. Without this check, a
 * non-wrapped response would silently resolve to `undefined` after unwrapping.
 * @param apiUrl The relative path to the resource.
 * @returns {Observable<T>} The unwrapped entity (or the raw response if it was never wrapped).
 */
getOne<T>(apiUrl: string): Observable<T> {
  return this.http.get<T | { data: T }>(`${this.baseUrl}/${apiUrl}`, { headers: this.getHeaders() }).pipe(
    map(response => {
      if (response && typeof response === 'object' && 'data' in response) {
        return (response as { data: T }).data;
      }
      return response as T;
    }),
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
   * @bugfix-note (2026-08-19) `FormData` payload (soubory) se teď posílá jako `POST`
   * s method-override polem `_method=PUT` - viz hlavička souboru. Bez multipart obsahu
   * (běžný JSON payload) beze změny - skutečný HTTP PUT, jako dřív.
   */
  put<T>(apiUrl: string, data: any): Observable<T> {
    if (data instanceof FormData) {
      return this.postWithMethodOverride<T>(apiUrl, data, 'PUT');
    }
    return this.http.put<{ data: T }>(`${this.baseUrl}/${apiUrl}`, data, { headers: this.getHeaders(data) }).pipe(
      map(response => response.data),
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
    return this.http.patch<{ data: T }>(`${this.baseUrl}/${apiUrl}`, data, { headers: this.getHeaders(data) }).pipe(
      map(response => response.data),
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
    return this.http.post<{ data: T }>(`${this.baseUrl}/${apiUrl}`, formData, { headers: this.getHeaders(formData) }).pipe(
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
uploadPut<T>(apiUrl: string, formData: FormData): Observable<T> {
  return this.http.post<T>(`${this.baseUrl}/${apiUrl}`, formData, { headers: this.getHeaders(formData) }).pipe(
    catchError(this.handleError)
  );
}
}