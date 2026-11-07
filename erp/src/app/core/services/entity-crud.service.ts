/**
 * @file entity-crud.service.ts
 * @path src/app/core/services/entity-crud.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Light single-purpose class wrapping the DataHandler calls of ONE REST endpoint
 * (get / getOne / create / update / delete / restore / upload / updatePassword). Deliberately
 * knows nothing about pagination, cache or the active / trash table pair - that is the
 * responsibility of PaginatedListStore.
 * @usage Testable in isolation and usable without inheriting BaseDataComponent (see
 * PersonalInfoComponent, TableBuilderComponent, TrashTableBuilderComponent - they compose it
 * directly).
 *
 * @note This is NOT @Injectable - an instance is created manually, per endpoint, where needed
 * (the component provides its own DataHandler + destroy$ subject).
 */

import { Observable, Subject, throwError } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { DataHandler } from './data-handler.service';

export interface DeleteOptions {
  forceDelete?: boolean;
  params?: { force_delete?: string | boolean; [key: string]: any };
}

export class EntityCrudService<T = any> {
  /**
   * @param dataHandler Shared HTTP client with centralized error handling.
   * @param endpointProvider Function returning the current endpoint (not a plain string!) -
   *   `apiEndpoint` is often set by a property initializer of the subclass, evaluated only AFTER
   *   the constructor of the base class / this service finished. Reading it lazily through a
   *   function prevents capturing `undefined`.
   * @param destroy$ Subject the component emits on destroy - cleans up all requests created by
   *   this instance.
   * @param onSettled Optional hook called after EVERY request finishes (success and error) -
   *   typically `() => this.cd.markForCheck()`. The service does not need to know
   *   ChangeDetectorRef.
   */
  constructor(
    private dataHandler: DataHandler,
    private endpointProvider: () => string,
    private destroy$: Subject<void>,
    private onSettled?: () => void
  ) {}

  private get endpoint(): string {
    return this.endpointProvider();
  }

  /** GET /{endpoint}/{id} */
getOne(id: number | undefined): Observable<T> {
  if (!id) return throwError(() => new Error('ID undefined.'));
  return this.dataHandler.getOne<T>(`${this.endpoint}/${id}`).pipe(
    takeUntil(this.destroy$),
    finalize(() => this.onSettled?.())
  );
}

  /** GET /{endpoint} (whole collection, no pagination) */
  getCollection(params?: any): Observable<T[]> {
    return this.dataHandler.getCollection<T>(this.endpoint, params).pipe(
      takeUntil(this.destroy$),
      finalize(() => this.onSettled?.())
    );
  }

  /** POST /{endpoint} */
  create(data: T): Observable<T> {
    return this.dataHandler.post<T>(this.endpoint, data).pipe(
      takeUntil(this.destroy$),
      finalize(() => this.onSettled?.())
    );
  }

  /** PUT /{endpoint}/{id} */
  update(id: number | undefined, data: T): Observable<T> {
    if (!id) return throwError(() => new Error('ID undefined.'));
    return this.dataHandler.put<T>(`${this.endpoint}/${id}`, data).pipe(
      takeUntil(this.destroy$),
      finalize(() => this.onSettled?.())
    );
  }

  /** DELETE /{endpoint}/{id} (optionally ?force_delete=true) */
  remove(id: number | undefined, options: DeleteOptions = {}): Observable<void> {
    if (!id) return throwError(() => new Error('ID undefined.'));

    let url = `${this.endpoint}/${id}`;
    const forced =
      options.params?.force_delete === 'true' ||
      options.params?.force_delete === true ||
      options.forceDelete === true;

    if (forced) url += '?force_delete=true';

    return this.dataHandler.delete(url).pipe(
      takeUntil(this.destroy$),
      finalize(() => this.onSettled?.())
    );
  }

  /** POST /{endpoint}/{id}/restore */
  restore(id: number): Observable<T> {
    return this.dataHandler.post<T>(`${this.endpoint}/${id}/restore`, {} as T).pipe(
      takeUntil(this.destroy$),
      finalize(() => this.onSettled?.())
    );
  }

  /** POST (multipart) to the endpoint or to `targetUrl` when given */
  upload<U>(formData: FormData, targetUrl?: string): Observable<U> {
    return this.dataHandler.upload<U>(targetUrl || this.endpoint, formData).pipe(
      takeUntil(this.destroy$),
      finalize(() => this.onSettled?.())
    );
  }

  /** PUT /{endpoint}/{id}/change-password */
  updatePassword(id: number, data: any): Observable<any> {
    if (!id) return throwError(() => new Error('User ID undefined.'));
    return this.dataHandler.put<any>(`${this.endpoint}/${id}/change-password`, data).pipe(
      takeUntil(this.destroy$),
      finalize(() => this.onSettled?.())
    );
  }

  /** GET /{endpoint}?no_pagination=true (+ optional filters) */
  loadAll(filters?: Record<string, any>): Observable<T[]> {
    const params = new URLSearchParams();
    params.set('no_pagination', 'true');

    if (filters) {
      Object.keys(filters).forEach(key => {
        const value = filters[key];
        if (value !== '' && value !== null && value !== undefined) {
          params.set(key, value.toString());
        }
      });
    }

    return this.dataHandler.getCollection<T>(`${this.endpoint}?${params.toString()}`).pipe(
      takeUntil(this.destroy$)
    );
  }

  /**
   * DELETE /{endpoint}/force-delete-all
   * @returns null (204) or the payload `{deleted_count, skipped_count}` when the API kept some
   *   records (e.g. shop customers with orders, finding #22; envelope since finding #6).
   */
  hardDeleteAllTrashed(): Observable<null | { deleted_count: number; skipped_count: number }> {
    return this.dataHandler.delete<null | { deleted_count: number; skipped_count: number }>(`${this.endpoint}/force-delete-all`).pipe(
      takeUntil(this.destroy$),
      finalize(() => this.onSettled?.())
    );
  }
}