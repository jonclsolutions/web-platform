/**
 * @file generic-table.service.ts
 * @path src/app/core/services/generic-table.service.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Provides generic pagination, caching, and preloading logic for data-driven tables within the admin panel.
 * @dependencies
 * - DataHandler: Used to perform the actual HTTP requests for collection data.
 *
 * @refactor-note (2026-08) KRITICKÁ OPRAVA CACHE: `lastFilterParams` bylo JEDNO sdílené
 * pole napříč VŠEMI tabulkami v celé aplikaci - jakmile se otevřela jiná tabulka s jinými
 * filtry (což je prakticky pořád, každá stránka má vlastní default `sort_by`), spustila
 * se `clearCache()` a smazala se ÚPLNĚ CELÁ cache, ne jen daný endpoint. V praxi to
 * znamenalo, že cache napříč navigací mezi stránkami prakticky nikdy nepřežila, takže
 * každý vstup na stránku dělal plný síťový dotaz - viz backlog task "zbytečně moc
 * dotazů na API". Odstraněno beze náhrady: cache klíč (`getCacheKey`) už filtry
 * zahrnuje, takže změna filtrů přirozeně vytvoří nový klíč = cache miss = reálný
 * fetch, bez potřeby cokoliv ručně mazat.
 *
 * Místo toho zaveden TTL (`CACHE_TTL_MS`) - každá cachovaná stránka má timestamp a po
 * uplynutí platnosti se považuje za cache miss (přefetchne se). Zároveň přidány
 * `invalidateEndpoint()` (zneplatní jen konkrétní zdroj - použito po mutaci dat a
 * tlačítkem "Aktualizovat" na jedné tabulce) a `invalidateAll()` (globální refresh
 * tlačítko v headeru). `preloadAdjacentPages()` nyní respektuje TTL při rozhodování,
 * jestli sousední stránku má smysl znovu stahovat.
 *
 * @bugfix-note (2026-08-17) KRITICKÝ BEZPEČNOSTNÍ BUG - CROSS-USER CACHE LEAK (primární
 * oprava, viz auth.service.ts): cache klíč nikdy neobsahoval identitu uživatele, jen
 * `endpoint-page-perPage-filters`. Protože je tahle služba `providedIn: 'root'` (jedna
 * sdílená `pageCache` mapa pro celou SPA session), po přepnutí uživatele BEZ reloadu
 * stránky (běžný SPA flow: logout -> login jiným účtem) mohl uživatel B do vypršení
 * `CACHE_TTL_MS` dostat cache hit s daty uživatele A, aniž by se poslal jakýkoliv nový
 * HTTP request - backendový `user_id` scoping (viz CoreExternalLinkController) tak byl
 * úplně obejitý, protože se vůbec nezavolal. Primární oprava je v `AuthService`
 * (`persistSession()`/`clearAuthData()` teď volají `invalidateAll()` při KAŽDÉ změně
 * identity uživatele).
 *
 * TOTO je DRUHÁ VRSTVA OCHRANY (defense in depth): `getCacheKey()` nově zahrnuje i ID
 * aktuálně přihlášeného uživatele (`sessionStorage.getItem('userId')`, stejný klíč, který
 * plní `AuthService.persistSession()`). I kdyby v budoucnu vznikla jiná cesta, jak se
 * změní přihlášený uživatel BEZ zavolání `AuthService.persistSession()`/`clearAuthData()`
 * (např. budoucí "přepnout účet"/impersonation feature, které by na `invalidateAll()`
 * zapomnělo), cache klíče dvou různých uživatelů se přirozeně nikdy nepotkají - cache je
 * teď per-user už ze své podstaty, ne jen díky tomu, že ji někdo v tu správnou chvíli
 * ručně zneplatní. Vědomě NEinjektuje `AuthService` (kruhová závislost - `AuthService`
 * injektuje `GenericTableService`), čte se přímo `sessionStorage`, stejně jako
 * `AuthService.getUserId()` dělá interně.
 */

import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { DataHandler } from './data-handler.service';

export interface FilterParams {
  [key: string]: string | number | boolean | undefined | null;
}

export interface PaginatedResponse<T> {
  current_page: number;
  data: T[];
  first_page_url: string;
  from: number;
  last_page: number;
  last_page_url: string;
  links: any[];
  next_page_url: string | null;
  path: string;
  per_page: number;
  prev_page_url: string | null;
  to: number;
  total: number;
}

interface CacheEntry {
  observable: Observable<PaginatedResponse<any>>;
  timestamp: number;
}

