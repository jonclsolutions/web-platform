/**
 * @file web-content.service.ts
 * @path src/app/shared/services/web-content.service.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Content of the public website managed in the admin (web/edit-website, tabs FAQ and
 * Jobs): the FAQ (`public/web/faq`) and the open positions (`public/web/jobs`). Every text comes
 * in all languages (`{ cz: '...', en: '...' }`, a language without text has no key); the pages
 * pick the current language with `localizedText()` / `optionalText()`. Each list is loaded once
 * per page load and shared by all components.
 * @note A text missing in the current language shows MISSING_TEXT ('Cannot load text', the same
 * placeholder as the localization services) - the admin warns about every missing translation.
 * @dependencies
 * - PublicDataService: the GET requests (envelope unwrapped).
 */

import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, shareReplay } from 'rxjs/operators';
import { PublicDataService } from './public-data.service';

/** Text per language code. */
export type I18nText = Record<string, string>;

/** Placeholder of a text missing in the current language. */
export const MISSING_TEXT = 'Cannot load text';

/** One FAQ category (tab) with its questions. */
export interface PublicFaqCategory {
  id: number;
  name: I18nText;
  items: { id: number; question: I18nText; answer: I18nText }[];
}

/** One open position with the blocks of its detail. */
export interface PublicJob {
  slug: string;
  title: I18nText;
  summary: I18nText;
  type: I18nText;
  location: I18nText;
  sections: { heading: I18nText; body: I18nText }[];
}

/**
 * @description Text of the current language.
 * @param text Text per language.
 * @param lang Current language code.
 * @returns The text; MISSING_TEXT when the language has none.
 */
export function localizedText(text: I18nText | null | undefined, lang: string): string {
  const value = text?.[lang];
  return typeof value === 'string' && value.trim() !== '' ? value : MISSING_TEXT;
}

/**
 * @description Text of an optional field (heading of a block, type / location of a position).
 * @param text Text per language.
 * @param lang Current language code.
 * @returns null when the field is empty in every language (not shown at all); otherwise as
 *   localizedText().
 */
export function optionalText(text: I18nText | null | undefined, lang: string): string | null {
  const filled = Object.values(text ?? {}).some(value => typeof value === 'string' && value.trim() !== '');
  return filled ? localizedText(text, lang) : null;
}

@Injectable({ providedIn: 'root' })
export class WebContentService {
  private readonly publicData = inject(PublicDataService);

  /** Shared requests (one per page load; a failed one is tried again next time). */
  private faq$: Observable<PublicFaqCategory[]> | null = null;
  private jobs$: Observable<PublicJob[]> | null = null;

  /**
   * @description FAQ categories with their questions in the order of the website.
   * @returns {Observable<PublicFaqCategory[]>} [] when it cannot be loaded.
   */
  faq(): Observable<PublicFaqCategory[]> {
    if (!this.faq$) {
      this.faq$ = this.load<PublicFaqCategory[]>('public/web/faq', () => (this.faq$ = null));
    }
    return this.faq$;
  }

  /**
   * @description Active open positions in the order of the website.
   * @returns {Observable<PublicJob[]>} [] when they cannot be loaded.
   */
  jobs(): Observable<PublicJob[]> {
    if (!this.jobs$) {
      this.jobs$ = this.load<PublicJob[]>('public/web/jobs', () => (this.jobs$ = null));
    }
    return this.jobs$;
  }

  /**
   * @description Loads a list once and shares it; an error gives [] and forgets the request.
   * @param endpoint Public endpoint.
   * @param forget Drops the shared request (after an error).
   */
  private load<T extends unknown[]>(endpoint: string, forget: () => void): Observable<T> {
    return this.publicData.get<T>(endpoint).pipe(
      catchError(() => {
        forget();
        return of([] as unknown as T);
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );
  }
}
