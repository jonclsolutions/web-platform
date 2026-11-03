/**
 * @file upload-rules.service.ts
 * @path src/app/shared/services/upload-rules.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Loads the attachment rules of every upload profile ONCE from the API
 *   (`GET upload-rules`) and shares them with every form (public web, customer portal, admin).
 * @note When the API cannot be reached the rules are null - the forms then check nothing
 *   themselves and the API refuses a wrong file on submit (it validates every upload anyway).
 * @dependencies
 * - HttpClient: the public, unauthenticated endpoint (no error toast of DataHandler).
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../interfaces/api-envelope';
import { UploadProfile, UploadRule } from '../utils/upload-rules';

@Injectable({ providedIn: 'root' })
export class UploadRulesService {
  private http = inject(HttpClient);

  /** @description All profiles, requested at the first use and cached for the whole session. */
  private readonly all$: Observable<Partial<Record<UploadProfile, UploadRule>>> = this.http
    .get<ApiEnvelope<Partial<Record<UploadProfile, UploadRule>>>>(`${environment.base_api_url}/upload-rules`)
    .pipe(
      map(res => res?.data ?? {}),
      catchError(() => of({})),
      shareReplay({ bufferSize: 1, refCount: false })
    );

  /**
   * @description Rules of one profile.
   * @param profile Upload profile, e.g. 'sales_order'.
   * @returns {Observable<UploadRule | null>} Null when the rules are not available.
   */
  rules(profile: UploadProfile): Observable<UploadRule | null> {
    return this.all$.pipe(map(all => all[profile] ?? null));
  }
}