/**
 * @description Manages state and caching for paginated data tables.
 * @usage Injected into admin list components to handle server-side pagination, search filtering, and performance optimizations.
 * @note Cache je bezpečná i pro velké (desetitisícové) tabulky - cachuje se vždy jen
 * konkrétní REQUESTOVANÁ stránka (15-50 řádků), nikdy "vše". Paměťová stopa roste jen
 * s tím, kolik stránek/filtrů uživatel reálně navštívil, ne s velikostí tabulky.
 * @note Cache klíč je per-uživatel (viz bugfix-note 2026-08-17 výše) - přepnutí
 * přihlášeného uživatele automaticky znamená nové (prázdné) cache klíče, nikdy sdílené
 * s předchozím uživatelem.
 */
@Injectable({
  providedIn: 'root'
})
export class GenericTableService {
  /**
   * @description Doba (ms), po kterou se cachovaná stránka považuje za "čerstvou" a
   * nevyvolá nový HTTP dotaz. 3 minuty je kompromis mezi "admin vidí rozumně aktuální
   * data bez ručního refreshe" a "nechceme zbytečně bušit do API při rychlé navigaci
   * tam a zpět". Ruční refresh tlačítko (viz `invalidateEndpoint`) i mutace dat (create/
   * update/delete/restore, přes stejný mechanismus v PaginatedListStore.forceFullRefresh())
   * TTL vždy obcházejí.
   */
  public readonly CACHE_TTL_MS = 3 * 60 * 1000;

  /** @description Klíč v sessionStorage, pod kterým `AuthService.persistSession()` ukládá ID přihlášeného uživatele. Musí zůstat v souladu s auth.service.ts. */
  private readonly USER_ID_STORAGE_KEY = 'userId';

  /** @description Fallback segment cache klíče, když žádný uživatel není přihlášený (sessionStorage prázdný) - odlišuje "nepřihlášeno" od reálného ID, ať se náhodou nesrazí. */
  private readonly ANONYMOUS_CACHE_SEGMENT = '__anon__';

  private pageCache = new Map<string, CacheEntry>();

  constructor(private dataHandler: DataHandler) {}

  /**
   * @description Fetches a paginated result set with support for filters and caching.
   * @note Pokud je cachovaná stránka mladší než `CACHE_TTL_MS`, vrátí se BEZ síťového
   * dotazu (shareReplay observable z předchozího volání). Jinak se cache položka
   * zahodí a provede se reálný fetch s novým timestampem.
   */
  getPaginatedData<T>(
    endpoint: string,
    page: number = 1,
    perPage: number = 15,
    filters: FilterParams = {}
  ): Observable<PaginatedResponse<T>> {
    const cacheKey = this.getCacheKey(endpoint, page, perPage, filters);
    const cached = this.pageCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL_MS) {
      return cached.observable as Observable<PaginatedResponse<T>>;
    }

    let params = new HttpParams();
    params = params.append('page', page.toString());
    params = params.append('per_page', perPage.toString());
    for (const key in filters) {
      const value = filters[key];
      if (value !== undefined && value !== null && value !== '') {
        params = params.append(key, value.toString());
      }
    }

    const dataObservable = this.dataHandler
      .getPaginatedCollection<PaginatedResponse<T>>(`${endpoint}?${params.toString()}`)
      .pipe(shareReplay(1));

