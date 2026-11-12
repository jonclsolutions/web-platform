/**
 * @file legal-route.ts
 * @path src/app/public/legal/legal-route.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description The legal pages (terms of service, privacy policy) are shared by every public
 *   application and shown in its layout: the route says whose translations the page reads
 *   (`data: { translationModule: 'shop' }` in the e-shop; the web by default).
 * @dependencies ActivatedRoute
 */

import { inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

/**
 * @description Translation module of the current legal page route - call in a field
 *   initializer (injection context).
 * @returns 'shop' when the route says so, otherwise 'web'.
 */
export function routeTranslationModule(): 'web' | 'shop' {
  return inject(ActivatedRoute, { optional: true })?.snapshot?.data?.['translationModule'] === 'shop' ? 'shop' : 'web';
}
