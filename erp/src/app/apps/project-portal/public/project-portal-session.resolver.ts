/**
 * @file project-portal-session.resolver.ts
 * @path src/app/apps/project-portal/public/project-portal-session.resolver.ts
 * @description Runs before /projects/:token. Asks the API (the session is an HttpOnly cookie that
 *   JavaScript cannot read): 200 = the project goes to the component (route data `project`),
 *   401 / any other error = redirect to the login of the same project. `?section=` and `?access=`
 *   survive the redirect. UX only - the API still checks the session on every request.
 */

import { inject } from '@angular/core';
import { RedirectCommand, ResolveFn, Router } from '@angular/router';
import { EMPTY, catchError, of } from 'rxjs';
import { PublicDataService } from '../../../shared/services/public-data.service';
import { SKIP_ADMIN_AUTH_CONTEXT } from '../../../core/interceptors/skip-admin-auth';
import { leaveOnMaintenance } from './maintenance/portal-maintenance';
import type { PublicProject } from './project-portal.component';

/** Query parameters that must survive the redirect to the login. */
const KEPT_QUERY = ['access', 'section'];

export const projectPortalSessionResolver: ResolveFn<PublicProject> = (route) => {
  const router = inject(Router);
  const api = inject(PublicDataService);
  const token = route.paramMap.get('token') ?? '';

  const toLogin = () => {
    const queryParams: Record<string, string> = {};
    for (const key of KEPT_QUERY) {
      const value = route.queryParamMap.get(key);
      if (value) queryParams[key] = value;
    }
    return new RedirectCommand(router.createUrlTree(['/projects/login', token], { queryParams }), { replaceUrl: true });
  };

  // One-time link of an e-mail: it is used on the login page, not here.
  if (route.queryParamMap.has('access')) return toLogin();

  return api.get<PublicProject>(`projects/public/${token}`, undefined, undefined, SKIP_ADMIN_AUTH_CONTEXT).pipe(
    leaveOnMaintenance(router),
    // 503 = the maintenance page is already opening, do not redirect over it.
    catchError(err => (err?.status === 503 ? EMPTY : of(toLogin())))
  );
};