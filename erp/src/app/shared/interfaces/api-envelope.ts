/**
 * @file api-envelope.ts
 * @path src/app/shared/interfaces/api-envelope.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026-10-24
 * @description Types of the ONE response envelope of the Laravel API (open finding #6,
 *   `App\Traits\RespondsWithData`): every successful answer with a payload is
 *   `{ data, meta?, message? }`; a paginated list carries the pagination in `meta`.
 *   Errors are not wrapped (`{ message, errors? }`, read from `HttpErrorResponse.error`).
 */

/** @description Pagination of a list page (`meta` of a paginated answer). */
export interface PageMeta {
  total: number;
  per_page: number;
  current_page: number;
  last_page: number;
  [key: string]: unknown;
}

/** @description A successful answer: payload in `data`, extra information in `meta`. */
export interface ApiEnvelope<T, M = Record<string, any>> {
  data: T;
  meta?: M;
  message?: string;
}

/** @description One page of a list: items in `data`, pagination in `meta`. */
export interface ApiPage<T> extends ApiEnvelope<T[], PageMeta> {
  meta: PageMeta;
}