    this.pageCache.set(cacheKey, { observable: dataObservable, timestamp: Date.now() });
    return dataObservable;
  }

  /**
   * @description Proactively fetches adjacent pages to improve perceived performance during pagination.
   * @note Respektuje TTL stejně jako `getPaginatedData()` - sousední stránku, která je
   * už čerstvě cachovaná, znovu nestahuje.
   */
  preloadAdjacentPages<T>(
    endpoint: string,
    currentPage: number,
    totalPages: number,
    perPage: number,
    preloadRange: number = 1,
    filters: FilterParams = {}
  ): void {
    const pagesToPreload: number[] = [];

    for (let i = 1; i <= preloadRange; i++) {
      const prevPage = currentPage - i;
      if (prevPage >= 1) pagesToPreload.push(prevPage);

      const nextPage = currentPage + i;
      if (nextPage <= totalPages) pagesToPreload.push(nextPage);
    }

    pagesToPreload.forEach((page) => {
      const cacheKey = this.getCacheKey(endpoint, page, perPage, filters);
      const cached = this.pageCache.get(cacheKey);
      const isFresh = cached && (Date.now() - cached.timestamp) < this.CACHE_TTL_MS;

      if (!isFresh) {
        this.getPaginatedData<T>(endpoint, page, perPage, filters).subscribe({
          error: (err) => console.error(`Failed to preload ${cacheKey}:`, err)
        });
      }
    });
  }

  /**
   * @description Zneplatní VŠECHNY cachované stránky/filtry pro daný endpoint NAPŘÍČ
   * VŠEMI uživateli (napříč všemi kombinacemi page/perPage/filters/userId). Použít po
   * mutaci dat (create/update/delete/restore) nebo tlačítkem "Aktualizovat" na konkrétní
   * tabulce - ENDPOINT-SCOPED, ostatní tabulky zůstávají nedotčené (opravuje starý bug
   * s globálním `clearCache()`).
   * @bugfix-note (2026-08-17) Prefix match upraven na nový formát klíče (viz
   * `getCacheKey()`) - endpoint je pořád první segment, takže logika zůstává funkčně
   * stejná jako předtím, jen se změnil oddělovač.
   */
  invalidateEndpoint(endpoint: string): void {
    const prefix = `${endpoint}|`;
    Array.from(this.pageCache.keys())
      .filter(key => key.startsWith(prefix))
      .forEach(key => this.pageCache.delete(key));
  }

  /**
   * @description Zneplatní ÚPLNĚ CELOU cache napříč všemi endpointy a všemi uživateli -
   * použito globálním refresh tlačítkem v admin headeru (viz TableRefreshBusService) a
   * (jako bezpečnostní opatření, viz bugfix-note 2026-08-17) automaticky při KAŽDÉ změně
   * přihlášeného uživatele - viz `AuthService.persistSession()` / `clearAuthData()`.
   * Samo o sobě nevyvolá žádný síťový dotaz - jen zajistí, že příští čtení (aktuálně
   * otevřené stránky i budoucí navigace) bude vždy reálný fetch, ne stará data.
   */
  invalidateAll(): void {
    this.pageCache.clear();
  }

  /**
   * @description Sestaví cache klíč jednoznačně identifikující kombinaci
   * endpoint + stránkování + filtry + PŘIHLÁŠENÝ UŽIVATEL.
   * @bugfix-note (2026-08-17) Přidán `userId` jako samostatný segment klíče (druhý,
   * hned za endpointem, aby `invalidateEndpoint()` mohl dál fungovat jako prostý prefix
   * match nezávisle na uživateli). Bez tohoto segmentu byla cache sdílená napříč
   * uživateli, viz hlavička souboru - CROSS-USER CACHE LEAK. `|` jako oddělovač místo
   * `-` je záměrná změna proti staršímu formátu, ať se žádný segment (endpoint cesty
   * typicky obsahuje `-`, např. `web-external-links`) nemůže náhodou zaměnit za hranici
   * mezi segmenty.
   */
  private getCacheKey(
    endpoint: string,
    page: number,
    perPage: number,
    filters: FilterParams
  ): string {
    const sortedFilterKeys = Object.keys(filters).sort();
    const normalizedFilters = sortedFilterKeys.reduce((acc, key) => {
      const value = filters[key];
      if (value !== undefined && value !== null && value !== '') {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, any>);

    const userId = this.getCurrentUserIdForCacheKey();
    return `${endpoint}|${userId}|${page}|${perPage}|${JSON.stringify(normalizedFilters)}`;
  }

  /**
   * @description Vrátí ID přihlášeného uživatele pro účely cache klíče, nebo neutrální
   * placeholder, pokud nikdo přihlášený není. Čte přímo `sessionStorage` (stejný klíč,
   * jaký nastavuje `AuthService.persistSession()`), aby nevznikla kruhová DI závislost
   * na `AuthService` (ten sám injektuje `GenericTableService` kvůli `invalidateAll()`
   * při loginu/logoutu - viz auth.service.ts).
   */
  private getCurrentUserIdForCacheKey(): string {
    return sessionStorage.getItem(this.USER_ID_STORAGE_KEY) ?? this.ANONYMOUS_CACHE_SEGMENT;
  }

  /**
   * @description Fetches all available records bypassing standard pagination.
   * @note Beze změny - `no_pagination=true` zůstává mimo cache mechanismus (používá se
   * jen pro export, kde je "vždy čerstvá data" žádoucí, ne cachovaná stránka).
   */
  getAllData<T>(endpoint: string, filters: FilterParams = {}): Observable<T[]> {
    let params = new HttpParams();

    for (const key in filters) {
      const value = filters[key];
      if (value !== undefined && value !== null && value !== '') {
        params = params.append(key, value.toString());
      }
    }

    params = params.append('no_pagination', 'true');
    return this.dataHandler.getCollection<T>(`${endpoint}?${params.toString()}`);
  }
}