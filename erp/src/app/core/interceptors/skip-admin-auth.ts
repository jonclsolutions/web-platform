/**
 * @file skip-admin-auth.ts
 * @path src/app/core/interceptors/skip-admin-auth.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Context token of a request that must not carry the admin session: the
 *   AuthTokenInterceptor adds no access token and never refreshes / signs out on its 401. Used by
 *   the requests of a client portal with its own session (e.g. the project portal), whose 401
 *   means "the client is signed out", not "the admin session expired".
 * @usage `publicDataService.get(path, undefined, undefined, SKIP_ADMIN_AUTH_CONTEXT)`
 * @dependencies @angular/common/http
 */

import { HttpContext, HttpContextToken } from '@angular/common/http';

/** @description True = the request is sent without the admin session. */
export const SKIP_ADMIN_AUTH = new HttpContextToken<boolean>(() => false);

/** @description Ready context of such a request. */
export const SKIP_ADMIN_AUTH_CONTEXT = new HttpContext().set(SKIP_ADMIN_AUTH, true);
