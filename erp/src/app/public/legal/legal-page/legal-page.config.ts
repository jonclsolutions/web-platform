/**
 * @file legal-page.config.ts
 * @path src/app/public/legal/legal-page/legal-page.config.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description The legal document pages (privacy policy, terms, cookies policy) are ONE
 *   component shared by every public application. An application adds a page to the children of
 *   its layout with `legalPageRoute('<area>', '<document>')`; the document decides the API slug,
 *   the address, the translation section and the extra paragraphs of the page.
 * @usage `legalPageRoute('web', 'cookies')` → `/…/cookies-policy` with the title
 *   `web.cookies-policy` (row of `legal_page_titles`).
 */

import { Route } from '@angular/router';

/** @description Legal document of a page (slug of GET public/legal/{slug}). */
export type LegalDocumentSlug = 'gdpr' | 'tos' | 'cookies';

/** @description What a legal page shows for its document. */
export interface LegalPageDefinition {
  /** Address of the page below the layout (also the page key of its browser title). */
  path: string;
  /** Section of the public translations with the texts of the page. */
  translationKey: string;
  /** "Change cookie settings" paragraph (reopens the cookie bar). */
  cookieSettings: boolean;
  /** "More information" paragraph linking the privacy policy. */
  privacyLink: boolean;
}

/** @description Pages of the legal documents. */
export const LEGAL_PAGES: Record<LegalDocumentSlug, LegalPageDefinition> = {
  gdpr:    { path: 'privacy-policy', translationKey: 'privacy_policy', cookieSettings: false, privacyLink: false },
  tos:     { path: 'tos',            translationKey: 'tos',            cookieSettings: false, privacyLink: true },
  cookies: { path: 'cookies-policy', translationKey: 'cookies_policy', cookieSettings: true,  privacyLink: true },
};

/** @description Route data key with the document of the page. */
export const LEGAL_DOCUMENT_DATA = 'legalDocument';

/**
 * @description Builds the route of a legal page of a public area.
 * @param area Page title area of the application (`<area>.<path>`).
 * @param slug Document of the page.
 * @param extra More route options.
 * @returns `{ path, title, data: { legalDocument }, loadComponent }`.
 */
export function legalPageRoute(area: string, slug: LegalDocumentSlug, extra: Partial<Route> = {}): Route {
  const { path } = LEGAL_PAGES[slug];
  return {
    path,
    title: `${area}.${path}`,
    data: { [LEGAL_DOCUMENT_DATA]: slug },
    loadComponent: () => import('./legal-page.component').then(m => m.LegalPageComponent),
    ...extra,
  };
}
