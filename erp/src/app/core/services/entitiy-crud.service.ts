/**
 * @file entity-crud.service.ts
 * @path src/app/core/services/entity-crud.service.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Lehká, jednoúčelová třída obalující volání DataHandleru pro JEDEN REST
 * endpoint (get/getOne/create/update/delete/restore/upload/updatePassword). Záměrně
 * neví vůbec nic o stránkování, cache, ani o duplicitě aktivní/koš tabulka — to je
 * odpovědnost PaginatedListStore.
 *
 * Vyextrahováno z BaseDataComponent, aby base komponenta přestala být "god class":
 * tuto třídu lze testovat izolovaně a používat i mimo dědičnost z BaseDataComponent
 * (viz PersonalInfoComponent, TableBuilderComponent, TrashTableBuilderComponent —
 * ty si ji nyní skládají přímo, místo aby dědily celý BaseDataComponent kvůli
 * pár metodám).
 *
 * @note Toto NENÍ @Injectable — instance se vytváří ručně, per endpoint, tam kde je
 * potřeba (komponenta dodá vlastní DataHandler + destroy$ subject).
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
   * @param dataHandler Sdílený HTTP klient s centralizovaným error handlingem.
   * @param endpointProvider Funkce vracející aktuální endpoint (ne plain string!) —
   *   `apiEndpoint` bývá nastaven přes property initializer v potomkovi, který se
   *   vyhodnotí AŽ PO doběhnutí konstruktoru base třídy / této služby. Lazy čtení
   *   přes funkci zabrání zachycení `undefined`.
   * @param destroy$ Subject, který komponenta pošle při zániku — zajišťuje úklid
   *   všech requestů vytvořených touto instancí.
   * @param onSettled Volitelný hook zavolaný po dokončení KAŽDÉHO requestu (úspěch
   *   i chyba) — typicky `() => this.cd.markForCheck()`. Služba díky tomu vůbec
   *   nemusí znát ChangeDetectorRef.
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
    return this.dataHandler.get<T>(`${this.endpoint}/${id}`).pipe(
      takeUntil(this.destroy$),
      finalize(() => this.onSettled?.())
    );
  }

  /** GET /{endpoint} (celá kolekce, bez stránkování) */
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

  /** DELETE /{endpoint}/{id} (volitelně ?force_delete=true) */
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

  /** POST (multipart) na endpoint nebo na `targetUrl`, pokud je zadán */
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

  /** GET /{endpoint}?no_pagination=true (+ volitelné filtry) */
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

  /** DELETE /{endpoint}/force-delete-all */
  hardDeleteAllTrashed(): Observable<void> {
    return this.dataHandler.delete(`${this.endpoint}/force-delete-all`).pipe(
      takeUntil(this.destroy$),
      finalize(() => this.onSettled?.())
    );
  }
}