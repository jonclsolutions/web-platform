/**
 * @file role-options.service.ts
 * @path src/app/core/services/role-options.service.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Lehká TTL cache pro seznam rolí (core/roles) použitý v select
 * options napříč adminem (AdministratorsComponent aj.) - odděleno od
 * GenericTableService, protože jde o no_pagination kolekci, ne stránkovaná data.
 */

import { Injectable } from '@angular/core';
import { Observable, catchError, shareReplay, throwError } from 'rxjs';
import { DataHandler } from './data-handler.service';

interface RoleOption { id: number; role_name: string; }

@Injectable({ providedIn: 'root' })
export class RoleOptionsService {
  private readonly TTL_MS = 5 * 60 * 1000;
  private cached$: Observable<RoleOption[]> | null = null;
  private cachedAt = 0;

  constructor(private dataHandler: DataHandler) {}

  getRoles(): Observable<RoleOption[]> {
    const isFresh = this.cached$ && (Date.now() - this.cachedAt) < this.TTL_MS;
    if (isFresh) return this.cached$!;

    this.cachedAt = Date.now();
    // @bugfix-note (2026-10-23) A failed load stayed cached for 5 minutes (role select stayed
    // empty / broken) - the cache is reset when the load fails, the next call retries.
    const roles$: Observable<RoleOption[]> = this.dataHandler
      .getCollection<RoleOption>('core/roles?no_pagination=true')
      .pipe(
        catchError(err => {
          if (this.cached$ === roles$) {
            this.cached$ = null;
          }
          return throwError(() => err);
        }),
        shareReplay(1)
      );
    this.cached$ = roles$;
    return roles$;
  }

  /** Zavolat po vytvoření/smazání role na edit-roles stránce, ať se cache neukazuje zastarale. */
  invalidate(): void {
    this.cached$ = null;
  }
}