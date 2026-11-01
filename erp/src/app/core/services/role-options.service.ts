/**
 * @file role-options.service.ts
 * @path src/app/core/services/role-options.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Light TTL cache of the role list (core/roles) used in select options across the
 * admin (AdministratorsComponent etc.) - separate from GenericTableService, because it is a
 * no_pagination collection, not paginated data.
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

  /** Call after creating / deleting a role on the edit-roles page, so the cache does not show stale data. */
  invalidate(): void {
    this.cached$ = null;
  }
}