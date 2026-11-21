/**
 * @file icon-set.service.ts
 * @path src/app/apps/js-creator/admin/shared/icon-set.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description The icon set of JS Creator (assets/icons/icons.json - Lucide, ISC), loaded once.
 * @dependencies HttpClient (static JSON).
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, shareReplay } from 'rxjs/operators';
import { IconSet } from './js-creator.models';
import { JS_CREATOR_ASSETS } from './js-creator-assets';

@Injectable({ providedIn: 'root' })
export class IconSetService {
  private readonly http = inject(HttpClient);

  /** The set (empty when the file cannot be read). */
  private readonly set$: Observable<IconSet> = this.http.get<IconSet>(`${JS_CREATOR_ASSETS}/icons/icons.json`).pipe(
    catchError(() => of({ source: '', license: '', viewBox: '0 0 24 24', icons: {} } as IconSet)),
    shareReplay({ bufferSize: 1, refCount: false })
  );

  /** @description The icon set. */
  iconSet(): Observable<IconSet> {
    return this.set$;
  }
}
